"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { Nav } from "../../components/Nav";
import { useMerchant } from "../../components/useMerchant";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI, PER_TX_CAP_USDC } from "../../lib/contract";
import { fetchUsdcInrRate } from "../../lib/rates";
import dynamic from "next/dynamic";

const INTEGRATOR = CONTRACT_ADDRESS;
const SCAN = "https://sepolia.basescan.org";

// The p2p widget touches the DOM at import time — load it client-side only so
// Next.js doesn't try to prerender it on the server.
const CheckoutWidget = dynamic(
  () => import("../../components/CheckoutWidget").then((m) => m.CheckoutWidget),
  { ssr: false }
);

export default function PosQr() {
  const { ready, address } = useMerchant();

  const [inr, setInr] = useState(""); // merchant types rupees
  const [rate, setRate] = useState(null); // { rate, source, at }
  const [error, setError] = useState("");
  // The p2p widget handles pubkey + circle + the place→pay→complete flow.
  const [liveWidget, setLiveWidget] = useState(null); // {usdcAmount, quantity, inr}
  const [done, setDone] = useState(null); // {orderId, usdc, inr} — real on-chain proof

  // Merchant label = their on-chain UPI (read via getMerchantInfo). No off-chain store.
  const { data: info } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantInfo",
    args: [address],
    query: { enabled: !!address },
  });
  const shopLabel = info?.[1] || ""; // [0]=upi, [1]=shopName

  const { data: daily, refetch: refetchDaily } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getDailyTxInfo",
    args: [address],
    query: { enabled: !!address, refetchInterval: 20000 },
  });
  const [used, limit] = daily ?? [0n, 4n];
  const limitReached = daily ? used >= limit : false;

  // live rate: fetch on mount, refresh every 60s
  useEffect(() => {
    let alive = true;
    const load = () => fetchUsdcInrRate().then((r) => alive && setRate(r));
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);


  const inrNum = Number(inr) || 0;
  const usdcEquiv = rate && inrNum > 0 ? inrNum / rate.rate : 0;
  const overCap = usdcEquiv > PER_TX_CAP_USDC;

  function generate() {
    setError("");
    if (!rate) return;
    if (inrNum <= 0) return setError("Enter the amount in rupees.");
    if (overCap) {
      return setError(
        `Max ${PER_TX_CAP_USDC} USDC per transaction (≈ ₹${Math.floor(
          PER_TX_CAP_USDC * rate.rate
        )} at the current rate).`
      );
    }
    // product 2 is priced at 0.01 USDC/unit -> quantity = usdc cents
    const quantity = BigInt(Math.round(usdcEquiv * 100));
    if (quantity === 0n) return setError("Amount too small.");

    // The p2p widget generates the user pubkey, auto-selects the INR circle via
    // the subgraph, and drives place → accept → pay → complete on Base Sepolia.
    setLiveWidget({
      usdcAmount: BigInt(Math.round(usdcEquiv * 1e6)),
      quantity,
      inr: inrNum,
      usdc: usdcEquiv,
    });
  }

  return (
    <>
      <Nav />
      <div className="container">
        <h1>POS — New sale{shopLabel ? ` · ${shopLabel}` : ""}</h1>
        <p className="muted">
          Type the bill amount in rupees. The customer scans the QR with any
          UPI app and pays that exact amount.
        </p>
        <div className="testnote">
          🧪 Testing phase — no real INR needed; this is a test payment on Base Sepolia.
        </div>

        {liveWidget && (
          <>
            <p className="testnote">
              🧪 Test payment — scanning this QR does not move real money.
            </p>
            <CheckoutWidget
              usdcAmount={liveWidget.usdcAmount}
              quantity={liveWidget.quantity}
              productName={shopLabel || "P2P Terminal sale"}
              onComplete={(orderId) => {
                // History comes from the subgraph (auto-indexed) — no DB write.
                setDone({ orderId: String(orderId), usdc: liveWidget.usdc, inr: liveWidget.inr });
                setLiveWidget(null);
                setInr("");
                refetchDaily();
              }}
              onCancel={() => {
                setLiveWidget(null);
                setInr("");
                refetchDaily();
              }}
              onClose={() => setLiveWidget(null)}
            />
          </>
        )}

        {/* On-chain proof card — real, Basescan-verifiable */}
        {done && (
          <div className="panel proof">
            <h2 className="success" style={{ fontSize: 22 }}>✓ Payment received & settled</h2>
            <p className="muted">
              ₹{done.inr} received — {done.usdc.toFixed(2)} USDC locked on-chain,
              withdrawable as INR or USDC after the settlement period.
            </p>

            <div className="proof-grid">
              <div><span className="muted">Order</span><strong>#{done.orderId}</strong></div>
              <div><span className="muted">Amount</span><strong>{done.usdc.toFixed(2)} USDC</strong></div>
            </div>

            <div className="proof-links">
              <a className="btn small" target="_blank" rel="noopener noreferrer"
                 href={`${SCAN}/address/${INTEGRATOR}`}>
                View settlement contract ↗
              </a>
              <a className="btn small secondary" target="_blank" rel="noopener noreferrer"
                 href={`${SCAN}/address/${address}`}>
                View merchant wallet ↗
              </a>
              <button className="btn small secondary"
                onClick={() => navigator.clipboard.writeText(done.orderId)}>
                Copy order #
              </button>
            </div>

            <button className="btn" style={{ marginTop: 8 }} onClick={() => setDone(null)}>
              Next sale
            </button>
          </div>
        )}

        {limitReached && !liveWidget && !done && (
          <div className="panel">
            <h2>🚫 Daily limit reached ({String(used)}/{String(limit)})</h2>
            <p className="muted">
              You have used all transactions for today. The limit resets at
              midnight UTC — please try tomorrow.
            </p>
          </div>
        )}

        {!limitReached && !liveWidget && !done && (
          <div className="panel" style={{ maxWidth: 460 }}>
            <div className="field">
              <label>Bill amount (₹ rupees)</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="200"
                value={inr}
                onChange={(e) => setInr(e.target.value)}
              />
            </div>

            <div className="panel" style={{ padding: 14, marginTop: 0, marginBottom: 14 }}>
              {rate ? (
                <>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">You will receive (locked)</span>
                    <strong style={{ color: "var(--accent)" }}>
                      {inrNum > 0 ? `${usdcEquiv.toFixed(2)} USDC` : "—"}
                    </strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                    <span className="muted">Rate ({rate.source})</span>
                    <span>1 USDC = ₹{rate.rate.toFixed(2)}</span>
                  </div>
                  {overCap && (
                    <p className="error" style={{ marginTop: 8 }}>
                      Over the 50 USDC per-sale cap — max ₹
                      {Math.floor(PER_TX_CAP_USDC * rate.rate)} per QR.
                    </p>
                  )}
                </>
              ) : (
                <span className="muted">Fetching live rate…</span>
              )}
            </div>

            <p className="muted" style={{ marginBottom: 12 }}>
              {String(used)} of {String(limit)} transactions used today
            </p>
            <button
              className="btn"
              disabled={!ready || !rate || inrNum <= 0 || overCap}
              onClick={generate}
            >
              Generate payment QR
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </div>
    </>
  );
}

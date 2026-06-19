"use client";

import { useState, useEffect } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import { encodeFunctionData } from "viem";
import { Nav } from "../../components/Nav";
import { useMerchant } from "../../components/useMerchant";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI, fmtUsdc } from "../../lib/contract";
import { resolveInrCircleId } from "../../lib/p2p";

function fmtRemaining(secs) {
  if (secs <= 0) return "ready";
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.ceil(secs / 60)} min`;
  if (secs < 86400) return `${Math.ceil(secs / 3600)} hr`;
  return `${Math.ceil(secs / 86400)} days`;
}

export default function Withdraw() {
  const { ready, address, sendTransaction } = useMerchant();
  const publicClient = usePublicClient();

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [upiMode, setUpiMode] = useState("saved"); // "saved" | "new"
  const [newUpi, setNewUpi] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Tick every second for the live countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Locked buckets (for the unlock countdown).
  const { data: buckets } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantBuckets",
    args: [address],
    query: { enabled: !!address, refetchInterval: 15000 },
  });
  const lockedBuckets = (buckets || []).filter(
    (b) => b.amount > 0n && Number(b.unlockTimestamp) > now
  );

  const { data: balance, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantBalance",
    args: [address],
    query: { enabled: !!address, refetchInterval: 20000 },
  });
  const { data: info } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantInfo",
    args: [address],
    query: { enabled: !!address },
  });
  const savedUpi = info?.[0] || "";
  const [pending, available] = balance ?? [0n, 0n];
  const availNum = Number(available) / 1e6;
  const amtNum = Number(amount) || 0;
  const overBalance = amtNum > availNum;

  async function withdraw(kind) {
    setError("");
    setDone("");
    if (amtNum <= 0) return setError("Enter an amount.");
    if (overBalance) return setError("Amount exceeds your available balance.");

    // For INR, validate the chosen UPI.
    const upiOverride = kind === "inr" && upiMode === "new" ? newUpi.trim() : "";
    if (kind === "inr") {
      const target = upiOverride || savedUpi;
      if (!target.includes("@")) return setError("Enter a valid UPI ID (like name@bank).");
    }

    const raw = BigInt(Math.round(amtNum * 1e6));
    setBusy(true);
    try {
      // INR: pass circleId (resolved off-chain) + the UPI override (empty =
      // use the saved UPI on-chain).
      const args =
        kind === "usdc"
          ? [raw]
          : [raw, await resolveInrCircleId(), upiOverride];
      const data = encodeFunctionData({
        abi: INTEGRATOR_ABI,
        functionName: kind === "usdc" ? "withdrawUSDC" : "withdrawINR",
        args,
      });
      const hash = await sendTransaction({ to: CONTRACT_ADDRESS, data });
      await publicClient.waitForTransactionReceipt({ hash });
      setDone(
        kind === "usdc"
          ? `${amtNum.toFixed(2)} USDC sent to your wallet.`
          : `${amtNum.toFixed(2)} USDC withdrawal to INR started — paid to your UPI after the LP settles.`
      );
      setAmount("");
      refetch();
    } catch (err) {
      console.error(err);
      setError(err.shortMessage || err.message || "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <div className="container">
        <h1>Withdraw</h1>
        <p className="muted">
          Settled funds unlock after the settlement period. Withdraw available
          USDC to your wallet, or as INR to your saved UPI.
        </p>

        <div className="cards">
          <div className="card available">
            <div className="label">Available now</div>
            <div className="value">{fmtUsdc(available)} USDC</div>
            <div className="sub">ready to withdraw</div>
          </div>
          <div className="card pending">
            <div className="label">Still locked</div>
            <div className="value">{fmtUsdc(pending)} USDC</div>
            <div className="sub">unlocks after settlement</div>
          </div>
        </div>

        {/* Per-sale unlock countdown */}
        {lockedBuckets.length > 0 && (
          <div className="panel" style={{ maxWidth: 460 }}>
            <h2 style={{ marginTop: 0 }}>Unlocking soon</h2>
            {lockedBuckets.map((b, i) => {
              const secs = Number(b.unlockTimestamp) - now;
              return (
                <div key={i} className="row" style={{ justifyContent: "space-between", padding: "6px 0" }}>
                  <span>{fmtUsdc(b.amount)} USDC</span>
                  <span className="badge locked">unlocks in {fmtRemaining(secs)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="panel" style={{ maxWidth: 460 }}>
          <div className="field">
            <label>Amount (USDC)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Max {availNum.toFixed(2)} USDC
              </span>
              <button
                className="btn secondary small"
                type="button"
                onClick={() => setAmount(availNum.toFixed(2))}
              >
                Max
              </button>
            </div>
          </div>

          {overBalance && (
            <p className="error">Amount exceeds your available balance.</p>
          )}

          {/* INR payout UPI: use the saved one, or send to a different UPI */}
          <div className="field" style={{ marginTop: 6 }}>
            <label>INR payout UPI</label>
            <div className="row" style={{ gap: 16, marginBottom: 8 }}>
              <label className="row" style={{ gap: 6, cursor: "pointer" }}>
                <input type="radio" name="upi" checked={upiMode === "saved"}
                  onChange={() => setUpiMode("saved")} />
                <span style={{ fontSize: 13 }}>Saved{savedUpi ? ` (${savedUpi})` : ""}</span>
              </label>
              <label className="row" style={{ gap: 6, cursor: "pointer" }}>
                <input type="radio" name="upi" checked={upiMode === "new"}
                  onChange={() => setUpiMode("new")} />
                <span style={{ fontSize: 13 }}>Different UPI</span>
              </label>
            </div>
            {upiMode === "new" && (
              <input
                className="input"
                placeholder="name@bank"
                value={newUpi}
                onChange={(e) => setNewUpi(e.target.value)}
              />
            )}
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn"
              disabled={busy || !ready || amtNum <= 0 || overBalance}
              onClick={() => withdraw("usdc")}
            >
              {busy ? "Working…" : "Withdraw USDC → wallet"}
            </button>
            <button
              className="btn dark"
              disabled={busy || !ready || amtNum <= 0 || overBalance}
              onClick={() => withdraw("inr")}
            >
              {busy ? "Working…" : "Withdraw INR → UPI"}
            </button>
          </div>

          {error && <p className="error">{error}</p>}
          {done && <p className="success">✓ {done}</p>}
        </div>
      </div>
    </>
  );
}

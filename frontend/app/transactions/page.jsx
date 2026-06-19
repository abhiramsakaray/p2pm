"use client";

import { useEffect, useState, useCallback } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import { encodeFunctionData } from "viem";
import { Nav } from "../../components/Nav";
import { useMerchant } from "../../components/useMerchant";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI, fmtUsdc } from "../../lib/contract";
import { resolveInrCircleId } from "../../lib/p2p";
import { fetchHistory } from "../../lib/history";

// Subgraph order status -> badge style + label
const STATUS_STYLE = { matching: "locked", settled: "available", cancelled: "withdrawn" };
const STATUS_LABEL = { matching: "Matching…", settled: "Settled", cancelled: "Cancelled" };

const SCAN = "https://sepolia.basescan.org";

export default function Transactions() {
  const { ready, address, sendTransaction } = useMerchant();
  const publicClient = usePublicClient();

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // Withdrawable balance comes live from the contract (the buckets / 10-min lock
  // are contract state, not order state).
  const { data: balance, refetch: refetchBal } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantBalance",
    args: [address],
    query: { enabled: !!address, refetchInterval: 20000 },
  });
  const [pending, available] = balance ?? [0n, 0n];
  const availNum = Number(available) / 1e6;

  // History list comes from the subgraph — no database.
  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      setRows(await fetchHistory(address));
    } catch (e) {
      console.error(e);
    }
  }, [address]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  async function withdraw(kind) {
    setError("");
    setDone("");
    if (availNum <= 0) return setError("Nothing available to withdraw yet.");
    setBusy(kind);
    try {
      const raw = available; // withdraw the full available balance
      const args =
        kind === "INR" ? [raw, await resolveInrCircleId(), ""] : [raw];
      const data = encodeFunctionData({
        abi: INTEGRATOR_ABI,
        functionName: kind === "INR" ? "withdrawINR" : "withdrawUSDC",
        args,
      });
      const hash = await sendTransaction({ to: CONTRACT_ADDRESS, data });
      await publicClient.waitForTransactionReceipt({ hash });
      setDone(
        kind === "USDC"
          ? `${availNum.toFixed(2)} USDC sent to your wallet.`
          : `INR withdrawal started for ${availNum.toFixed(2)} USDC — paid to your UPI once the LP settles.`
      );
      refetchBal();
      refresh();
    } catch (err) {
      console.error(err);
      setError(err.shortMessage || err.message || "Withdrawal failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Nav />
      <div className="container">
        <h1>Transactions</h1>

        {/* Withdrawable balance + actions (live from the contract) */}
        <div className="panel" style={{ maxWidth: 520 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Available to withdraw</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtUsdc(available)} USDC</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {fmtUsdc(pending)} USDC still locked (settling)
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy || !ready || availNum <= 0} onClick={() => withdraw("USDC")}>
              {busy === "USDC" ? "Working…" : "Withdraw USDC → wallet"}
            </button>
            <button className="btn dark" disabled={busy || !ready || availNum <= 0} onClick={() => withdraw("INR")}>
              {busy === "INR" ? "Working…" : "Withdraw INR → UPI"}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {done && <p className="success">✓ {done}</p>}
        </div>

        <h2 style={{ marginTop: 22 }}>History</h2>
        <p className="muted" style={{ fontSize: 13 }}>Every sale, indexed on-chain.</p>

        {!ready ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="panel">
            <p className="muted">No transactions yet — make your first sale from the POS page.</p>
          </div>
        ) : (
          <div className="panel" style={{ padding: 8, overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Proof</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr key={tx.orderId}>
                    <td>{new Date(tx.createdAt).toLocaleString()}</td>
                    <td>#{tx.orderId}</td>
                    <td>{fmtUsdc(tx.amount)} USDC</td>
                    <td>
                      <span className={`badge ${STATUS_STYLE[tx.status] || "withdrawn"}`}>
                        {STATUS_LABEL[tx.status] || tx.status}
                      </span>
                    </td>
                    <td>
                      {tx.txHash ? (
                        <a href={`${SCAN}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
                           style={{ color: "var(--accent)", fontSize: 12 }}>
                          Basescan ↗
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

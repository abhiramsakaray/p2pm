"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { Nav } from "../../components/Nav";
import { useMerchant } from "../../components/useMerchant";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI, fmtUsdc } from "../../lib/contract";
import { fetchUsdcInrRate } from "../../lib/rates";

export default function Dashboard() {
  const { ready, address } = useMerchant();
  const [rate, setRate] = useState(null);

  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantBalance",
    args: [address],
    query: { enabled: !!address, refetchInterval: 20000 },
  });

  const { data: daily } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getDailyTxInfo",
    args: [address],
    query: { enabled: !!address, refetchInterval: 20000 },
  });

  useEffect(() => {
    let on = true;
    fetchUsdcInrRate().then((r) => on && setRate(r)).catch(() => {});
    return () => { on = false; };
  }, []);

  const [pending, available, , isFrozen] = balance ?? [0n, 0n, 0n, false];
  const [used, limit] = daily ?? [0n, 4n];
  const availUsdc = Number(available) / 1e6;
  const inrEquiv = rate ? availUsdc * rate.rate : null;

  return (
    <>
      <Nav />
      <div className="screen">
        {isFrozen && (
          <div className="frozen-banner">
            ⚠ Account frozen — payments and withdrawals are paused. Contact support.
          </div>
        )}

        {/* Centered balance hero (p2p.me style) */}
        <div className="balance">
          <div className="balance-label">Available Balance</div>
          <div className="balance-amount">${availUsdc.toFixed(2)}</div>
          <div className="balance-sub">
            {inrEquiv != null ? `≈ ₹${inrEquiv.toFixed(2)}` : "≈ ₹—"}
          </div>
        </div>

        {/* round action icons */}
        <div className="quick">
          <Link className="quick-item" href="/qr">
            <span className="quick-ico">🧾</span>
            <span>New Sale</span>
          </Link>
          <Link className="quick-item" href="/withdraw">
            <span className="quick-ico">↑</span>
            <span>Withdraw</span>
          </Link>
          <Link className="quick-item" href="/transactions">
            <span className="quick-ico">⇄</span>
            <span>History</span>
          </Link>
          <a className="quick-item" href="mailto:support@p2pm.app">
            <span className="quick-ico dark">☎</span>
            <span>Support</span>
          </a>
        </div>

        {/* info strip */}
        <div className="strip">
          <div>
            <span className="muted">Locked (settling)</span>
            <strong>{fmtUsdc(pending)} USDC</strong>
          </div>
          <div>
            <span className="muted">Today’s sales</span>
            <strong>{String(used)} / {String(limit)}</strong>
          </div>
        </div>

        {!ready && <p className="muted" style={{ textAlign: "center" }}>Loading…</p>}
      </div>

      {/* bottom action bar (p2p.me style) */}
      <div className="bottombar">
        <Link className="btn" href="/qr" style={{ flex: 1, textAlign: "center" }}>
          + New Sale
        </Link>
        <Link className="btn dark" href="/withdraw" style={{ flex: 1, textAlign: "center" }}>
          Withdraw
        </Link>
      </div>
    </>
  );
}

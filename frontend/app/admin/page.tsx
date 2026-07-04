"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { isAddress } from "viem";
import { useAdmin } from "../../components/useAdmin";
import { ADMIN_MOCK } from "../../lib/admin-config";
import type { MockMerchantResponse } from "../../lib/admin-mock";
import { MOCK_DEMO_ADDRESSES } from "../../lib/admin-mock";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI, fmtUsdc } from "../../lib/contract";
import { useT } from "../../lib/i18n";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useT();
  const { ready, isAdmin, writeAdmin, logout } = useAdmin();

  const [query, setQuery] = useState("");
  const [merchant, setMerchant] = useState<`0x${string}` | "">("");
  const [mockData, setMockData] = useState<MockMerchantResponse | null>(null);
  const [mockLoading, setMockLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/admin/login");
  }, [ready, isAdmin, router]);

  const lookup = merchant && isAddress(merchant) ? merchant : undefined;

  const loadMockMerchant = useCallback(async (addr: `0x${string}`) => {
    setMockLoading(true);
    try {
      const res = await fetch(`/api/admin/merchant?address=${addr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load merchant");
      setMockData(data);
    } catch (e: any) {
      setMockData(null);
      setError(e?.message || t("admin.txFailed"));
    } finally {
      setMockLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (ADMIN_MOCK && lookup && isAdmin) loadMockMerchant(lookup);
  }, [lookup, isAdmin, loadMockMerchant]);

  const { data: info, refetch: refetchInfo } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantInfo",
    args: [lookup!],
    query: { enabled: !!lookup && !ADMIN_MOCK },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantBalance",
    args: [lookup!],
    query: { enabled: !!lookup && !ADMIN_MOCK, refetchInterval: 20000 },
  });

  const { data: currency } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "getMerchantCurrency",
    args: [lookup!],
    query: { enabled: !!lookup && !ADMIN_MOCK },
  });

  const chainRegistered = info?.[3] ?? false;
  const chainFrozen = info?.[4] ?? false;
  const chainShopName = info?.[1] ?? "";
  const chainPayoutId = info?.[0] ?? "";
  const chainPending = balance?.[0] ?? 0n;
  const chainAvailable = balance?.[1] ?? 0n;
  const chainTotalDeposited = balance?.[2] ?? 0n;

  const isRegistered = ADMIN_MOCK ? !!mockData?.isRegistered : chainRegistered;
  const isFrozen = ADMIN_MOCK ? !!mockData?.isRegistered && mockData.isFrozen : chainFrozen;
  const shopName = ADMIN_MOCK && mockData?.isRegistered ? mockData.shopName : chainShopName;
  const payoutId = ADMIN_MOCK && mockData?.isRegistered ? mockData.payoutId : chainPayoutId;
  const pending = ADMIN_MOCK && mockData?.isRegistered ? BigInt(mockData.pending) : chainPending;
  const available = ADMIN_MOCK && mockData?.isRegistered ? BigInt(mockData.available) : chainAvailable;
  const totalDeposited =
    ADMIN_MOCK && mockData?.isRegistered ? BigInt(mockData.totalDeposited) : chainTotalDeposited;
  const currencyLabel =
    ADMIN_MOCK && mockData?.isRegistered ? mockData.currency : currency || "—";

  function search() {
    setError("");
    setOk("");
    setMockData(null);
    const trimmed = query.trim();
    if (!isAddress(trimmed)) {
      setError(t("admin.invalidAddr"));
      return;
    }
    setMerchant(trimmed as `0x${string}`);
  }

  async function act(kind: "freeze" | "unfreeze") {
    if (!lookup) return;
    setError("");
    setOk("");
    setBusy(kind);
    try {
      const fn = kind === "freeze" ? "freezeMerchant" : "unfreezeMerchant";
      await writeAdmin(fn, [lookup]);
      setOk(kind === "freeze" ? t("admin.frozenOk") : t("admin.unfrozenOk"));
      if (ADMIN_MOCK) await loadMockMerchant(lookup);
      else await Promise.all([refetchInfo(), refetchBalance()]);
    } catch (e: any) {
      setError(e?.message || t("admin.txFailed"));
    } finally {
      setBusy("");
    }
  }

  if (!ready || !isAdmin) {
    return (
      <div className="screen">
        <p className="muted" style={{ textAlign: "center" }}>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="screen">
      {ADMIN_MOCK && (
        <div className="panel" style={{ padding: 12, marginBottom: 16, borderColor: "var(--accent)" }}>
          <p style={{ fontSize: 13, marginBottom: 8 }}>{t("admin.mockMode")}</p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.mockMerchants")}</p>
          {MOCK_DEMO_ADDRESSES.map((addr) => (
            <button
              key={addr}
              type="button"
              className="btn ghost small"
              style={{ display: "block", width: "100%", textAlign: "left", fontFamily: "monospace", fontSize: 11, marginBottom: 4 }}
              onClick={() => {
                setQuery(addr);
                setError("");
                setOk("");
                setMockData(null);
                setMerchant(addr as `0x${string}`);
              }}
            >
              {addr}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{t("admin.title")}</h1>
          <p className="muted" style={{ fontSize: 13 }}>{t("admin.subtitle")}</p>
        </div>
        <button className="btn ghost small" onClick={logout}>{t("admin.logout")}</button>
      </div>

      <div className="field">
        <label>{t("admin.merchantAddr")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="0x…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button className="btn secondary" onClick={search} disabled={!!busy || mockLoading}>
            {mockLoading ? t("admin.working") : t("admin.search")}
          </button>
        </div>
      </div>

      {lookup && (
        <div className="panel" style={{ padding: 18, marginTop: 8 }}>
          {mockLoading ? (
            <p className="muted">{t("common.loading")}</p>
          ) : !isRegistered ? (
            <p className="muted">{t("admin.notRegistered")}</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{shopName || "—"}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{payoutId}</div>
                </div>
                <span className={`badge ${isFrozen ? "locked" : "available"}`}>
                  {isFrozen ? t("admin.statusFrozen") : t("admin.statusActive")}
                </span>
              </div>

              <div className="cards" style={{ margin: "14px 0" }}>
                <div className="card available">
                  <div className="label">{t("dash.available")}</div>
                  <div className="value">{fmtUsdc(available)}</div>
                  <div className="sub">USDC</div>
                </div>
                <div className="card pending">
                  <div className="label">{t("dash.waitingClear")}</div>
                  <div className="value">{fmtUsdc(pending)}</div>
                  <div className="sub">USDC</div>
                </div>
              </div>

              <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                {t("admin.currency")}: {currencyLabel} · {t("admin.totalDeposited")}: {fmtUsdc(totalDeposited)} USDC
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn"
                  style={{ flex: 1, background: "var(--danger)" }}
                  disabled={!!busy || isFrozen}
                  onClick={() => act("freeze")}
                >
                  {busy === "freeze" ? t("admin.working") : t("admin.freeze")}
                </button>
                <button
                  className="btn secondary"
                  style={{ flex: 1 }}
                  disabled={!!busy || !isFrozen}
                  onClick={() => act("unfreeze")}
                >
                  {busy === "unfreeze" ? t("admin.working") : t("admin.unfreeze")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p style={{ color: "var(--danger)", marginTop: 14, fontSize: 14 }}>{error}</p>}
      {ok && <p style={{ color: "var(--success)", marginTop: 14, fontSize: 14 }}>{ok}</p>}

      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        {ADMIN_MOCK ? t("admin.mockHint") : t("admin.hint")}
      </p>
    </div>
  );
}

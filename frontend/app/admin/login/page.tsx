"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "../../../components/useAdmin";
import { ADMIN_MOCK } from "../../../lib/admin-config";
import { useT } from "../../../lib/i18n";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useT();
  const { ready, isAdmin } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && isAdmin) router.replace("/admin");
  }, [ready, isAdmin, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.loginFailed"));
      router.replace("/admin");
    } catch (err: any) {
      setError(err.message || t("admin.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="screen">
        <p className="muted" style={{ textAlign: "center" }}>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="screen" style={{ maxWidth: 400, paddingTop: 48 }}>
      {ADMIN_MOCK && (
        <div className="panel" style={{ padding: 12, marginBottom: 16, borderColor: "var(--accent)" }}>
          <p style={{ fontSize: 13, marginBottom: 4 }}>{t("admin.mockMode")}</p>
          <p className="muted" style={{ fontSize: 12 }}>{t("admin.mockLogin")}</p>
        </div>
      )}
      <h1 style={{ marginBottom: 6 }}>{t("admin.title")}</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>{t("admin.loginSubtitle")}</p>

      <form onSubmit={onSubmit} className="panel" style={{ padding: 20 }}>
        <div className="field">
          <label>{t("admin.username")}</label>
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label>{t("admin.password")}</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</p>}
        <button className="btn" type="submit" disabled={busy || !username || !password} style={{ width: "100%" }}>
          {busy ? t("admin.working") : t("admin.login")}
        </button>
      </form>
    </div>
  );
}

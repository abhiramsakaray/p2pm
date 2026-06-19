"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export default function Login() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) router.replace("/dashboard");
  }, [ready, authenticated, router]);

  return (
    <div className="center">
      <div className="panel" style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>◆</div>
        <h1 style={{ fontSize: 30 }}>P2PM Terminal</h1>
        <p className="muted" style={{ margin: "10px auto 22px", maxWidth: 360 }}>
          Accept UPI payments from customers, settle in USDC on Base. Log in with
          your email to open your merchant dashboard.
        </p>
        <button className="btn" disabled={!ready} onClick={login} style={{ width: "100%" }}>
          {ready ? "Continue with Email" : "Loading…"}
        </button>
      </div>
    </div>
  );
}

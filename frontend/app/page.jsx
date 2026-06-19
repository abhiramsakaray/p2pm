"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export default function Home() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    if (!ready) return;
    router.replace(authenticated ? "/dashboard" : "/login");
  }, [ready, authenticated, router]);

  return (
    <div className="center">
      <p className="muted">Loading…</p>
    </div>
  );
}

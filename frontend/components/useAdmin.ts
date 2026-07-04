"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAdmin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session");
      const data = await res.json();
      setIsAdmin(!!data.ok);
    } catch {
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function writeAdmin(
    functionName: "freezeMerchant" | "unfreezeMerchant",
    args: [`0x${string}`]
  ) {
    const action = functionName === "freezeMerchant" ? "freeze" : "unfreeze";
    const res = await fetch("/api/admin/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant: args[0], action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Transaction failed");
    return data.hash as string;
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAdmin(false);
    router.replace("/admin/login");
  }

  return { ready, isAdmin, writeAdmin, logout, refresh };
}

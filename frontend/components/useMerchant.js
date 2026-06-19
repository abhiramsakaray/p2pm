"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI } from "../lib/contract";
import { useSmartAccount } from "./useSmartAccount";

/**
 * Shared page guard: requires Privy auth + on-chain registration.
 * Redirects to /login when logged out, /onboarding when unregistered.
 *
 * The merchant's on-chain identity is their Privy SMART WALLET (gas sponsored),
 * NOT the embedded EOA — so `address` here is the smart wallet address.
 */
export function useMerchant({ requireRegistered = true } = {}) {
  const router = useRouter();
  const { ready: privyReady, authenticated } = usePrivy();
  const { address, ready: saReady, sendTransaction } = useSmartAccount();

  const { data: isRegistered, isLoading: regLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INTEGRATOR_ABI,
    functionName: "registered",
    args: [address],
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (privyReady && !authenticated) router.replace("/login");
  }, [privyReady, authenticated, router]);

  // Onboarding awaits the on-chain registration before routing here, so
  // `registered` is already true — a simple guard, no off-chain flag needed.
  useEffect(() => {
    if (requireRegistered && address && !regLoading && isRegistered === false) {
      router.replace("/onboarding");
    }
  }, [requireRegistered, address, regLoading, isRegistered, router]);

  return {
    ready: saReady && !regLoading,
    authenticated,
    address,
    isRegistered,
    refetchRegistered: refetch,
    sendTransaction,
  };
}

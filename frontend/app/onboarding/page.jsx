"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicClient } from "wagmi";
import { encodeFunctionData } from "viem";
import { useMerchant } from "../../components/useMerchant";
import { CONTRACT_ADDRESS, INTEGRATOR_ABI } from "../../lib/contract";

/**
 * One-field setup: the merchant enters their UPI ID, which is registered
 * ON-CHAIN (registerMerchant). Gas is sponsored, so there are no wallet popups.
 * Nothing is stored off-chain — the UPI is the merchant's profile, read back
 * via getMerchantInfo.
 */
export default function Onboarding() {
  const router = useRouter();
  const { ready, address, isRegistered, sendTransaction } = useMerchant({
    requireRegistered: false,
  });
  const publicClient = usePublicClient();

  const [upiId, setUpiId] = useState("");
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (ready && isRegistered) {
    router.replace("/dashboard");
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!shopName.trim()) {
      setError("Enter your shop name.");
      return;
    }
    if (!upiId.trim().includes("@")) {
      setError("Enter a valid UPI ID (like myshop@upi).");
      return;
    }
    setBusy(true);
    try {
      // Register on-chain (gas sponsored). Both shop name and UPI are stored
      // on-chain. Await it so the dashboard sees registered=true immediately.
      const data = encodeFunctionData({
        abi: INTEGRATOR_ABI,
        functionName: "registerMerchant",
        args: [upiId.trim(), shopName.trim()],
      });
      const hash = await sendTransaction({ to: CONTRACT_ADDRESS, data });
      await publicClient.waitForTransactionReceipt({ hash });
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.shortMessage || err.message || "Setup failed");
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <div className="panel" style={{ width: 420 }}>
        <h1>Set up your shop</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Enter the UPI ID where you want INR withdrawals paid. That's it —
          gas is on us.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Shop name</label>
            <input
              className="input"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Demo Chai Stall"
            />
          </div>
          <div className="field">
            <label>UPI ID</label>
            <input
              className="input"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="myshop@upi"
            />
          </div>
          <button className="btn" disabled={busy || !ready} type="submit" style={{ width: "100%" }}>
            {busy ? "Setting up…" : "Open my dashboard"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

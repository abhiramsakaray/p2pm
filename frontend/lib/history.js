// Merchant transaction history straight from the p2p.me subgraph — no backend
// database. The subgraph indexes every on-chain order; we query the ones placed
// by this merchant (userAddress). Balances/locks still come live from the
// contract; this is purely the historical list for the Transactions page.

import { SUBGRAPH_URL } from "./p2p";

const ST = { 0: "matching", 1: "matching", 2: "matching", 3: "settled", 4: "cancelled" };

/**
 * Fetch a merchant's orders from the subgraph.
 * Returns rows shaped for the Transactions page:
 *   { orderId, amount (raw 6-dec string), status, txHash, createdAt(ms), placedAt }
 * status: 'matching' | 'settled' | 'cancelled'  (the page maps these to badges)
 */
export async function fetchHistory(address) {
  if (!address) return [];
  const query = `{
    orders_collection(
      first: 50,
      where: { userAddress: "${address.toLowerCase()}" },
      orderBy: orderId,
      orderDirection: desc
    ) {
      orderId
      status
      usdcAmount
      placedAt
      completedAt
      transactionHash
    }
  }`;

  let data;
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    data = await res.json();
  } catch {
    return [];
  }
  const rows = data?.data?.orders_collection || [];

  return rows.map((o) => {
    const placed = Number(o.placedAt) * 1000;
    return {
      orderId: String(o.orderId),
      amount: String(o.usdcAmount), // raw 6-dec
      status: ST[Number(o.status)] || "matching",
      txHash: o.transactionHash || null,
      createdAt: new Date(placed).toISOString(),
      placedAt: Number(o.placedAt),
      completedAt: o.completedAt ? Number(o.completedAt) : null,
    };
  });
}

/**
 * Withdrawal history straight from the integrator's own events
 * (WithdrawalINR / WithdrawalUSDC), keyed by the merchant address. Reads via
 * the viem public client in small block chunks (free-tier RPC friendly).
 * Returns: [{ kind: 'INR'|'USDC', amount(raw), txHash, blockNumber }]
 */

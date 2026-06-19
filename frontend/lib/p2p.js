/**
 * p2p.me widget integration helpers.
 *
 * The merchant terminal places orders through the official @p2pdotme/widgets
 * <Checkout> component, which (a) generates and persists a "relay identity"
 * (the user pubkey used to encrypt UPI details) and (b) auto-resolves the
 * INR circleId via the subgraph. Our placeOrder callback then encodes a call
 * to OUR integrator's 6-arg userPlaceOrder.
 *
 * Docs: github.com/p2pdotme/widgets
 */
import { encodeFunctionData, stringToHex } from "viem";
import { INTEGRATOR_ABI, CONTRACT_ADDRESS, CLIENT_ADDRESS, PRODUCT_ID } from "./contract";

// The team's Base Sepolia subgraph — enables automatic circle selection.
export const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/1745491/event-indexer/v0.0.4";

export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "";
export const DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS || "";

// INR via UPI, circleId omitted → resolved by the widget through the subgraph.
export const CURRENCIES = [{ symbol: "INR", flag: "🇮🇳", paymentMethod: "UPI", symbolNative: "₹" }];

// bytes32("INR") as the subgraph stores currency.
const INR_HEX =
  "0x494e520000000000000000000000000000000000000000000000000000000000";

/**
 * Resolve the INR circle id from the subgraph (the same source the widget uses
 * for BUY orders) so withdrawINR doesn't hardcode it. Returns a bigint circleId.
 * Falls back to 1 if the subgraph is unreachable (INR has been circle 1 across
 * all live orders) — the contract + Diamond still validate it.
 */
export async function resolveInrCircleId() {
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ circles(first: 50) { circleId currency } }` }),
    });
    const json = await res.json();
    const inr = (json.data?.circles || []).find((c) => c.currency === INR_HEX);
    return inr ? BigInt(inr.circleId) : 1n;
  } catch {
    return 1n;
  }
}

/**
 * Build the placeOrder callback the widget invokes once it has resolved the
 * circleId and the relay identity (pubkey). We encode OUR 6-arg userPlaceOrder
 * — the integrator forwards (currency, circleId, pubKey) to the Diamond and
 * passes its own 0,0 for preferredPaymentChannelConfigId / fiatAmountLimit.
 *
 * @param signer        CheckoutSigner (Privy wallet adapter)
 * @param publicClient  viem public client for receipt parsing
 * @param quantity      bigint product-2 units (USDC cents)
 * @param getIdentity   async () => RelayIdentity ({ publicKey })
 */
export function makePlaceOrder({ signer, publicClient, quantity, getIdentity }) {
  return async (ctx) => {
    const circleId = ctx?.currency?.circleId;
    if (circleId === undefined || circleId === null) {
      throw new Error("No circle resolved for INR — check subgraphUrl/usdcAmount");
    }

    const identity = await getIdentity();
    if (!identity?.publicKey) throw new Error("relay identity missing");

    const data = encodeFunctionData({
      abi: INTEGRATOR_ABI,
      functionName: "userPlaceOrder",
      args: [
        CLIENT_ADDRESS,
        PRODUCT_ID,
        quantity,
        stringToHex(ctx.currency.symbol, { size: 32 }),
        BigInt(circleId),
        identity.publicKey, // 128-char hex, no prefix
      ],
    });

    const { hash } = await signer.sendTransaction({
      to: CONTRACT_ADDRESS,
      data,
      gasLimit: 1_500_000,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error("order tx reverted");

    // Decode the orderId from OUR OrderPlaced event (Diamond also emits
    // B2BOrderPlaced; either resolves the id — we use ours since it's in the ABI).
    let orderId = null;
    for (const log of receipt.logs) {
      try {
        const { decodeEventLog } = await import("viem");
        const ev = decodeEventLog({ abi: INTEGRATOR_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "OrderPlaced") {
          orderId = ev.args.orderId.toString();
          break;
        }
      } catch {
        // not our event — skip
      }
    }
    if (!orderId) throw new Error("orderId missing from receipt");

    return { orderId, txHash: hash };
  };
}

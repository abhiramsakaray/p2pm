import { parseAbi } from "viem";

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
export const CLIENT_ADDRESS = process.env.NEXT_PUBLIC_CLIENT_ADDRESS;

export const INTEGRATOR_ABI = parseAbi([
  "function registerMerchant(string upiId, string shopName)",
  "function registered(address) view returns (bool)",
  "function userPlaceOrder(address client, uint256 productId, uint256 quantity, bytes32 currency, uint256 circleId, string pubKey) returns (uint256)",
  "function withdrawINR(uint256 amount, uint256 circleId, string upiOverride)",
  "function deliverInrUpi(uint256 orderId, string encUpi)",
  "function withdrawUSDC(uint256 amount)",
  "function getMerchantBalance(address merchant) view returns (uint256 pending, uint256 available, uint256 totalDeposited, bool isFrozen)",
  "function getMerchantInfo(address merchant) view returns (string upiId, string shopName, bool isRegistered, bool isFrozen)",
  "function getMerchantBuckets(address merchant) view returns ((uint256 amount, uint256 unlockTimestamp)[])",
  "function getDailyTxInfo(address merchant) view returns (uint256 usedToday, uint256 limit)",
  "event OrderPlaced(uint256 indexed orderId, address indexed user, uint256 amount)",
]);

// Fine-grained pricing product: id 2 @ 0.01 USDC/unit, so any INR amount
// maps to a quantity of cents (quantity = usdc * 100).
export const PRODUCT_ID = 2n;
export const UNIT_PRICE_USDC = 0.01;
export const PER_TX_CAP_USDC = 50;

// bytes32("INR")
export const INR_BYTES32 =
  "0x494e520000000000000000000000000000000000000000000000000000000000";

export const fmtUsdc = (raw) => (Number(raw) / 1e6).toFixed(2);

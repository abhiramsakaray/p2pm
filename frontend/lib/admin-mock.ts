import { ADMIN_MOCK } from "./admin-config";

export type MockMerchantRecord = {
  shopName: string;
  payoutId: string;
  currency: string;
  pending: string;
  available: string;
  totalDeposited: string;
  isFrozen: boolean;
};

export type MockMerchantResponse =
  | { isRegistered: false }
  | ({
      isRegistered: true;
    } & MockMerchantRecord);

const SEED: Record<string, MockMerchantRecord> = {
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": {
    shopName: "Demo Café",
    payoutId: "demo@cafe.upi",
    currency: "INR",
    pending: "12500000",
    available: "48750000",
    totalDeposited: "125000000",
    isFrozen: false,
  },
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": {
    shopName: "Frozen Shop",
    payoutId: "frozen@shop.upi",
    currency: "BRL",
    pending: "0",
    available: "150000000",
    totalDeposited: "200000000",
    isFrozen: true,
  },
};

export const MOCK_DEMO_ADDRESSES = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdDb6a900fa2b585dd299e03d12FA4293BC",
] as const;

declare global {
  // eslint-disable-next-line no-var
  var __adminMockStore: Record<string, MockMerchantRecord> | undefined;
}

function store() {
  if (!globalThis.__adminMockStore) {
    globalThis.__adminMockStore = JSON.parse(JSON.stringify(SEED));
  }
  return globalThis.__adminMockStore;
}

export function isAdminMockEnabled() {
  return ADMIN_MOCK;
}

export function getMockMerchant(address: string): MockMerchantResponse {
  const row = store()[address.toLowerCase()];
  if (!row) return { isRegistered: false };
  return { isRegistered: true, ...row };
}

export async function mockFreezeAction(
  merchant: string,
  action: "freeze" | "unfreeze"
): Promise<`0x${string}`> {
  await new Promise((r) => setTimeout(r, 700));
  const key = merchant.toLowerCase();
  const row = store()[key];
  if (!row) throw new Error("Merchant not registered");
  if (action === "freeze" && row.isFrozen) throw new Error("Merchant already frozen");
  if (action === "unfreeze" && !row.isFrozen) throw new Error("Merchant is not frozen");
  row.isFrozen = action === "freeze";
  const nonce = Date.now().toString(16).padStart(12, "0");
  return `0xmock${nonce}${"ab".repeat(22)}` as `0x${string}`;
}

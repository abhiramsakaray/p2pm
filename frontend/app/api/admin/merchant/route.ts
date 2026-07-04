import { isAddress } from "viem";
import { getMockMerchant, isAdminMockEnabled } from "../../../../lib/admin-mock";
import { isAdminSession } from "../../../../lib/admin-session";

export async function GET(req: Request) {
  if (!isAdminMockEnabled()) {
    return Response.json({ error: "Mock mode disabled" }, { status: 404 });
  }
  if (!isAdminSession()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const address = new URL(req.url).searchParams.get("address")?.trim() || "";
  if (!isAddress(address)) {
    return Response.json({ error: "Invalid merchant address" }, { status: 400 });
  }

  return Response.json(getMockMerchant(address));
}

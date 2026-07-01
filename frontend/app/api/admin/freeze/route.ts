import { isAddress } from "viem";
import { isAdminSession } from "../../../../lib/admin-session";
import { adminFreezeAction } from "../../../../lib/admin-chain";

export async function POST(req: Request) {
  if (!isAdminSession()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const merchant = String(body.merchant || "").trim();
  const action = body.action;

  if (!isAddress(merchant)) {
    return Response.json({ error: "Invalid merchant address" }, { status: 400 });
  }
  if (action !== "freeze" && action !== "unfreeze") {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const hash = await adminFreezeAction(merchant, action);
    return Response.json({ ok: true, hash });
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Transaction failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

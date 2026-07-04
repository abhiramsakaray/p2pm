import { isAdminSession } from "../../../../lib/admin-session";

export async function GET() {
  return Response.json({ ok: isAdminSession() });
}

import { clearSessionCookie } from "../../../../lib/admin-session";

export async function POST() {
  clearSessionCookie();
  return Response.json({ ok: true });
}

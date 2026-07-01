import { createSessionToken, setSessionCookie } from "../../../../lib/admin-session";

export async function POST(req: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return Response.json({ error: "Admin login not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const pass = String(body.password || "");
  const expectedUser = process.env.ADMIN_USERNAME || "admin";

  if (username !== expectedUser || pass !== password) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  setSessionCookie(createSessionToken());
  return Response.json({ ok: true });
}

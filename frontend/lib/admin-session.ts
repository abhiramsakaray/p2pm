import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "payqr_admin";
const MAX_AGE_SEC = 60 * 60 * 24;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_SESSION_SECRET or ADMIN_PASSWORD must be set");
  return s;
}

export function createSessionToken(): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const sig = createHmac("sha256", secret()).update(`admin:${exp}`).digest("hex");
  return `${exp}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (Date.now() > Number(exp)) return false;
  const expected = createHmac("sha256", secret()).update(`admin:${exp}`).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAdminSession(): boolean {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

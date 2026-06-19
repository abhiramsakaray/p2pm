"use client";

import Link from "next/link";
import { AccountMenu } from "./AccountMenu";

export function Nav() {
  return (
    <nav className="nav">
      <Link href="/dashboard" className="brand">◆ P2PM</Link>
      <div style={{ marginLeft: "auto" }}>
        <AccountMenu />
      </div>
    </nav>
  );
}

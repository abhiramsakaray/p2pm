# P2P Merchant Terminal

Merchants accept **INR (UPI) payments** from customers and receive **USDC on Base** under a **30-day settlement lock**, then withdraw either as **INR to their UPI** or **USDC to their wallet**. Built on the [p2p.me](https://p2p.me) protocol.

## How a payment works

```
Customer ₹ ──UPI──> Liquidity Provider ──USDC──> Integrator contract (locked 30 days)
                                                        │
Merchant <──INR to UPI (sell order)  or  USDC to wallet─┘  (after unlock)
```

1. Merchant taps **Generate QR** on the dashboard → on-chain order is placed (limits checked here: **max 50 USDC/tx, 4 tx/day**)
2. Customer scans the **dynamic UPI QR** with any UPI app and pays normally
3. Protocol confirms the INR payment → USDC is locked for the merchant in a 30-day settlement bucket
4. After 30 days the merchant withdraws as INR (UPI) or USDC

## Repository layout

```
payment-integrators/   Fork of p2pdotme/payment-integrators (contract + tests live here)
backend/               Node.js indexer + REST API
frontend/              Next.js merchant dashboard + POS
```

Upstream provenance: cloned from [p2pdotme/payment-integrators](https://github.com/p2pdotme/payment-integrators) at commit `b44c5559e3e60820f6a559c2e41823380ce3cac8`. **No upstream file is modified** — we only added our own files (required for protocol whitelisting verification).

## What is built so far

### ✅ Phase 1 — Smart contract
[`contracts/integrators/merchant-terminal/MerchantTerminalIntegrator.sol`](payment-integrators/contracts/integrators/merchant-terminal/MerchantTerminalIntegrator.sol)

- Self-serve merchant registration with UPI ID
- `validateOrder` (Diamond callback): 50 USDC per-tx cap, 4 tx/UTC-day limit, freeze check, system-proxy carve-out for withdrawals
- `onOrderComplete`: pulls USDC from the merchant's UserProxy into the integrator, locks it in a 30-day `SettlementBucket`
- `onOrderCancel`: best-effort refund of the daily-count slot (double-decrement safe)
- `withdrawINR`: deducts unlocked buckets oldest-first → funds the system proxy → places a `placeB2BSellOrder` with the merchant's saved UPI (TradeStars offramp pattern)
- `withdrawUSDC`: same deduction → USDC straight to the merchant wallet
- Owner freeze/unfreeze, bucket-derived balance views, daily-limit view
- All Diamond placement routed through `UserProxy` clones (the B2B gateway is proxy-only); orderId decoded from the proxy's raw return bytes

**Gate passed:** `npx hardhat compile` clean.

### ✅ Phase 2 — Tests
[`test/MerchantTerminalIntegrator.ts`](payment-integrators/test/MerchantTerminalIntegrator.ts) — 14 cases mirroring the repo's example harness (MockUSDC → MockDiamond → integrator → SimpleERC721Client):

registration + duplicate revert · per-tx cap · daily limit + next-day reset · settlement bucket math (unlock = completion + 30d) · balance views · INR/USDC withdrawal gating before/after T+30 · freeze enforcement · two-merchant isolation · cancel refund.

**Gate passed:** 14/14 green; full repo regression 404/404.

```bash
cd payment-integrators
npm install
npx hardhat test test/MerchantTerminalIntegrator.ts
```

### ✅ Phase 3 — Backend
[`backend/`](backend/) — Node.js (ES modules), express + ethers v6 + pg:

- **Indexer** ([src/indexer.js](backend/src/indexer.js)): cursor-based catch-up poller over ws:// or http:// RPC — survives restarts, rebuilds the DB purely from chain events
- **Settlement cron** ([src/cron.js](backend/src/cron.js)): flips `pending → available` using the **chain's block timestamp** (chain is source of truth, not the server clock)
- **API** ([src/api.js](backend/src/api.js)): `GET /merchant/:address` (profile + DB and live-chain balances) · `GET /merchant/:address/txs` · `POST /merchant/register` · `GET /merchant/:address/daily` (proxied from the contract view)
- **DB**: Postgres via `DATABASE_URL`; without it, in-memory pg-mem (zero-setup dev)

**Gate passed:** local Hardhat node → deploy → simulated order → appears in API with DB and chain balances matching exactly; restart catch-up and the 30-day unlock cron both verified by chain time-warp.

```bash
# terminal 1
cd payment-integrators && npx hardhat node
# terminal 2
cd backend && npm install && npm run deploy:local && npm start
# terminal 3
cd backend && npm run simulate:order
curl http://localhost:4000/merchant/<address>/txs
```

### ✅ Phase 4 — Frontend
[`frontend/`](frontend/) — Next.js 14 (App Router) + Privy (email OTP → embedded wallet) + Wagmi/Viem + qrcode.react:

- **/login** — Privy email OTP
- **/onboarding** — shop name + UPI ID → backend profile + on-chain `registerMerchant`
- **/dashboard** — Pending / Available / Total Earned cards (live `getMerchantBalance`), daily-limit meter
- **/transactions** — table with unlock dates, day countdowns (chain-time based), per-row Withdraw INR / Withdraw USDC buttons
- **/qr** — live POS: enter amount → daily-limit + per-tx-cap pre-check → on-chain `userPlaceOrder` → **dynamic UPI QR** for the customer to scan with any UPI app. Local dev panel simulates the customer payment via MockDiamond.

Local-mode extras: auto-funds the Privy embedded wallet with gas from the Hardhat faucet; chain switch (local ⇄ Base Sepolia) via one env var.

**Gate:** production build clean, all routes serving against local chain + backend; merchant click-through (login → onboard → sale → unlock → withdraw) runs on `npm run dev`.

```bash
cd frontend && npm install && npm run dev   # needs chain + backend up (see Phase 3)
```

### ✅ Phase 5 — Base Sepolia deployment (hardened / post-audit)

A self-audit before whitelisting found and fixed 6 issues (2 critical fund-safety
bugs — cancelled-withdrawal recovery + shared-proxy cross-steal). See the
"Security" commit. All contracts below are the **hardened** versions,
source-verified on Basescan. Test suite: **30 cases** (14 functional + 16
security/hardening), all green; repo regression 420 passing.

**A. Official-protocol integrator** (ready for whitelisting):
| Contract | Address |
|---|---|
| MerchantTerminalIntegrator | [`0xFcc48eda869a0A832838d7432791D4893f627d09`](https://sepolia.basescan.org/address/0xFcc48eda869a0A832838d7432791D4893f627d09#code) |
| proxyImpl (pinned) | `0xD4960b34A421c76C02B5ED26726Bd4d7c739eDB7` |
| Price client | [`0x7C6Af63ea0C48094d94F76F2cE975e2d9bcCA1B8`](https://sepolia.basescan.org/address/0x7C6Af63ea0C48094d94F76F2cE975e2d9bcCA1B8#code) |

Points at the live P2P Diamond `0xce868398...532aE2` + protocol test USDC.
`usdcThroughIntegrator = FALSE`. Runtime bytecode hash
`0xd9533afd8ea95a2888571d4964bd97ac101890ade14c846774897cc6db47b75e`.
**Pending: PR to p2pdotme/payment-integrators + whitelist request → team calls `registerIntegrator`.**

**B. Self-contained demo stack** (fully operational — we own the protocol simulator):
| Contract | Address |
|---|---|
| MockUSDC | [`0xfFDf3139783c7AF362f23c782ef1985E31c1ccCa`](https://sepolia.basescan.org/address/0xfFDf3139783c7AF362f23c782ef1985E31c1ccCa#code) |
| MockDiamond | [`0x0a7d2B82A241AE0A570652417864703d6F1a0263`](https://sepolia.basescan.org/address/0x0a7d2B82A241AE0A570652417864703d6F1a0263#code) |
| MerchantTerminalIntegrator | [`0x41C875453bfb805700550110D04df8D81105B19a`](https://sepolia.basescan.org/address/0x41C875453bfb805700550110D04df8D81105B19a#code) |
| Price client | [`0x1DF0F436966AdBAE1A1e8eAF96D291Ee995ac53a`](https://sepolia.basescan.org/address/0x1DF0F436966AdBAE1A1e8eAF96D291Ee995ac53a#code) |

**Gate passed — live end-to-end order on the hardened stack:**
[placement tx](https://sepolia.basescan.org/tx/0x432e999fcbe426269841da69000ee536a1e7f73bae69fd62470aca49fc116dbb) → [completion tx](https://sepolia.basescan.org/tx/0x345b62453c4369e1e2063f8d8cfa23158a52377fd0d3ef13efd1e7a8a5a76568) → 2.00 USDC locked for 30 days, daily counter 1/4.

## Remaining

- Host backend (Railway/Render + Supabase Postgres) and frontend (Vercel) against the demo stack
- Optional: file the whitelist request to activate deployment A on the official Diamond

## Key design decisions

- **Merchant-driven dynamic QR (POS model):** the merchant generates a per-sale QR; the customer pays with any normal UPI app. Limits are checked *before* the QR is shown — money never moves on a blocked order.
- **Chain is the source of truth** — the backend DB only serves fast history; balances are always recomputed from on-chain settlement buckets.
- **Only additions, no forks:** protocol interfaces, `UserProxy`, and build config are used exactly as upstream ships them.

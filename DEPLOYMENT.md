# Deployment Guide — P2PM Merchant Terminal (Base Sepolia)

A frontend-only app: the merchant's browser talks directly to the chain, the
p2p.me subgraph, and Privy/Pimlico. **No backend, no database.**

> Testnet build on Base Sepolia. The settlement lock is 10 minutes (test value).
> No real money moves — the p2p LP simulates the fiat (INR) leg on Sepolia.

---

## Architecture

```
 Merchant browser (Next.js, hosted on Vercel)
        │
        ├── Contract via RPC ── balances, registration (shop name + UPI),
        │   (Base Sepolia)       withdrawals, settlement buckets
        │
        ├── Subgraph ─────────── order history
        │
        ├── Privy + Pimlico ──── gasless smart wallet (merchant identity + gas)
        │
        └── CoinGecko / subgraph ─ live USDC↔INR rate
```

- **Money + profile truth** = the integrator contract on-chain (read live).
- **Order history** = the p2p.me subgraph (no database).
- **Nothing is stored off-chain.**

---

## Live addresses (Base Sepolia)

| Thing | Address |
|------|---------|
| Integrator (whitelisted) | `0x6503d29ac6D9C1f3ECee0A44194aFB0e5B6fFC2b` |
| proxyImpl | `0xad4Bd44d2DB744Af85187dC45F354f96FeC4681b` |
| Price client | `0x1cf2c86c3BeD9F696c6e8B9D3A0B7c2A08E466eF` |
| p2p Diamond | `0xeb0BB8E3c014D915D9B2df03aBB130a1Fb44beb9` |
| USDC | `0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d` |
| Subgraph | `https://api.studio.thegraph.com/query/1745491/event-indexer/v0.0.4` |

---

## 1. Privy (auth + gasless smart wallets)

dashboard.privy.io → your app:
- **Login Methods**: email (+ Google etc. if configured).
- **Smart Wallets**: provider **Kernel (ZeroDev)**, chain **Base Sepolia (84532)**,
  with a **Pimlico paymaster + bundler URL** set — this is what makes it gasless.
- Add your Vercel URL to the app's **allowed origins**.

## 2. Frontend → Vercel

1. vercel.com → **Add New → Project** → import the repo → root directory `frontend/`.
2. Add the `NEXT_PUBLIC_*` env vars (see `frontend/.env.example`):
   PRIVY_APP_ID, CHAIN=baseSepolia, RPC_URL, CONTRACT_ADDRESS, CLIENT_ADDRESS,
   DIAMOND_ADDRESS, USDC_ADDRESS, SUBGRAPH_URL.
3. Deploy → Vercel builds Next.js and gives an `https://…vercel.app` URL.

## 3. Verify

- Open the URL → log in → register (shop name + UPI, on-chain) → New Sale →
  the QR generates → on completion the proof card shows real Basescan links.
- Everything is verifiable on https://sepolia.basescan.org.

---

## Notes / limits (testnet)

- **10-minute settlement** (test value), not the 30-day production lock.
- **No real INR** — the LP simulates the fiat leg on Sepolia.
- **Free Alchemy RPC** — fine for a demo; the withdrawal-history event scan is
  light but can be slow under rate limits.
- The contract is **deployed from `payment-integrators/`**
  (`npx hardhat run scripts/deploy-merchant-terminal.ts --network baseSepolia`).
  Any logic change requires a redeploy **and** re-whitelisting by the p2p team.

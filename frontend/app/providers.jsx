"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { ACTIVE_CHAIN, RPC_URL } from "../lib/chain";

const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  // Batch concurrent reads into a single multicall request, and throttle the
  // rate, so the free-tier RPC isn't hammered (was causing 429 / CORS errors).
  transports: {
    [ACTIVE_CHAIN.id]: http(RPC_URL, {
      batch: { wait: 200 },
      retryCount: 2,
      retryDelay: 1500,
    }),
  },
  batch: { multicall: true },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry-storm on rate limits; serve cached data while refetching.
      retry: 1,
      retryDelay: 2000,
      staleTime: 10_000,
    },
  },
});

export function Providers({ children }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        // No loginMethods override — Privy shows every login method enabled
        // in the dashboard (dashboard.privy.io -> your app -> Login methods).
        appearance: { theme: "light", accentColor: "#5b4cf0" },
        // Gas is sponsored by the Pimlico paymaster, so per-transaction
        // confirmation modals add no value — suppress them for a one-tap flow.
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: false,
        },
        defaultChain: ACTIVE_CHAIN,
        supportedChains: [ACTIVE_CHAIN],
      }}
    >
      {/* Smart wallets (Kernel) — gas sponsored by the Pimlico paymaster
          configured in the Privy dashboard. Merchants transact with 0 ETH. */}
      <SmartWalletsProvider>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}

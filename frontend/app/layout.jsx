import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "P2P Merchant Terminal",
  description: "Accept UPI payments, settle in USDC on Base",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

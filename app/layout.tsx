import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RELAY — rolling market intent",
  description: "A Shannon testnet operator console for moving an unfilled binary-market limit intent into its verified successor window.",
  openGraph: {
    title: "RELAY — Set the price. Keep the intent.",
    description: "Evidence-backed prediction-market order continuity on Somnia Shannon testnet.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

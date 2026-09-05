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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

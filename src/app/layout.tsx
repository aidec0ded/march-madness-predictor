import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "March Madness Bracket Predictor",
  description:
    "Data-driven bracket predictions using Monte Carlo simulation, composite ratings, and game theory strategy.",
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

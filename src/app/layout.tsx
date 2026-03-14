import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/client";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/navigation/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "The Bracket Lab",
    template: "%s | BracketLab",
  },
  description:
    "Data-driven bracket predictions using Monte Carlo simulation, composite ratings from KenPom, Torvik, and Evan Miya, plus contest-aware game theory strategy.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "The Bracket Lab",
    description:
      "Build smarter brackets with Monte Carlo simulation, composite ratings, and contest-aware strategy.",
    siteName: "The Bracket Lab",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Bracket Lab",
    description:
      "Monte Carlo simulation meets college basketball. Build data-driven brackets.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="dark light" />
      </head>
      <body>
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>
        <AuthProvider initialUser={user}>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

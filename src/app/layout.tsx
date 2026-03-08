import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/client";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "March Madness Bracket Predictor",
  description:
    "Data-driven bracket predictions using Monte Carlo simulation, composite ratings, and game theory strategy.",
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
      <body>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </body>
    </html>
  );
}

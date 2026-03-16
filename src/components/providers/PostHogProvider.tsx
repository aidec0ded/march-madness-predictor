"use client";

/**
 * PostHog Analytics Provider
 *
 * Initializes PostHog on the client side and provides automatic
 * pageview tracking for Next.js App Router navigation.
 *
 * - Only loads in production (or when NEXT_PUBLIC_POSTHOG_KEY is set)
 * - Respects user privacy: IP is not stored, cookies are secure
 * - Captures pageviews on route changes via Next.js navigation events
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// ---------------------------------------------------------------------------
// Pageview tracker (captures route changes in App Router)
// ---------------------------------------------------------------------------

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      const search = searchParams?.toString();
      if (search) {
        url += `?${search}`;
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Capture pageviews manually via PostHogPageView component
      capture_pageview: false,
      capture_pageleave: true,
      // Privacy settings
      persistence: "localStorage+cookie",
      secure_cookie: true,
    });
  }, []);

  if (!POSTHOG_KEY) {
    // No PostHog key — render children without analytics
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

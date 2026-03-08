"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createBrowserClient();

  async function handleResetRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    );

    if (resetError) {
      setError(resetError.message);
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-primary)]/10">
              <svg
                className="h-6 w-6 text-[var(--accent-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--text-primary)]">
              Check your email
            </h2>
            <p className="mb-6 text-sm text-[var(--text-secondary)]">
              If an account exists for{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {email}
              </span>
              , we sent a password reset link. Check your inbox and follow the
              instructions.
            </p>
            <Link
              href="/auth/sign-in"
              className="text-sm font-medium text-[var(--accent-primary)] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
          <h1 className="mb-2 text-center text-2xl font-bold text-[var(--text-primary)]">
            Reset Password
          </h1>
          <p className="mb-8 text-center text-sm text-[var(--text-secondary)]">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {error && (
            <div className="mb-4 rounded border border-[var(--accent-danger)]/30 bg-[var(--accent-danger)]/10 px-4 py-3 text-sm text-[var(--accent-danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-[var(--accent-primary)] px-4 py-2.5 font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)] disabled:opacity-50"
            >
              {isLoading ? "Sending reset link..." : "Send Reset Link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            Remember your password?{" "}
            <Link
              href="/auth/sign-in"
              className="font-medium text-[var(--accent-primary)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

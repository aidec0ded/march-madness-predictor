import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | BracketLab",
  description: "Admin data management for BracketLab.",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin header bar */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-secondary)" }}
          >
            &larr; Back to App
          </Link>
          <div
            className="h-4 w-px"
            style={{ backgroundColor: "var(--border-default)" }}
          />
          <span
            className="text-sm font-semibold tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            BracketLab
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--accent-warning)",
              color: "var(--bg-primary)",
            }}
          >
            Admin
          </span>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/admin/data"
            className="text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-secondary)" }}
          >
            Data Management
          </Link>
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

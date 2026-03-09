"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/bracket", label: "Bracket" },
  { href: "/backtest", label: "Backtest" },
  { href: "/guide", label: "Guide" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  const { user, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        height: 48,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%",
          padding: "0 24px",
          maxWidth: "100%",
        }}
      >
        {/* Left: Brand */}
        <Link
          href="/"
          style={{
            fontWeight: 700,
            fontSize: "0.875rem",
            color: "var(--text-primary)",
            textDecoration: "none",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Predict the Madness
        </Link>

        {/* Center: Nav Links (desktop) */}
        <div className="nav-links-desktop">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? "nav-link-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Auth Section (desktop) */}
        <div className="nav-auth-desktop">
          {isLoading ? (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              ...
            </span>
          ) : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </span>
              <button
                onClick={signOut}
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 4,
                }}
                className="nav-auth-button"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/auth/sign-in"
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  padding: "4px 8px",
                  borderRadius: 4,
                }}
                className="nav-auth-button"
              >
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                style={{
                  fontSize: "0.8125rem",
                  color: "#fff",
                  textDecoration: "none",
                  backgroundColor: "var(--accent-primary)",
                  padding: "4px 12px",
                  borderRadius: 6,
                }}
                className="nav-signup-button"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: Hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              display: "block",
              width: 18,
              height: 2,
              backgroundColor: "var(--text-secondary)",
              borderRadius: 1,
              transition: "transform 0.2s ease, opacity 0.2s ease",
              transform: isMobileMenuOpen ? "rotate(45deg) translate(3px, 3px)" : "none",
            }}
          />
          <span
            style={{
              display: "block",
              width: 18,
              height: 2,
              backgroundColor: "var(--text-secondary)",
              borderRadius: 1,
              transition: "opacity 0.2s ease",
              opacity: isMobileMenuOpen ? 0 : 1,
            }}
          />
          <span
            style={{
              display: "block",
              width: 18,
              height: 2,
              backgroundColor: "var(--text-secondary)",
              borderRadius: 1,
              transition: "transform 0.2s ease, opacity 0.2s ease",
              transform: isMobileMenuOpen ? "rotate(-45deg) translate(3px, -3px)" : "none",
            }}
          />
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 0,
            right: 0,
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "8px 0",
            zIndex: 19,
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                padding: "10px 24px",
                fontSize: "0.875rem",
                color: isActive(link.href) ? "var(--accent-primary)" : "var(--text-secondary)",
                textDecoration: "none",
              }}
              className="nav-mobile-link"
            >
              {link.label}
            </Link>
          ))}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              margin: "8px 0",
            }}
          />
          {isLoading ? null : user ? (
            <>
              <span
                style={{
                  display: "block",
                  padding: "8px 24px",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                }}
              >
                {user.email}
              </span>
              <button
                onClick={signOut}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 24px",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                className="nav-mobile-link"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                style={{
                  display: "block",
                  padding: "10px 24px",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                }}
                className="nav-mobile-link"
              >
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                style={{
                  display: "block",
                  padding: "10px 24px",
                  fontSize: "0.875rem",
                  color: "var(--accent-primary)",
                  textDecoration: "none",
                }}
                className="nav-mobile-link"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

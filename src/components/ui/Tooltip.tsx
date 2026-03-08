"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TooltipProps {
  /** Tooltip content — string or JSX */
  content: string | ReactNode;
  /** The element that triggers the tooltip on hover */
  children: ReactNode;
  /** Tooltip position relative to the trigger (default: "top") */
  position?: "top" | "bottom" | "left" | "right";
}

// ---------------------------------------------------------------------------
// Position styles
// ---------------------------------------------------------------------------

const POSITION_STYLES: Record<
  NonNullable<TooltipProps["position"]>,
  React.CSSProperties
> = {
  top: {
    bottom: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
  },
  bottom: {
    top: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
  },
  left: {
    right: "calc(100% + 8px)",
    top: "50%",
    transform: "translateY(-50%)",
  },
  right: {
    left: "calc(100% + 8px)",
    top: "50%",
    transform: "translateY(-50%)",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CSS-positioned hover tooltip.
 *
 * Shows tooltip content after a 200ms hover delay.
 * Uses CSS variables: --bg-elevated, --border-primary, --text-secondary.
 */
export function Tooltip({
  content,
  children,
  position = "top",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 200);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  }, []);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          className="absolute z-50 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs pointer-events-none"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-secondary)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            ...POSITION_STYLES[position],
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

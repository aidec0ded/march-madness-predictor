'use client';

import Link from 'next/link';

export default function BracketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '48px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
          }}
        >
          Unable to load bracket data
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            margin: '0 0 24px 0',
            lineHeight: 1.5,
          }}
        >
          This may be a temporary issue with our data service.
        </p>
        {error.message && (
          <pre
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '13px',
              fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
              color: 'var(--accent-danger)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'left',
              margin: '0 0 16px 0',
              overflowX: 'auto',
            }}
          >
            {error.message}
          </pre>
        )}
        {error.digest && (
          <p
            style={{
              fontSize: '12px',
              fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
              color: 'var(--text-muted)',
              margin: '0 0 24px 0',
            }}
          >
            Digest: {error.digest}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <Link
            href="/"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

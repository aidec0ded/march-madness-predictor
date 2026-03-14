'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#0a0a0f',
          color: '#e8e8ed',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: '#1a1a26',
            border: '1px solid #2a2a3d',
            borderRadius: '12px',
            padding: '48px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              margin: '0 0 16px 0',
              color: '#e8e8ed',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#9898a8',
              margin: '0 0 24px 0',
              lineHeight: 1.5,
            }}
          >
            A critical error occurred. The application could not recover
            gracefully.
          </p>
          {error.message && (
            <pre
              style={{
                backgroundColor: '#12121a',
                border: '1px solid #2a2a3d',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '13px',
                fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
                color: '#ef4444',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'left',
                margin: '0 0 24px 0',
                overflowX: 'auto',
              }}
            >
              {error.message}
            </pre>
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
                backgroundColor: '#4a90d9',
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
            <a
              href="/"
              style={{
                backgroundColor: 'transparent',
                color: '#9898a8',
                border: '1px solid #2a2a3d',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Return Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

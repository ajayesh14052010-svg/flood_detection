"use client";

// Global error boundary — required to render when the ROOT layout throws (e.g.
// the database is unreachable during initial data load). Must include its own
// <html>/<body>. Like error.tsx, it shows only a generic message and never the
// underlying error text, so no connection string or query detail leaks.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            FloodGuard is temporarily unavailable
          </h1>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
            We couldn&apos;t reach the monitoring database. Please try again in
            a moment.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

"use client";

// Route-level error boundary. If a server component or data fetch throws (for
// example the database is unreachable or DATABASE_URL is misconfigured), Next
// renders this instead of a raw stack trace. We deliberately show a generic,
// safe message and never render `error.message`/`error.stack` to the browser,
// because those can contain connection strings or query details.

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the console/server only. Never expose the message to the client.
    console.error("FloodGuard error boundary:", error?.digest ?? "unknown");
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        We couldn&apos;t load the flood data right now. This is usually a
        temporary database connection issue. Please try again.
      </p>
      {error?.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-400">
          Reference: {error.digest}
        </p>
      ) : null}
      <button
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
      >
        Try again
      </button>
    </div>
  );
}

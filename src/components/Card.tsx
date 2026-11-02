import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || subtitle) && (
        <header className="mb-3">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "green" | "amber" | "orange" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    green: "text-green-700",
    amber: "text-yellow-600",
    orange: "text-orange-600",
    red: "text-red-600",
    slate: "text-slate-500",
  };
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

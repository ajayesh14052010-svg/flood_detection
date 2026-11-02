// Site-wide navigation shell (server component). Links to every public page.
import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/map", label: "Live Map" },
  { href: "/sensors", label: "Sensors" },
  { href: "/zones", label: "Zones" },
  { href: "/diagnostics", label: "Diagnostics" },
  { href: "/alerts", label: "Alerts" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-600 text-lg font-black text-white">
            F
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Flood<span className="text-sky-600">Guard</span>
          </span>
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-600">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-sky-700">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

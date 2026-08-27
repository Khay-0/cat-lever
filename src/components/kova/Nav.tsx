import { Link } from "@tanstack/react-router";

import { ConnectWallet } from "./ConnectWallet";

const links = [
  { to: "/", label: "TRADE" },
  { to: "/liquidity", label: "LIQUIDITÉ" },
  { to: "/token", label: "$KVO" },
  { to: "/admin", label: "ADMIN" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          <span className="font-mono text-sm font-bold tracking-[0.2em] neon-text">
            KOVA
          </span>
          <span className="hidden font-mono text-[10px] tracking-widest text-muted-foreground sm:inline">
            ROBINHOOD CHAIN
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded px-2.5 py-1.5 font-mono text-[11px] tracking-widest text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-primary" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto">
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}

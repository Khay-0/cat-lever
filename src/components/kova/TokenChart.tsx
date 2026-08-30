import { useState } from "react";

import { GT_NETWORK } from "@/lib/chain";

const INTERVALS = [
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1J", value: "1D" },
] as const;

/** Graphique DexScreener du pool, alimenté par les swaps réels de Robinhood Chain. */
export function TokenChart({
  poolAddress,
  symbol,
}: {
  poolAddress: string | null;
  symbol: string;
}) {
  const [interval, setInterval] = useState<string>("15");

  if (!poolAddress) {
    return (
      <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
        Aucun pool on-chain trouvé pour {symbol}.
      </div>
    );
  }

  const src = `https://dexscreener.com/${GT_NETWORK}/${poolAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=${interval}`;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          GRAPH DEXSCREENER
        </span>
        <div className="ml-auto flex gap-1">
          {INTERVALS.map((r) => (
            <button
              key={r.value}
              onClick={() => setInterval(r.value)}
              className={`rounded border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors ${
                interval === r.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <iframe
        key={`${poolAddress}-${interval}`}
        title={`Graphique ${symbol} en temps réel`}
        src={src}
        className="h-[420px] w-full rounded border border-border bg-black"
        allow="clipboard-write"
        loading="lazy"
      />
    </div>
  );
}

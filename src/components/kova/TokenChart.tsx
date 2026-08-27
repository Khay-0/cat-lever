import { useState } from "react";

import { GT_NETWORK } from "@/lib/chain";

const RESOLUTIONS = [
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1J", value: "1D" },
] as const;

/**
 * Real TradingView chart of the pool, fed by live Robinhood Chain swap data
 * (GeckoTerminal embed).
 */
export function TokenChart({
  poolAddress,
  symbol,
}: {
  poolAddress: string | null;
  symbol: string;
}) {
  const [resolution, setResolution] = useState<string>("15");

  if (!poolAddress) {
    return (
      <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
        Aucun pool on-chain trouvé pour {symbol}.
      </div>
    );
  }

  const src = `https://www.geckoterminal.com/${GT_NETWORK}/pools/${poolAddress}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=${resolution}`;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          GRAPH ON-CHAIN
        </span>
        <div className="ml-auto flex gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResolution(r.value)}
              className={`rounded border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors ${
                resolution === r.value
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
        key={`${poolAddress}-${resolution}`}
        title={`Graphique ${symbol} en temps réel`}
        src={src}
        className="h-[420px] w-full rounded border border-border bg-black"
        allow="clipboard-write"
        loading="lazy"
      />
    </div>
  );
}

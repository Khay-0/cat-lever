import { queryOptions } from "@tanstack/react-query";

import { GT_NETWORK } from "./chain";

export type TokenStats = {
  priceUsd: number;
  change24h: number;
  volume24h: number;
  liquidityUsd: number;
  fdv: number;
  poolAddress: string | null;
  dexUrl: string | null;
};

type DsPair = {
  chainId: string;
  pairAddress: string;
  url: string;
  priceUsd: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
};

/** Live on-chain market data for a token, straight from the Robinhood Chain DEX pools. */
export function tokenStatsQuery(tokenAddress: string) {
  return queryOptions({
    queryKey: ["token-stats", tokenAddress.toLowerCase()],
    refetchInterval: 15_000,
    staleTime: 10_000,
    queryFn: async (): Promise<TokenStats> => {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      );
      if (!res.ok) throw new Error("Flux de prix indisponible");
      const json = (await res.json()) as { pairs: DsPair[] | null };
      const pairs = (json.pairs ?? []).filter((p) => p.chainId === GT_NETWORK);
      if (pairs.length === 0) throw new Error("Aucun pool trouvé pour ce token");
      const best = pairs.reduce((a, b) =>
        (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
      );
      return {
        priceUsd: Number(best.priceUsd),
        change24h: best.priceChange?.h24 ?? 0,
        volume24h: pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0),
        liquidityUsd: pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0),
        fdv: best.fdv ?? 0,
        poolAddress: best.pairAddress,
        dexUrl: best.url,
      };
    },
  });
}

export type Candle = { t: number; o: number; h: number; l: number; c: number };

/** Real OHLCV candles from the pool, used for the in-app chart. */
export function candlesQuery(
  poolAddress: string | null,
  timeframe: "minute" | "hour" | "day" = "minute",
  aggregate = 15,
) {
  return queryOptions({
    queryKey: ["candles", poolAddress, timeframe, aggregate],
    enabled: Boolean(poolAddress),
    refetchInterval: 60_000,
    queryFn: async (): Promise<Candle[]> => {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${GT_NETWORK}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=200`,
      );
      if (!res.ok) throw new Error("Historique indisponible");
      const json = (await res.json()) as {
        data?: { attributes?: { ohlcv_list?: number[][] } };
      };
      const list = json.data?.attributes?.ohlcv_list ?? [];
      return list
        .map((r) => ({
          t: Number(r[0]),
          o: Number(r[1]),
          h: Number(r[2]),
          l: Number(r[3]),
          c: Number(r[4]),
        }))
        .sort((a, b) => a.t - b.t);
    },
  });
}

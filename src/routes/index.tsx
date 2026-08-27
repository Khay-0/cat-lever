import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  feeConfigQuery,
  lpPositionsQuery,
  marketsQuery,
  positionsQuery,
  type Position,
} from "@/lib/queries";
import {
  bps,
  fmtPrice,
  fmtUsd,
  getAccount,
  getBalance,
  liquidationPrice,
  positionPnl,
  setBalance,
  useLivePrice,
} from "@/lib/kova";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOVA — Trader Cash Cat avec levier x3" },
      {
        name: "description",
        content:
          "Terminal de trading à levier sur les memecoins de Robinhood Chain. Ouvre une position long ou short sur Cash Cat jusqu'à x3.",
      },
      { property: "og:title", content: "KOVA — Trader Cash Cat avec levier x3" },
      {
        property: "og:description",
        content:
          "Terminal de trading à levier jusqu'à x3 sur les memecoins de Robinhood Chain.",
      },
    ],
  }),
  component: TradePage,
});

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="h-40" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / span) * 92 - 4}`)
    .join(" ");
  const stroke = up ? "var(--long)" : "var(--short)";
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      <polyline
        points={`0,100 ${pts} 100,100`}
        fill={stroke}
        opacity="0.08"
        stroke="none"
      />
    </svg>
  );
}

function TradePage() {
  const qc = useQueryClient();
  const markets = useQuery(marketsQuery);
  const fees = useQuery(feeConfigQuery);
  const positions = useQuery(positionsQuery);
  const lps = useQuery(lpPositionsQuery);

  const [symbol, setSymbol] = useState<string | null>(null);
  const [side, setSide] = useState<"long" | "short">("long");
  const [collateral, setCollateral] = useState("250");
  const [leverage, setLeverage] = useState(3);

  const activeMarkets = (markets.data ?? []).filter((m) => m.is_active);
  const market =
    activeMarkets.find((m) => m.symbol === symbol) ?? activeMarkets[0] ?? null;
  const { price, history } = useLivePrice(market?.base_price ?? 1);

  const maxLev = Math.min(market?.max_leverage ?? 3, fees.data?.max_leverage ?? 3);
  const lev = Math.min(leverage, maxLev);
  const coll = Number(collateral) || 0;
  const size = coll * lev;
  const feeBps = fees.data?.trading_fee_bps ?? 100;
  const openFee = size * bps(feeBps);

  const poolTvl = useMemo(
    () => (lps.data ?? []).reduce((s, p) => s + Number(p.amount), 0),
    [lps.data],
  );
  const openPositions = (positions.data ?? []).filter((p) => p.status === "open");
  const borrowed = openPositions.reduce(
    (s, p) => s + Number(p.collateral) * (Number(p.leverage) - 1),
    0,
  );
  const available = Math.max(0, poolTvl - borrowed);
  const needed = size - coll;

  const up = history.length > 1 && (history.at(-1) ?? 0) >= (history[0] ?? 0);

  const openMut = useMutation({
    mutationFn: async () => {
      if (!market) throw new Error("Aucun marché actif");
      if (coll <= 0) throw new Error("Collatéral invalide");
      if (coll + openFee > getBalance()) throw new Error("Solde démo insuffisant");
      if (needed > available)
        throw new Error("Liquidité insuffisante dans le pool");

      const cfg = fees.data!;
      const liq = liquidationPrice(price, lev, side);
      const { error } = await supabase.from("positions").insert({
        account: getAccount(),
        market_symbol: market.symbol,
        side,
        collateral: coll,
        leverage: lev,
        entry_price: price,
        liquidation_price: liq,
        fees_paid: openFee,
      });
      if (error) throw error;

      await supabase.from("fee_events").insert({
        account: getAccount(),
        kind: "open",
        amount: openFee,
        lp_amount: openFee * bps(cfg.lp_share_bps),
        buyback_amount: openFee * bps(cfg.buyback_share_bps),
        treasury_amount: openFee * bps(cfg.treasury_share_bps),
      });

      setBalance(getBalance() - coll - openFee);
    },
    onSuccess: () => {
      toast.success("Position ouverte");
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["fee_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async (p: Position) => {
      const cfg = fees.data!;
      const pnl = positionPnl(
        Number(p.entry_price),
        price,
        Number(p.collateral),
        Number(p.leverage),
        p.side,
      );
      const closeFee = Number(p.collateral) * Number(p.leverage) * bps(cfg.trading_fee_bps);
      const payout = Math.max(0, Number(p.collateral) + pnl - closeFee);

      const { error } = await supabase
        .from("positions")
        .update({
          status: "closed",
          exit_price: price,
          pnl,
          fees_paid: Number(p.fees_paid) + closeFee,
          closed_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (error) throw error;

      await supabase.from("fee_events").insert({
        account: p.account,
        kind: "close",
        amount: closeFee,
        lp_amount: closeFee * bps(cfg.lp_share_bps),
        buyback_amount: closeFee * bps(cfg.buyback_share_bps),
        treasury_amount: closeFee * bps(cfg.treasury_share_bps),
      });

      setBalance(getBalance() + payout);
      return pnl;
    },
    onSuccess: (pnl) => {
      toast.success(`Position fermée — PnL ${pnl >= 0 ? "+" : ""}$${fmtUsd(pnl)}`);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["fee_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="sr-only">Trading à levier de memecoins sur Robinhood Chain</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5">
                {activeMarkets.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSymbol(m.symbol)}
                    className={`rounded border px-3 py-1.5 font-mono text-[11px] tracking-widest transition-colors ${
                      market?.symbol === m.symbol
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.symbol}
                  </button>
                ))}
              </div>
              <div className="ml-auto text-right">
                <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  {market?.name ?? "—"} / USD
                </div>
                <div className={`mono-num text-2xl ${up ? "text-long" : "text-short"}`}>
                  ${market ? fmtPrice(price) : "—"}
                </div>
              </div>
            </div>
            <Sparkline data={history} up={up} />
            <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
              <Stat label="LEVIER MAX" value={`x${maxLev}`} />
              <Stat label="LIQUIDITÉ DISPO" value={`$${fmtUsd(available)}`} />
              <Stat label="FRAIS / TRADE" value={`${(feeBps / 100).toFixed(2)}%`} />
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-mono text-[11px] tracking-widest text-muted-foreground">
              POSITIONS OUVERTES
            </h2>
            {openPositions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune position ouverte.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="font-mono text-[10px] tracking-widest text-muted-foreground">
                      <th className="pb-2">MARCHÉ</th>
                      <th className="pb-2">SENS</th>
                      <th className="pb-2">COLLAT.</th>
                      <th className="pb-2">LEV.</th>
                      <th className="pb-2">ENTRÉE</th>
                      <th className="pb-2">LIQ.</th>
                      <th className="pb-2">PNL</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((p) => {
                      const pnl = positionPnl(
                        Number(p.entry_price),
                        price,
                        Number(p.collateral),
                        Number(p.leverage),
                        p.side,
                      );
                      return (
                        <tr key={p.id} className="border-t border-border/60">
                          <td className="py-2 font-mono text-xs">{p.market_symbol}</td>
                          <td className={p.side === "long" ? "text-long" : "text-short"}>
                            {p.side.toUpperCase()}
                          </td>
                          <td className="mono-num">${fmtUsd(Number(p.collateral))}</td>
                          <td className="mono-num">x{Number(p.leverage)}</td>
                          <td className="mono-num">{fmtPrice(Number(p.entry_price))}</td>
                          <td className="mono-num text-muted-foreground">
                            {fmtPrice(Number(p.liquidation_price))}
                          </td>
                          <td className={`mono-num ${pnl >= 0 ? "text-long" : "text-short"}`}>
                            {pnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(pnl))}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => closeMut.mutate(p)}
                              className="rounded border border-border px-2 py-1 font-mono text-[10px] tracking-widest hover:border-primary hover:text-primary"
                            >
                              FERMER
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="panel h-fit p-4">
          <div className="grid grid-cols-2 gap-1.5">
            {(["long", "short"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`rounded border py-2 font-mono text-xs tracking-widest transition-colors ${
                  side === s
                    ? s === "long"
                      ? "border-long bg-long/10 text-long"
                      : "border-short bg-short/10 text-short"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <label className="mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
            COLLATÉRAL (USD)
          </label>
          <input
            value={collateral}
            onChange={(e) => setCollateral(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="mono-num mt-1 w-full rounded border border-input bg-input/40 px-3 py-2 text-lg outline-none focus:border-primary"
          />

          <div className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-widest text-muted-foreground">
            <span>LEVIER</span>
            <span className="mono-num text-base text-primary">x{lev.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxLev}
            step={0.1}
            value={lev}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--primary)]"
          />

          <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
            <Row label="Taille de position" value={`$${fmtUsd(size)}`} />
            <Row label="Emprunté au pool" value={`$${fmtUsd(Math.max(0, needed))}`} />
            <Row label={`Frais d'ouverture (${(feeBps / 100).toFixed(2)}%)`} value={`$${fmtUsd(openFee)}`} />
            <Row
              label="Prix de liquidation"
              value={market ? fmtPrice(liquidationPrice(price, lev, side)) : "—"}
            />
          </dl>

          <button
            onClick={() => openMut.mutate()}
            disabled={openMut.isPending || !market}
            className="mt-4 w-full rounded bg-primary py-2.5 font-mono text-xs tracking-widest text-primary-foreground shadow-[var(--glow-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {openMut.isPending ? "ENVOI…" : `OUVRIR ${side.toUpperCase()}`}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Démo : soldes et prix simulés, aucun actif réel n'est engagé.
          </p>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mono-num text-base">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mono-num">{value}</dd>
    </div>
  );
}

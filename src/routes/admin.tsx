import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { feeConfigQuery, feeEventsQuery, marketsQuery } from "@/lib/queries";
import { GT_NETWORK } from "@/lib/chain";

type DexPair = {
  chainId: string;
  pairAddress: string;
  priceUsd: string;
  liquidity?: { usd?: number };
  baseToken: { symbol: string; name: string };
};
import { fmtUsd } from "@/lib/kova";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin KOVA — Réglage des frais et des marchés" },
      {
        name: "description",
        content:
          "Panneau de contrôle KOVA : définis les frais de trading, la répartition entre LP, buyback $KVO et trésorerie, et gère les memecoins listés.",
      },
      { property: "og:title", content: "Admin KOVA — Réglage des frais" },
      {
        property: "og:description",
        content:
          "Définis les frais du protocole et leur répartition, puis confirme les paramètres.",
      },
    ],
  }),
  component: AdminPage,
});

type Draft = {
  trading_fee_bps: number;
  borrow_fee_bps_hourly: number;
  liquidation_fee_bps: number;
  lp_share_bps: number;
  buyback_share_bps: number;
  treasury_share_bps: number;
  max_leverage: number;
};

function AdminPage() {
  const qc = useQueryClient();
  const cfg = useQuery(feeConfigQuery);
  const markets = useQuery(marketsQuery);
  const events = useQuery(feeEventsQuery);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");

  useEffect(() => {
    if (cfg.data && !draft) {
      const d = cfg.data;
      setDraft({
        trading_fee_bps: d.trading_fee_bps,
        borrow_fee_bps_hourly: d.borrow_fee_bps_hourly,
        liquidation_fee_bps: d.liquidation_fee_bps,
        lp_share_bps: d.lp_share_bps,
        buyback_share_bps: d.buyback_share_bps,
        treasury_share_bps: d.treasury_share_bps,
        max_leverage: Number(d.max_leverage),
      });
    }
  }, [cfg.data, draft]);

  const splitTotal = draft
    ? draft.lp_share_bps + draft.buyback_share_bps + draft.treasury_share_bps
    : 0;
  const splitOk = splitTotal === 10000;

  const save = useMutation({
    mutationFn: async () => {
      if (!draft || !cfg.data) throw new Error("Configuration non chargée");
      if (!splitOk) throw new Error("La répartition doit totaliser 100%");
      const { error } = await supabase
        .from("fee_config")
        .update({ ...draft, updated_at: new Date().toISOString() })
        .eq("id", cfg.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres confirmés et appliqués au protocole");
      qc.invalidateQueries({ queryKey: ["fee_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMarket = useMutation({
    mutationFn: async () => {
      const addr = newAddress.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr))
        throw new Error("Adresse de contrat invalide");

      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${addr}`,
      );
      const json = (await res.json()) as { pairs: DexPair[] | null };
      const pairs = (json.pairs ?? []).filter((p) => p.chainId === GT_NETWORK);
      if (pairs.length === 0)
        throw new Error("Aucun pool trouvé sur Robinhood Chain pour ce token");
      const best = pairs.reduce((a, b) =>
        (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
      );

      const { error } = await supabase.from("markets").insert({
        symbol: (newSymbol.trim() || best.baseToken.symbol).toUpperCase(),
        name: newName.trim() || best.baseToken.name,
        base_price: Number(best.priceUsd) || 0,
        token_address: addr,
        pool_address: best.pairAddress,
        max_leverage: draft?.max_leverage ?? 3,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Memecoin listé");
      setNewSymbol("");
      setNewName("");
      setNewAddress("");
      qc.invalidateQueries({ queryKey: ["markets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMarket = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("markets")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["markets"] }),
  });

  const totals = (events.data ?? []).reduce(
    (a, e) => ({
      total: a.total + Number(e.amount),
      lp: a.lp + Number(e.lp_amount),
      buyback: a.buyback + Number(e.buyback_amount),
      treasury: a.treasury + Number(e.treasury_amount),
    }),
    { total: 0, lp: 0, buyback: 0, treasury: 0 },
  );

  if (!draft) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted-foreground">
        Chargement de la configuration…
      </main>
    );
  }

  const set = (k: keyof Draft) => (v: number) => setDraft({ ...draft, [k]: v });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-mono text-lg tracking-widest neon-text">PANNEAU ADMIN</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Définis les frais du protocole et leur répartition, puis confirme : les valeurs
        deviennent immédiatement les paramètres utilisés par le moteur de trading.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground">
            FRAIS DU PROTOCOLE
          </h2>
          <div className="mt-4 space-y-5">
            <Slider
              label="Frais par transaction"
              value={draft.trading_fee_bps}
              min={0}
              max={300}
              step={5}
              format={(v) => `${(v / 100).toFixed(2)}%`}
              onChange={set("trading_fee_bps")}
            />
            <Slider
              label="Frais d'emprunt (par heure)"
              value={draft.borrow_fee_bps_hourly}
              min={0}
              max={50}
              step={1}
              format={(v) => `${(v / 100).toFixed(2)}%/h`}
              onChange={set("borrow_fee_bps_hourly")}
            />
            <Slider
              label="Pénalité de liquidation"
              value={draft.liquidation_fee_bps}
              min={0}
              max={1000}
              step={25}
              format={(v) => `${(v / 100).toFixed(2)}%`}
              onChange={set("liquidation_fee_bps")}
            />
            <Slider
              label="Levier maximum"
              value={draft.max_leverage}
              min={1}
              max={10}
              step={0.5}
              format={(v) => `x${v}`}
              onChange={set("max_leverage")}
            />
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground">
            RÉPARTITION DES FRAIS
          </h2>
          <div className="mt-4 space-y-5">
            <Slider
              label="Fournisseurs de liquidité"
              value={draft.lp_share_bps}
              min={0}
              max={10000}
              step={100}
              format={(v) => `${(v / 100).toFixed(0)}%`}
              onChange={set("lp_share_bps")}
            />
            <Slider
              label="Buyback $KVO"
              value={draft.buyback_share_bps}
              min={0}
              max={10000}
              step={100}
              format={(v) => `${(v / 100).toFixed(0)}%`}
              onChange={set("buyback_share_bps")}
            />
            <Slider
              label="Trésorerie"
              value={draft.treasury_share_bps}
              min={0}
              max={10000}
              step={100}
              format={(v) => `${(v / 100).toFixed(0)}%`}
              onChange={set("treasury_share_bps")}
            />
          </div>
          <div
            className={`mt-4 rounded border px-3 py-2 font-mono text-xs ${
              splitOk
                ? "border-primary/40 text-primary"
                : "border-destructive/60 text-destructive"
            }`}
          >
            TOTAL : {(splitTotal / 100).toFixed(0)}%{" "}
            {splitOk ? "— OK" : "— doit être égal à 100%"}
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={!splitOk || save.isPending}
            className="mt-4 w-full rounded bg-primary py-2.5 font-mono text-xs tracking-widest text-primary-foreground shadow-[var(--glow-primary)] hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? "CONFIRMATION…" : "CONFIRMER LES PARAMÈTRES"}
          </button>
        </section>

        <section className="panel p-4">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground">
            MARCHÉS LISTÉS
          </h2>
          <div className="mt-3 space-y-2">
            {(markets.data ?? []).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded border border-border/70 px-3 py-2"
              >
                <span className="font-mono text-xs text-primary">{m.symbol}</span>
                <span className="text-sm text-muted-foreground">{m.name}</span>
                <span className="mono-num ml-auto text-sm">
                  ${Number(m.base_price).toFixed(6)}
                </span>
                <button
                  onClick={() =>
                    toggleMarket.mutate({ id: m.id, active: !m.is_active })
                  }
                  className={`rounded border px-2 py-1 font-mono text-[10px] tracking-widest ${
                    m.is_active
                      ? "border-primary/50 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m.is_active ? "ACTIF" : "INACTIF"}
                </button>
              </div>
            ))}
          </div>

          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x… adresse du contrat sur Robinhood Chain"
            className="mono-num mt-4 w-full rounded border border-input bg-input/40 px-2 py-2 text-xs outline-none focus:border-primary"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="SYMBOLE (auto)"
              className="rounded border border-input bg-input/40 px-2 py-2 font-mono text-xs outline-none focus:border-primary"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom (auto)"
              className="rounded border border-input bg-input/40 px-2 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => addMarket.mutate()}
            className="mt-2 w-full rounded border border-border py-2 font-mono text-[11px] tracking-widest hover:border-primary hover:text-primary"
          >
            AJOUTER UN MEMECOIN
          </button>
        </section>

        <section className="panel p-4">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground">
            FRAIS COLLECTÉS
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Metric label="TOTAL" value={`$${fmtUsd(totals.total)}`} />
            <Metric label="VERS LP" value={`$${fmtUsd(totals.lp)}`} />
            <Metric label="BUYBACK $KVO" value={`$${fmtUsd(totals.buyback)}`} />
            <Metric label="TRÉSORERIE" value={`$${fmtUsd(totals.treasury)}`} />
          </div>
          <div className="mt-4 max-h-56 space-y-1 overflow-y-auto">
            {(events.data ?? []).map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 border-b border-border/50 py-1.5 text-xs"
              >
                <span className="font-mono text-muted-foreground">
                  {new Date(e.created_at).toLocaleTimeString("fr-FR")}
                </span>
                <span className="font-mono uppercase text-accent">{e.kind}</span>
                <span className="mono-num ml-auto">${fmtUsd(Number(e.amount), 4)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="mono-num text-sm text-primary">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]"
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mono-num text-lg">{value}</div>
    </div>
  );
}

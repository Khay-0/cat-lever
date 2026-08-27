import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  feeConfigQuery,
  feeEventsQuery,
  lpPositionsQuery,
  positionsQuery,
} from "@/lib/queries";
import { fmtUsd } from "@/lib/kova";
import { useAccount } from "wagmi";

export const Route = createFileRoute("/liquidity")({
  head: () => ({
    meta: [
      { title: "Pool de liquidité KOVA — Gagne une part des frais" },
      {
        name: "description",
        content:
          "Dépose de la liquidité dans le pool KOVA, finance le levier des traders et reçois ta part des frais générés sur Robinhood Chain.",
      },
      { property: "og:title", content: "Pool de liquidité KOVA" },
      {
        property: "og:description",
        content:
          "Dépose de la liquidité, finance le levier des traders et reçois ta part des frais.",
      },
    ],
  }),
  component: LiquidityPage,
});

function LiquidityPage() {
  const qc = useQueryClient();
  const lps = useQuery(lpPositionsQuery);
  const fees = useQuery(feeConfigQuery);
  const events = useQuery(feeEventsQuery);
  const positions = useQuery(positionsQuery);
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("1000");

  const account = (address ?? "").toLowerCase();
  const rows = lps.data ?? [];
  const tvl = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows]);
  const mine = useMemo(
    () =>
      rows
        .filter((r) => account && r.account.toLowerCase() === account)
        .reduce((s, r) => s + Number(r.amount), 0),
    [rows, account],
  );
  const share = tvl > 0 ? mine / tvl : 0;

  const borrowed = (positions.data ?? [])
    .filter((p) => p.status === "open")
    .reduce((s, p) => s + Number(p.collateral) * (Number(p.leverage) - 1), 0);
  const utilization = tvl > 0 ? Math.min(1, borrowed / tvl) : 0;

  const lpFees = (events.data ?? []).reduce((s, e) => s + Number(e.lp_amount), 0);
  const myFees = lpFees * share;

  const deposit = useMutation({
    mutationFn: async () => {
      const v = Number(amount) || 0;
      if (!account) throw new Error("Connecte ton wallet");
      if (v <= 0) throw new Error("Montant invalide");
      const { error } = await supabase
        .from("lp_positions")
        .insert({ account, amount: v });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liquidité déposée");
      qc.invalidateQueries({ queryKey: ["lp_positions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawAll = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error("Connecte ton wallet");
      if (mine <= 0) throw new Error("Aucune liquidité déposée");
      const free = tvl - borrowed;
      if (mine > free) throw new Error("Liquidité utilisée par des positions ouvertes");
      const { error } = await supabase
        .from("lp_positions")
        .delete()
        .eq("account", account);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liquidité retirée avec les frais");
      qc.invalidateQueries({ queryKey: ["lp_positions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-mono text-lg tracking-widest neon-text">POOL DE LIQUIDITÉ</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        La liquidité déposée finance le levier des traders. Chaque trade prélève des
        frais dont{" "}
        <span className="text-primary">
          {((fees.data?.lp_share_bps ?? 7000) / 100).toFixed(0)}%
        </span>{" "}
        reviennent aux fournisseurs de liquidité, au prorata de leur part du pool.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <Metric label="TVL DU POOL" value={`$${fmtUsd(tvl)}`} />
            <Metric label="EMPRUNTÉ" value={`$${fmtUsd(borrowed)}`} />
            <Metric label="UTILISATION" value={`${(utilization * 100).toFixed(1)}%`} />
            <Metric label="FRAIS LP CUMULÉS" value={`$${fmtUsd(lpFees)}`} />
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-mono text-[11px] tracking-widest text-muted-foreground">
              DÉPÔTS DU POOL
            </h2>
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Le pool est vide. Sois le premier à déposer.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    <th className="pb-2">COMPTE</th>
                    <th className="pb-2">MONTANT</th>
                    <th className="pb-2">PART</th>
                    <th className="pb-2">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-2 font-mono text-xs">
                        {r.account.slice(0, 6)}…{r.account.slice(-4)}
                        {account && r.account.toLowerCase() === account && (
                          <span className="ml-2 text-primary">toi</span>
                        )}
                      </td>
                      <td className="mono-num">${fmtUsd(Number(r.amount))}</td>
                      <td className="mono-num text-muted-foreground">
                        {tvl > 0 ? ((Number(r.amount) / tvl) * 100).toFixed(1) : "0.0"}%
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="panel h-fit p-4">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground">
            MA POSITION LP
          </h2>
          <div className="mono-num mt-1 text-2xl text-primary">${fmtUsd(mine)}</div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Part du pool" value={`${(share * 100).toFixed(2)}%`} />
            <Row label="Frais gagnés" value={`$${fmtUsd(myFees)}`} />
          </dl>

          <label className="mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
            MONTANT À DÉPOSER (USD)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="mono-num mt-1 w-full rounded border border-input bg-input/40 px-3 py-2 text-lg outline-none focus:border-primary"
          />
          <button
            onClick={() => deposit.mutate()}
            disabled={deposit.isPending || !isConnected}
            className="mt-3 w-full rounded bg-primary py-2.5 font-mono text-xs tracking-widest text-primary-foreground shadow-[var(--glow-primary)] hover:opacity-90 disabled:opacity-50"
          >
            {isConnected ? "DÉPOSER" : "CONNECTE TON WALLET"}
          </button>
          <button
            onClick={() => withdrawAll.mutate()}
            disabled={withdrawAll.isPending || !isConnected}
            className="mt-2 w-full rounded border border-border py-2.5 font-mono text-xs tracking-widest text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            TOUT RETIRER + FRAIS
          </button>
        </aside>
      </div>
    </main>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mono-num">{value}</dd>
    </div>
  );
}

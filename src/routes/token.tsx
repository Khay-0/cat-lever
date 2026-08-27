import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { feeConfigQuery, feeEventsQuery } from "@/lib/queries";
import { fmtUsd } from "@/lib/kova";

export const Route = createFileRoute("/token")({
  head: () => ({
    meta: [
      { title: "$KVO — Le token KOVA racheté par les revenus" },
      {
        name: "description",
        content:
          "$KVO est le token du protocole KOVA : une part des frais de trading finance un buyback permanent alimenté par les revenus réels du protocole.",
      },
      { property: "og:title", content: "$KVO — Le token KOVA" },
      {
        property: "og:description",
        content:
          "Une part des frais de trading finance un buyback permanent de $KVO.",
      },
    ],
  }),
  component: TokenPage,
});

function TokenPage() {
  const cfg = useQuery(feeConfigQuery);
  const events = useQuery(feeEventsQuery);

  const buyback = (events.data ?? []).reduce(
    (s, e) => s + Number(e.buyback_amount),
    0,
  );
  const total = (events.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="panel p-8">
        <span className="font-mono text-[10px] tracking-[0.3em] text-accent">
          ROBINHOOD CHAIN
        </span>
        <h1 className="mt-2 font-mono text-4xl tracking-tight neon-text">$KVO</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          KOVA est un échange décentralisé de levier pour les memecoins de Robinhood
          Chain. Le token du protocole, <strong className="text-foreground">$KVO</strong>,
          capte la valeur générée par l'activité : une part fixe de chaque frais de
          trading est utilisée pour racheter du $KVO sur le marché.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card
            label="PART BUYBACK"
            value={`${((cfg.data?.buyback_share_bps ?? 2000) / 100).toFixed(0)}%`}
            hint="des frais collectés"
          />
          <Card
            label="BUYBACK CUMULÉ"
            value={`$${fmtUsd(buyback)}`}
            hint="revenus réels du protocole"
          />
          <Card
            label="FRAIS TOTAUX"
            value={`$${fmtUsd(total)}`}
            hint="depuis le lancement"
          />
        </div>

        <h2 className="mt-10 font-mono text-[11px] tracking-widest text-muted-foreground">
          COMMENT LA VALEUR CIRCULE
        </h2>
        <ol className="mt-3 space-y-3 text-sm">
          {[
            "Les fournisseurs de liquidité déposent dans le pool KOVA.",
            "Les traders empruntent cette liquidité pour prendre du levier jusqu'à x3 sur les memecoins listés (Cash Cat en premier).",
            "Chaque ouverture et fermeture prélève des frais, réglés depuis le panneau admin.",
            "Les frais sont répartis : la majorité aux LP, une part au buyback $KVO, le reste à la trésorerie.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="mono-num text-primary">0{i + 1}</span>
              <span className="text-muted-foreground">{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded border border-border bg-secondary/30 p-4">
      <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mono-num mt-1 text-2xl text-primary">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { feeConfigQuery } from "@/lib/queries";
import { isAddress, vaultAbi } from "@/lib/contracts";
import { EXPLORER, robinhoodChain, shortAddr } from "@/lib/chain";

export const Route = createFileRoute("/liquidity")({
  head: () => ({
    meta: [
      { title: "Pool de liquidité KOVA — Gagne une part des frais" },
      {
        name: "description",
        content:
          "Dépose de l'ETH dans le vault KOVA sur Robinhood Chain, finance le levier des traders et reçois ta part des frais on-chain.",
      },
      { property: "og:title", content: "Pool de liquidité KOVA" },
      {
        property: "og:description",
        content:
          "Dépose de l'ETH on-chain, finance le levier des traders et reçois ta part des frais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiquidityPage,
});

const eth = (v?: bigint, digits = 5) =>
  v === undefined ? "—" : Number(formatEther(v)).toFixed(digits);

function LiquidityPage() {
  const cfg = useQuery(feeConfigQuery);
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("0.1");

  const vault = cfg.data?.vault_address;
  const deployed = isAddress(vault);
  const vaultAddress = deployed ? vault : undefined;

  const read = {
    address: vaultAddress,
    abi: vaultAbi,
    chainId: robinhoodChain.id,
    query: { enabled: deployed, refetchInterval: 15_000 },
  } as const;

  const { data: totalAssets } = useReadContract({ ...read, functionName: "totalAssets" });
  const { data: borrowed } = useReadContract({ ...read, functionName: "totalBorrowed" });
  const { data: available } = useReadContract({ ...read, functionName: "availableLiquidity" });
  const { data: myShares, refetch: refetchShares } = useReadContract({
    ...read,
    functionName: "sharesOf",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address), refetchInterval: 15_000 },
  });
  const { data: myAssets, refetch: refetchAssets } = useReadContract({
    ...read,
    functionName: "assetsOf",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address), refetchInterval: 15_000 },
  });
  const { data: wallet } = useBalance({
    address,
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(address) },
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const receipt = useWaitForTransactionReceipt({ hash });

  const utilization =
    totalAssets && totalAssets > 0n && borrowed !== undefined
      ? Number((borrowed * 10000n) / totalAssets) / 100
      : 0;

  async function run(fn: () => Promise<`0x${string}`>, label: string) {
    try {
      const tx = await fn();
      setHash(tx);
      toast.success(`${label} — transaction envoyée`);
      await new Promise((r) => setTimeout(r, 4000));
      void refetchShares();
      void refetchAssets();
    } catch (e) {
      toast.error((e as Error).message.split("\n")[0] ?? "Transaction refusée");
    }
  }

  const deposit = () =>
    run(
      () =>
        writeContractAsync({
          address: vaultAddress!,
          abi: vaultAbi,
          functionName: "deposit",
          value: parseEther(amount || "0"),
          chainId: robinhoodChain.id,
        }),
      "Dépôt",
    );

  const withdrawAll = () =>
    run(
      () =>
        writeContractAsync({
          address: vaultAddress!,
          abi: vaultAbi,
          functionName: "withdraw",
          args: [myShares ?? 0n],
          chainId: robinhoodChain.id,
        }),
      "Retrait",
    );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-mono text-lg tracking-widest neon-text">POOL DE LIQUIDITÉ</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Dépose de l'ETH dans le vault on-chain : il finance le levier des traders. Chaque
        transaction prélève{" "}
        <span className="text-primary">
          {((cfg.data?.trading_fee_bps ?? 20) / 100).toFixed(2)}%
        </span>{" "}
        de frais, dont{" "}
        <span className="text-primary">
          {((cfg.data?.lp_share_bps ?? 7000) / 100).toFixed(0)}%
        </span>{" "}
        restent dans le vault et font monter la valeur de tes parts.
      </p>

      {!deployed && (
        <div className="mt-4 rounded border border-destructive/60 px-4 py-3 text-sm text-destructive">
          Le vault n'est pas encore branché. Déploie <code>contracts/KovaVault.sol</code>{" "}
          puis colle son adresse dans le panneau admin.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <Metric label="TVL DU VAULT" value={`${eth(totalAssets)} ETH`} />
            <Metric label="EMPRUNTÉ" value={`${eth(borrowed)} ETH`} />
            <Metric label="DISPONIBLE" value={`${eth(available)} ETH`} />
            <Metric label="UTILISATION" value={`${utilization.toFixed(1)}%`} />
          </div>

          <div className="panel p-4 text-sm text-muted-foreground">
            <h2 className="mb-2 font-mono text-[11px] tracking-widest">
              CONTRAT DU VAULT
            </h2>
            {deployed ? (
              <a
                href={`${EXPLORER}/address/${vaultAddress}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-primary hover:underline"
              >
                {shortAddr(vaultAddress)} ↗
              </a>
            ) : (
              <span className="font-mono text-xs">non déployé</span>
            )}
            <p className="mt-3">
              Les dépôts et retraits sont des transactions réelles signées avec ton
              wallet. Un retrait n'est possible que sur la liquidité non empruntée par
              des positions ouvertes.
            </p>
            {hash && (
              <p className="mt-3 font-mono text-xs">
                Dernière tx :{" "}
                <a
                  href={`${EXPLORER}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {shortAddr(hash)} ↗
                </a>{" "}
                {receipt.isLoading ? "· en attente…" : receipt.isSuccess ? "· confirmée" : ""}
              </p>
            )}
          </div>
        </section>

        <aside className="panel h-fit p-4">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground">
            MA POSITION LP
          </h2>
          <div className="mono-num mt-1 text-2xl text-primary">
            {eth(myAssets)} ETH
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Mes parts" value={eth(myShares)} />
            <Row label="Solde wallet" value={`${eth(wallet?.value)} ETH`} />
          </dl>

          <label className="mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
            MONTANT À DÉPOSER (ETH)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="mono-num mt-1 w-full rounded border border-input bg-input/40 px-3 py-2 text-lg outline-none focus:border-primary"
          />
          <button
            onClick={deposit}
            disabled={isPending || !isConnected || !deployed}
            className="mt-3 w-full rounded bg-primary py-2.5 font-mono text-xs tracking-widest text-primary-foreground shadow-[var(--glow-primary)] hover:opacity-90 disabled:opacity-50"
          >
            {!isConnected ? "CONNECTE TON WALLET" : "DÉPOSER"}
          </button>
          <button
            onClick={withdrawAll}
            disabled={isPending || !isConnected || !deployed || !myShares}
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

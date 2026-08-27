import { useEffect, useState } from "react";
import { useAccount, useBalance, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { toast } from "sonner";

import { robinhoodChain, shortAddr } from "@/lib/chain";

export function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: bal } = useBalance({
    address,
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  });

  if (!mounted) {
    return (
      <div className="rounded border border-border bg-secondary/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
        …
      </div>
    );
  }

  if (!isConnected) {
    const injectedConnector = connectors[0];
    return (
      <button
        onClick={() => {
          if (typeof window !== "undefined" && !("ethereum" in window)) {
            toast.error("Aucun wallet détecté. Installe MetaMask ou Rabby.");
            return;
          }
          if (injectedConnector) connect({ connector: injectedConnector });
        }}
        disabled={isPending}
        className="rounded bg-primary px-3 py-1.5 font-mono text-[11px] tracking-widest text-primary-foreground shadow-[var(--glow-primary)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "CONNEXION…" : "CONNECTER WALLET"}
      </button>
    );
  }

  if (chainId !== robinhoodChain.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: robinhoodChain.id })}
        className="rounded border border-short px-3 py-1.5 font-mono text-[11px] tracking-widest text-short"
      >
        PASSER SUR ROBINHOOD CHAIN
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
          SOLDE ETH
        </div>
        <div className="mono-num text-sm text-primary">
          {bal ? Number(formatUnits(bal.value, bal.decimals)).toFixed(4) : "—"}
        </div>
      </div>
      <button
        onClick={() => disconnect()}
        title="Déconnecter"
        className="rounded border border-border bg-secondary/60 px-2.5 py-1.5 font-mono text-[11px] text-foreground hover:border-primary hover:text-primary"
      >
        {shortAddr(address)}
      </button>
    </div>
  );
}

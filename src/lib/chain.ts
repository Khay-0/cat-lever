import { defineChain } from "viem";

/** Robinhood Chain — Arbitrum Orbit L2, chainId 4663. */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://rpc.mainnet.chain.robinhood.com",
        "https://robinhood-rpc.publicnode.com",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Robinscan", url: "https://robinscan.io" },
  },
});

export const EXPLORER = "https://robinscan.io";

/** GeckoTerminal / Dexscreener network slug for Robinhood Chain. */
export const GT_NETWORK = "robinhood";

export const WETH_ADDRESS =
  "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;

/** Fallback market when the database has not been configured yet. */
export const CASHCAT = {
  symbol: "CASHCAT",
  name: "Cash Cat",
  tokenAddress: "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
  poolAddress: "0xa70fc67c9f69da90b63a0e4c05d229954574e313",
} as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const shortAddr = (a?: string) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

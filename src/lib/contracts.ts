/**
 * ABIs des contrats KOVA déployés sur Robinhood Chain (voir /contracts).
 * Les adresses sont stockées dans la config du protocole (panneau admin).
 */

export const vaultAbi = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalShares", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBorrowed", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableLiquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "sharesOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "assetsOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const perpAbi = [
  {
    type: "function",
    name: "open",
    stateMutability: "payable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "token", type: "address" },
      { name: "isLong", type: "bool" },
      { name: "leverageX100", type: "uint16" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "close",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "trader", type: "address" },
      { name: "pool", type: "address" },
      { name: "token", type: "address" },
      { name: "isLong", type: "bool" },
      { name: "collateral", type: "uint256" },
      { name: "size", type: "uint256" },
      { name: "entryPrice", type: "uint256" },
      { name: "openedAt", type: "uint256" },
      { name: "open", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "positionsOf",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "pnlOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "int256" }],
  },
  {
    type: "function",
    name: "liquidationPriceOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "priceOf",
    stateMutability: "view",
    inputs: [
      { name: "pool", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "tradingFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "maxLeverageX100", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  {
    type: "function",
    name: "setFees",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_tradingFeeBps", type: "uint16" },
      { name: "_borrowFeeBpsHourly", type: "uint16" },
      { name: "_liquidationFeeBps", type: "uint16" },
      { name: "_lpShareBps", type: "uint16" },
      { name: "_buybackShareBps", type: "uint16" },
      { name: "_treasuryShareBps", type: "uint16" },
      { name: "_maxLeverageX100", type: "uint16" },
    ],
    outputs: [],
  },
] as const;

export const isAddress = (v?: string | null): v is `0x${string}` =>
  typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);

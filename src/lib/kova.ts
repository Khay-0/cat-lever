export const bps = (v: number) => v / 10000;

export function fmtUsd(v: number, digits = 2) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtCompact(v: number) {
  return v.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export function fmtPrice(v: number) {
  return v < 1 ? v.toFixed(6) : v.toFixed(4);
}

export function liquidationPrice(entry: number, leverage: number, side: string) {
  const move = 1 / leverage;
  return side === "long" ? entry * (1 - move * 0.9) : entry * (1 + move * 0.9);
}

export function positionPnl(
  entry: number,
  current: number,
  collateral: number,
  leverage: number,
  side: string,
) {
  const change = (current - entry) / entry;
  const dir = side === "long" ? 1 : -1;
  return collateral * leverage * change * dir;
}

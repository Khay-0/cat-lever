import { useEffect, useRef, useState } from "react";

const ACCOUNT_KEY = "kova.account";
const BALANCE_KEY = "kova.balance";
const START_BALANCE = 10000;

export function getAccount(): string {
  if (typeof window === "undefined") return "anon";
  let a = window.localStorage.getItem(ACCOUNT_KEY);
  if (!a) {
    const hex = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    a = `rc1${hex}`;
    window.localStorage.setItem(ACCOUNT_KEY, a);
  }
  return a;
}

export function getBalance(): number {
  if (typeof window === "undefined") return START_BALANCE;
  const raw = window.localStorage.getItem(BALANCE_KEY);
  if (raw === null) {
    window.localStorage.setItem(BALANCE_KEY, String(START_BALANCE));
    return START_BALANCE;
  }
  return Number(raw);
}

export function setBalance(v: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BALANCE_KEY, String(Math.max(0, v)));
  window.dispatchEvent(new Event("kova:balance"));
}

export function useAccount() {
  const [account, setAccount] = useState("…");
  const [balance, setBal] = useState(START_BALANCE);
  useEffect(() => {
    setAccount(getAccount());
    setBal(getBalance());
    const sync = () => setBal(getBalance());
    window.addEventListener("kova:balance", sync);
    return () => window.removeEventListener("kova:balance", sync);
  }, []);
  return { account, balance };
}

/** Simulated on-chain price feed: random walk around the market base price. */
export function useLivePrice(basePrice: number, tickMs = 1500) {
  const [price, setPrice] = useState(basePrice);
  const [history, setHistory] = useState<number[]>([]);
  const base = useRef(basePrice);

  useEffect(() => {
    base.current = basePrice;
    setPrice(basePrice);
    setHistory(Array.from({ length: 60 }, () => basePrice));
  }, [basePrice]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPrice((p) => {
        const drift = (base.current - p) * 0.04;
        const shock = (Math.random() - 0.5) * base.current * 0.012;
        const next = Math.max(base.current * 0.4, p + drift + shock);
        setHistory((h) => [...h.slice(-79), next]);
        return next;
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return { price, history };
}

export const bps = (v: number) => v / 10000;

export function fmtUsd(v: number, digits = 2) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Market = {
  id: string;
  symbol: string;
  name: string;
  base_price: number;
  max_leverage: number;
  is_active: boolean;
  token_address: string | null;
  pool_address: string | null;
};

export type FeeConfig = {
  id: string;
  trading_fee_bps: number;
  borrow_fee_bps_hourly: number;
  liquidation_fee_bps: number;
  lp_share_bps: number;
  buyback_share_bps: number;
  treasury_share_bps: number;
  max_leverage: number;
  updated_at: string;
};

export type Position = {
  id: string;
  account: string;
  market_symbol: string;
  side: string;
  collateral: number;
  leverage: number;
  entry_price: number;
  liquidation_price: number;
  exit_price: number | null;
  fees_paid: number;
  pnl: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

export type LpPosition = {
  id: string;
  account: string;
  amount: number;
  created_at: string;
};

export type FeeEvent = {
  id: string;
  account: string;
  kind: string;
  amount: number;
  lp_amount: number;
  buyback_amount: number;
  treasury_amount: number;
  created_at: string;
};

export const marketsQuery = queryOptions({
  queryKey: ["markets"],
  queryFn: async (): Promise<Market[]> => {
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .order("created_at");
    if (error) throw error;
    return data as unknown as Market[];
  },
});

export const feeConfigQuery = queryOptions({
  queryKey: ["fee_config"],
  queryFn: async (): Promise<FeeConfig> => {
    const { data, error } = await supabase
      .from("fee_config")
      .select("*")
      .limit(1)
      .single();
    if (error) throw error;
    return data as unknown as FeeConfig;
  },
});

export const positionsQuery = queryOptions({
  queryKey: ["positions"],
  queryFn: async (): Promise<Position[]> => {
    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data as unknown as Position[];
  },
});

export const lpPositionsQuery = queryOptions({
  queryKey: ["lp_positions"],
  queryFn: async (): Promise<LpPosition[]> => {
    const { data, error } = await supabase
      .from("lp_positions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data as unknown as LpPosition[];
  },
});

export const feeEventsQuery = queryOptions({
  queryKey: ["fee_events"],
  queryFn: async (): Promise<FeeEvent[]> => {
    const { data, error } = await supabase
      .from("fee_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data as unknown as FeeEvent[];
  },
});

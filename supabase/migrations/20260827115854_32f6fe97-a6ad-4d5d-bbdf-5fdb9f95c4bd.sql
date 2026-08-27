CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 1,
  max_leverage numeric NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.markets TO anon, authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open markets" ON public.markets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.fee_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  trading_fee_bps integer NOT NULL DEFAULT 100,
  borrow_fee_bps_hourly integer NOT NULL DEFAULT 5,
  liquidation_fee_bps integer NOT NULL DEFAULT 250,
  lp_share_bps integer NOT NULL DEFAULT 7000,
  buyback_share_bps integer NOT NULL DEFAULT 2000,
  treasury_share_bps integer NOT NULL DEFAULT 1000,
  max_leverage numeric NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_config TO anon, authenticated;
GRANT ALL ON public.fee_config TO service_role;
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open fee_config" ON public.fee_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.lp_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lp_positions TO anon, authenticated;
GRANT ALL ON public.lp_positions TO service_role;
ALTER TABLE public.lp_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open lp_positions" ON public.lp_positions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  market_symbol text NOT NULL,
  side text NOT NULL DEFAULT 'long',
  collateral numeric NOT NULL,
  leverage numeric NOT NULL,
  entry_price numeric NOT NULL,
  liquidation_price numeric NOT NULL,
  exit_price numeric,
  fees_paid numeric NOT NULL DEFAULT 0,
  pnl numeric,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO anon, authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open positions" ON public.positions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.fee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  kind text NOT NULL,
  amount numeric NOT NULL,
  lp_amount numeric NOT NULL DEFAULT 0,
  buyback_amount numeric NOT NULL DEFAULT 0,
  treasury_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_events TO anon, authenticated;
GRANT ALL ON public.fee_events TO service_role;
ALTER TABLE public.fee_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open fee_events" ON public.fee_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.markets (symbol, name, base_price, max_leverage, is_active)
VALUES ('CASHCAT', 'Cash Cat', 0.0421, 3, true);

INSERT INTO public.fee_config (singleton) VALUES (true);
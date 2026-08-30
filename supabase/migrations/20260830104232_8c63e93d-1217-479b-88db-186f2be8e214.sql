ALTER TABLE public.fee_config
  ADD COLUMN IF NOT EXISTS vault_address text,
  ADD COLUMN IF NOT EXISTS perp_address text;

UPDATE public.fee_config SET trading_fee_bps = 20, updated_at = now();
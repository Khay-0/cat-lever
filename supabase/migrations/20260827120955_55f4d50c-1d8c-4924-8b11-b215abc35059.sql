ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS token_address TEXT,
  ADD COLUMN IF NOT EXISTS pool_address TEXT;

UPDATE public.markets
SET token_address = '0x020bfC650A365f8BB26819deAAbF3E21291018b4',
    pool_address = '0xa70fc67c9f69da90b63a0e4c05d229954574e313',
    name = 'Cash Cat'
WHERE upper(symbol) = 'CASHCAT';
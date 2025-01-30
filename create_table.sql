create table token_pairs (
  id bigint primary key generated always as identity,
  chain_id text not null,
  pair_address text not null unique,
  base_token jsonb not null,
  quote_token jsonb not null,
  price_usd numeric,
  liquidity_usd numeric,
  volume_24h numeric,
  created_at timestamptz,
  dex_info jsonb,
  inserted_at timestamptz not null default now()
); 
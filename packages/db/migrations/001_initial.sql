-- Markets table
CREATE TABLE IF NOT EXISTS markets (
  market_id TEXT PRIMARY KEY,
  season_id BIGINT NOT NULL,
  creator_wallet TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  curve_a BIGINT NOT NULL,
  curve_b BIGINT NOT NULL,
  reserve_bps INT NOT NULL,
  platform_bps INT NOT NULL,
  creator_bps INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_markets_season ON markets(season_id);
CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets(creator_wallet);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  signature TEXT PRIMARY KEY,
  slot BIGINT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  market_id TEXT NOT NULL REFERENCES markets(market_id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  side SMALLINT NOT NULL CHECK (side IN (0, 1)),
  token_amount NUMERIC(20, 9) NOT NULL,
  sol_gross_lamports NUMERIC(20, 0) NOT NULL,
  sol_net_lamports NUMERIC(20, 0) NOT NULL,
  fee_lamports NUMERIC(20, 0) NOT NULL,
  fee_tier SMALLINT NOT NULL,
  post_supply NUMERIC(20, 0) NOT NULL,
  post_price_lamports NUMERIC(20, 0) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_market_ts ON trades(market_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_trades_wallet ON trades(wallet);
CREATE INDEX IF NOT EXISTS idx_trades_slot ON trades(slot);

-- Market snapshots
CREATE TABLE IF NOT EXISTS market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(market_id) ON DELETE CASCADE,
  slot BIGINT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  supply NUMERIC(20, 0) NOT NULL,
  price_lamports NUMERIC(20, 0) NOT NULL,
  exit_reserve_lamports NUMERIC(20, 0) NOT NULL,
  volume_24h_lamports NUMERIC(20, 0) NOT NULL,
  holders_count BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_market_ts ON market_snapshots(market_id, ts DESC);

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
  season_id BIGINT PRIMARY KEY,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  params_json JSONB NOT NULL,
  reward_pool_lamports NUMERIC(20, 0) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended'))
);

-- Reward claims
CREATE TABLE IF NOT EXISTS reward_claims (
  season_id BIGINT NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_lamports NUMERIC(20, 0) NOT NULL,
  claim_tx_sig TEXT,
  status TEXT NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible', 'claimed', 'expired')),
  PRIMARY KEY (season_id, wallet, category)
);

-- Admin actions log
CREATE TABLE IF NOT EXISTS admin_actions (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_wallet TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  tx_sig TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_ts ON admin_actions(ts DESC);

# STACK, ARCHITECTURE, SCHEMA & MATH (IMPLEMENTATION BLUEPRINT)
## Solana Market Simulation Game — Developer Document v2

This document is intended to be **implementation-ready**. It provides:
- Recommended **stack/framework**
- Full **program/module architecture**
- **Account models, PDAs, and instruction set**
- **Bonding curve math** with integer-safety notes
- **Sell caps, cooldown, fee tiers** implementation logic
- **Backend schema + indexer + API skeleton**
- **Frontend transaction flows**
- **Development timeline and milestones**

> All money values in the programs MUST be handled in **lamports** (1 SOL = 1,000,000,000 lamports).

---

## 0. Repository Layout (Recommended)

```text
repo/
  apps/
    web/                       # Next.js frontend
    api/                       # Node/NestJS backend API
    indexer/                   # Event ingester / stream processor
  programs/
    factory/                   # Creates markets; stores immutable parameters
    market/                    # Bonding curve buy/sell + caps/fees + vault split
    rewards/                   # Seasons + reward pool + claims
  packages/
    sdk/                       # TypeScript SDK (quotes, fee calc, helpers)
    db/                        # SQL migrations + types
  docs/
    WHITEPAPER.md
    STACK_AND_ARCHITECTURE.md  # this file
```

---

## 1. Stack & Framework

### 1.1 On-chain
- **Rust + Anchor**
- SPL Token (Token Program)
- System Program (SOL vaults are PDAs holding lamports)
- Optional: Address Lookup Tables for transaction size (later)

### 1.2 Backend (Recommended)
- **TypeScript**
- **Indexer:** Helius / QuickNode webhook + backfill
- **DB:** PostgreSQL (Supabase acceptable)
- **API:** Fastify or NestJS
- **Cache:** Redis (leaderboards, hot market stats)
- **Queue:** BullMQ or Redis Streams (idempotent processing)

### 1.3 Frontend
- **Next.js (TypeScript)** + Tailwind
- Solana Wallet Adapter
- Anchor TS client
- Lightweight charts for candles

---

## 2. On-Chain Architecture

### 2.1 Program Responsibilities

**Factory program**
- Creates a `Market` PDA
- Creates/mints the token mint for the market
- Initializes vault PDAs
- Stores immutable parameters (curve, ratios, season id)

**Market program**
- Buy: SOL -> mint tokens, split SOL to vaults
- Sell: burn tokens -> SOL payout from ExitReserve subject to caps/fees
- Maintains per-wallet rolling state (sold_24h, last_sell_ts)
- Maintains global rolling state for market (global_sold_24h)

**Rewards program**
- Creates seasons
- Accumulates season reward pool (can receive transfers from Market program)
- Allows users to claim rewards after season end (proof by backend or on-chain merkle root—design choice)

---

## 3. PDAs & Accounts (Anchor)

### 3.1 PDA Seeds (Deterministic)

```rust
// Factory / Market
Market PDA:        ["market", token_mint]
Exit Reserve PDA:  ["exit_reserve", market]
Treasury PDA:      ["treasury", market]
Creator Stream PDA:["creator_stream", market]
GlobalConfig PDA:  ["config"]
Season PDA:        ["season", season_id.to_le_bytes()]

// Per user
UserState PDA:     ["user_state", market, user_pubkey]
```

---

### 3.2 Core Accounts

#### 3.2.1 GlobalConfig
Holds platform-wide or season-default constants.

```rust
#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub default_season_length_secs: i64,

    // Sell regulation defaults
    pub global_cap_bps: u16,   // e.g. 1500 = 15.00%
    pub wallet_cap_holdings_bps: u16, // e.g. 1000 = 10.00%
    pub wallet_cap_reserve_bps: u16,  // e.g. 300 = 3.00%
    pub cooldown_secs: i64,    // e.g. 300

    // Fee tiers stored as bps
    // Example tiers: [(0-20)->100, (20-40)->300, (40-60)->600, (60-80)->1200, (80-100)->2000]
    pub fee_tier_1_bps: u16,
    pub fee_tier_2_bps: u16,
    pub fee_tier_3_bps: u16,
    pub fee_tier_4_bps: u16,
    pub fee_tier_5_bps: u16,
}
```

#### 3.2.2 Market
Immutable parameters + mutable state.

```rust
#[account]
pub struct Market {
    pub creator: Pubkey,
    pub token_mint: Pubkey,

    // Vault PDAs (SOL lamports accounts)
    pub exit_reserve: Pubkey,
    pub treasury: Pubkey,
    pub creator_stream: Pubkey,

    // Bonding curve parameters (integer)
    // Price(S) = a*S + b
    pub curve_a: u64,
    pub curve_b: u64,

    // Split ratios in basis points (bps). Must sum to 10_000.
    pub reserve_bps: u16,
    pub platform_bps: u16,
    pub creator_bps: u16,

    // Supply and rolling global sell accounting (lamports)
    pub supply: u64,
    pub global_window_start_ts: i64,
    pub global_sold_in_window_lamports: u64,

    // Season binding
    pub season_id: u64,
    pub created_at_ts: i64,
}
```

#### 3.2.3 UserMarketState
Tracks wallet rolling sell usage and cooldown.

```rust
#[account]
pub struct UserMarketState {
    pub wallet: Pubkey,
    pub market: Pubkey,

    pub window_start_ts: i64,
    pub sold_in_window_lamports: u64,
    pub last_sell_ts: i64,
}
```

---

## 4. Instruction Set (Anchor)

### 4.1 Factory Program Instructions
- `initialize_config(admin, defaults...)`
- `create_market(params)`
  - creates token mint
  - creates Market PDA
  - creates vault PDAs (exit_reserve, treasury, creator_stream)

### 4.2 Market Program Instructions
- `buy(market, buyer, token_amount)`
- `sell(market, seller, token_amount)`
- `sync_window(market)` (optional helper; auto-performed inside buy/sell)

### 4.3 Rewards Program Instructions
- `create_season(season_id, start_ts, end_ts, params_snapshot)`
- `fund_reward_pool(season_id)` (receives SOL from platform)
- `publish_rewards_root(season_id, merkle_root)` (optional approach)
- `claim_reward(season_id, proof, amount)`

---

## 5. Bonding Curve Math (Integer-Safe)

### 5.1 Units and Overflow Rules
- Supply `S` and delta `Δ` are in **token base units** (respect token decimals).
- Costs/proceeds are in **lamports**.
- Use **u128** for intermediate multiplication to avoid overflow.

### 5.2 Linear Price Curve
Price per token (lamports) as function of supply:
- `p(S) = a*S + b`

Where:
- `a` and `b` are scaled such that price is in lamports per token base unit.

### 5.3 Buy cost
\[
Cost(S,\Delta)= a\cdot\frac{(S+\Delta)^2-S^2}{2}+b\cdot \Delta
\]

Rust implementation (checked, u128 intermediates):

```rust
pub fn buy_cost_lamports(s: u64, d: u64, a: u64, b: u64) -> Result<u64> {
    let s128 = s as u128;
    let d128 = d as u128;
    let a128 = a as u128;
    let b128 = b as u128;

    let new_s = s128 + d128;

    let term_sq = new_s
        .checked_mul(new_s).ok_or(ErrorCode::MathOverflow)?
        .checked_sub(s128.checked_mul(s128).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    let cost = a128
        .checked_mul(term_sq).ok_or(ErrorCode::MathOverflow)?
        .checked_div(2).ok_or(ErrorCode::MathOverflow)?
        .checked_add(b128.checked_mul(d128).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    u64::try_from(cost).map_err(|_| ErrorCode::MathOverflow.into())
}
```

### 5.4 Sell proceeds
\[
Proceeds(S,\Delta)= a\cdot\frac{S^2-(S-\Delta)^2}{2}+b\cdot \Delta
\]

```rust
pub fn sell_proceeds_lamports(s: u64, d: u64, a: u64, b: u64) -> Result<u64> {
    require!(d <= s, ErrorCode::InvalidDelta);
    let s128 = s as u128;
    let d128 = d as u128;
    let a128 = a as u128;
    let b128 = b as u128;

    let new_s = s128 - d128;

    let term_sq = s128
        .checked_mul(s128).ok_or(ErrorCode::MathOverflow)?
        .checked_sub(new_s.checked_mul(new_s).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    let proceeds = a128
        .checked_mul(term_sq).ok_or(ErrorCode::MathOverflow)?
        .checked_div(2).ok_or(ErrorCode::MathOverflow)?
        .checked_add(b128.checked_mul(d128).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    u64::try_from(proceeds).map_err(|_| ErrorCode::MathOverflow.into())
}
```

---

## 6. Sell Regulation (Exact, On-Chain Enforced)

### 6.1 Rolling Window Reset
Both market-global and user-level tracking are rolling 24h windows.

```rust
fn reset_if_expired(start_ts: &mut i64, sold: &mut u64, now: i64) {
    const WINDOW: i64 = 24 * 60 * 60;
    if now.saturating_sub(*start_ts) >= WINDOW {
        *start_ts = now;
        *sold = 0;
    }
}
```

### 6.2 Global cap (15% of ExitReserve per 24h)
Let:
- `exit_reserve_lamports = **exit_reserve.to_account_info().lamports.borrow()`
- `cap = exit_reserve_lamports * global_cap_bps / 10_000`

```rust
let exit_reserve_lamports: u64 = ctx.accounts.exit_reserve.to_account_info().lamports();
let cap = (exit_reserve_lamports as u128)
    .checked_mul(config.global_cap_bps as u128).ok_or(ErrorCode::MathOverflow)?
    .checked_div(10_000).ok_or(ErrorCode::MathOverflow)? as u64;

require!(
    market.global_sold_in_window_lamports
        .checked_add(net_payout).ok_or(ErrorCode::MathOverflow)? <= cap,
    ErrorCode::GlobalSellCapExceeded
);
```

### 6.3 Wallet cap
Define wallet cap as min:
- `wallet_holdings_value * wallet_cap_holdings_bps`
- `exit_reserve * wallet_cap_reserve_bps`

For MVP, wallet holdings value approximation can be:
- `wallet_token_balance * current_price`
(Exact proceeds is already computed; you can compute cap on **lamports** directly based on token balance and price.)

```rust
let price_now = price_lamports(market.supply, market.curve_a, market.curve_b)?;
let wallet_value = (wallet_token_balance as u128)
    .checked_mul(price_now as u128).ok_or(ErrorCode::MathOverflow)? as u64;

let cap_by_holdings = (wallet_value as u128)
    .checked_mul(config.wallet_cap_holdings_bps as u128).ok_or(ErrorCode::MathOverflow)?
    .checked_div(10_000).ok_or(ErrorCode::MathOverflow)? as u64;

let cap_by_reserve = (exit_reserve_lamports as u128)
    .checked_mul(config.wallet_cap_reserve_bps as u128).ok_or(ErrorCode::MathOverflow)?
    .checked_div(10_000).ok_or(ErrorCode::MathOverflow)? as u64;

let wallet_cap = cap_by_holdings.min(cap_by_reserve);

require!(
    user_state.sold_in_window_lamports
        .checked_add(net_payout).ok_or(ErrorCode::MathOverflow)? <= wallet_cap,
    ErrorCode::WalletSellCapExceeded
);
```

### 6.4 Cooldown (1 sell / 5 minutes)
```rust
require!(
    now.saturating_sub(user_state.last_sell_ts) >= config.cooldown_secs,
    ErrorCode::CooldownActive
);
```

---

## 7. Dynamic Sell Fee (Tiered)

Compute fee tier based on fraction of wallet cap used **after** this sell.
- Let `u = (sold_in_window + net_payout) / wallet_cap`

```rust
pub fn fee_bps(used: u64, cap: u64, cfg: &GlobalConfig) -> Result<u16> {
    require!(cap > 0, ErrorCode::InvalidCap);
    let usage = (used as u128)
        .checked_mul(100).ok_or(ErrorCode::MathOverflow)?
        .checked_div(cap as u128).ok_or(ErrorCode::MathOverflow)? as u64;

    let bps = match usage {
        0..=20 => cfg.fee_tier_1_bps,
        21..=40 => cfg.fee_tier_2_bps,
        41..=60 => cfg.fee_tier_3_bps,
        61..=80 => cfg.fee_tier_4_bps,
        _ => cfg.fee_tier_5_bps,
    };
    Ok(bps)
}
```

Apply fee:
```rust
let fee = (gross_payout as u128)
    .checked_mul(fee_bps as u128).ok_or(ErrorCode::MathOverflow)?
    .checked_div(10_000).ok_or(ErrorCode::MathOverflow)? as u64;

let net_payout = gross_payout.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;
```

Fee distribution:
- `fee_to_reserve` (e.g. 70%)
- `fee_to_platform` (e.g. 20%)
- `fee_to_season_pool` (e.g. 10%)
(These are parameters in config or market.)

---

## 8. Treasury Split (Buy)

For buy cost `cost_lamports`, split by bps:

```rust
fn split(cost: u64, reserve_bps: u16, platform_bps: u16, creator_bps: u16) -> Result<(u64,u64,u64)> {
    require!((reserve_bps as u32 + platform_bps as u32 + creator_bps as u32) == 10_000, ErrorCode::BadBps);
    let c = cost as u128;
    let r = (c * reserve_bps as u128 / 10_000) as u64;
    let p = (c * platform_bps as u128 / 10_000) as u64;
    let k = cost.checked_sub(r).ok_or(ErrorCode::MathOverflow)?.checked_sub(p).ok_or(ErrorCode::MathOverflow)?;
    Ok((r,p,k))
}
```

Transfer lamports using system instructions (from buyer to vault PDAs).

---

## 9. Anchor Instruction Skeletons (Market Program)

### 9.1 Errors
```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid delta")]
    InvalidDelta,
    #[msg("Global sell cap exceeded")]
    GlobalSellCapExceeded,
    #[msg("Wallet sell cap exceeded")]
    WalletSellCapExceeded,
    #[msg("Sell cooldown active")]
    CooldownActive,
    #[msg("Invalid cap")]
    InvalidCap,
    #[msg("Bad basis points sum")]
    BadBps,
}
```

### 9.2 Buy Instruction (Skeleton)
```rust
#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: PDA vault
    #[account(mut, address = market.exit_reserve)]
    pub exit_reserve: UncheckedAccount<'info>,

    /// CHECK: PDA vault
    #[account(mut, address = market.treasury)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: PDA vault
    #[account(mut, address = market.creator_stream)]
    pub creator_stream: UncheckedAccount<'info>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn buy(ctx: Context<Buy>, token_amount: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let now = Clock::get()?.unix_timestamp;

    // compute cost
    let cost = buy_cost_lamports(market.supply, token_amount, market.curve_a, market.curve_b)?;

    // split SOL into vaults (system transfers from buyer)
    let (to_reserve, to_treasury, to_creator) = split(cost, market.reserve_bps, market.platform_bps, market.creator_bps)?;

    // transfer lamports from buyer to each vault PDA
    // (system_program::transfer)

    // mint tokens to buyer (token::mint_to CPI) using mint authority PDA
    // market.supply += token_amount;

    // emit event
    Ok(())
}
```

### 9.3 Sell Instruction (Skeleton)
```rust
#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + std::mem::size_of::<UserMarketState>(),
        seeds = [b"user_state", market.key().as_ref(), seller.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserMarketState>,

    /// CHECK: PDA vault
    #[account(mut, address = market.exit_reserve)]
    pub exit_reserve: UncheckedAccount<'info>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let user_state = &mut ctx.accounts.user_state;
    let now = Clock::get()?.unix_timestamp;

    // reset rolling windows
    reset_if_expired(&mut market.global_window_start_ts, &mut market.global_sold_in_window_lamports, now);
    reset_if_expired(&mut user_state.window_start_ts, &mut user_state.sold_in_window_lamports, now);

    // cooldown
    // require!(now - user_state.last_sell_ts >= cooldown)

    // compute gross payout
    let gross = sell_proceeds_lamports(market.supply, token_amount, market.curve_a, market.curve_b)?;

    // compute wallet cap + global cap using current reserve
    // compute fee tier based on usage
    // compute net payout and enforce caps on net payout
    // burn tokens from seller (token::burn CPI)
    // transfer lamports from exit_reserve PDA to seller for net payout
    // distribute fee to reserve/platform/season pool
    // update market.supply -= token_amount
    // update sold counters and timestamps

    Ok(())
}
```

---

## 10. Backend: Database Schema (PostgreSQL)

### 10.1 Migrations (Core Tables)

```sql
CREATE TABLE markets (
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

CREATE TABLE trades (
  signature TEXT PRIMARY KEY,
  slot BIGINT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  market_id TEXT NOT NULL REFERENCES markets(market_id),
  wallet TEXT NOT NULL,
  side SMALLINT NOT NULL, -- 0 buy, 1 sell
  token_amount NUMERIC NOT NULL,
  sol_gross_lamports NUMERIC NOT NULL,
  sol_net_lamports NUMERIC NOT NULL,
  fee_lamports NUMERIC NOT NULL,
  fee_tier SMALLINT NOT NULL,
  post_supply NUMERIC NOT NULL,
  post_price_lamports NUMERIC NOT NULL
);

CREATE INDEX trades_market_ts ON trades (market_id, ts DESC);

CREATE TABLE market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(market_id),
  slot BIGINT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  supply NUMERIC NOT NULL,
  price_lamports NUMERIC NOT NULL,
  exit_reserve_lamports NUMERIC NOT NULL,
  volume_24h_lamports NUMERIC NOT NULL,
  holders_count BIGINT NOT NULL
);
```

### 10.2 Seasons & Rewards
```sql
CREATE TABLE seasons (
  season_id BIGINT PRIMARY KEY,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  params_json JSONB NOT NULL,
  reward_pool_lamports NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE reward_claims (
  season_id BIGINT NOT NULL REFERENCES seasons(season_id),
  wallet TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_lamports NUMERIC NOT NULL,
  claim_tx_sig TEXT,
  status TEXT NOT NULL DEFAULT 'eligible',
  PRIMARY KEY (season_id, wallet, category)
);
```

---

## 11. Indexer (TypeScript) — Minimal Working Skeleton

### 11.1 Event Handler (Idempotent)

```ts
import { Pool } from "pg";

export async function handleTradeEvent(pg: Pool, ev: any) {
  // ev.signature must be unique
  await pg.query(
    `INSERT INTO trades (signature, slot, ts, market_id, wallet, side, token_amount,
                         sol_gross_lamports, sol_net_lamports, fee_lamports, fee_tier,
                         post_supply, post_price_lamports)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (signature) DO NOTHING`,
    [ev.signature, ev.slot, ev.ts, ev.market, ev.wallet, ev.side, ev.tokenAmount,
     ev.solGross, ev.solNet, ev.fee, ev.feeTier, ev.postSupply, ev.postPrice]
  );

  // Update derived snapshot (simplified; production uses aggregation jobs)
  await updateSnapshot(pg, ev.market);
}
```

### 11.2 Snapshot Aggregation (Example)
```ts
async function updateSnapshot(pg: Pool, marketId: string) {
  // compute last price, supply, reserve, volume_24h using SQL aggregation
  // then insert into market_snapshots
}
```

---

## 12. API (Fastify / NestJS) — Endpoint Skeleton

### 12.1 Markets List
```ts
GET /markets
GET /markets/:id
GET /markets/:id/trades?limit=200
GET /markets/:id/candles?tf=1m&from=...&to=...
GET /seasons/current
GET /seasons/:id/leaderboards
GET /seasons/:id/rewards/:wallet
```

### 12.2 Example Route (Fastify)
```ts
fastify.get("/markets/:id", async (req, reply) => {
  const { id } = req.params as any;
  const { rows } = await pg.query("SELECT * FROM markets WHERE market_id=$1", [id]);
  if (!rows.length) return reply.code(404).send({ error: "not_found" });
  return rows[0];
});
```

---

## 13. Frontend (Next.js) — Transaction Flows

### 13.1 Buy Flow (Anchor TS)
```ts
import { BN } from "bn.js";

await program.methods
  .buy(new BN(tokenAmount))
  .accounts({
    buyer: wallet.publicKey,
    market,
    exitReserve,
    treasury,
    creatorStream,
    tokenMint,
    buyerTokenAccount,
  })
  .rpc();
```

### 13.2 Sell Flow (Anchor TS)
```ts
await program.methods
  .sell(new BN(tokenAmount))
  .accounts({
    seller: wallet.publicKey,
    market,
    userState,
    exitReserve,
    tokenMint,
    sellerTokenAccount,
  })
  .rpc();
```

---

## 14. Development Timeline (Phase Plan)

| Phase | Weeks | Deliverables |
|---|---:|---|
| Spec Lock | 1 | Parameters + invariants + instruction definitions |
| On-chain MVP | 2–5 | Factory + Market programs; buy/sell; caps/fees; tests |
| Backend MVP | 3–6 | Indexer + DB + core API endpoints |
| Frontend MVP | 4–7 | Wallet connect + market UI + buy/sell |
| Seasons/Rewards | 7–10 | Season pools + leaderboards + claims |
| Hardening | 10–12 | Stress tests + security checks + monitoring |
| Launch | 13 | Season 1 rollout |

---

## 15. Missing Pieces (Explicit)

This v2 document provides complete skeletons, but these items still require final design choices before coding production:
- **Exact curve constants** (`a`, `b`) and token decimals
- **Exact fee distribution percentages**
- **Rewards proof mechanism** (direct on-chain calc vs merkle distribution)
- **Queue behavior** when global cap is exceeded (FIFO vs pro-rata vs partial fill)

---

END OF DOCUMENT

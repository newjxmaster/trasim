# ADMIN ROLE & ADMIN INTERFACE SPECIFICATION (ADDENDUM)
## Solana Market Simulation Game — Governance + UI Requirements

This document resolves the gap identified:

- Papers mention **Admin role** (`GlobalConfig.admin` can initialize config and create seasons)
- Papers mention **Platform control** (Game Treasury withdrawal + reward pool funding)
- But no admin interface/UI spec existed

This addendum defines:
1. Exact **admin privileges** and constraints (on-chain)
2. Required **admin instructions** (Anchor)
3. A minimal **Admin Dashboard** (Next.js) spec
4. Backend endpoints + database tables to support admin tooling

---

## 1. Governance Model

### 1.1 Roles
**Admin (Platform Governance)**
- Controls global parameters via `GlobalConfig`
- Can create/close seasons
- Can withdraw only from **Game Treasury** (platform fees)
- Can fund **Season Reward Pools**
- Cannot withdraw from **Exit Reserve** (hard-coded invariant)

**Creator**
- Can create a market via Factory (pays creation fee)
- Earns only via `CreatorStream` vesting

**Player**
- Can buy/sell tokens
- Sell capped + fee tiers enforced on-chain

---

## 2. On-Chain Access Control (Anchor)

Anchor provides account constraints like `has_one` and custom `constraint = ...` checks to enforce admin-only access.  
References:
- Anchor account constraints documentation (`has_one`). citeturn0search13  
- Helius security guide recommending `constraint = config.admin == admin.key()`. citeturn0search5  
- Solana Foundation course suggests storing admin in config and initializing via an instruction. citeturn0search4

### 2.1 GlobalConfig Account

```rust
#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub paused: bool,

    // Defaults (basis points)
    pub global_cap_bps: u16,              // 1500 = 15%
    pub wallet_cap_holdings_bps: u16,     // 1000 = 10%
    pub wallet_cap_reserve_bps: u16,      // 300 = 3%
    pub cooldown_secs: i64,               // 300 sec

    // Fee tiers (bps)
    pub fee_tier_1_bps: u16, // 100 = 1%
    pub fee_tier_2_bps: u16, // 300 = 3%
    pub fee_tier_3_bps: u16, // 600 = 6%
    pub fee_tier_4_bps: u16, // 1200 = 12%
    pub fee_tier_5_bps: u16, // 2000 = 20%
}
```

---

## 3. Admin Instructions (Anchor) — REQUIRED

### 3.1 Initialize Config (admin sets first parameters)

```rust
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = admin, space = 8 + std::mem::size_of::<GlobalConfig>() )]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.paused = false;

    cfg.global_cap_bps = 1500;
    cfg.wallet_cap_holdings_bps = 1000;
    cfg.wallet_cap_reserve_bps = 300;
    cfg.cooldown_secs = 300;

    cfg.fee_tier_1_bps = 100;
    cfg.fee_tier_2_bps = 300;
    cfg.fee_tier_3_bps = 600;
    cfg.fee_tier_4_bps = 1200;
    cfg.fee_tier_5_bps = 2000;

    Ok(())
}
```

---

### 3.2 Update Config (admin-only)

```rust
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, has_one = admin)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    paused: bool,
    global_cap_bps: u16,
    wallet_cap_holdings_bps: u16,
    wallet_cap_reserve_bps: u16,
    cooldown_secs: i64,
    fee_tier_1_bps: u16,
    fee_tier_2_bps: u16,
    fee_tier_3_bps: u16,
    fee_tier_4_bps: u16,
    fee_tier_5_bps: u16,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;

    // sanity bounds
    require!(global_cap_bps <= 3000, ErrorCode::BadParam); // <= 30%
    require!(fee_tier_5_bps <= 5000, ErrorCode::BadParam); // <= 50%

    cfg.paused = paused;
    cfg.global_cap_bps = global_cap_bps;
    cfg.wallet_cap_holdings_bps = wallet_cap_holdings_bps;
    cfg.wallet_cap_reserve_bps = wallet_cap_reserve_bps;
    cfg.cooldown_secs = cooldown_secs;

    cfg.fee_tier_1_bps = fee_tier_1_bps;
    cfg.fee_tier_2_bps = fee_tier_2_bps;
    cfg.fee_tier_3_bps = fee_tier_3_bps;
    cfg.fee_tier_4_bps = fee_tier_4_bps;
    cfg.fee_tier_5_bps = fee_tier_5_bps;

    Ok(())
}
```

> `has_one = admin` is the standard Anchor way to bind admin access to a config account. citeturn0search13

---

### 3.3 Create Season (admin-only)

```rust
#[account]
pub struct Season {
    pub id: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub reward_pool_lamports: u64,
    pub status: u8, // 0=active,1=ended
}

#[derive(Accounts)]
pub struct CreateSeason<'info> {
    #[account(has_one = admin)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,

    #[account(init, payer = admin, space = 8 + std::mem::size_of::<Season>(),
        seeds = [b"season", &season_id.to_le_bytes()], bump)]
    pub season: Account<'info, Season>,

    pub system_program: Program<'info, System>,
}

pub fn create_season(ctx: Context<CreateSeason>, season_id: u64, start_ts: i64, end_ts: i64) -> Result<()> {
    require!(end_ts > start_ts, ErrorCode::BadParam);
    let s = &mut ctx.accounts.season;
    s.id = season_id;
    s.start_ts = start_ts;
    s.end_ts = end_ts;
    s.reward_pool_lamports = 0;
    s.status = 0;
    Ok(())
}
```

---

### 3.4 End Season (admin-only)

```rust
#[derive(Accounts)]
pub struct EndSeason<'info> {
    #[account(has_one = admin)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub season: Account<'info, Season>,
}

pub fn end_season(ctx: Context<EndSeason>) -> Result<()> {
    let s = &mut ctx.accounts.season;
    s.status = 1;
    Ok(())
}
```

---

### 3.5 Withdraw Platform Treasury (admin-only)

**Invariant:** admin can withdraw **only** from the platform treasury vault, never the exit reserve.

```rust
#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(has_one = admin)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,

    /// CHECK: platform treasury PDA (market-level or global)
    #[account(mut)]
    pub treasury_vault: UncheckedAccount<'info>,

    /// CHECK: recipient
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, lamports: u64) -> Result<()> {
    **ctx.accounts.treasury_vault.to_account_info().try_borrow_mut_lamports()? -= lamports;
    **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += lamports;
    Ok(())
}
```

---

### 3.6 Fund Season Reward Pool (admin-only)

```rust
#[derive(Accounts)]
pub struct FundSeasonPool<'info> {
    #[account(has_one = admin)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,

    /// CHECK: platform treasury vault
    #[account(mut)]
    pub treasury_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub season: Account<'info, Season>,
}

pub fn fund_season_pool(ctx: Context<FundSeasonPool>, lamports: u64) -> Result<()> {
    **ctx.accounts.treasury_vault.to_account_info().try_borrow_mut_lamports()? -= lamports;
    ctx.accounts.season.reward_pool_lamports =
        ctx.accounts.season.reward_pool_lamports.checked_add(lamports).ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}
```

---

## 4. Admin Dashboard (Next.js) — MINIMUM SPEC

### 4.1 Access Control
Admin UI is accessible only if:
1) Connected wallet == `GlobalConfig.admin`
2) UI confirms with on-chain read (no backend trust)

```ts
const isAdmin = connectedWallet === config.admin;
if (!isAdmin) return <NotAuthorized />;
```

### 4.2 Pages

#### `/admin`
- Summary cards:
  - Current season status
  - Total platform treasury
  - Active markets count
  - Total volume 24h

#### `/admin/config`
- Form to update:
  - pause/unpause
  - caps bps
  - cooldown seconds
  - fee tiers bps
- Buttons:
  - “Submit update_config transaction”

#### `/admin/seasons`
- Create season form:
  - season_id
  - start_ts/end_ts
- End season button
- Fund reward pool button

#### `/admin/treasury`
- Withdraw from platform treasury vault
- Fund season pool
- Transfers history

#### `/admin/markets`
- Market lookup + actions:
  - freeze market (optional instruction)
  - set market status (deprecate)
  - view abnormal activity metrics

---

## 5. Backend Support (Optional but Recommended)

Admin UI can work fully on-chain, but backend is useful for:
- analytics
- auditing
- history views

### 5.1 Admin API endpoints (read-only + logs)
- `GET /admin/overview`
- `GET /admin/transfers`
- `GET /admin/markets/flagged`

### 5.2 Admin action logging table
```sql
CREATE TABLE admin_actions (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_wallet TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  tx_sig TEXT
);
```

---

## 6. Security Invariants (Non-Negotiable)

1. Exit Reserve vault has **no withdraw path**
2. Admin withdrawals allowed only from **Treasury vault**
3. All admin-only instructions must enforce:
   - `has_one = admin` or explicit `constraint = config.admin == admin.key()` citeturn0search5turn0search13
4. Season parameters are immutable after start (recommended)
5. Any pause switch must disable buy/sell in emergency

---

END OF DOCUMENT

# AI ASSISTANT CONTEXT - TRASIM PROJECT

> **Purpose**: This file provides essential context for AI assistants working on TRASIM.
> Read this FIRST before making any changes.

---

## 🎯 What is TRASIM?

A Solana-based speculative market simulation game with:
- **Bonding curve trading** (linear price curves)
- **Anti-rug-pull mechanisms** (protected Exit Reserve)
- **Sell regulation** (caps, cooldowns, dynamic fees)
- **Seasonal gameplay** (30-60 day competitive cycles)
- **Real economic incentives** (SOL-based trading)

**Think**: Pump.fun meets fair game mechanics with structural rug-pull prevention.

---

## 🏗️ Architecture at a Glance

### On-Chain (Solana/Anchor)
- **Factory Program**: Creates markets, initializes config
- **Market Program**: Buy/sell with bonding curves, enforces caps/fees
- **Rewards Program**: Manages seasons, reward pools, treasury

### Off-Chain (TypeScript)
- **API** (Fastify): REST endpoints for markets, trades, seasons
- **Indexer**: Listens to Solana events, updates database
- **Web** (Next.js): Frontend with wallet adapter
- **SDK**: Bonding curve math, quote calculations

### Database (Supabase/PostgreSQL)
- 6 tables: markets, trades, market_snapshots, seasons, reward_claims, admin_actions
- Running locally on port 54342
- Studio UI on port 54343

---

## 🔐 Security Model (CRITICAL)

### The Golden Rule
**Exit Reserve is UNTOUCHABLE**. No withdraw path exists or should ever exist.

### Treasury Architecture
```
SOL Inflow (Buy)
    ↓
    ├─→ Exit Reserve (70%) ────→ [LOCKED - Pays sellers only]
    ├─→ Platform Treasury (20%) → [Admin withdrawable]
    └─→ Creator Stream (10%) ───→ [Vested to creator]
```

### Sell Regulation (On-Chain Enforced)
1. **Global Cap**: Max 15% of Exit Reserve per 24h
2. **Wallet Cap**: Min(10% of holdings, 3% of Exit Reserve) per 24h
3. **Cooldown**: 1 sell per 5 minutes per wallet
4. **Dynamic Fees**: 1% → 3% → 6% → 12% → 20% based on cap usage

### Admin Powers (Restricted)
- ✅ Can: Update config, create seasons, withdraw Platform Treasury
- ❌ Cannot: Access Exit Reserve, bypass sell caps, mint tokens arbitrarily

---

## 📊 Current Status (Jan 19, 2026)

### ✅ Complete
- All 3 on-chain programs (Factory, Market, Rewards)
- Database schema with 6 tables
- Basic API structure
- Basic web app structure
- SDK with bonding curve math
- Local Supabase setup
- Comprehensive documentation

### 🚧 In Progress / TODO
- Complete indexer event parsing
- Buy/sell UI flows
- Market detail pages with charts
- User portfolio view
- Season rewards UI
- Unit tests
- Integration tests
- E2E tests

### 🎯 Next Priority
**Complete the indexer** (`apps/indexer/src/index.ts`)

---

## 🧮 Bonding Curve Math (CRITICAL)

### Price Function
```
p(S) = a*S + b
```
Where S = supply, a = slope, b = base price

### Buy Cost (Integral)
```
Cost(S, Δ) = a*(S+Δ)²/2 - a*S²/2 + b*Δ
```

### Sell Proceeds (Integral minus fees)
```
Proceeds(S, Δ) = a*S²/2 - a*(S-Δ)²/2 + b*Δ - fees
```

### ALWAYS Use u128 Intermediates
```rust
let cost = (a as u128)
    .checked_mul(term_sq).ok_or(ErrorCode::MathOverflow)?
    .checked_div(2).ok_or(ErrorCode::MathOverflow)?;
```

**Never use unchecked arithmetic!**

---

## 🗂️ File Organization

### Most Important Files
1. `docs/WHITEPAPER.md` - Game design (MUST READ)
2. `docs/STACK_AND_ARCHITECTURE.md` - Implementation spec (MUST READ)
3. `docs/ADMIN_GOVERNANCE_AND_DASHBOARD.md` - Admin features
4. `AI_ASSISTANT_INSTRUCTIONS.md` - Detailed instructions for AI
5. `REVIEW_AND_RECOMMENDATIONS.md` - Current assessment

### Code Entry Points
- `trasim/programs/market/src/lib.rs` - Core trading logic
- `apps/indexer/src/index.ts` - Event processing (needs work)
- `apps/api/src/index.ts` - Backend API
- `apps/web/src/app/page.tsx` - Frontend home
- `packages/sdk/src/index.ts` - Bonding curve calculations

---

## ⚠️ NEVER DO THIS

1. ❌ Create a withdraw path from Exit Reserve
2. ❌ Allow non-admin to withdraw from Platform Treasury
3. ❌ Use unchecked math in Rust programs
4. ❌ Change the admin wallet address
5. ❌ Modify database directly (always use migrations)
6. ❌ Deploy to mainnet without thorough testing
7. ❌ Bypass sell caps or cooldowns
8. ❌ Hardcode sensitive values (use .env)

---

## ✅ ALWAYS DO THIS

1. ✅ Use checked arithmetic (`.checked_add()`, `.checked_mul()`)
2. ✅ Use u128 for intermediate calculations
3. ✅ Validate admin access with `has_one = admin`
4. ✅ Create database migrations for schema changes
5. ✅ Test locally before deploying
6. ✅ Read documentation before changing critical code
7. ✅ Handle errors explicitly
8. ✅ Emit events for important state changes

---

## 🔑 Critical Constants

### Admin Wallet (NEVER CHANGE)
```
PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am
```

### Sell Regulation Defaults
- Global cap: 1500 bps (15%)
- Wallet holdings cap: 1000 bps (10%)
- Wallet reserve cap: 300 bps (3%)
- Cooldown: 300 seconds (5 minutes)

### Fee Tiers (basis points)
- Tier 1 (0-20% usage): 100 bps (1%)
- Tier 2 (20-40%): 300 bps (3%)
- Tier 3 (40-60%): 600 bps (6%)
- Tier 4 (60-80%): 1200 bps (12%)
- Tier 5 (80-100%): 2000 bps (20%)

### Treasury Split (basis points, must sum to 10000)
- Exit Reserve: 7000 bps (70%)
- Platform Treasury: 2000 bps (20%)
- Creator Stream: 1000 bps (10%)

---

## 🎯 Development Priorities

### Phase 1: Core Functionality (Current)
1. Complete indexer implementation
2. Add buy/sell UI flows
3. Write unit tests for bonding curve math
4. Test programs on localnet

### Phase 2: Testing & Hardening
1. Integration tests for all programs
2. E2E tests for user flows
3. Load testing for API
4. Security audit preparation

### Phase 3: Polish & Launch
1. Market detail pages with charts
2. User portfolio and history
3. Season leaderboards UI
4. Admin dashboard completion
5. User documentation

---

## 💬 Communication Guidelines

### When to Ask User
- Changing security-critical code
- Modifying bonding curve math
- Deploying to devnet/mainnet
- Major architectural changes
- Unclear requirements

### When to Proceed
- Adding new features (UI, API)
- Writing tests
- Improving documentation
- Refactoring non-critical code
- Fixing obvious bugs

---

## 📖 Quick Command Reference

```bash
# Start everything
supabase start && yarn dev

# Build programs
cd trasim && anchor build

# Create migration
supabase migration new migration_name

# View database
open http://127.0.0.1:54343
```

---

**Last Updated**: January 19, 2026
**Project Grade**: A- (Excellent foundation)
**Status**: Ready for feature development
**Next Task**: Complete indexer in `apps/indexer/src/index.ts`


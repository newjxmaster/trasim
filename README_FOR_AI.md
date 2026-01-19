# 🤖 README FOR AI ASSISTANTS

> **You are continuing work on TRASIM, a Solana-based market simulation game.**
> This file is your starting point. Read it completely before making any changes.

---

## 🎯 Your Mission

Help complete TRASIM - a production-ready Solana game with anti-rug-pull mechanics, bonding curve trading, and seasonal competitive cycles.

**Current Status**: Foundation complete (Grade A-), ready for feature implementation.

**Your First Task**: Complete the indexer in `apps/indexer/src/index.ts`

---

## 📚 REQUIRED READING (Read in this order)

### 1. Start Here (5 minutes)
- **This file** - You're reading it now ✓
- `AI_CONTEXT.md` - Essential context and critical rules
- `QUICK_REFERENCE.md` - Commands and URLs

### 2. Detailed Instructions (15 minutes)
- `AI_ASSISTANT_INSTRUCTIONS.md` - Complete guide for AI assistants
- `NEXT_STEPS_CHECKLIST.md` - Task breakdown with acceptance criteria

### 3. Project Documentation (30 minutes)
- `docs/WHITEPAPER.md` - Game design and economics
- `docs/STACK_AND_ARCHITECTURE.md` - Technical implementation spec
- `docs/ADMIN_GOVERNANCE_AND_DASHBOARD.md` - Admin features

### 4. Status & Setup (10 minutes)
- `REVIEW_AND_RECOMMENDATIONS.md` - Project assessment
- `SUPABASE_SETUP.md` - Database guide
- `BUILD_SUMMARY.md` - What's been built

**Total Reading Time**: ~60 minutes (worth it!)

---

## ⚡ Quick Start

### 1. Verify Environment
```bash
# Check Supabase is running
supabase status

# If not running, start it
supabase start

# Verify database
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres -c "\dt"
```

### 2. Start Development
```bash
# Install dependencies (if needed)
yarn install

# Start all services
yarn dev
```

### 3. Access Services
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Supabase Studio: http://127.0.0.1:54343

---

## 🚨 CRITICAL RULES - READ CAREFULLY

### Security Invariants (NEVER VIOLATE)
1. ❌ **NEVER** create a withdraw path from Exit Reserve
2. ❌ **NEVER** allow non-admin to access Platform Treasury
3. ❌ **NEVER** bypass sell caps (15% global, 10% holdings/3% reserve)
4. ❌ **NEVER** use unchecked math in Rust (always `.checked_*()`)
5. ❌ **NEVER** change admin wallet: `PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am`

### Development Rules (ALWAYS FOLLOW)
1. ✅ **ALWAYS** use u128 for intermediate calculations in Rust
2. ✅ **ALWAYS** create migrations for database changes
3. ✅ **ALWAYS** test locally before suggesting deployment
4. ✅ **ALWAYS** read relevant docs before changing critical code
5. ✅ **ALWAYS** handle errors explicitly (no silent failures)

### When to Ask User
- Changing security-critical code (sell caps, admin access, treasury)
- Modifying bonding curve math
- Deploying to devnet/mainnet
- Major architectural changes
- Unclear requirements

### When to Proceed
- Adding new features (UI, API endpoints)
- Writing tests
- Improving documentation
- Refactoring non-critical code
- Fixing obvious bugs

---

## 🎯 Current Priorities (Phase 1)

### Task 1: Complete Indexer ⭐ HIGHEST PRIORITY
**File**: `apps/indexer/src/index.ts`

**What to do**:
1. Set up Solana WebSocket connection
2. Subscribe to program logs
3. Parse Anchor events from transactions
4. Insert trades into database (idempotent)
5. Update market snapshots

**Why it matters**: Without the indexer, the frontend can't display trade history or market data.

**Acceptance Criteria**:
- Indexer runs without crashing
- Trades appear in database after on-chain transactions
- Handles reconnections gracefully

**See**: `NEXT_STEPS_CHECKLIST.md` for detailed steps

---

### Task 2: Buy/Sell UI Flows
**Files**: Create `apps/web/src/app/market/[id]/page.tsx`

**What to do**:
1. Create market detail page
2. Add buy form with quote calculation
3. Add sell form with fee/cap display
4. Connect to Solana wallet
5. Build and send transactions

**Why it matters**: Core user experience - users need to trade!

**See**: `NEXT_STEPS_CHECKLIST.md` for detailed steps

---

### Task 3: Unit Tests
**Files**: `packages/sdk/src/index.test.ts`, `trasim/tests/trasim.ts`

**What to do**:
1. Test bonding curve math
2. Test sell cap enforcement
3. Test fee calculations
4. Test admin access control

**Why it matters**: Ensures security and correctness before deployment.

---

## 🗂️ Project Structure

```
TRASIM/
├── trasim/programs/          # Solana programs (Rust + Anchor)
│   ├── factory/              # ✅ Complete - Market creation
│   ├── market/               # ✅ Complete - Trading logic
│   └── rewards/              # ✅ Complete - Seasons & treasury
├── apps/
│   ├── api/                  # ✅ Basic structure - Needs endpoints
│   ├── web/                  # 🚧 In progress - Needs buy/sell UI
│   └── indexer/              # ⭐ PRIORITY - Needs implementation
├── packages/
│   ├── sdk/                  # ✅ Complete - Needs tests
│   └── db/                   # ✅ Complete - Schema ready
├── supabase/                 # ✅ Complete - Running locally
└── docs/                     # ✅ Complete - Comprehensive
```

**Legend**:
- ✅ Complete
- 🚧 In progress
- ⭐ High priority

---

## 🔑 Essential Information

### Admin Wallet (NEVER CHANGE)
```
PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am
```

### Database Connection
```
postgresql://postgres:postgres@127.0.0.1:54342/postgres
```

### Program IDs
```
Factory: 9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg
Market:  67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz
Rewards: 3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B
```

---

## 🧮 Bonding Curve Math (Critical)

### Price Function
```
p(S) = a*S + b
```

### Buy Cost
```
Cost = a*(S+Δ)²/2 - a*S²/2 + b*Δ
```

### Sell Proceeds (before fees)
```
Proceeds = a*S²/2 - a*(S-Δ)²/2 + b*Δ
```

**ALWAYS use u128 intermediates to prevent overflow!**

See `docs/STACK_AND_ARCHITECTURE.md` section 5 for implementation details.

---

## 🛠️ Common Commands

```bash
# Start everything
supabase start && yarn dev

# Individual services
yarn dev:api      # Backend
yarn dev:web      # Frontend
yarn dev:indexer  # Event processor

# Database
supabase status                    # Check status
supabase migration new name        # Create migration
supabase db reset                  # Reset database

# On-chain programs
cd trasim
anchor build                       # Build programs
anchor test                        # Run tests
anchor deploy                      # Deploy to localnet
```

---

## 📊 Success Metrics

You're doing well if:
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ Services start without errors
- ✅ Security invariants maintained
- ✅ Code follows existing patterns
- ✅ Documentation updated

---

## 🆘 Getting Help

1. Check `AI_ASSISTANT_INSTRUCTIONS.md` for detailed guidance
2. Review `docs/STACK_AND_ARCHITECTURE.md` for technical details
3. Look at existing code for patterns
4. Check logs (Supabase, API, browser console)
5. Ask user if security-critical or unclear

---

## 🎉 Let's Build!

You have everything you need:
- ✅ Excellent documentation
- ✅ Solid architecture
- ✅ Working database
- ✅ Clear priorities

**Next Step**: Read `AI_CONTEXT.md` then start on the indexer!

---

**Project Status**: Ready for development
**Your First Task**: Complete indexer (`apps/indexer/src/index.ts`)
**Estimated Time**: 2-4 hours for indexer
**Support**: All documentation in this directory

Good luck! 🚀


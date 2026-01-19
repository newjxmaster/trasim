# TRASIM - Next Steps Checklist

> **For AI Assistants**: Follow this checklist when continuing work on TRASIM.

---

## 📋 Before You Start

### 1. Read Documentation (30 minutes)
- [ ] Read `AI_CONTEXT.md` - Quick overview
- [ ] Read `AI_ASSISTANT_INSTRUCTIONS.md` - Detailed instructions
- [ ] Read `docs/WHITEPAPER.md` - Game design
- [ ] Read `docs/STACK_AND_ARCHITECTURE.md` - Technical spec
- [ ] Skim `REVIEW_AND_RECOMMENDATIONS.md` - Current status

### 2. Verify Environment
- [ ] Check Supabase is running: `supabase status`
- [ ] If not running: `supabase start`
- [ ] Verify database tables exist: `psql postgresql://postgres:postgres@127.0.0.1:54342/postgres -c "\dt"`
- [ ] Check `.env` file has correct values
- [ ] Verify admin wallet is: `PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am`

### 3. Test Services
- [ ] Try starting API: `yarn dev:api`
- [ ] Try starting web: `yarn dev:web`
- [ ] Open Supabase Studio: http://127.0.0.1:54343
- [ ] Verify all services can connect to database

---

## 🎯 Phase 1: Core Functionality (CURRENT PRIORITY)

### Task 1: Complete Indexer ⭐ HIGHEST PRIORITY
**File**: `apps/indexer/src/index.ts`

- [ ] Set up Solana WebSocket connection to RPC
- [ ] Subscribe to program logs for all 3 programs
- [ ] Parse Anchor events from transaction logs
- [ ] Extract TradeEvent data (signature, market, wallet, side, amounts)
- [ ] Insert trades into database (use `ON CONFLICT DO NOTHING` for idempotency)
- [ ] Update market_snapshots table with aggregated data
- [ ] Handle connection errors and reconnection
- [ ] Add logging for debugging
- [ ] Test with localnet transactions

**Acceptance Criteria**:
- Indexer runs without crashing
- Trades appear in database after on-chain transactions
- Idempotent (can replay same events without duplicates)
- Handles network disconnections gracefully

---

### Task 2: Buy/Sell UI Flows
**Files**: `apps/web/src/app/market/[id]/page.tsx` (create new)

#### 2.1 Market Detail Page
- [ ] Create route: `/market/[id]`
- [ ] Fetch market data from API
- [ ] Display market info (name, supply, price, reserve)
- [ ] Show recent trades list
- [ ] Add placeholder for chart (implement later)

#### 2.2 Buy Form
- [ ] Create buy form component
- [ ] Input: token amount to buy
- [ ] Calculate cost using SDK: `buyCost(supply, amount, a, b)`
- [ ] Display: cost in SOL, new price, slippage
- [ ] Connect to wallet
- [ ] Build transaction using Anchor
- [ ] Send transaction and handle confirmation
- [ ] Show success/error messages
- [ ] Refresh market data after transaction

#### 2.3 Sell Form
- [ ] Create sell form component
- [ ] Input: token amount to sell
- [ ] Fetch user's token balance
- [ ] Calculate proceeds using SDK: `sellProceeds(supply, amount, a, b)`
- [ ] Calculate fee tier based on usage
- [ ] Display: proceeds in SOL, fee amount, net proceeds
- [ ] Show remaining daily cap
- [ ] Check cooldown status
- [ ] Build transaction using Anchor
- [ ] Send transaction and handle confirmation
- [ ] Show success/error messages
- [ ] Handle cap/cooldown errors gracefully

**Acceptance Criteria**:
- Users can buy tokens and see cost preview
- Users can sell tokens and see proceeds/fees preview
- Transactions succeed on-chain
- UI updates after transactions
- Errors are displayed clearly

---

### Task 3: Unit Tests for Bonding Curve Math
**File**: `packages/sdk/src/index.test.ts` (create new)

- [ ] Test `buyCost()` with various inputs
- [ ] Test `sellProceeds()` with various inputs
- [ ] Test fee tier calculation
- [ ] Test edge cases (zero amounts, max values)
- [ ] Test overflow protection
- [ ] Verify math matches on-chain implementation

**Acceptance Criteria**:
- All tests pass
- Coverage > 80% for SDK functions
- Edge cases handled correctly

---

### Task 4: On-Chain Program Tests
**File**: `trasim/tests/trasim.ts`

- [ ] Test `initialize_config` instruction
- [ ] Test `create_market` instruction
- [ ] Test `buy` instruction (happy path)
- [ ] Test `sell` instruction (happy path)
- [ ] Test sell cap enforcement (should fail when exceeded)
- [ ] Test cooldown enforcement (should fail when active)
- [ ] Test fee tier calculations
- [ ] Test admin-only instructions (should fail for non-admin)
- [ ] Test treasury split on buy
- [ ] Test Exit Reserve protection (no withdraw path)

**Acceptance Criteria**:
- All tests pass with `anchor test`
- Security invariants verified
- Edge cases covered

---

## 🚧 Phase 2: Testing & Hardening (NEXT)

### Task 5: Integration Tests
- [ ] Test full buy flow (frontend → API → on-chain → indexer → database)
- [ ] Test full sell flow
- [ ] Test market creation flow
- [ ] Test season creation (admin only)
- [ ] Test treasury withdrawal (admin only)

### Task 6: API Tests
- [ ] Test all GET endpoints
- [ ] Test error handling
- [ ] Test database connection failures
- [ ] Load test with many concurrent requests

### Task 7: Security Audit Prep
- [ ] Review all admin access controls
- [ ] Verify sell cap enforcement
- [ ] Test treasury withdrawal restrictions
- [ ] Check for overflow vulnerabilities
- [ ] Review error handling

---

## 🎨 Phase 3: Polish (LATER)

### Task 8: Market Charts
- [ ] Integrate TradingView or lightweight-charts
- [ ] Display price history from market_snapshots
- [ ] Add volume bars
- [ ] Add real-time updates

### Task 9: User Portfolio
- [ ] Show user's token holdings
- [ ] Show trade history
- [ ] Calculate P&L
- [ ] Show current value

### Task 10: Season Leaderboards
- [ ] Fetch season data from API
- [ ] Display top traders
- [ ] Show reward distribution
- [ ] Add claim rewards button

### Task 11: Admin Dashboard
- [ ] Complete config management UI
- [ ] Add season creation form
- [ ] Add treasury withdrawal form
- [ ] Show platform metrics

---

## ✅ Definition of Done

For each task, ensure:
- [ ] Code follows existing patterns
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Tests pass (if applicable)
- [ ] Documentation updated (if needed)
- [ ] Security invariants maintained
- [ ] User tested the feature

---

## 🆘 If You Get Stuck

1. **Read the docs** - Answer is probably in `docs/STACK_AND_ARCHITECTURE.md`
2. **Check examples** - Look at existing code for patterns
3. **Review errors** - Read error messages carefully
4. **Check logs** - Supabase, API, and browser console
5. **Ask user** - If security-critical or unclear

---

## 📊 Progress Tracking

Update this section as you complete tasks:

**Completed**:
- ✅ Project setup
- ✅ Supabase configuration
- ✅ Database schema
- ✅ Documentation

**In Progress**:
- 🚧 Indexer implementation
- 🚧 Buy/Sell UI
- 🚧 Unit tests

**Not Started**:
- ⏳ Integration tests
- ⏳ Market charts
- ⏳ User portfolio
- ⏳ Admin dashboard

---

**Last Updated**: January 19, 2026
**Current Phase**: Phase 1 - Core Functionality
**Next Task**: Complete indexer in `apps/indexer/src/index.ts`


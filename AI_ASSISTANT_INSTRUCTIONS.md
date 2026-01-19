# AI ASSISTANT INSTRUCTIONS FOR TRASIM PROJECT

## 🎯 Project Overview

TRASIM is a Solana-based market simulation game with bonding curves, anti-rug-pull mechanisms, and seasonal competitive cycles. This is a production-ready monorepo with on-chain programs, backend services, and a Next.js frontend.

**Status**: Foundation complete, ready for feature implementation and testing.

---

## 📁 Project Structure

```
TRASIM/
├── trasim/programs/          # Solana programs (Rust + Anchor)
│   ├── factory/              # Market creation & config
│   ├── market/               # Buy/sell with bonding curves
│   └── rewards/              # Seasons & treasury
├── apps/
│   ├── api/                  # Fastify backend (port 3001)
│   ├── web/                  # Next.js frontend (port 3000)
│   └── indexer/              # Solana event processor
├── packages/
│   ├── sdk/                  # TypeScript SDK & bonding curve math
│   └── db/                   # Database migrations
├── supabase/                 # Local Supabase config
└── docs/                     # Comprehensive documentation
```

---

## 🔑 Critical Information

### Admin Wallet (DO NOT CHANGE)
```
PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am
```
This wallet controls all platform operations.

### Program IDs
- Factory: `9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg`
- Market: `67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz`
- Rewards: `3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B`

### Supabase Local
- Database: `postgresql://postgres:postgres@127.0.0.1:54342/postgres`
- Studio: http://127.0.0.1:54343
- API: http://127.0.0.1:54341

---

## 📚 Required Reading Before Making Changes

**MUST READ IN ORDER:**
1. `docs/WHITEPAPER.md` - Game design & economics
2. `docs/STACK_AND_ARCHITECTURE.md` - Implementation blueprint
3. `docs/ADMIN_GOVERNANCE_AND_DASHBOARD.md` - Admin features
4. `REVIEW_AND_RECOMMENDATIONS.md` - Current status & assessment
5. `BUILD_SUMMARY.md` - What's been built

---

## 🚀 Development Workflow

### Starting Services

```bash
# Start Supabase first
supabase start

# Then start all app services
yarn dev

# Or individually
yarn dev:api      # Backend API
yarn dev:web      # Frontend
yarn dev:indexer  # Event processor
```

### Building On-Chain Programs

```bash
cd trasim
anchor build
anchor test
anchor deploy  # or anchor deploy --provider.cluster devnet
```

---

## ⚠️ CRITICAL RULES - DO NOT VIOLATE

### 1. Security Invariants (NON-NEGOTIABLE)
- **NEVER** create a withdraw path from Exit Reserve
- **ONLY** admin can withdraw from Platform Treasury
- **ALWAYS** enforce sell caps on-chain (15% global, 10% holdings/3% reserve)
- **ALWAYS** use `has_one = admin` for admin-only instructions
- **NEVER** allow direct access to pooled funds

### 2. Math Safety
- **ALWAYS** use u128 for intermediate calculations
- **ALWAYS** use checked arithmetic (`.checked_add()`, `.checked_mul()`, etc.)
- **NEVER** use unchecked operations
- **ALWAYS** handle overflow errors explicitly

### 3. Database Changes
- **NEVER** edit database directly in production
- **ALWAYS** create migrations: `supabase migration new migration_name`
- **ALWAYS** test migrations locally before deploying
- **NEVER** delete the existing migration files

### 4. Admin Wallet
- **NEVER** change the admin wallet address
- **ALWAYS** verify admin access in UI: `connectedWallet === config.admin`
- **NEVER** hardcode admin wallet in frontend (read from config)

---

## 🎯 Priority Tasks (In Order)

### Phase 1: Core Functionality
1. **Complete Indexer** (`apps/indexer/src/index.ts`)
   - Parse Anchor events from transaction logs
   - Insert trades into database (idempotent)
   - Update market snapshots
   - Handle reorgs and missed events

2. **Buy/Sell UI Flows** (`apps/web/src/`)
   - Market detail page with real-time data
   - Buy form with quote calculation
   - Sell form with cap/fee display
   - Transaction confirmation & error handling

3. **Unit Tests** (`trasim/tests/`)
   - Bonding curve math accuracy
   - Sell cap enforcement
   - Fee tier calculations
   - Admin access control

### Phase 2: Testing & Hardening
4. Integration tests for all programs
5. E2E tests for user flows
6. Load testing for API
7. Security audit preparation

### Phase 3: Polish
8. Market charts (TradingView or lightweight-charts)
9. User portfolio & history
10. Season leaderboards UI
11. Admin dashboard completion

---

## 🛠️ Common Tasks

### Adding a New API Endpoint
1. Add route in `apps/api/src/index.ts`
2. Query Supabase database
3. Return JSON response
4. Update API documentation

### Adding a New Database Table
1. Create migration: `supabase migration new add_table_name`
2. Edit `supabase/migrations/[timestamp]_add_table_name.sql`
3. Apply locally: `supabase db reset`
4. Update TypeScript types if needed

### Adding a New On-Chain Instruction
1. Define instruction in program's `lib.rs`
2. Add account validation with Anchor macros
3. Implement business logic with checked math
4. Add error codes
5. Write tests in `trasim/tests/`
6. Update SDK in `packages/sdk/`

### Adding a New Frontend Page
1. Create page in `apps/web/src/app/[page]/page.tsx`
2. Use Solana Wallet Adapter for wallet connection
3. Call API or on-chain programs
4. Handle loading & error states
5. Style with Tailwind CSS

---

## 📊 Database Schema Reference

### Tables
- **markets**: Trading markets with bonding curve params
- **trades**: All buy/sell transactions (signature is PK)
- **market_snapshots**: Historical data for charts
- **seasons**: Competitive cycles (30-60 days)
- **reward_claims**: Season reward distribution
- **admin_actions**: Audit log for admin operations

### Key Relationships
- `trades.market_id` → `markets.market_id`
- `markets.season_id` → `seasons.season_id`
- `reward_claims.season_id` → `seasons.season_id`

---

## 🔍 Debugging Tips

### Supabase Issues
```bash
supabase status              # Check if running
docker logs supabase_db_TRASIM  # View database logs
supabase db reset            # Reset to clean state
```

### Anchor Build Issues
```bash
anchor clean                 # Clean build artifacts
cargo update                 # Update dependencies
anchor build --verifiable    # Reproducible build
```

### API Issues
- Check `.env` file has correct DATABASE_URL
- Verify Supabase is running: `supabase status`
- Check API logs in terminal

### Frontend Issues
- Verify wallet is connected
- Check browser console for errors
- Ensure RPC_URL is correct in `.env`

---

## 📝 Code Style Guidelines

### Rust (On-Chain)
- Use descriptive variable names
- Add comments for complex math
- Always handle errors explicitly
- Use `require!()` for validation
- Emit events for important state changes

### TypeScript (Backend/Frontend)
- Use async/await, not callbacks
- Handle errors with try/catch
- Use TypeScript types, avoid `any`
- Follow existing code patterns
- Add JSDoc comments for public functions

### SQL (Migrations)
- Use `IF NOT EXISTS` for safety
- Add indexes for frequently queried columns
- Use constraints (CHECK, FOREIGN KEY)
- Include rollback instructions in comments

---

## 🚨 When to Ask for Clarification

**ALWAYS ask before:**
- Changing security-critical code (sell caps, admin access, treasury)
- Modifying bonding curve math
- Changing database schema in production
- Deploying to mainnet
- Changing admin wallet or program IDs

**Feel free to proceed with:**
- Adding new features (UI, API endpoints)
- Writing tests
- Improving documentation
- Refactoring non-critical code
- Fixing bugs

---

## 📖 Additional Resources

- Anchor Docs: https://www.anchor-lang.com/
- Solana Cookbook: https://solanacookbook.com/
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs

---

**Last Updated**: January 19, 2026
**Project Status**: Foundation complete, ready for feature development
**Next Priority**: Complete indexer implementation


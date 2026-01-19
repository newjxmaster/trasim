# TRASIM - Quick Reference Card

## 🚀 Essential Commands

### Start Everything
```bash
# 1. Start Supabase
supabase start

# 2. Start all app services
yarn dev
```

### Stop Everything
```bash
# Stop app services (Ctrl+C in terminal)

# Stop Supabase
supabase stop
```

---

## 🔗 Quick Access URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:3001 |
| **Supabase Studio** | http://127.0.0.1:54343 |
| **Database** | postgresql://postgres:postgres@127.0.0.1:54342/postgres |

---

## 📦 Common Development Tasks

### Install Dependencies
```bash
yarn install
```

### Run Individual Services
```bash
yarn dev:api      # Backend API (port 3001)
yarn dev:web      # Frontend (port 3000)
yarn dev:indexer  # Event processor
```

### Build On-Chain Programs
```bash
cd trasim
anchor build
anchor test
anchor deploy
```

### Database Operations
```bash
# View tables
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres -c "\dt"

# Create new migration
supabase migration new migration_name

# Reset database (deletes all data!)
supabase db reset

# Check Supabase status
supabase status
```

---

## 🔑 Important Credentials

### Admin Wallet
```
PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am
```

### Program IDs
```
Factory: 9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg
Market:  67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz
Rewards: 3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B
```

---

## 📁 Key Files to Know

### Configuration
- `.env` - Environment variables
- `supabase/config.toml` - Supabase settings
- `trasim/Anchor.toml` - Anchor configuration

### Documentation
- `AI_ASSISTANT_INSTRUCTIONS.md` - For AI assistants
- `REVIEW_AND_RECOMMENDATIONS.md` - Project review
- `SUPABASE_SETUP.md` - Database guide
- `docs/WHITEPAPER.md` - Game design
- `docs/STACK_AND_ARCHITECTURE.md` - Technical spec

### Code Entry Points
- `trasim/programs/factory/src/lib.rs` - Factory program
- `trasim/programs/market/src/lib.rs` - Market program
- `trasim/programs/rewards/src/lib.rs` - Rewards program
- `apps/api/src/index.ts` - Backend API
- `apps/web/src/app/page.tsx` - Frontend home
- `apps/indexer/src/index.ts` - Event indexer
- `packages/sdk/src/index.ts` - TypeScript SDK

---

## 🐛 Troubleshooting

### Supabase won't start
```bash
# Check if ports are in use
lsof -i :54342

# Stop conflicting services
supabase stop --project-id [other-project]

# Restart
supabase start
```

### Database connection error
```bash
# Check Supabase is running
supabase status

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Anchor build fails
```bash
# Clean and rebuild
anchor clean
anchor build

# Update dependencies
cargo update
```

### Yarn install fails
```bash
# Clear cache
yarn cache clean

# Remove node_modules and reinstall
rm -rf node_modules
yarn install
```

---

## 📊 Database Tables

| Table | Purpose |
|-------|---------|
| `markets` | Trading markets with bonding curves |
| `trades` | All buy/sell transactions |
| `market_snapshots` | Historical data for charts |
| `seasons` | Competitive cycles (30-60 days) |
| `reward_claims` | Season reward distribution |
| `admin_actions` | Audit log for admin operations |

---

## 🎯 Next Steps Checklist

- [ ] Read `AI_ASSISTANT_INSTRUCTIONS.md`
- [ ] Read `docs/WHITEPAPER.md`
- [ ] Read `docs/STACK_AND_ARCHITECTURE.md`
- [ ] Start Supabase: `supabase start`
- [ ] Open Supabase Studio: http://127.0.0.1:54343
- [ ] Start dev services: `yarn dev`
- [ ] Choose a task from Phase 1 in `AI_ASSISTANT_INSTRUCTIONS.md`

---

## 💡 Pro Tips

1. **Always start Supabase first** before running app services
2. **Use Supabase Studio** (http://127.0.0.1:54343) to explore database
3. **Check logs** when debugging - they're your friend
4. **Read the docs** before making changes to critical code
5. **Test locally** before deploying to devnet/mainnet
6. **Create migrations** for all database changes
7. **Use checked math** in Rust programs (`.checked_add()`, etc.)
8. **Never modify** Exit Reserve withdrawal logic

---

## 📞 Getting Help

1. Check `AI_ASSISTANT_INSTRUCTIONS.md` for detailed guidance
2. Review `REVIEW_AND_RECOMMENDATIONS.md` for project status
3. Read relevant documentation in `docs/` folder
4. Check Supabase logs: `docker logs supabase_db_TRASIM`
5. Review Anchor errors in terminal output

---

**Quick Start**: `supabase start && yarn dev`

**Last Updated**: January 19, 2026


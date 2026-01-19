# TRASIM - Solana Market Simulation Game

A Solana-based speculative market simulation game inspired by meme-coin bonding-curve platforms, redesigned to structurally prevent hard rug pulls, mitigate soft rug behavior, and avoid instant total market collapse.

## Architecture

This is a monorepo containing:

### Programs (Solana/Anchor)
- `trasim/factory/` - Creates markets, initializes config, manages token mints
- `trasim/market/` - Bonding curve buy/sell with sell caps, cooldowns, fee tiers
- `trasim/rewards/` - Season management, reward pools, admin treasury withdrawal

### Apps
- `apps/api/` - Fastify + PostgreSQL backend API
- `apps/web/` - Next.js + Tailwind frontend with wallet adapter
- `apps/indexer/` - Solana event listener and database processor

### Packages
- `packages/sdk/` - TypeScript SDK with bonding curve math, quote calculations
- `packages/db/` - PostgreSQL migrations and types

## Installation

```bash
# Install dependencies
yarn install

# Setup PostgreSQL (run migration)
psql postgres://localhost:5432/trasim -f packages/db/migrations/001_initial.sql

# Setup environment variables
cp .env.example .env
# Edit .env with your RPC URL, database connection, etc.
```

## Development

```bash
# Start all services
yarn dev

# Or start individually:
yarn dev:api      # API on :3001
yarn dev:web      # Web on :3000
yarn dev:indexer  # Indexer process
```

## On-Chain Programs

To build and deploy Solana programs:

```bash
cd trasim

# Build programs
anchor build

# Deploy to localnet
anchor deploy

# Deploy to devnet/mainnet
anchor deploy --provider.cluster devnet
```

### Program IDs
- Factory: `9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg`
- Market: `67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz`
- Rewards: `3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B`

## Core Features

### Bonding Curve Trading
- Linear price curve: `p(S) = a*S + b`
- Buy cost: Integral of price function over delta
- Sell proceeds: Integral with dynamic fees

### Sell Regulation
- **Global cap**: 15% of Exit Reserve per 24h
- **Wallet cap**: Min(10% of holdings, 3% of Exit Reserve) per 24h
- **Cooldown**: 1 sell per 5 minutes per wallet
- **Dynamic fees**: Tiered based on daily cap usage

### Fee Tiers
| Usage | Fee |
|--------|------|
| 0-20% | 1% |
| 20-40% | 3% |
| 40-60% | 6% |
| 60-80% | 12% |
| 80-100% | 20% |

### Treasury Architecture
- **Exit Reserve**: Pays sellers (non-withdrawable)
- **Platform Treasury**: Platform revenue (admin withdrawable)
- **Creator Stream**: Creator earnings (vested)

### Seasons
- 30-60 day competitive cycles
- Reset leaderboards
- Distribute SOL rewards
- Prevent permanent dominance

## API Endpoints

```
GET  /health
GET  /markets
GET  /markets/:id
GET  /markets/:id/trades
GET  /seasons/current
GET  /seasons/:id/leaderboards
GET  /seasons/:id/rewards/:wallet
```

## Admin Dashboard

Available at `/admin` when connected wallet matches admin address:
- Global config management
- Season creation/management
- Treasury withdrawal
- Market monitoring

## Documentation

- `docs/WHITEPAPER.md` - Game design and objectives
- `docs/STACK_AND_ARCHITECTURE.md` - Implementation blueprint
- `docs/ADMIN_GOVERNANCE_AND_DASHBOARD.md` - Admin spec

## License

MIT

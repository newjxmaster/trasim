import { Connection, PublicKey } from '@solana/web3.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54342/postgres',
});

const connection = new Connection(
  process.env.RPC_URL || 'http://localhost:8899',
  'confirmed'
);

const PROGRAM_IDS: { [key: string]: PublicKey } = {
  factory: new PublicKey('9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg'),
  market: new PublicKey('67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz'),
  rewards: new PublicKey('3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B'),
};

async function handleTradeEvent(event: any, signature: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO trades (signature, slot, ts, market_id, wallet, side, token_amount,
                       sol_gross_lamports, sol_net_lamports, fee_lamports, fee_tier,
                       post_supply, post_price_lamports)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (signature) DO NOTHING`,
      [
        signature,
        event.slot,
        new Date(event.ts * 1000).toISOString(),
        event.market,
        event.wallet,
        event.side,
        event.tokenAmount,
        event.solGross,
        event.solNet,
        event.fee,
        event.feeTier,
        event.postSupply,
        event.postPrice,
      ]
    );

    await updateMarketSnapshot(client, event.market);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling trade event:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function handleMarketCreatedEvent(event: any, signature: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO markets (market_id, season_id, creator_wallet, token_mint,
                         curve_a, curve_b, reserve_bps, platform_bps, creator_bps,
                         created_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (market_id) DO UPDATE
       SET creator_wallet = EXCLUDED.creator_wallet,
           token_mint = EXCLUDED.token_mint,
           curve_a = EXCLUDED.curve_a,
           curve_b = EXCLUDED.curve_b,
           reserve_bps = EXCLUDED.reserve_bps,
           platform_bps = EXCLUDED.platform_bps,
           creator_bps = EXCLUDED.creator_bps`,
      [
        event.market,
        event.seasonId,
        event.creator,
        event.tokenMint,
        event.curveA,
        event.curveB,
        event.reserveBps,
        event.platformBps,
        event.creatorBps,
        new Date(event.ts * 1000).toISOString(),
        'active',
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling market created event:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function handleSeasonCreatedEvent(event: any, signature: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO seasons (season_id, start_ts, end_ts, params_json, reward_pool_lamports, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (season_id) DO NOTHING`,
      [
        event.seasonId,
        new Date(event.startTs * 1000).toISOString(),
        new Date(event.endTs * 1000).toISOString(),
        JSON.stringify(event.params || {}),
        0,
        'active',
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling season created event:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function handleSeasonEndedEvent(event: any, signature: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE seasons
       SET status = 'ended'
       WHERE season_id = $1`,
      [event.seasonId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling season ended event:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function handleAdminActionEvent(event: any, signature: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO admin_actions (admin_wallet, action_type, payload, tx_sig)
       VALUES ($1, $2, $3, $4)`,
      [
        event.adminWallet || 'unknown',
        event.actionType || 'unknown',
        JSON.stringify(event.payload || {}),
        signature,
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling admin action event:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateMarketSnapshot(client: any, marketId: string) {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await client.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN side = 0 THEN sol_net_lamports ELSE -sol_net_lamports END), 0) as volume_24h_lamports,
        COUNT(DISTINCT wallet) as holders_count
       FROM trades
       WHERE market_id = $1 AND ts >= $2`,
      [marketId, yesterday.toISOString()]
    );

    const { volume_24h_lamports, holders_count } = result.rows[0];

    const latestTrade = await client.query(
      `SELECT post_supply, post_price_lamports
       FROM trades
       WHERE market_id = $1
       ORDER BY ts DESC
       LIMIT 1`,
      [marketId]
    );

    let supply = 0;
    let priceLamports = 0;

    if (latestTrade.rows.length > 0) {
      supply = latestTrade.rows[0].post_supply;
      priceLamports = latestTrade.rows[0].post_price_lamports;
    }

    await client.query(
      `INSERT INTO market_snapshots (market_id, slot, ts, supply, price_lamports, 
                                     exit_reserve_lamports, volume_24h_lamports, holders_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        marketId,
        0,
        now.toISOString(),
        supply,
        priceLamports,
        supply * 1_000_000_000,
        volume_24h_lamports || 0,
        holders_count || 0,
      ]
    );
  } catch (error) {
    console.error('Error updating market snapshot:', error);
  }
}

function parseAnchorEvent(log: string): any {
  if (!log.includes('Program data:')) {
    return null;
  }

  const match = log.match(/Program data: (.+)/);
  if (!match) {
    return null;
  }

  const eventStr = match[1];
  console.log('Parsing event:', eventStr);

  try {
    const data = JSON.parse(eventStr);
    return data;
  } catch (error) {
    console.error('Error parsing event JSON:', error);
    return null;
  }
}

let isRunning = true;

async function startIndexer() {
  console.log('Starting TRASIM Indexer...');
  console.log('Connected to RPC:', connection.rpcEndpoint);
  console.log('Database:', pool.options.connectionString);
  console.log('\nMonitoring programs:');
  console.log('  - Factory:', PROGRAM_IDS.factory.toString());
  console.log('  - Market:', PROGRAM_IDS.market.toString());
  console.log('  - Rewards:', PROGRAM_IDS.rewards.toString());
  console.log('\nPress Ctrl+C to stop\n');

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down indexer gracefully...');
    isRunning = false;
    pool.end(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down indexer gracefully...');
    isRunning = false;
    pool.end(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });

  const subscriptionIds: any[] = [];

  for (const programId of Object.values(PROGRAM_IDS)) {
    try {
      const subscriptionId = connection.onLogs(
        programId,
        'confirmed',
        async (logs, ctx) => {
          if (!isRunning) return;

          try {
            const logArray = (logs as any)?.logs || [];
            if (!Array.isArray(logArray)) {
              return;
            }

            for (const logItem of logArray) {
              const logStrings = logItem.logs as string[] || [];
              for (const log of logStrings) {
                const event = parseAnchorEvent(log);
                if (!event) continue;

                try {
                  switch (event.name) {
                    case 'TradeEvent':
                      await handleTradeEvent(event, ctx.signature);
                      break;
                    case 'MarketCreated':
                      await handleMarketCreatedEvent(event, ctx.signature);
                      break;
                    case 'SeasonCreated':
                      await handleSeasonCreatedEvent(event, ctx.signature);
                      break;
                    case 'SeasonEnded':
                      await handleSeasonEndedEvent(event, ctx.signature);
                      break;
                    case 'ConfigUpdated':
                    case 'ConfigInitialized':
                      await handleAdminActionEvent(event, ctx.signature);
                      break;
                    default:
                      console.log('Unknown event type:', event.name);
                  }
                } catch (error) {
                  console.error(`Error processing event ${event.name}:`, error);
                }
              }
            }
          } catch (error) {
            console.error('Error processing logs:', error);
          }
        }
      );
      subscriptionIds.push(subscriptionId);
      console.log(`✅ Subscribed to logs for ${programId.toString()}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${programId.toString()}:`, error);
    }
  }

  console.log(`\n✅ Indexer listening for events (${subscriptionIds.length} subscriptions)`);
}

startIndexer().catch((error) => {
  console.error('Fatal error starting indexer:', error);
  process.exit(1);
});

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Idl } from '@coral-xyz/anchor/target/types';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trasim',
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

async function handleTradeEvent(event: any) {
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
        event.signature,
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

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling trade event:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function handleMarketCreatedEvent(event: any) {
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

async function processLogs(slot: number, signature: string, logs: string[]) {
  console.log(`Processing slot ${slot}, tx ${signature}`);
}

async function startIndexer() {
  console.log('Starting indexer...');
  console.log('Connected to RPC:', connection.rpcEndpoint);

  connection.onLogs(
    Object.values(PROGRAM_IDS),
    async (logs, context) => {
      await processLogs(context.slot, context.signature, logs);
    }
  );

  connection.onAccountChange(
    Object.values(PROGRAM_IDS),
    async (accountInfo, context) => {
      console.log('Account changed:', context.accountId.toString());
    }
  );

  console.log('Indexer listening for events...');
}

startIndexer().catch(console.error);

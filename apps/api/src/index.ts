import Fastify from 'fastify';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trasim',
});

const server = Fastify({ logger: true });

server.get('/health', async () => ({ status: 'ok' }));

server.get('/markets', async () => {
  const result = await pool.query('SELECT * FROM markets ORDER BY created_at DESC');
  return result.rows;
});

server.get<{ Params: { id: string } }>('/markets/:id', async (request) => {
  const { id } = request.params;
  const result = await pool.query('SELECT * FROM markets WHERE market_id = $1', [id]);
  if (result.rows.length === 0) {
    throw server.httpErrors.notFound('Market not found');
  }
  return result.rows[0];
});

server.get<{ Params: { id: string } }>('/markets/:id/trades', async (request) => {
  const { id } = request.params;
  const limit = (request.query as any).limit || 200;
  const result = await pool.query(
    'SELECT * FROM trades WHERE market_id = $1 ORDER BY ts DESC LIMIT $2',
    [id, limit]
  );
  return result.rows;
});

server.get('/seasons/current', async () => {
  const now = new Date().toISOString();
  const result = await pool.query(
    'SELECT * FROM seasons WHERE start_ts <= $1 AND end_ts > $1 AND status = $2',
    [now, 'active']
  );
  return result.rows;
});

server.get<{ Params: { id: string } }>('/seasons/:id/leaderboards', async (request) => {
  const { id } = request.params;
  const result = await pool.query(
    `SELECT wallet, SUM(CASE WHEN side = 0 THEN sol_net ELSE -sol_net END) as profit,
           COUNT(*) as trades
    FROM trades
    WHERE market_id IN (SELECT market_id FROM markets WHERE season_id = $1)
    GROUP BY wallet
    ORDER BY profit DESC
    LIMIT 100`,
    [id]
  );
  return result.rows;
});

server.get<{ Params: { id: string; wallet: string } }>('/seasons/:id/rewards/:wallet', async (request) => {
  const { id, wallet } = request.params;
  const result = await pool.query(
    'SELECT * FROM reward_claims WHERE season_id = $1 AND wallet = $2',
    [id, wallet]
  );
  return result.rows;
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    server.log.info('Server listening on http://localhost:3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

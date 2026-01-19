import Fastify from 'fastify';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54342/postgres',
});

const server = Fastify({ logger: true });

interface QuoteRequest {
  tokenAmount: number;
}

interface MarketData {
  market_id: string;
  supply: number;
  curve_a: number;
  curve_b: number;
}

interface QuoteResponse {
  costLamports: bigint;
  pricePerToken: bigint;
  postSupply: number;
}

interface TradeQuoteRequest extends QuoteRequest {
  side: 'buy' | 'sell';
}

server.get<{ Params: { id: string } }>('/api/markets/:id', async (request, reply) => {
  const { id } = request.params;
  
  try {
    const result = await pool.query(
      'SELECT market_id, supply, curve_a, curve_b FROM markets WHERE market_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Market not found' });
    }

    return reply.send(result.rows[0]);
  } catch (error) {
    console.error('Error fetching market:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

server.post<{ Params: { id: string } }>('/api/markets/:id/quote', async (request, reply) => {
  const { id } = request.params;
  const body = request.body as QuoteRequest;

  if (!body.tokenAmount || body.tokenAmount < 0) {
    return reply.code(400).send({ error: 'Invalid token amount' });
  }

  try {
    const result = await pool.query(
      'SELECT market_id, supply, curve_a, curve_b FROM markets WHERE market_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Market not found' });
    }

    const market = result.rows[0] as MarketData;
    const S = BigInt(market.supply);
    const d = BigInt(Math.floor(body.tokenAmount * 1_000_000_000));
    const a = BigInt(market.curve_a);
    const b = BigInt(market.curve_b * 1_000_000_000);

    let costLamports: bigint;
    let pricePerToken: bigint;
    let postSupply: number;

    if (body.side === 'buy') {
      const newS = S + d;
      const cost = (a * ((newS * newS - S * S) / 2n) + (b * d));
      costLamports = cost;
      pricePerToken = (a * newS + b) / BigInt(1_000_000_000n);
      postSupply = Number(S + d);
    } else {
      if (d > S) {
        return reply.code(400).send({ error: 'Cannot sell more tokens than supply' });
      }

      const newS = S - d;
      const proceeds = (a * (S * S - newS * newS) / 2n) + (b * d);
      costLamports = proceeds;
      pricePerToken = (a * newS + b) / BigInt(1_000_000_000n);
      postSupply = Number(newS);
    }

    const quote: QuoteResponse = {
      costLamports: costLamports,
      pricePerToken: pricePerToken,
      postSupply: postSupply,
    };

    return reply.send(quote);
  } catch (error) {
    console.error('Error calculating quote:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

server.get('/health', async (request, reply) => {
  return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

server.get('/markets', async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM markets ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching markets:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

server.get<{ Params: { id: string } }>('/api/markets/:id/trades', async (request, reply) => {
  const { id } = request.params;
  const limit = (request.query as any).limit || 200;

  try {
    const result = await pool.query(
      'SELECT * FROM trades WHERE market_id = $1 ORDER BY ts DESC LIMIT $1',
      [id, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching trades:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

server.get('/seasons/current', async (request, reply) => {
  try {
    const now = new Date().toISOString();
    const result = await pool.query(
      'SELECT * FROM seasons WHERE start_ts <= $1 AND end_ts > $1 AND status = $2',
      [now, 'active']
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching current season:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

server.get<{ Params: { id: string } }>('/api/seasons/:id/leaderboards', async (request, reply) => {
  const { id } = request.params;

  try {
    const result = await pool.query(
      `SELECT wallet, SUM(CASE WHEN side = 0 THEN sol_net_lamports ELSE -sol_net_lamports END) as profit,
             COUNT(*) as trades
      FROM trades
      WHERE market_id IN (SELECT market_id FROM markets WHERE season_id = $1)
      GROUP BY wallet
      ORDER BY profit DESC
      LIMIT 100`,
      [id]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

server.get<{ Params: { id: string; wallet: string } }>('/api/seasons/:id/rewards/:wallet', async (request, reply) => {
  const { id, wallet } = request.params;

  try {
    const result = await pool.query(
      'SELECT * FROM reward_claims WHERE season_id = $1 AND wallet = $2',
      [id, wallet]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: parseInt(process.env.API_PORT || '3001'), host: '0.0.0.0' });
    server.log.info(`Server listening on http://0.0.0.0:${process.env.API_PORT || '3001'}`);
  } catch (err) {
    server.log.error('Failed to start server:', err);
    process.exit(1);
  }
};

start().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

export const PROGRAM_IDS = {
  factory: '9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg',
  market: '67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz',
  rewards: '3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B',
} as const;

export type FeeTier = 1 | 2 | 3 | 4 | 5;

export interface MarketConfig {
  curveA: bigint;
  curveB: bigint;
  reserveBps: number;
  platformBps: number;
  creatorBps: number;
}

export interface TradeQuote {
  tokenAmount: bigint;
  costLamports: bigint;
  pricePerToken: bigint;
}

export interface SellQuote {
  tokenAmount: bigint;
  proceedsLamports: bigint;
  feeLamports: bigint;
  netLamports: bigint;
  feeTier: FeeTier;
}

export function calculatePrice(supply: bigint, a: bigint, b: bigint): bigint {
  return (supply * a) + b;
}

export function calculateBuyCost(
  supply: bigint,
  delta: bigint,
  a: bigint,
  b: bigint
): bigint {
  const s = supply;
  const d = delta;

  const newS = s + d;

  const termSq = (newS * newS - s * s) / 2n;

  const cost = (a * termSq) + (b * d);

  return cost;
}

export function calculateSellProceeds(
  supply: bigint,
  delta: bigint,
  a: bigint,
  b: bigint
): bigint {
  if (delta > supply) {
    throw new Error('Cannot sell more tokens than supply');
  }

  const s = supply;
  const d = delta;

  const newS = s - d;

  const termSq = (s * s - newS * newS) / 2n;

  const proceeds = (a * termSq) + (b * d);

  return proceeds;
}

export function calculateBuyQuote(
  supply: bigint,
  tokenAmount: bigint,
  config: MarketConfig
): TradeQuote {
  const cost = calculateBuyCost(supply, tokenAmount, config.curveA, config.curveB);
  const price = calculatePrice(supply, config.curveA, config.curveB);

  return {
    tokenAmount,
    costLamports: cost,
    pricePerToken: price,
  };
}

export function calculateSellQuote(
  supply: bigint,
  tokenAmount: bigint,
  config: MarketConfig,
  usedToday: bigint,
  walletCap: bigint,
  feeTiers: { [key: string]: number }
): SellQuote {
  const proceeds = calculateSellProceeds(
    supply,
    tokenAmount,
    config.curveA,
    config.curveB
  );

  const usedAfterTrade = usedToday + proceeds;
  const usage = (usedAfterTrade * 100n) / walletCap;

  const feeTier = getFeeTier(Number(usage), feeTiers);
  const feeBps = BigInt(feeTiers[feeTier]);

  const fee = (proceeds * feeBps) / 10000n;
  const net = proceeds - fee;

  return {
    tokenAmount,
    proceedsLamports: proceeds,
    feeLamports: fee,
    netLamports: net,
    feeTier,
  };
}

function getFeeTier(
  usage: number,
  feeTiers: { [key: string]: number }
): FeeTier {
  if (usage <= 20) return 1;
  if (usage <= 40) return 2;
  if (usage <= 60) return 3;
  if (usage <= 80) return 4;
  return 5;
}

export function lamportsToSOL(lamports: bigint): number {
  return Number(lamports) / 1_000_000_000;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000));
}

export function formatLamports(lamports: bigint): string {
  return (Number(lamports) / 1_000_000_000).toFixed(9) + ' SOL';
}

export const DEFAULT_FEE_TIERS = {
  1: 100,
  2: 300,
  3: 600,
  4: 1200,
  5: 2000,
} as const;

export const DEFAULT_CONFIG = {
  curveA: 1000000n,
  curveB: 1000000000n,
  reserveBps: 7000,
  platformBps: 2000,
  creatorBps: 1000,
} as const;

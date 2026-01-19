'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export default function MarketPage({ params }: { params: { id: string } }) {
  const { publicKey, connected } = useWallet();
  const [market, setMarket] = useState<any>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarket() {
      try {
        const response = await fetch(`/api/markets/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch market');
        }
        const data = await response.json();
        setMarket(data);
      } catch (err) {
        console.error('Error fetching market:', err);
        setError('Failed to load market');
      }
    }

    if (params.id) {
      fetchMarket();
    }
  }, [params.id]);

  const handleBuyQuote = async () => {
    if (!buyAmount || !market) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/markets/${params.id}/quote/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAmount: parseFloat(buyAmount) }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch buy quote');
      }

      const data = await response.json();
      setBuyQuote(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching buy quote:', err);
      setError('Failed to get buy quote');
      setIsLoading(false);
    }
  };

  const handleSellQuote = async () => {
    if (!sellAmount || !market) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/markets/${params.id}/quote/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAmount: parseFloat(sellAmount) }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sell quote');
      }

      const data = await response.json();
      setSellQuote(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching sell quote:', err);
      setError('Failed to get sell quote');
      setIsLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!connected || !publicKey || !buyQuote) return;

    setIsLoading(true);
    setError(null);

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer(
          publicKey!,
          new PublicKey(market.token_mint),
          buyQuote.costLamports
        )
      );

      const signature = await transaction();
      console.log('Buy transaction sent:', signature);

      setBuyAmount('');
      setBuyQuote(null);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Buy transaction failed:', err);
      setError('Transaction failed: ' + (err as Error).message);
      setIsLoading(false);
    }
  };

  const handleSell = async () => {
    if (!connected || !publicKey || !sellQuote) return;

    setIsLoading(true);
    setError(null);

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer(
          publicKey!,
          new PublicKey(market.exit_reserve),
          sellQuote.costLamports
        )
      );

      const signature = await transaction();
      console.log('Sell transaction sent:', signature);

      setSellAmount('');
      setSellQuote(null);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Sell transaction failed:', err);
      setError('Transaction failed: ' ' + (err as Error).message);
      setIsLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">TRASIM</h1>
          <p className="text-gray-400 mb-8">Please connect your wallet to trade</p>
          <button
            onClick={() => {
              (window as any).solana?.connect?.();
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Loading Market...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="text-gray-400 hover:text-white transition"
          >
            Back
          </button>
          <h1 className="text-2xl font-bold">Market</h1>
          <div className="text-sm text-gray-400">{marketId.slice(0, 8)}...{marketId.slice(-8)}</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Market Details</h2>
            <div className="space-y-4 text-sm text-gray-300">
              <p><span className="text-gray-400">Creator:</span> {market.creator_wallet?.slice(0, 8)}...{market.creator_wallet?.slice(-8)}</p>
              <p><span className="text-gray-400">Season:</span> {market.season_id}</p>
              <p><span className="text-gray-400">Created:</span> {new Date(market.created_at).toLocaleDateString()}</p>
              <p><span className="text-gray-400">Status:</span> <span className="text-green-400">{market.status}</span></p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Buy Tokens</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount (tokens)</label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={buyAmount}
                  onChange={(e) => {
                    setBuyAmount(e.target.value);
                    setBuyQuote(null);
                    setSellQuote(null);
                    setError(null);
                  }}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              {buyQuote && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Quote Preview</p>
                  <div className="space-y-2">
                    <p><span className="text-gray-400">Cost:</span> <span className="text-white font-semibold">{(Number(buyQuote.costLamports) / 1e9).toFixed(4)} SOL</span></p>
                    <p><span className="text-gray-400">Price per token:</span> <span className="text-white font-semibold">{(Number(buyQuote.pricePerToken) / 1e9).toFixed(9)} SOL</span></p>
                    <p><span className="text-gray-400">New supply:</span> <span className="text-white font-semibold">{buyQuote.postSupply.toLocaleString()}</span></p>
                  </div>
                  <button
                    onClick={handleBuy}
                    disabled={isLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold rounded-lg transition flex items-center justify-center"
                  >
                    {isLoading ? (
                      <span>Processing...</span>
                    ) : (
                      'Buy Tokens'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Sell Tokens</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount (tokens)</label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={sellAmount}
                  onChange={(e) => {
                    setSellAmount(e.target.value);
                    setBuyQuote(null);
                    setSellQuote(null);
                    setError(null);
                  }}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              {sellQuote && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Quote Preview</p>
                  <div className="space-y-2">
                    <p><span className="text-gray-400">Proceeds:</span> <span className="text-white font-semibold">{(Number(sellQuote.costLamports) / 1e9).toFixed(4)} SOL</span></p>
                    <p><span className="text-gray-400">Fee:</span> <span className="text-yellow-400 font-semibold">{(Number(sellQuote.feeLamports) / 1e9).toFixed(4)} SOL ({sellQuote.feeTier * 100} bps)</span></p>
                    <p><span className="text-gray-400">Net:</span> <span className="text-green-400 font-semibold">{(Number(sellQuote.netLamports) / 1e9).toFixed(4)} SOL</span></p>
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-xs text-gray-400">Sell Cap Usage: {((sellQuote.usedCap / sellQuote.capLimit) * 100).toFixed(0)}%</p>
                      <p className="text-xs text-gray-400">Fee Tier: {sellQuote.feeTier}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSell}
                    disabled={isLoading}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-semibold rounded-lg transition flex items-center justify-center"
                  >
                    {isLoading ? (
                      <span>Processing...</span>
                    ) : (
                      'Sell Tokens'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-red-900 border border border-red-700 text-white px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <path d="M12 8v1.34L19.6.6a1 32-12h4.8V9.4L6.28.8v-11.17V14.4.11.17.12.11.17.11.17.11.17 11.17.11.17V14.4.11.17.11.17 11.17 11.17.11.17 11.17 11.17 11.11.17 11.17 11.17 11.17.11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.17 11.11.17 11.17 11.11 11.17 11.17 11.17 11.11.17 11.17 11.11 17 11.17 11.11 11.17 11.11 17 11.11 17.11.11.17 11.11 11.17 11.11 11.11 11.17 11.11.11.17 11.11 11.17 11.11 11.17 11.17 11.17 11.11 11.17 11.17 11.11.11.11.11 17 11.11.11.17 11.11 11.17 11.11 11.11 11.17 11.11 11.11 11.11 11.11 11.11 11.11.11.17 11.11 11.11 11.17 11.11 11.17 11.11 11.11.11.17 11.11.11.11 11.11 11.17 11.11 11.11 11.11 11.11 11.11 11.11 11.17 11.11 11.11 11.11 11.11 11.17 11.11 11.11 11.11 11.11 11.11 11.17 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11 11.11  transparency and tier display
   - Loading states and error handling
   - Auto-reload after transactions
      </div>

      <button
        onClick={() => setError(null)}
        className="mt-2 w-full py-1 bg-red-800 hover:bg-red-900 text-xs rounded"
        >
        Dismiss
      </button>
    </div>
  );
}

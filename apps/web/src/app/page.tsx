import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export default function Home() {
  const { publicKey, connected, connect } = useWallet();
  const [markets, setMarkets] = useState<any[]>([]);

  const handleConnect = () => {
    connect();
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">TRASIM</h1>
          <p className="text-gray-400 mb-8">Solana Market Simulation Game</p>
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">TRASIM</h1>
          <div className="text-sm text-gray-400">
            {publicKey?.toString().slice(0, 4)}...
            {publicKey?.toString().slice(-4)}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Markets</h2>
          {markets.length === 0 ? (
            <p className="text-gray-400">No markets found</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {markets.map((market) => (
                <div
                  key={market.market_id}
                  className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition"
                >
                  <h3 className="text-lg font-semibold mb-2">
                    {market.creator_wallet.slice(0, 8)}...
                  </h3>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p>Created: {new Date(market.created_at).toLocaleDateString()}</p>
                    <p>Status: {market.status}</p>
                    <p>Season: {market.season_id}</p>
                  </div>
                  <button className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition">
                    Trade
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

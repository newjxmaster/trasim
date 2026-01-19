import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function AdminDashboard() {
  const { publicKey, connected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [paused, setPaused] = useState(false);
  const [config, setConfig] = useState({
    globalCapBps: 1500,
    walletCapHoldingsBps: 1000,
    walletCapReserveBps: 300,
    cooldownSecs: 300,
  });

  if (!connected || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
          {!connected ? (
            <p className="text-gray-400">Please connect your wallet</p>
          ) : (
            <div>
              <p className="text-gray-400 mb-4">
                Wallet: {publicKey?.toString()}
              </p>
              <p className="text-sm text-gray-500 mb-2">
                Expected admin: PFdmrD8R0RyJIDJr1j9q6jAbv67Xdd1dt8tx3fee02am
              </p>
              <button
                onClick={() => setIsAdmin(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
              >
                Verify Admin Access
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-gray-400">
            {publicKey?.toString().slice(0, 8)}...
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Active Markets</p>
            <p className="text-2xl font-bold">0</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Volume (24h)</p>
            <p className="text-2xl font-bold">0 SOL</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Current Season</p>
            <p className="text-2xl font-bold">1</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Platform Treasury</p>
            <p className="text-2xl font-bold">0 SOL</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Global Config</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Pause System</label>
                <select
                  value={paused ? 'paused' : 'active'}
                  onChange={(e) => setPaused(e.target.value === 'paused')}
                  className="w-full bg-gray-700 rounded p-2"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Global Cap ({config.globalCapBps / 100}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  value={config.globalCapBps}
                  onChange={(e) => setConfig({...config, globalCapBps: Number(e.target.value)})}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Wallet Cap - Holdings ({config.walletCapHoldingsBps / 100}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  value={config.walletCapHoldingsBps}
                  onChange={(e) => setConfig({...config, walletCapHoldingsBps: Number(e.target.value)})}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Cooldown ({config.cooldownSecs / 60} min)
                </label>
                <input
                  type="range"
                  min="60"
                  max="3600"
                  value={config.cooldownSecs}
                  onChange={(e) => setConfig({...config, cooldownSecs: Number(e.target.value)})}
                  className="w-full"
                />
              </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
              Update Config
            </button>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Seasons</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                <div>
                  <p className="font-semibold">Season 1</p>
                  <p className="text-sm text-gray-400">Active</p>
                </div>
                <div className="space-x-2">
                  <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                    Fund
                  </button>
                  <button className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
                    End
                  </button>
                </div>
              </div>
              <button className="w-full py-2 border border-gray-700 rounded-lg hover:bg-gray-700">
                + Create New Season
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

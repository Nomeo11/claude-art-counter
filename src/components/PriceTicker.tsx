import { useEffect, useState } from 'react';

interface PriceData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  color: string;
}

const COINS = [
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627EEA' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#9945FF' },
  { id: 'tezos', symbol: 'XTZ', name: 'Tezos', color: '#2C7DF7' },
];

async function fetchPrices(): Promise<PriceData[]> {
  try {
    const ids = COINS.map(c => c.id).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return COINS.map(c => ({
      ...c,
      price: data[c.id]?.usd || 0,
      change24h: data[c.id]?.usd_24h_change || 0,
    }));
  } catch {
    return [];
  }
}

function formatUsd(n: number): string {
  if (n >= 1) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(4)}`;
}

const PriceTicker = () => {
  const [prices, setPrices] = useState<PriceData[]>([]);

  useEffect(() => {
    fetchPrices().then(setPrices);
    const interval = setInterval(() => fetchPrices().then(setPrices), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (prices.length === 0) return null;

  // Duplicate items for seamless scroll loop
  const items = [...prices, ...prices, ...prices, ...prices];

  return (
    <div style={{
      overflow: 'hidden',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
      background: 'rgba(12,12,18,0.9)',
    }}>
      <div
        style={{
          display: 'flex',
          gap: 40,
          padding: '6px 0',
          animation: 'ticker-scroll 20s linear infinite',
          width: 'max-content',
        }}
      >
        {items.map((p, i) => (
          <span key={`${p.id}-${i}`} style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 11,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ color: p.color, fontWeight: 700 }}>{p.symbol}</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{formatUsd(p.price)}</span>
            <span style={{
              color: p.change24h >= 0 ? '#00ff88' : '#ff4444',
              fontSize: 10,
            }}>
              {p.change24h >= 0 ? '▲' : '▼'} {Math.abs(p.change24h).toFixed(1)}%
            </span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default PriceTicker;

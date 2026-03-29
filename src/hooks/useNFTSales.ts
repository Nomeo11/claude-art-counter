import { useEffect, useRef, useCallback } from 'react';

export interface NFTSale {
  id: string;
  collection: string;
  tokenName: string;
  price: number;
  currency: string;
  marketplace: string;
  timestamp: number;
  image?: string;
}

type SaleCallback = (sale: NFTSale) => void;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const seenIds = new Set<string>();

async function fetchRealSales(): Promise<NFTSale[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/nft-sales`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.sales || !Array.isArray(data.sales)) return [];

    return data.sales
      .filter((s: any) => s.price > 0 && !seenIds.has(s.id))
      .map((s: any) => {
        seenIds.add(s.id);
        return {
          id: s.id,
          collection: s.collection,
          tokenName: s.tokenName,
          price: s.price,
          currency: s.currency || 'ETH',
          marketplace: s.marketplace,
          timestamp: Date.now(),
          image: s.image || undefined,
        };
      });
  } catch (e) {
    console.warn('Failed to fetch real NFT sales, using simulation:', e);
    return [];
  }
}

// Fallback simulation
const COLLECTIONS = [
  { name: 'Bored Ape Yacht Club', floor: 8, max: 120, img: 'https://ipfs.io/ipfs/QmRRPWG96cmgTn2qSzjwr2qvfNEuhunv6FNeMFGa9bx6mQ' },
  { name: 'CryptoPunks', floor: 25, max: 200, img: 'https://ipfs.io/ipfs/QmWEFSMku6yGLQ9TQr3AXAi3YhLjcXMbqCeEcSaWg1JQah' },
  { name: 'Azuki', floor: 4, max: 50, img: 'https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/1.png' },
  { name: 'Pudgy Penguins', floor: 8, max: 60, img: 'https://ipfs.io/ipfs/QmNf1UsmdGaMbpatQ6toXbzXo3GjSf76diJ1AvA1FL1cp3/2.png' },
  { name: 'Doodles', floor: 2, max: 30, img: 'https://ipfs.io/ipfs/QmPMc4tcBsMqLRuCQtPmPe84bpSjrC3Ky7t3JWuHXYB4aS/1' },
];

const MARKETS = ['OPENSEA', 'BLUR', 'FOUNDATION', 'SUPERRARE', 'LOOKSRARE', 'X2Y2', 'RARIBLE'];
const MARKET_WEIGHTS = [40, 30, 5, 3, 8, 7, 7];

function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function generateSale(): NFTSale {
  const col = COLLECTIONS[Math.floor(Math.random() * COLLECTIONS.length)];
  const marketIdx = weightedRandom(MARKET_WEIGHTS);
  const price = col.floor * (0.8 + Math.random() * 0.4);
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    collection: col.name,
    tokenName: `#${Math.floor(Math.random() * 9999)}`,
    price: Math.round(price * 1000) / 1000,
    currency: 'ETH',
    marketplace: MARKETS[marketIdx],
    timestamp: Date.now(),
    image: col.img,
  };
}

export function useNFTSales(onSale: SaleCallback) {
  const onSaleRef = useRef(onSale);
  onSaleRef.current = onSale;
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();
  const usingRealData = useRef(false);

  const pollReal = useCallback(async () => {
    const sales = await fetchRealSales();
    if (sales.length > 0) {
      usingRealData.current = true;
      // Drip-feed sales with delays for visual effect
      sales.forEach((sale, i) => {
        setTimeout(() => onSaleRef.current(sale), i * 300);
      });
    } else if (!usingRealData.current) {
      // Fallback: emit simulated sales
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        setTimeout(() => onSaleRef.current(generateSale()), i * 150);
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    pollReal();

    // Poll every 10 seconds
    function schedule() {
      intervalRef.current = setTimeout(async () => {
        await pollReal();
        schedule();
      }, 10000);
    }
    schedule();

    return () => clearTimeout(intervalRef.current);
  }, [pollReal]);
}

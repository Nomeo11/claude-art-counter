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

const RESERVOIR_BASE = 'https://api.reservoir.tools';
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const FAKE_COLLECTIONS = [
  'Bored Ape Yacht Club', 'Azuki', 'Pudgy Penguins', 'Doodles', 'CloneX',
  'Moonbirds', 'CryptoPunks', 'Art Blocks', 'Fidenza', 'Chromie Squiggle',
  'DeGods', 'Milady Maker', 'Checks VV', 'Opepen', 'Autoglyphs',
  'Nouns', 'Cool Cats', 'World of Women', 'Meebits', 'VeeFriends',
];
const FAKE_MARKETS = ['OPENSEA', 'BLUR', 'FOUNDATION', 'SUPERRARE', 'LOOKSRARE', 'X2Y2', 'RARIBLE'];

function generateFakeSale(): NFTSale {
  const marketplace = FAKE_MARKETS[Math.floor(Math.random() * FAKE_MARKETS.length)];
  const big = Math.random() < 0.08;
  const price = big
    ? 0.5 + Math.random() * 15
    : 0.001 + Math.random() * 0.5;
  return {
    id: `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    collection: FAKE_COLLECTIONS[Math.floor(Math.random() * FAKE_COLLECTIONS.length)],
    tokenName: `#${Math.floor(Math.random() * 9999)}`,
    price,
    currency: 'ETH',
    marketplace,
    timestamp: Date.now(),
  };
}

function mapMarketplace(source: string): string {
  const s = source?.toLowerCase() || '';
  if (s.includes('opensea')) return 'OPENSEA';
  if (s.includes('blur')) return 'BLUR';
  if (s.includes('foundation')) return 'FOUNDATION';
  if (s.includes('x2y2')) return 'X2Y2';
  if (s.includes('looksrare')) return 'LOOKSRARE';
  if (s.includes('superrare')) return 'SUPERRARE';
  if (s.includes('rarible')) return 'RARIBLE';
  return source?.toUpperCase() || 'UNKNOWN';
}

export function useNFTSales(onSale: SaleCallback) {
  const lastTimestamp = useRef<number>(0);
  const seenIds = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const onSaleRef = useRef(onSale);
  const useFallback = useRef(false);
  const proxyIndex = useRef(0);
  const failCount = useRef(0);
  onSaleRef.current = onSale;

  const emitFakeBatch = useCallback(() => {
    const count = 2 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      setTimeout(() => onSaleRef.current(generateFakeSale()), i * 120);
    }
  }, []);

  const fetchSales = useCallback(async () => {
    if (useFallback.current) {
      emitFakeBatch();
      return;
    }

    try {
      const rawUrl = `${RESERVOIR_BASE}/sales/v6?limit=50&sortBy=time&sortDirection=desc`;
      const proxyFn = CORS_PROXIES[proxyIndex.current % CORS_PROXIES.length];
      const url = proxyFn(rawUrl);

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const sales = data.sales || [];
      failCount.current = 0;

      const newSales: NFTSale[] = [];

      for (const sale of sales) {
        const id = sale.id || sale.txHash + sale.logIndex;
        if (seenIds.current.has(id)) continue;
        seenIds.current.add(id);

        if (seenIds.current.size > 500) {
          const arr = Array.from(seenIds.current);
          seenIds.current = new Set(arr.slice(-300));
        }

        const ts = new Date(sale.timestamp * 1000).getTime();
        if (ts <= lastTimestamp.current && lastTimestamp.current > 0) continue;

        const price = sale.price?.amount?.native || sale.price?.amount?.decimal || 0;
        const currency = sale.price?.currency?.symbol || 'ETH';

        newSales.push({
          id,
          collection: sale.token?.collection?.name || sale.collection?.name || 'Unknown Collection',
          tokenName: sale.token?.name || `#${sale.token?.tokenId || '?'}`,
          price,
          currency,
          marketplace: mapMarketplace(sale.orderSource || sale.fillSource || ''),
          timestamp: ts,
          image: sale.token?.image || sale.token?.collection?.image,
        });
      }

      newSales.reverse().forEach((sale, i) => {
        setTimeout(() => onSaleRef.current(sale), i * 120);
      });

      if (newSales.length > 0) {
        lastTimestamp.current = Math.max(...newSales.map(s => s.timestamp));
      }
    } catch {
      failCount.current++;
      if (failCount.current >= 2) {
        // Try next proxy
        proxyIndex.current++;
        if (proxyIndex.current >= CORS_PROXIES.length) {
          console.warn('All proxies failed, switching to simulated data');
          useFallback.current = true;
          emitFakeBatch();
        }
      }
    }
  }, [emitFakeBatch]);
  useEffect(() => {
    fetchSales();
    // Poll every 8 seconds (Reservoir free tier friendly)
    intervalRef.current = setInterval(fetchSales, 8000);
    return () => clearInterval(intervalRef.current);
  }, [fetchSales]);
}

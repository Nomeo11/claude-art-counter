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

// Map Reservoir marketplace sources to our display names
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
  onSaleRef.current = onSale;

  const fetchSales = useCallback(async () => {
    try {
      const url = `${RESERVOIR_BASE}/sales/v6?limit=50&sortBy=time&sortDirection=desc`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) return;

      const data = await res.json();
      const sales = data.sales || [];

      // Process newest first, but emit in chronological order
      const newSales: NFTSale[] = [];

      for (const sale of sales) {
        const id = sale.id || sale.txHash + sale.logIndex;
        if (seenIds.current.has(id)) continue;
        seenIds.current.add(id);

        // Keep set from growing unbounded
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

      // Emit in chronological order with staggered timing for visual effect
      newSales.reverse().forEach((sale, i) => {
        setTimeout(() => onSaleRef.current(sale), i * 120);
      });

      if (newSales.length > 0) {
        lastTimestamp.current = Math.max(...newSales.map(s => s.timestamp));
      }
    } catch (err) {
      console.warn('Failed to fetch NFT sales:', err);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    // Poll every 8 seconds (Reservoir free tier friendly)
    intervalRef.current = setInterval(fetchSales, 8000);
    return () => clearInterval(intervalRef.current);
  }, [fetchSales]);
}

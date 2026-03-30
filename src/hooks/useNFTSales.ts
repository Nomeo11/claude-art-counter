import { useEffect, useRef, useCallback } from 'react';

export interface NFTSale {
  id: string;
  collection: string;
  tokenName: string;
  artist?: string;
  price: number;
  currency: string;
  chain: string;
  marketplace: string;
  timestamp: number;
  image?: string;
  imageCandidates?: string[];
  mediaType?: string;
}

type SaleCallback = (sale: NFTSale) => void;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const seenIds = new Set<string>();

async function fetchSales(): Promise<NFTSale[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/nft-sales?chain=all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.sales || !Array.isArray(data.sales)) return [];

    return data.sales
      .filter((s: any) => !seenIds.has(s.id) && (s.image || s.imageCandidates?.length))
      .map((s: any) => {
        seenIds.add(s.id);
        const imageCandidates = Array.isArray(s.imageCandidates)
          ? s.imageCandidates.filter(Boolean)
          : s.image
            ? [s.image]
            : [];

        return {
          id: s.id,
          collection: s.collection,
          tokenName: s.tokenName,
          price: s.price,
          currency: s.currency || 'ETH',
          chain: s.chain || 'ethereum',
          marketplace: s.marketplace,
          timestamp: Date.now(),
          image: imageCandidates[0] || s.image || undefined,
          imageCandidates,
          mediaType: typeof s.mediaType === 'string' ? s.mediaType : undefined,
        };
      });
  } catch (e) {
    console.warn('Failed to fetch NFT sales:', e);
    return [];
  }
}

export function useNFTSales(onSale: SaleCallback) {
  const onSaleRef = useRef(onSale);
  onSaleRef.current = onSale;
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();

  const poll = useCallback(async () => {
    const sales = await fetchSales();
    sales.forEach((sale, i) => {
      setTimeout(() => onSaleRef.current(sale), i * 300);
    });
  }, []);

  useEffect(() => {
    poll();

    function schedule() {
      intervalRef.current = setTimeout(async () => {
        await poll();
        schedule();
      }, 3000);
    }
    schedule();

    return () => clearTimeout(intervalRef.current);
  }, [poll]);
}
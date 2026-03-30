import { useEffect, useRef, useCallback, useState } from 'react';

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
let pollCount = 0;
let isFirstPoll = true;
const RARIBLE_INTERVAL = 10; // include Rarible every 10th poll (10 * 3s = 30s)
const INITIAL_MAX_PER_CHAIN = 2; // limit catch-up on first load

async function fetchSales(): Promise<NFTSale[]> {
  try {
    pollCount++;
    const includeRarible = pollCount % RARIBLE_INTERVAL === 1;
    const url = `${SUPABASE_URL}/functions/v1/nft-sales?chain=all${includeRarible ? '&rarible=1' : ''}`
    const res = await fetch(url);
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
          artist: s.artist || undefined,
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

function limitInitialBatch(sales: NFTSale[]): NFTSale[] {
  // On first poll, only show a few per chain to avoid a massive catch-up flood
  const counts: Record<string, number> = {};
  return sales.filter(s => {
    counts[s.chain] = (counts[s.chain] || 0) + 1;
    return counts[s.chain] <= INITIAL_MAX_PER_CHAIN;
  });
}

const COUNTDOWN_SECONDS = 10;

export function useNFTSales(onSale: SaleCallback) {
  const onSaleRef = useRef(onSale);
  onSaleRef.current = onSale;
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const [countdown, setCountdown] = useState<number | null>(null);

  const poll = useCallback(async () => {
    let sales = await fetchSales();
    if (isFirstPoll) {
      sales = limitInitialBatch(sales);
      isFirstPoll = false;
    }
    sales.forEach((sale, i) => {
      setTimeout(() => onSaleRef.current(sale), i * 300);
    });
  }, []);

  useEffect(() => {
    // First poll: show initial batch, then countdown before going live
    poll().then(() => {
      setCountdown(COUNTDOWN_SECONDS);
      let remaining = COUNTDOWN_SECONDS;
      countdownRef.current = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          setCountdown(null);
          // Start live polling
          function schedule() {
            intervalRef.current = setTimeout(async () => {
              await poll();
              schedule();
            }, 3000);
          }
          poll();
          schedule();
        }
      }, 1000);
    });

    return () => {
      clearTimeout(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [poll]);

  return { countdown };
}
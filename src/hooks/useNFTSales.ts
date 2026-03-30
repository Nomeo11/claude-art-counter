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
const seenIds = new Map<string, number>(); // id -> timestamp
let pollCount = 0;
let isFirstPoll = true;
const RARIBLE_INTERVAL = 10;
const INITIAL_MAX_PER_CHAIN = 2;
const SEEN_TTL = 90_000; // forget seen IDs after 90s so feed stays alive

async function fetchSales(): Promise<NFTSale[]> {
  try {
    pollCount++;
    // Prune old seen IDs to keep feed alive
    const now = Date.now();
    for (const [id, ts] of seenIds) {
      if (now - ts > SEEN_TTL) seenIds.delete(id);
    }

    const includeRarible = pollCount % RARIBLE_INTERVAL === 1;
    const url = `${SUPABASE_URL}/functions/v1/nft-sales?chain=all${includeRarible ? '&rarible=1' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.sales || !Array.isArray(data.sales)) return [];

    return data.sales
      .filter((s: any) => !seenIds.has(s.id) && (s.image || s.imageCandidates?.length))
      .map((s: any) => {
        seenIds.set(s.id, Date.now());
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

const COUNTDOWN_SECONDS = 5;

export function useNFTSales(onSale: SaleCallback) {
  const onSaleRef = useRef(onSale);
  onSaleRef.current = onSale;
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [waitingForGo, setWaitingForGo] = useState(true);
  const bufferedSalesRef = useRef<NFTSale[]>([]);

  const poll = useCallback(async () => {
    let sales = await fetchSales();
    if (isFirstPoll) {
      sales = limitInitialBatch(sales);
      isFirstPoll = false;
    }
    return sales;
  }, []);

  const dispatchSales = useCallback((sales: NFTSale[]) => {
    sales.forEach((sale, i) => {
      setTimeout(() => onSaleRef.current(sale), i * 300);
    });
  }, []);

  const startCountdown = useCallback(() => {
    setWaitingForGo(false);
    setCountdown(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;

    // Pre-fetch sales during countdown
    poll().then(sales => {
      bufferedSalesRef.current = sales;
    });

    countdownRef.current = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);

        // Dispatch buffered sales
        dispatchSales(bufferedSalesRef.current);
        bufferedSalesRef.current = [];

        // Start live polling
        function schedule() {
          intervalRef.current = setTimeout(async () => {
            const sales = await poll();
            dispatchSales(sales);
            schedule();
          }, 3000);
        }
        poll().then(sales => {
          dispatchSales(sales);
          schedule();
        });
      }
    }, 1000);
  }, [poll, dispatchSales]);

  useEffect(() => {
    return () => {
      clearTimeout(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  return { countdown, waitingForGo, startCountdown };
}
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

const COLLECTIONS = [
  { name: 'Bored Ape Yacht Club', floor: 8, max: 120, img: 'https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR0M9rAKFENIlu0Dnv-BZmKMi8rB5a4UhFPYkfLTCqOaOE7Tg' },
  { name: 'CryptoPunks', floor: 25, max: 200, img: 'https://i.seadn.io/gae/BdxvLseXcfl57BiuQcQYdJ64v-aI8din7WPk0Pgo3qQFhAUH-B6i-dCqqc_mCkRIzULmwzwecnohLhrcH8A9mpWIZqA7yfnrgNxJ_Q' },
  { name: 'Azuki', floor: 4, max: 50, img: 'https://i.seadn.io/gcs/files/1017097edc3e7dd7dab1e53b3deaa4b3.png' },
  { name: 'Pudgy Penguins', floor: 8, max: 60, img: 'https://i.seadn.io/gae/yNi-XdGxsgQCPpqSio4o31ygAV6wURdIdInWRcFIl46UjUQ1eV7BEndGe8L661OoG-clRi7EgInLX4LPu5Jjga4GI_pziZCrix_pHZBI' },
  { name: 'Doodles', floor: 2, max: 30, img: 'https://i.seadn.io/gae/7B0qai02OdHA8P_EOVK672qUliyjQdQDGNrACxs7WnTgZAkJa_wWURnIFKeOh5VTf8cfTqW3wQpozGedaC9mteKphEOtztls02RlWQ' },
  { name: 'CloneX', floor: 1.5, max: 25, img: 'https://i.seadn.io/gae/XN0XuD8Uh3jyRWNtPTFeXJg_ht8m5ofDx6aHklOiy4amhFuWUa0JaR6It49AH8tlnYS386Q0TW_-Lmedn0UET_ko1a3CbJGeu5iHMg' },
  { name: 'Moonbirds', floor: 0.8, max: 15, img: 'https://i.seadn.io/gae/H-eyNE1MtWA3aRuSP8KE0xwi-7N5J5TlTO3K4QkLn-PKnAdbZGSmK0qdNVEJfoSYLA4JC3jmA2KR_vFA9OVr3ABwwGs2PH6M5Q' },
  { name: 'Art Blocks', floor: 0.5, max: 80, img: 'https://i.seadn.io/gae/GHhptRLebBOcz-HVNX0UYV-_JGeLDkzDBygebH1OBxu7PcPSrmMpz55klVSfbd_FU3MrpM3E3w3OP5VbZGGZ0gC_BbghXwA_gFmGVw' },
  { name: 'Chromie Squiggle', floor: 3, max: 60, img: 'https://i.seadn.io/gae/M_q-hJqvDB5B30Wm1K8NoSH-2rmVPM3Yjj3E4K3Kh5BNFJMwX28RvTJqPiTDI3bVi1jx3WEATHX-d5jLXgMXIBL1g' },
  { name: 'Fidenza', floor: 30, max: 300, img: 'https://i.seadn.io/gae/6LdH7M2KZxS2w-NjrPkN_4sm2FpL8dXQ9u6tJYvb1IYHNgyEW-IhHJOIciCgkL9rLJ1EEgNafj5rwVJ2F42SZQO_' },
  { name: 'DeGods', floor: 2, max: 30, img: 'https://i.seadn.io/gcs/files/09328274879f441950ee98632b8d2dd6.png' },
  { name: 'Milady Maker', floor: 3, max: 20, img: 'https://i.seadn.io/gcs/files/e33b2eed3904ee4ed5aa4f6bfcbc6e67.png' },
  { name: 'Checks VV', floor: 0.3, max: 8, img: 'https://i.seadn.io/gcs/files/5780b0e18b3a1eab5cd12f7e844c49ad.png' },
  { name: 'Opepen', floor: 0.2, max: 5, img: 'https://i.seadn.io/gcs/files/53a03e0e67cd31dfc7f17c253a5a4d3b.jpg' },
  { name: 'Nouns', floor: 15, max: 100, img: 'https://i.seadn.io/gae/vfYB4MU-XTi8f15DAHTfhvMpwMEUzKMori4ooo1E6fa2bbBaUT7MvvDbQjMbFRsSJgfN-xoDBIpTBP8MfczkuUkHAGpf_CP63uNBXv' },
  { name: 'Cool Cats', floor: 0.5, max: 8, img: 'https://i.seadn.io/gae/LIov33kogXOK4XZd2ESj29sqm_Hww5JSdO7AFn5LpKax7C01JMC8mtMOGIfTe4YwseVTjOB6RCMn__6VB5FwYPNXEw' },
  { name: 'World of Women', floor: 0.3, max: 5, img: 'https://i.seadn.io/gae/EFAQpIktMBU5SU0TqSdPWZ4BY0b0G6GBbKHpPa1VUoYL9WUpbWwkl8rRCq5PLYZUAKB1B0YfMKqPLRJZi_Gsb52JzUo' },
  { name: 'Meebits', floor: 1, max: 12, img: 'https://i.seadn.io/gae/d784iHHbqQFVH1XYD6HoT4u3y_Fsu_9FZUltWjnOzoYv7qqB5dLUqpGyHBd8Gq3h4mykK5Enj8pxqOUorgD2PfIWcVj9ugvu8l0' },
];

const MARKETS = ['OPENSEA', 'BLUR', 'FOUNDATION', 'SUPERRARE', 'LOOKSRARE', 'X2Y2', 'RARIBLE'];
const MARKET_WEIGHTS = [40, 30, 5, 3, 8, 7, 7]; // Weighted distribution

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
  const marketplace = MARKETS[marketIdx];
  const big = Math.random() < 0.06;
  const price = big
    ? col.floor + Math.random() * (col.max - col.floor)
    : col.floor * (0.8 + Math.random() * 0.4);

  return {
    id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    collection: col.name,
    tokenName: `#${Math.floor(Math.random() * 9999)}`,
    price: Math.round(price * 1000) / 1000,
    currency: 'ETH',
    marketplace,
    timestamp: Date.now(),
    image: col.img,
  };
}

export function useNFTSales(onSale: SaleCallback) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const onSaleRef = useRef(onSale);
  onSaleRef.current = onSale;

  const emitBatch = useCallback(() => {
    const count = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      setTimeout(() => onSaleRef.current(generateSale()), i * 150);
    }
  }, []);

  useEffect(() => {
    // Initial burst
    for (let i = 0; i < 8; i++) {
      setTimeout(() => onSaleRef.current(generateSale()), i * 200);
    }

    // Ongoing sales every 2-6 seconds
    function schedule() {
      const delay = 2000 + Math.random() * 4000;
      intervalRef.current = setTimeout(() => {
        emitBatch();
        schedule();
      }, delay) as unknown as ReturnType<typeof setInterval>;
    }
    schedule();

    return () => clearTimeout(intervalRef.current as unknown as number);
  }, [emitBatch]);
}

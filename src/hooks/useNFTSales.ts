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

// Use publicly accessible NFT images via IPFS gateways and other reliable hosts
const COLLECTIONS = [
  { name: 'Bored Ape Yacht Club', floor: 8, max: 120, img: 'https://ipfs.io/ipfs/QmRRPWG96cmgTn2qSzjwr2qvfNEuhunv6FNeMFGa9bx6mQ' },
  { name: 'CryptoPunks', floor: 25, max: 200, img: 'https://ipfs.io/ipfs/QmWEFSMku6yGLQ9TQr3AXAi3YhLjcXMbqCeEcSaWg1JQah' },
  { name: 'Azuki', floor: 4, max: 50, img: 'https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/1.png' },
  { name: 'Pudgy Penguins', floor: 8, max: 60, img: 'https://ipfs.io/ipfs/QmNf1UsmdGaMbpatQ6toXbzXo3GjSf76diJ1AvA1FL1cp3/2.png' },
  { name: 'Doodles', floor: 2, max: 30, img: 'https://ipfs.io/ipfs/QmPMc4tcBsMqLRuCQtPmPe84bpSjrC3Ky7t3JWuHXYB4aS/1' },
  { name: 'CloneX', floor: 1.5, max: 25, img: 'https://clonex-assets.rtfkt.com/images/1.png' },
  { name: 'Moonbirds', floor: 0.8, max: 15, img: 'https://live---metadata-5covpqijaa-uc.a.run.app/images/1' },
  { name: 'Art Blocks: Fidenza', floor: 30, max: 300, img: 'https://media.artblocks.io/78000001.png' },
  { name: 'Art Blocks: Squiggle', floor: 3, max: 60, img: 'https://media.artblocks.io/0.png' },
  { name: 'Art Blocks: Ringers', floor: 5, max: 80, img: 'https://media.artblocks.io/13000001.png' },
  { name: 'DeGods', floor: 2, max: 30, img: 'https://metadata.degods.com/g/1.png' },
  { name: 'Milady Maker', floor: 3, max: 20, img: 'https://www.miladymaker.net/milady/1.png' },
  { name: 'Nouns', floor: 15, max: 100, img: 'https://noun.pics/1' },
  { name: 'Cool Cats', floor: 0.5, max: 8, img: 'https://ipfs.io/ipfs/QmSg1DP3TYqLivhyXAGDRL3YSQAosNHr1o3oehqJFRCzUz/1.png' },
  { name: 'World of Women', floor: 0.3, max: 5, img: 'https://ipfs.io/ipfs/QmTvSRKDo3z1LCpMS5QS3eU6PFmGWLkjU7WRAXHP8Fembk/1.png' },
  { name: 'Meebits', floor: 1, max: 12, img: 'https://meebits.larvalabs.com/meebitimages/characterimage?index=1&type=full&width=600' },
  { name: 'Checks VV', floor: 0.3, max: 8, img: 'https://checks.art/api/checks/1/img' },
  { name: 'Invisible Friends', floor: 0.5, max: 6, img: 'https://ipfs.io/ipfs/QmVwBqEfMYaYBNSD9C7pYsFBLv1fMUWUuyhpNYm4F52aM6/1.gif' },
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
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();
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

    function schedule() {
      const delay = 2000 + Math.random() * 4000;
      intervalRef.current = setTimeout(() => {
        emitBatch();
        schedule();
      }, delay);
    }
    schedule();

    return () => clearTimeout(intervalRef.current);
  }, [emitBatch]);
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALCHEMY_BASE = 'https://eth-mainnet.g.alchemy.com/nft/v3/demo';

const SOLANA_COLLECTIONS = [
  'mad_lads', 'degods', 'okay_bears', 'famous_fox_federation',
  'solana_monkey_business', 'tensorians', 'claynosaurz',
];

function normalizeTezosMediaUrl(url?: string): string {
  if (!url) return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('ipfs://ipfs/')) {
    return `https://ipfs.io/ipfs/${trimmed.replace('ipfs://ipfs/', '')}`;
  }

  if (trimmed.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${trimmed.replace('ipfs://', '')}`;
  }

  if (trimmed.startsWith('/ipfs/')) {
    return `https://ipfs.io${trimmed}`;
  }

  return trimmed;
}

function getTezosImageCandidates(token: any): string[] {
  return Array.from(new Set([
    normalizeTezosMediaUrl(token?.artifact_uri),
    normalizeTezosMediaUrl(token?.thumbnail_uri),
    normalizeTezosMediaUrl(token?.display_uri),
  ].filter(Boolean)));
}

async function fetchEthSales(pageKey?: string): Promise<any[]> {
  try {
    const url = `${ALCHEMY_BASE}/getNFTSales?fromBlock=0&toBlock=latest&limit=10&order=desc${pageKey ? `&pageKey=${pageKey}` : ''}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const sales = data.nftSales || [];

    const metaRequests = sales.map((s: any) =>
      fetch(`${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${s.contractAddress}&tokenId=${s.tokenId}`, { headers: { Accept: 'application/json' } })
        .then(r => r.ok ? r.json() : null).catch(() => null)
    );
    const metas = await Promise.all(metaRequests);

    return sales.map((s: any, i: number) => {
      const m = metas[i];
      const total = (BigInt(s.sellerFee?.amount || '0') + BigInt(s.protocolFee?.amount || '0') + BigInt(s.royaltyFee?.amount || '0'));
      const price = Number(total) / 1e18;
      return {
        id: `eth-${s.transactionHash}-${s.logIndex}`,
        collection: m?.contract?.openSeaMetadata?.collectionName || m?.contract?.name || 'Unknown',
        tokenName: m?.name || `#${s.tokenId}`,
        price,
        currency: 'ETH',
        chain: 'ethereum',
        marketplace: (s.marketplace || 'unknown').toUpperCase(),
        image: m?.image?.cachedUrl || m?.image?.thumbnailUrl || m?.image?.originalUrl || '',
      };
    }).filter((s: any) => s.price > 0);
  } catch { return []; }
}

async function fetchSolanaSales(): Promise<any[]> {
  try {
    const col = SOLANA_COLLECTIONS[Math.floor(Math.random() * SOLANA_COLLECTIONS.length)];
    const res = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${col}/activities?type=buyNow&limit=10`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((s: any) => ({
      id: `sol-${s.signature}`,
      collection: s.collectionSymbol?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Unknown',
      tokenName: s.tokenMint ? `#${s.tokenMint.slice(0, 6)}` : 'Unknown',
      price: s.price || 0,
      currency: 'SOL',
      chain: 'solana',
      marketplace: (s.source || 'magiceden').toUpperCase().replace('MAGICEDEN_V2', 'MAGIC EDEN'),
      image: s.image || '',
    })).filter((s: any) => s.price > 0 && s.image);
  } catch { return []; }
}

async function fetchTezosSales(): Promise<any[]> {
  try {
    const query = `{
      event(where: {price_xtz: {_is_null: false, _gt: 0}}, order_by: {timestamp: desc}, limit: 10) {
        token { name display_uri thumbnail_uri artifact_uri mime }
        price_xtz
        timestamp
      }
    }`;
    const res = await fetch('https://data.objkt.com/v3/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events = data?.data?.event || [];

    return events.map((e: any, i: number) => {
      const token = e.token || {};
      const imageCandidates = getTezosImageCandidates(token);
      const mediaType = typeof token?.mime === 'string' ? token.mime.toLowerCase() : '';
      return {
        id: `tez-${e.timestamp}-${i}`,
        collection: token.name || 'Tezos NFT',
        tokenName: token.name || 'Unknown',
        price: (e.price_xtz || 0) / 1_000_000,
        currency: 'XTZ',
        chain: 'tezos',
        marketplace: 'OBJKT',
        image: imageCandidates[0] || '',
        imageCandidates,
        mediaType: mediaType || undefined,
      };
    }).filter((s: any) => s.price > 0 && s.imageCandidates.length > 0);
  } catch { return []; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const chain = url.searchParams.get('chain') || 'all';
    const pageKey = url.searchParams.get('pageKey') || undefined;

    let sales: any[] = [];

    if (chain === 'all') {
      const [eth, sol, tez] = await Promise.all([
        fetchEthSales(pageKey),
        fetchSolanaSales(),
        fetchTezosSales(),
      ]);
      sales = [...eth, ...sol, ...tez];
      sales.sort(() => Math.random() - 0.5);
    } else if (chain === 'ethereum') {
      sales = await fetchEthSales(pageKey);
    } else if (chain === 'solana') {
      sales = await fetchSolanaSales();
    } else if (chain === 'tezos') {
      sales = await fetchTezosSales();
    }

    return new Response(JSON.stringify({ sales }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
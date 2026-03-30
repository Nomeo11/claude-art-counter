import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY') || 'demo';
const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`;
const RESERVOIR_BASE = 'https://api.reservoir.tools';

const SOLANA_COLLECTIONS = [
  'mad_lads', 'degods', 'okay_bears', 'famous_fox_federation',
  'solana_monkey_business', 'tensorians', 'claynosaurz',
  'sharky_fi', 'degenerate_ape_academy', 'aurory',
  'cets_on_creck', 'primates', 'blocksmith_labs',
  'abc_abracadabra', 'lifinity_flares', 'smb_gen2',
  'boogles', 'gothic_degens', 'galactic_geckos',
  'shadowy_super_coder_dao',
];

function normalizeTezosMediaUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ipfs://ipfs/')) return `https://ipfs.io/ipfs/${trimmed.replace('ipfs://ipfs/', '')}`;
  if (trimmed.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${trimmed.replace('ipfs://', '')}`;
  if (trimmed.startsWith('/ipfs/')) return `https://ipfs.io${trimmed}`;
  return trimmed;
}

function getTezosImageCandidates(token: any): string[] {
  return Array.from(new Set([
    normalizeTezosMediaUrl(token?.display_uri || token?.displayUri),
    normalizeTezosMediaUrl(token?.thumbnail_uri || token?.thumbnailUri),
    normalizeTezosMediaUrl(token?.artifact_uri || token?.artifactUri),
  ].filter(Boolean)));
}

// ─── Ethereum: Alchemy getAssetTransfers (live ERC721 sales) ───
async function fetchEthLiveTransfers(): Promise<any[]> {
  try {
    const alchemyRpc = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    
    // Fetch recent ERC721 transfers
    const res = await fetch(alchemyRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          category: ['erc721'],
          order: 'desc',
          maxCount: '0x1E', // 30
          withMetadata: true,
          excludeZeroValue: false,
        }],
      }),
    });
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const transfers = data?.result?.transfers || [];
    
    // Filter out mints (from zero address)
    const salesCandidates = transfers.filter((t: any) => 
      t.from !== '0x0000000000000000000000000000000000000000'
    );

    // Get ETH values for transactions to find actual paid sales
    const txHashes = [...new Set(salesCandidates.slice(0, 20).map((t: any) => t.hash))];
    const txPromises = txHashes.map(hash =>
      fetch(alchemyRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [hash] }),
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    );
    const txResults = await Promise.all(txPromises);
    const txMap: Record<string, any> = {};
    txResults.forEach(r => {
      if (r?.result?.hash) txMap[r.result.hash] = r.result;
    });

    // Only keep transfers where the transaction had ETH value (= paid sale)
    const paidTransfers = salesCandidates.filter((t: any) => {
      const tx = txMap[t.hash];
      const ethValue = tx?.value ? parseInt(tx.value, 16) / 1e18 : 0;
      return ethValue > 0.001; // filter dust
    }).slice(0, 15);

    // Fetch metadata for paid transfers
    const metaPromises = paidTransfers.map((t: any) => {
      const contract = t.rawContract?.address;
      const tokenId = t.erc721TokenId ? String(parseInt(t.erc721TokenId, 16)) : null;
      if (!contract || !tokenId) return Promise.resolve(null);
      return fetch(`${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${contract}&tokenId=${tokenId}`, {
        headers: { Accept: 'application/json' },
      }).then(r => r.ok ? r.json() : null).catch(() => null);
    });
    const metas = await Promise.all(metaPromises);

    // Known marketplace router contracts (includes multiple versions)
    const MARKETPLACE_MAP: Record<string, string> = {
      // OpenSea Seaport versions
      '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': 'OPENSEA',
      '0x00000000006c3852cbef3e08e8df289169ede581': 'OPENSEA',
      '0x0000000000000068f116a894984e2db1123eb395': 'OPENSEA',
      '0x00000000000001ad428e4906ae43d8f9852d0dd6': 'OPENSEA',
      '0x0000000000000ad24e80fd803c6ac37206a95221': 'OPENSEA',
      // Blur
      '0x39da41747a83aee658334415666f3ef92dd0d541': 'BLUR',
      '0xb2ecfe4e4d61f8790bbb9de2d1259b9e2410cea5': 'BLUR',
      '0x29469395eaf6f95920e59f858042f0e28d98a20b': 'BLUR',
      '0x000000000000ad05ccc4f10045630fb830b95127': 'BLUR',
      // X2Y2
      '0x74312363e45dcaba76c59ec49a7aa8a65a67eed3': 'X2Y2',
      // LooksRare
      '0x59728544b08ab483533076417fbbb2fd0b17556a': 'LOOKSRARE',
      '0x0000000000e655fae4d56241588680f86e3b2377': 'LOOKSRARE',
      // Sudoswap
      '0x2b2e8cda09bba9660dca5cb6233787738ad68329': 'SUDOSWAP',
      // Magic Eden
      '0xa020d57ab0448ef74115c112d18a9c231cc86000': 'MAGIC EDEN',
      // Gem (OpenSea aggregator)
      '0x0000000035634b55f3d99b071b5a354f48e10bef': 'OPENSEA',
      '0x83c8f28c26bf6aaca652df1dbbe0e1b56f8baba2': 'OPENSEA',
    };

    return paidTransfers.map((t: any, i: number) => {
      const m = metas[i];
      const tx = txMap[t.hash];
      const ethValue = tx?.value ? parseInt(tx.value, 16) / 1e18 : 0;
      const tokenId = t.erc721TokenId ? String(parseInt(t.erc721TokenId, 16)) : '?';
      const collection = m?.contract?.openSeaMetadata?.collectionName || m?.contract?.name || 'Unknown';
      const tokenName = m?.name || `#${tokenId}`;
      const image = m?.image?.cachedUrl || m?.image?.thumbnailUrl || m?.image?.originalUrl || '';
      const timestamp = t.metadata?.blockTimestamp || '';

      const toAddr = tx?.to?.toLowerCase() || '';
      // Check direct match, then check if input data starts with known selectors
      let marketplace = MARKETPLACE_MAP[toAddr] || '';
      if (!marketplace) {
        const input = (tx?.input || '').slice(0, 10).toLowerCase();
        // Seaport fulfillBasicOrder / fulfillOrder / matchOrders
        if (['0xfb0f3ee1', '0xe7acab24', '0xa8174404', '0x87201b41'].includes(input)) {
          marketplace = 'OPENSEA';
        } else {
          marketplace = 'NFT SALE';
        }
      }

      return {
        id: `eth-live-${t.uniqueId}`,
        collection,
        tokenName,
        price: ethValue,
        currency: 'ETH',
        chain: 'ethereum',
        marketplace,
        image,
        timestamp,
      };
    }).filter((s: any) => s.price > 0 && s.image);
  } catch (e) {
    console.error('Alchemy live fetch error:', e);
    return [];
  }
}

// Combined Ethereum fetch
async function fetchEthSales(_pageKey?: string): Promise<any[]> {
  return fetchEthLiveTransfers();
}

// ─── Solana (MagicEden — expanded collections) ───
async function fetchSolanaSales(): Promise<any[]> {
  try {
    // Pick 3 random collections to spread coverage
    const shuffled = [...SOLANA_COLLECTIONS].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 3);

    const requests = picks.map(col =>
      fetch(`https://api-mainnet.magiceden.dev/v2/collections/${col}/activities?type=buyNow&limit=5`, {
        headers: { Accept: 'application/json' },
      }).then(r => r.ok ? r.json() : []).catch(() => [])
    );
    const results = await Promise.all(requests);
    const data = results.flat().filter(Array.isArray(results) ? Boolean : () => false);
    const allActivities = results.flatMap(r => Array.isArray(r) ? r : []);

    return allActivities.map((s: any) => ({
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

// ─── Tezos: Objkt ───
async function fetchTezosSales(): Promise<any[]> {
  try {
    const query = `{
      event(where: {price_xtz: {_is_null: false, _gt: 0}}, order_by: {timestamp: desc}, limit: 10) {
        token { name display_uri thumbnail_uri artifact_uri mime creators { holder { alias } } }
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
      const creatorAlias = token?.creators?.[0]?.holder?.alias || '';
      return {
        id: `tez-objkt-${e.timestamp}-${i}`,
        collection: token.name || 'Tezos NFT',
        tokenName: token.name || 'Unknown',
        artist: creatorAlias,
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

// ─── Tezos: fx(hash) ───
async function fetchFxhashSales(): Promise<any[]> {
  try {
    const query = `{
      actions(
        filters: { type_in: [LISTING_V3_ACCEPTED, LISTING_V2_ACCEPTED, LISTING_V1_ACCEPTED] }
        take: 10
      ) {
        id
        type
        numericValue
        createdAt
        token {
          name
          thumbnailUri
          displayUri
          author { name }
        }
      }
    }`;
    const res = await fetch('https://api.fxhash.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const actions = data?.data?.actions || [];

    return actions.map((a: any) => {
      const token = a.token || {};
      const imageCandidates = getTezosImageCandidates(token);
      return {
        id: `tez-fxhash-${a.id}`,
        collection: token.name || 'fx(hash) NFT',
        tokenName: token.name || 'Unknown',
        artist: token.author?.name || '',
        price: (a.numericValue || 0) / 1_000_000,
        currency: 'XTZ',
        chain: 'tezos',
        marketplace: 'FX(HASH)',
        image: imageCandidates[0] || '',
        imageCandidates,
      };
    }).filter((s: any) => s.price > 0 && s.imageCandidates.length > 0);
  } catch { return []; }
}

// ─── Rarible (multi-chain) — requires API key, cached to avoid rate limits ───
let raribleCache: { data: any[]; ts: number } = { data: [], ts: 0 };
const RARIBLE_CACHE_TTL = 120_000; // 2 minutes to avoid 429s
async function fetchRaribleSales(): Promise<any[]> {
  const apiKey = Deno.env.get('RARIBLE_API_KEY');
  if (!apiKey) return [];
  
  // Return cached data if fresh
  if (Date.now() - raribleCache.ts < RARIBLE_CACHE_TTL && raribleCache.data.length > 0) {
    return raribleCache.data;
  }

  try {
    const referer = 'https://id-preview--e22f2454-77fb-4983-b775-a8c59b148c89.lovable.app';
    const res = await fetch('https://api.rarible.org/v0.1/activities/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey, 'Referer': referer },
      body: JSON.stringify({ filter: { types: ['SELL'] }, size: 5, sort: 'LATEST' }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`Rarible API ${res.status}: ${errText.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    const activities = data?.activities || [];

    // Fetch metadata in parallel with a short per-item timeout
    const headers = { 'X-API-KEY': apiKey, 'Referer': referer };
    const metaResults = await Promise.all(
      activities.map((a: any) => {
        const c = a.nft?.type?.contract;
        const t = a.nft?.type?.tokenId;
        if (!c || !t) return Promise.resolve(null);
        return Promise.race([
          fetch(`https://api.rarible.org/v0.1/items/${c}:${t}`, { headers }).then(r => r.ok ? r.json() : null),
          new Promise(r => setTimeout(() => r(null), 3000)),
        ]).catch(() => null);
      })
    );

    const result = activities.map((a: any, i: number) => {
      const priceValue = parseFloat(a.price || '0');
      const idPrefix = (a.id || '').split(':')[0]?.toUpperCase();
      let chain = 'ethereum';
      let currency = 'ETH';
      if (idPrefix === 'SOLANA') { chain = 'solana'; currency = 'SOL'; }
      else if (idPrefix === 'TEZOS') { chain = 'tezos'; currency = 'XTZ'; }
      else if (idPrefix === 'BASE') { chain = 'ethereum'; currency = 'ETH'; }
      else if (idPrefix === 'POLYGON') { chain = 'ethereum'; currency = 'MATIC'; }

      const paymentType = a.payment?.type?.['@type'];
      if (paymentType === 'ERC20' && a.priceUsd) { currency = 'USD'; }

      const meta = metaResults[i];
      const image = meta?.meta?.content?.find((c: any) =>
        c['@type'] === 'IMAGE' && (c.representation === 'PREVIEW' || c.representation === 'ORIGINAL')
      )?.url || '';
      const collectionName = meta?.meta?.name || `NFT #${a.nft?.type?.tokenId || '?'}`;
      const source = (a.source || 'RARIBLE').toUpperCase().replace('OPEN_SEA', 'OPENSEA');

      return {
        id: `rarible-${a.id}`,
        collection: collectionName,
        tokenName: collectionName,
        price: currency === 'USD' ? parseFloat(a.priceUsd || '0') : priceValue,
        currency: currency === 'USD' ? 'USD' : currency,
        chain,
        marketplace: source,
        image,
      };
    }).filter((s: any) => s.price > 0);
    raribleCache = { data: result, ts: Date.now() };
    return result;
  } catch { return raribleCache.data; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const chain = url.searchParams.get('chain') || 'all';
    const pageKey = url.searchParams.get('pageKey') || undefined;
    const includeRarible = url.searchParams.get('rarible') === '1';

    let sales: any[] = [];

    // Wrap each fetch with a 8-second timeout to prevent edge function timeout
    function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]).catch(() => [] as unknown as T);
    }

    const rariblePromise = includeRarible ? withTimeout(fetchRaribleSales()) : Promise.resolve([]);

    if (chain === 'all') {
      const [eth, sol, tez, fxhash, rarible] = await Promise.all([
        withTimeout(fetchEthSales(pageKey)),
        withTimeout(fetchSolanaSales()),
        withTimeout(fetchTezosSales()),
        withTimeout(fetchFxhashSales()),
        rariblePromise,
      ]);
      sales = [...eth, ...sol, ...tez, ...fxhash, ...rarible];
      sales.sort(() => Math.random() - 0.5);
    } else if (chain === 'ethereum') {
      const [eth, rarible] = await Promise.all([withTimeout(fetchEthSales(pageKey)), rariblePromise]);
      sales = [...eth, ...rarible.filter(s => s.chain === 'ethereum')];
    } else if (chain === 'solana') {
      const [sol, rarible] = await Promise.all([withTimeout(fetchSolanaSales()), rariblePromise]);
      sales = [...sol, ...rarible.filter(s => s.chain === 'solana')];
    } else if (chain === 'tezos') {
      const [tez, fxhash] = await Promise.all([withTimeout(fetchTezosSales()), withTimeout(fetchFxhashSales())]);
      sales = [...tez, ...fxhash];
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

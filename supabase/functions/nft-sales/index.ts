import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALCHEMY_BASE = 'https://eth-mainnet.g.alchemy.com/nft/v3/demo';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pageKey = url.searchParams.get('pageKey') || '';

    // Fetch recent NFT sales
    const salesUrl = `${ALCHEMY_BASE}/getNFTSales?fromBlock=0&toBlock=latest&limit=20&order=desc${pageKey ? `&pageKey=${pageKey}` : ''}`;
    const salesRes = await fetch(salesUrl, { headers: { 'Accept': 'application/json' } });

    if (!salesRes.ok) {
      const text = await salesRes.text();
      return new Response(JSON.stringify({ error: `Alchemy API error: ${salesRes.status}`, details: text }), {
        status: salesRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const salesData = await salesRes.json();
    const sales = salesData.nftSales || [];

    // Fetch metadata for each unique contract+token (batch up to 20)
    const metadataRequests = sales.slice(0, 20).map((sale: any) => {
      const metaUrl = `${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${sale.contractAddress}&tokenId=${sale.tokenId}`;
      return fetch(metaUrl, { headers: { 'Accept': 'application/json' } })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    });

    const metadataResults = await Promise.all(metadataRequests);

    // Combine sales with metadata
    const enrichedSales = sales.slice(0, 20).map((sale: any, i: number) => {
      const meta = metadataResults[i];
      const sellerFeeWei = BigInt(sale.sellerFee?.amount || '0');
      const protocolFeeWei = BigInt(sale.protocolFee?.amount || '0');
      const royaltyFeeWei = BigInt(sale.royaltyFee?.amount || '0');
      const totalWei = sellerFeeWei + protocolFeeWei + royaltyFeeWei;
      const priceEth = Number(totalWei) / 1e18;

      const marketplace = (sale.marketplace || 'unknown').toUpperCase();

      // Get image - try multiple sources
      let image = meta?.image?.cachedUrl
        || meta?.image?.thumbnailUrl
        || meta?.image?.originalUrl
        || meta?.raw?.metadata?.image
        || '';

      // Get collection name
      const collection = meta?.contract?.openSeaMetadata?.collectionName
        || meta?.contract?.name
        || `${sale.contractAddress.slice(0, 6)}...${sale.contractAddress.slice(-4)}`;

      const tokenName = meta?.name || `#${sale.tokenId}`;

      return {
        id: `${sale.transactionHash}-${sale.logIndex}-${sale.bundleIndex}`,
        collection,
        tokenName,
        price: priceEth,
        currency: sale.sellerFee?.symbol || 'ETH',
        marketplace,
        blockNumber: sale.blockNumber,
        image,
      };
    });

    return new Response(JSON.stringify({
      sales: enrichedSales,
      pageKey: salesData.pageKey || null,
    }), {
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

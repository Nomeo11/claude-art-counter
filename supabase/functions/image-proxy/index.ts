import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
];

function getIpfsUrls(originalUrl: string): string[] {
  const normalizedUrl = originalUrl.trim();
  const ipfsSchemeMatch = normalizedUrl.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  if (ipfsSchemeMatch) {
    const cid = ipfsSchemeMatch[1];
    return IPFS_GATEWAYS.map(gw => `${gw}${cid}`);
  }

  const ipfsPathMatch = normalizedUrl.match(/\/ipfs\/(.+)$/i);
  if (!ipfsPathMatch) return [normalizedUrl];
  const cid = ipfsPathMatch[1];
  return IPFS_GATEWAYS.map(gw => `${gw}${cid}`);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'image/*' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      return new Response('Missing url param', { status: 400, headers: corsHeaders });
    }

    const urls = getIpfsUrls(imageUrl);

    for (const tryUrl of urls) {
      try {
        const res = await fetchWithTimeout(tryUrl, 2000);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || 'image/png';
          // Reject non-image content (HTML pages, videos, etc.)
          if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
            await res.arrayBuffer(); // consume body
            continue;
          }
          const body = await res.arrayBuffer();
          // Reject suspiciously small responses (likely error pages)
          if (body.byteLength < 100) {
            continue;
          }
          return new Response(body, {
            headers: {
              ...corsHeaders,
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
        // consume body to avoid leak
        await res.text();
      } catch {
        // try next gateway
      }
    }

    return new Response('All gateways failed', { status: 502, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});
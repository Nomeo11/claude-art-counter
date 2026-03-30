import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IPFS_GATEWAYS = [
  'https://nftstorage.link/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
];

function getIpfsUrls(originalUrl: string): string[] {
  const normalizedUrl = originalUrl.trim();
  const ipfsSchemeMatch = normalizedUrl.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  if (ipfsSchemeMatch) {
    const cid = ipfsSchemeMatch[1];
    return IPFS_GATEWAYS.map((gw) => `${gw}${cid}`);
  }

  const ipfsPathMatch = normalizedUrl.match(/\/ipfs\/(.+)$/i);
  if (!ipfsPathMatch) return [normalizedUrl];
  const cid = ipfsPathMatch[1];
  return IPFS_GATEWAYS.map((gw) => `${gw}${cid}`);
}

function normalizeContentType(contentType: string | null): string {
  return contentType?.split(';')[0]?.trim().toLowerCase() || '';
}

function sniffMimeType(body: Uint8Array): string | null {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    body.length >= 6 &&
    body[0] === 0x47 &&
    body[1] === 0x49 &&
    body[2] === 0x46 &&
    body[3] === 0x38 &&
    (body[4] === 0x37 || body[4] === 0x39) &&
    body[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    body.length >= 12 &&
    body[0] === 0x52 &&
    body[1] === 0x49 &&
    body[2] === 0x46 &&
    body[3] === 0x46 &&
    body[8] === 0x57 &&
    body[9] === 0x45 &&
    body[10] === 0x42 &&
    body[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (
    body.length >= 12 &&
    body[4] === 0x66 &&
    body[5] === 0x74 &&
    body[6] === 0x79 &&
    body[7] === 0x70
  ) {
    return 'video/mp4';
  }

  return null;
}

function isRenderableMediaType(contentType: string): boolean {
  return contentType.startsWith('image/') || contentType.startsWith('video/');
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*,video/*,*/*;q=0.8' },
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
        const res = await fetchWithTimeout(tryUrl, 8000);
        if (!res.ok) {
          await res.arrayBuffer().catch(() => null);
          continue;
        }

        const body = new Uint8Array(await res.arrayBuffer());
        if (body.byteLength === 0) continue;

        const headerType = normalizeContentType(res.headers.get('content-type'));
        const sniffedType = sniffMimeType(body);
        const contentType =
          headerType && headerType !== 'application/octet-stream'
            ? headerType
            : sniffedType || headerType || 'application/octet-stream';

        if (!isRenderableMediaType(contentType)) {
          continue;
        }

        return new Response(body, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
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
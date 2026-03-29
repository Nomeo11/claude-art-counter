import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const res = await fetch(imageUrl, {
      headers: { 'Accept': 'image/*' },
    });

    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: res.status, headers: corsHeaders });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    const body = await res.arrayBuffer();

    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});

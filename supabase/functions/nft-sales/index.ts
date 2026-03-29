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
    const continuation = url.searchParams.get('continuation') || '';
    
    const apiUrl = `https://api.reservoir.tools/sales/v6?limit=50&sortBy=time&sortDirection=desc${continuation ? `&continuation=${continuation}` : ''}`;
    
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Reservoir API error: ${res.status}`, details: text }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
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

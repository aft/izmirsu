/**
 * IZSU CORS Proxy Worker
 * Deploy this to Cloudflare Workers (free tier)
 *
 * Setup:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Workers & Pages > Create Worker
 * 3. Paste this code and deploy
 * 4. Note the worker URL (e.g., izsu-proxy.username.workers.dev)
 * 5. Update API_BASE in api.js to use this URL
 */

const ALLOWED_ORIGINS = [
  'https://cembaspinar.com',
  'https://aft.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

const ALLOWED_API_HOSTS = [
  'openapi.izmir.bel.tr',
  'acikveri.bizizmir.com'
];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(origin);
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate target URL
    try {
      const target = new URL(targetUrl);
      if (!ALLOWED_API_HOSTS.includes(target.hostname)) {
        return new Response(JSON.stringify({ error: 'Host not allowed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'IZSU-Proxy/1.0',
          'Accept': 'application/json'
        }
      });

      const data = await response.text();

      const corsHeaders = getCORSHeaders(origin);

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(origin)
        }
      });
    }
  }
};

function getCORSHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function handleCORS(origin) {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(origin)
  });
}

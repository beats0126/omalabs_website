/**
 * OMA Labs — OAuth Token Exchange Proxy
 * Deploy to Cloudflare Workers (free tier)
 *
 * Setup:
 *   1. npx wrangler deploy worker.js
 *   2. Set secret: npx wrangler secret put GITHUB_CLIENT_SECRET
 *   3. Set secret: npx wrangler secret put GITHUB_CLIENT_ID
 */

export default {
  async fetch(request, env) {
    // CORS headers for the admin page
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://profile.omalabs.cc',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /token — exchange authorization code for access token
    if (url.pathname === '/token' && request.method === 'POST') {
      try {
        const { code } = await request.json();
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });

        const data = await tokenRes.json();
        return new Response(JSON.stringify(data), {
          status: tokenRes.ok ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('OMA Labs OAuth Proxy', {
      headers: corsHeaders,
    });
  },
};

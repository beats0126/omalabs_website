/**
 * OMA Labs — OAuth Token Exchange Proxy
 * Deploy to Cloudflare Workers (free tier)
 *
 * Setup:
 *   1. npx wrangler deploy worker.js
 *   2. Set secret: npx wrangler secret put GITHUB_CLIENT_SECRET
 *   3. Set secret: npx wrangler secret put GITHUB_CLIENT_ID
 */

// Simple in-memory rate limiter (resets when worker cold-starts)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;        // max requests per window per IP

function isRateLimited(ip) {
  // Prevent memory leak by periodically clearing map if it gets too large
  if (rateLimitMap.size > 5000) {
    rateLimitMap.clear();
  }

  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigins = [
      'https://profile.omalabs.cc',
      'https://beats0126.github.io'
    ];
    
    // Only allow known production origins
    let corsOrigin = 'https://profile.omalabs.cc'; 
    if (origin && allowedOrigins.includes(origin)) {
      corsOrigin = origin;
    }

    // CORS headers for the admin page
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    };

    // Simple rate limiting by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Reject requests from unknown or missing origins (defense-in-depth)
    if (!origin || !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
      });
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

        // Sanitize: only return the access token, never leak scopes or other metadata
        if (!tokenRes.ok || data.error) {
          return new Response(JSON.stringify({
            error: data.error || 'token_exchange_failed',
            error_description: data.error_description || 'Token exchange failed',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ access_token: data.access_token }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // POST /revoke — revoke an OAuth access token
    if (url.pathname === '/revoke' && request.method === 'POST') {
      try {
        const { token } = await request.json();
        if (!token) {
          return new Response(JSON.stringify({ error: 'Missing token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: 'Basic ' + btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`),
            'Content-Type': 'application/json',
            'User-Agent': 'OMA-Labs-Admin-Proxy',
          },
          body: JSON.stringify({ access_token: token }),
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
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

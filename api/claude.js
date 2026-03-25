export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return new Response(
        JSON.stringify({ error: { message: 'No API key found. Go to Settings tab and add your Anthropic API key (starts with sk-ant-).' } }),
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 3000,
        messages: body.messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });

  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out — try a shorter blog length' : err.message;
    return new Response(
      JSON.stringify({ error: { message: msg } }),
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
    );
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain, token } = req.query;

  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      node_version: process.version,
      has_env_anthropic: !!process.env.ANTHROPIC_API_KEY,
      has_env_shopify_token: !!process.env.SHOPIFY_TOKEN,
    },
    params_received: {
      domain: domain || 'NOT PROVIDED',
      token_provided: !!token,
      token_prefix: token ? token.substring(0, 10) + '...' : 'NONE',
      token_format_ok: token ? token.startsWith('shpat_') : false,
    },
    shopify_test: null,
    anthropic_test: null,
  };

  // Test Shopify connection
  if (domain && token) {
    try {
      const url = `https://${domain}/admin/api/2024-01/shop.json`;
      const resp = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      });
      const text = await resp.text();
      results.shopify_test = {
        status: resp.status,
        status_text: resp.statusText,
        url_called: url,
        response_preview: text.substring(0, 200),
        success: resp.ok,
      };
    } catch (e) {
      results.shopify_test = { error: e.message, success: false };
    }
  } else {
    results.shopify_test = { skipped: 'No domain or token provided in query params' };
  }

  // Test Anthropic connection
  const anthropicKey = req.query.apikey || process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
      });
      results.anthropic_test = {
        status: resp.status,
        success: resp.ok,
        key_prefix: anthropicKey.substring(0, 12) + '...',
      };
    } catch (e) {
      results.anthropic_test = { error: e.message, success: false };
    }
  } else {
    results.anthropic_test = { skipped: 'No API key — pass ?apikey=sk-ant-... in URL' };
  }

  return res.status(200).json(results);
}

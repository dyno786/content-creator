export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { domain, token, endpoint, limit = 250, page = 1 } = req.query;

  if (!domain || !token) {
    return res.status(400).json({ error: 'Missing domain or token' });
  }

  if (!token.startsWith('shpat_')) {
    return res.status(400).json({ error: 'Invalid token format — must start with shpat_' });
  }

  const endpointMap = {
    products: `https://${domain}/admin/api/2024-01/products.json?limit=${limit}&page=${page}&fields=id,title,handle,body_html,vendor,product_type,tags,images,variants`,
    collections: `https://${domain}/admin/api/2024-01/custom_collections.json?limit=${limit}`,
    smart_collections: `https://${domain}/admin/api/2024-01/smart_collections.json?limit=${limit}`,
  };

  const url = endpointMap[endpoint];
  if (!url) {
    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Shopify API error: ${response.status}`,
        detail: errorText,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}

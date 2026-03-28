export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain, token, endpoint, limit = 250, page = 1, handle, url } = req.query;

  // ── IMAGE PROXY — no auth needed, just fetches the image ──────────────
  if (endpoint === 'image_proxy' && url) {
    try {
      const resp = await fetch(decodeURIComponent(url));
      if (!resp.ok) return res.status(resp.status).json({ error: 'Image fetch failed' });
      const buffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'attachment; filename="product-image.jpg"');
      return res.status(200).send(Buffer.from(buffer));
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (!domain || !token) {
    return res.status(400).json({ error: 'Missing domain or token' });
  }

  const endpointMap = {
    products: `https://${domain}/admin/api/2024-01/products.json?limit=${limit}&fields=id,title,handle,body_html,vendor,product_type,tags,images,variants`,
    product_by_handle: `https://${domain}/admin/api/2024-01/products.json?handle=${handle}&fields=id,title,handle,body_html,vendor,product_type,tags,images,variants`,
    collections: `https://${domain}/admin/api/2024-01/custom_collections.json?limit=${limit}`,
    smart_collections: `https://${domain}/admin/api/2024-01/smart_collections.json?limit=${limit}`,
    shop: `https://${domain}/admin/api/2024-01/shop.json`,
  };

  const apiUrl = endpointMap[endpoint];
  if (!apiUrl) {
    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Shopify ${response.status}`,
        detail: text.substring(0, 300),
      });
    }
    const data = JSON.parse(text);
    if (endpoint === 'product_by_handle' && data.products) {
      return res.status(200).json({ product: data.products[0] || null });
    }
    return res.status(200).json(data);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

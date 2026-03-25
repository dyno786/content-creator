export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-shopify-token, x-shopify-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-shopify-token'];
  const store = req.headers['x-shopify-store'];

  if (!token || !store) {
    return res.status(400).json({ error: 'Missing Shopify credentials' });
  }

  try {
    const url = req.query.endpoint 
      ? `https://${store}/admin/api/2024-01/${req.query.endpoint}`
      : `https://${store}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,variants,product_type,images,vendor`;

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

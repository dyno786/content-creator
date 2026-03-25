export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-shopify-token, x-shopify-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-shopify-token'];
  const store = req.headers['x-shopify-store'];

  if (!token || !store) {
    return res.status(400).json({ error: 'Missing Shopify credentials. Add your store domain and API token in Settings.' });
  }

  try {
    let url;
    if (req.query.page_info) {
      // Cursor-based pagination - page_info replaces all other params
      url = `https://${store}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,variants,product_type,images,vendor&page_info=${req.query.page_info}`;
    } else {
      url = `https://${store}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,variants,product_type,images,vendor`;
    }

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        return res.status(401).json({ error: 'Invalid Shopify API token. Check your token starts with shpat_ and has read_products permission.' });
      }
      return res.status(response.status).json({ error: `Shopify error ${response.status}: ${errText.substring(0, 200)}` });
    }

    const data = await response.json();

    // Extract next page cursor from Link header
    const linkHeader = response.headers.get('Link') || '';
    data._link = linkHeader;

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Connection failed: ' + err.message });
  }
}

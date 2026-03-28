import OpenAI from "openai";

// ── SETTING PROMPTS ────────────────────────────────────────────────────────
const SETTINGS = {
  bathroom: {
    label: 'Bathroom Shelf',
    prompt: 'Place this exact product on a clean marble bathroom shelf. Soft warm lighting from the side. White and grey tones. A folded white towel in the background, slightly out of focus. The product label must be clearly visible and unaltered. No people, no faces. Photorealistic, professional product photography.',
  },
  barber: {
    label: 'Barber Counter',
    prompt: 'Place this exact product on a barbershop counter. Dark wood surface, chrome accents, a mirror reflection visible in the background, slightly out of focus. Barbershop aesthetic, professional lighting. The product label must be clearly visible and unaltered. No people, no faces. Photorealistic.',
  },
  bedroom: {
    label: 'Bedroom Dressing Table',
    prompt: 'Place this exact product on a bedroom vanity dressing table. Warm soft lighting, a round mirror partially visible in the background. Luxurious feminine aesthetic. The product label must be clearly visible and unaltered. No people, no faces. Photorealistic, professional product photography.',
  },
  salon: {
    label: 'Beauty Salon Station',
    prompt: 'Place this exact product on a professional beauty salon counter. Clean salon aesthetic, good lighting, styling tools softly visible in the background. The product label must be clearly visible and unaltered. No people, no faces. Photorealistic.',
  },
  natural: {
    label: 'Natural & Spa',
    prompt: 'Place this exact product on a wooden surface surrounded by natural botanicals — eucalyptus leaves, dried flowers, a small stone. Soft natural window lighting. Spa and wellness aesthetic. The product label must be clearly visible and unaltered. No people, no faces. Photorealistic.',
  },
  studio: {
    label: 'Clean Studio',
    prompt: 'Place this exact product on a clean white studio surface with a soft grey gradient background. Professional studio lighting from above and left. The product label must be clearly visible and unaltered. No people. Photorealistic, commercial product photography.',
  },
  hands: {
    label: 'Hands Holding Product',
    prompt: 'Show a pair of well-manicured hands gently holding this exact product at a slight angle. Clean neutral background. The product label must be clearly visible. No faces, only hands from mid-forearm down. Photorealistic, lifestyle product photography.',
  },
  flatlay: {
    label: 'Flatlay Overhead',
    prompt: 'Flat lay overhead shot of this exact product on a light marble or pastel surface. Arrange small complementary beauty accessories around it — a comb, small flowers, a mirror — all slightly out of focus. The product must be the clear focus. No people, no faces. Photorealistic, professional beauty flatlay photography.',
  },
};

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET' && req.query.settings === '1') {
    // Return available settings to the frontend
    return res.status(200).json({
      settings: Object.entries(SETTINGS).map(([key, val]) => ({
        key,
        label: val.label,
      })),
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { productImageUrl, productName, productType, setting = 'studio', apiKey } = req.body;

  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) return res.status(400).json({ error: 'Missing OpenAI API key — add it in Settings' });
  if (!productImageUrl) return res.status(400).json({ error: 'Missing product image URL' });

  const settingConfig = SETTINGS[setting] || SETTINGS.studio;

  try {
    const openai = new OpenAI({ apiKey: key });

    // Step 1: Fetch the Shopify product image as a buffer
    let imageBuffer;
    try {
      const imgResp = await fetch(productImageUrl);
      if (!imgResp.ok) throw new Error(`Could not fetch product image: ${imgResp.status}`);
      const arrayBuffer = await imgResp.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } catch (e) {
      return res.status(400).json({ error: `Could not load product image: ${e.message}` });
    }

    // Step 2: Create a File object from the buffer for the OpenAI SDK
    const { Blob } = await import('buffer');
    const imageFile = new File(
      [imageBuffer],
      'product.jpg',
      { type: 'image/jpeg' }
    );

    // Step 3: Build the full prompt
    const fullPrompt = [
      `Product: ${productName || 'hair and beauty product'}.`,
      `Type: ${productType || 'beauty product'}.`,
      settingConfig.prompt,
      `This is for CC Hair & Beauty Leeds social media marketing.`,
      `CRITICAL: Keep the original product exactly as it is — same packaging, same label, same colours. Only change the background and setting. The product must look identical to the input image.`,
      `No text overlays. No logos added. No human faces. Square 1:1 format.`,
    ].join(' ');

    console.log(`Generating image: ${productName} in ${settingConfig.label}`);

    // Step 4: Call the image edit endpoint with the product photo
    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
    });

    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error('No image data returned');

    return res.status(200).json({
      success: true,
      image_b64: imageBase64,
      model: 'gpt-image-1 (edit)',
      setting: settingConfig.label,
      estimated_cost: '~$0.05-0.07 (~4-5p)',
    });

  } catch (err) {
    console.error('Image generation error:', err);
    let message = err.message || 'Unknown error';

    if (message.includes('billing') || message.includes('quota') || message.includes('hard limit')) {
      message = 'OpenAI billing limit reached — go to platform.openai.com/settings/billing to top up';
    } else if (message.includes('invalid_api_key') || message.includes('Incorrect API key')) {
      message = 'Invalid OpenAI API key — check Settings';
    } else if (message.includes('organization') || message.includes('verification')) {
      message = 'Organization verification needed — see platform.openai.com/settings/organization';
    } else if (message.includes('content_policy') || message.includes('safety')) {
      message = 'Blocked by content policy — try a different setting or product';
    } else if (message.includes('Could not fetch') || message.includes('Could not load')) {
      message = message; // Pass through image fetch errors as-is
    }

    return res.status(500).json({ error: message });
  }
}

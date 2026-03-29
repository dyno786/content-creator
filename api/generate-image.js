import OpenAI from "openai";
import { toFile } from "openai";

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const SETTINGS = {
  studio:   { label:'Clean Studio',         prompt:'Clean white studio background, professional lighting from top-left, soft shadow underneath. Product label must be clearly visible. No people, no faces. Photorealistic commercial product photography.' },
  bathroom: { label:'Bathroom Shelf',       prompt:'On a clean marble bathroom shelf. Soft warm lighting from the side. White folded towel blurred in background. Product label clearly visible. No people, no faces. Photorealistic.' },
  barber:   { label:'Barber Counter',       prompt:'On a barbershop counter. Dark wood surface, chrome accents, mirror reflection blurred in background. Product label clearly visible. No people, no faces. Photorealistic.' },
  bedroom:  { label:'Bedroom Vanity',       prompt:'On a bedroom vanity dressing table. Warm soft lighting, round mirror partially visible. Product label clearly visible. No people, no faces. Photorealistic.' },
  salon:    { label:'Beauty Salon',         prompt:'On a professional beauty salon station. Clean lighting, styling tools softly visible in background. Product label clearly visible. No people, no faces. Photorealistic.' },
  natural:  { label:'Natural & Spa',        prompt:'On a wooden surface surrounded by eucalyptus leaves, dried flowers, a small stone. Soft natural window lighting. Product label clearly visible. No people, no faces. Photorealistic.' },
  hands:    { label:'Hands Holding',        prompt:'Held gently in well-manicured hands at a slight angle. Clean neutral background. Product label clearly visible. Hands from mid-forearm only, no faces. Photorealistic lifestyle photography.' },
  flatlay:  { label:'Flatlay Overhead',     prompt:'Flat lay overhead shot on a light marble surface. Small beauty accessories softly arranged around — comb, flowers, mirror. Product is the clear focus. No people, no faces. Photorealistic.' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    productImageUrl,
    productName = 'hair and beauty product',
    productType = 'beauty product',
    setting = 'studio',
    apiKey,
  } = req.body;

  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) return res.status(400).json({ error: 'Missing OpenAI API key — add it in Settings' });

  const settingConfig = SETTINGS[setting] || SETTINGS.studio;

  const fullPrompt = [
    `Product: ${productName}. Type: ${productType}.`,
    settingConfig.prompt,
    `CRITICAL: Keep the original product packaging exactly as-is — same label, same colours, same shape. Only change the background/setting.`,
    `Add a subtle watermark: small semi-transparent white text "cchairandbeauty.com" at the very bottom edge.`,
    `No human faces. Square 1:1 format. High detail, photorealistic.`,
  ].join(' ');

  try {
    const openai = new OpenAI({ apiKey: key });

    // MODE 1: Image edit (with real product photo)
    if (productImageUrl) {
      let imageBuffer;
      try {
        const imgResp = await fetch(productImageUrl);
        if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status}`);
        const arrayBuffer = await imgResp.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } catch (e) {
        console.error('Image fetch error:', e.message);
        // Fall through to text-only mode
        imageBuffer = null;
      }

      if (imageBuffer) {
        try {
          // Use toFile from openai package - handles Node.js compatibility
          const imageFile = await toFile(imageBuffer, 'product.png', { type: 'image/png' });

          const result = await openai.images.edit({
            model: 'gpt-image-1',
            image: imageFile,
            prompt: fullPrompt,
            n: 1,
            size: '1024x1024',
          });

          const b64 = result.data?.[0]?.b64_json;
          if (!b64) throw new Error('No image data in edit response');

          return res.status(200).json({
            success: true,
            image_b64: b64,
            model: 'gpt-image-1 edit',
            setting: settingConfig.label,
            estimated_cost: '~5p',
          });
        } catch (editErr) {
          console.error('Edit failed, trying generate:', editErr.message);
          // Fall through to generate mode
        }
      }
    }

    // MODE 2: Text-only generation (no image or edit failed)
    const textPrompt = [
      `Professional product photography for: ${productName} by CC Hair & Beauty Leeds.`,
      `Type: ${productType}.`,
      settingConfig.prompt,
      `No human faces. Square format. Photorealistic. High quality.`,
      `Add subtle watermark: small semi-transparent white text "cchairandbeauty.com" at bottom edge.`,
    ].join(' ');

    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: textPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data in generate response');

    return res.status(200).json({
      success: true,
      image_b64: b64,
      model: 'gpt-image-1 generate',
      setting: settingConfig.label,
      estimated_cost: '~3p',
    });

  } catch (err) {
    console.error('OpenAI error:', err);
    let message = err.message || 'Unknown error';

    if (message.includes('billing') || message.includes('quota') || message.includes('hard limit')) {
      message = 'OpenAI billing limit reached — top up at platform.openai.com/settings/billing';
    } else if (message.includes('invalid_api_key') || message.includes('Incorrect API key')) {
      message = 'Invalid OpenAI API key — check Settings';
    } else if (message.includes('organization') || message.includes('verification')) {
      message = 'Organisation verification needed — platform.openai.com/settings/organization';
    } else if (message.includes('content_policy') || message.includes('safety')) {
      message = 'Blocked by content policy — try a different setting';
    } else if (message.includes('model') || message.includes('not found')) {
      message = 'Model not available on your account — may need organisation verification for gpt-image-1';
    }

    return res.status(500).json({ error: message, raw: err.message });
  }
}

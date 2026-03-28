import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, apiKey } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) return res.status(400).json({ error: 'Missing OpenAI API key — add it in Settings' });

  try {
    const openai = new OpenAI({ apiKey: key });

    // Try gpt-image-1 first (best quality), fall back to dall-e-3
    let imageBase64 = null;
    let modelUsed = '';

    try {
      // gpt-image-1 — returns base64 by default, no response_format needed
      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });
      imageBase64 = result.data?.[0]?.b64_json;
      modelUsed = 'gpt-image-1';
    } catch (e1) {
      console.log('gpt-image-1 failed:', e1.message, '— trying dall-e-3');

      // Fall back to dall-e-3 — needs response_format explicitly
      const result2 = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json",
      });
      imageBase64 = result2.data?.[0]?.b64_json;
      modelUsed = 'dall-e-3';
    }

    if (!imageBase64) throw new Error('No image data returned from OpenAI');

    return res.status(200).json({
      success: true,
      image_b64: imageBase64,
      model: modelUsed,
    });

  } catch (err) {
    console.error('OpenAI image error:', err);

    let message = err.message || 'Unknown error';
    if (message.includes('billing') || message.includes('quota')) {
      message = 'OpenAI billing issue — check your account at platform.openai.com/settings';
    } else if (message.includes('organization') || message.includes('verification')) {
      message = 'Organization verification required — see platform.openai.com/settings/organization';
    } else if (message.includes('invalid_api_key') || message.includes('Incorrect API key')) {
      message = 'Invalid OpenAI API key — check Settings';
    } else if (message.includes('content_policy') || message.includes('safety')) {
      message = 'Image blocked by OpenAI content policy — try a different product description';
    }

    return res.status(500).json({ error: message });
  }
}

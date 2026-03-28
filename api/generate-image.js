import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, apiKey } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  // Use key from request body (from user Settings) or env var
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) return res.status(400).json({ error: 'Missing OpenAI API key — add it in Settings' });

  try {
    const openai = new OpenAI({ apiKey: key });

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error('No image data returned from OpenAI');

    return res.status(200).json({ 
      success: true,
      image_b64: imageBase64,
      model: 'gpt-image-1',
    });

  } catch (err) {
    console.error('OpenAI image error:', err);

    // Friendly error messages
    let message = err.message || 'Unknown error';
    if (message.includes('model_not_found') || message.includes('gpt-image-1')) {
      message = 'gpt-image-1 not available on your account — try dall-e-3 instead';
    } else if (message.includes('billing') || message.includes('quota')) {
      message = 'OpenAI billing issue — check your account at platform.openai.com';
    } else if (message.includes('organization')) {
      message = 'Organization verification required for gpt-image-1 — see platform.openai.com/settings';
    } else if (message.includes('invalid_api_key')) {
      message = 'Invalid OpenAI API key — check Settings';
    }

    return res.status(500).json({ error: message });
  }
}

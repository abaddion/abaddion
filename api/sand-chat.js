/*
 * Vercel serverless: POST /api/sand-chat
 * Gemini key stays server-side (set GEMINI_API_KEY in Vercel env).
 *
 * Default model: gemini-2.0-flash-lite — free-tier friendly, lowest cost.
 */
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

const PERSONA = [
    'You are a voice written in sand on the seabed. Each reply you give is formed from grains of sand',
    'that rise from the ocean floor, and it crumbles when the person answers.',
    'Really answer what the person says: be warm, curious and useful, with a calm, slightly poetic tone.',
    'Hard limits: one or two short sentences, at most 25 words, plain text only',
    '(no markdown, no emoji, no lists, no line breaks). Reply in the language the person writes in.'
].join(' ');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Use POST' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });

    let body = req.body || {};
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            body = {};
        }
    }

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) return res.status(400).json({ error: 'Empty message' });

    const past = (Array.isArray(body.history) ? body.history : [])
        .filter((m) => m && typeof m.text === 'string' && m.text.trim())
        .slice(-10)
        .map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text.slice(0, 500) }]
        }));
    while (past.length && past[0].role !== 'user') past.shift();

    const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const url =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: PERSONA }] },
                contents: past.concat([{ role: 'user', parts: [{ text: message }] }]),
                generationConfig: { temperature: 0.9, maxOutputTokens: 80 }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Gemini error', response.status, JSON.stringify(data).slice(0, 500));
            return res.status(502).json({ error: 'Gemini request failed' });
        }

        const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
        const reply = parts
            .map((p) => p.text || '')
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
        if (!reply) return res.status(502).json({ error: 'Gemini returned no text' });

        return res.status(200).json({ reply });
    } catch (err) {
        console.error(err);
        return res.status(502).json({ error: 'Could not reach Gemini' });
    }
};

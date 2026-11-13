/*
 * Vercel serverless: POST /api/sand-chat
 * Gemini key stays server-side (set GEMINI_API_KEY in Vercel env).
 *
 * Model and generation settings: api/sand-chat.config.json
 * Override without redeploying config: GEMINI_MODEL, GEMINI_MAX_OUTPUT_TOKENS, GEMINI_TEMPERATURE.
 */
import sandConfig from './sand-chat.config.json' with { type: 'json' };
import {
    preferredModel,
    pickCheapestFlashLite,
    isModelUnavailable
} from './gemini-model.mjs';

const PERSONA = [
    'You are a voice written in sand on the seabed. Each reply you give is formed from grains of sand',
    'that rise from the ocean floor, and it crumbles when the person answers.',
    'Really answer what the person says: be warm, curious and useful, with a calm, slightly poetic tone.',
    'Hard limits: one or two short sentences, at most 25 words, plain text only',
    '(no markdown, no emoji, no lists, no line breaks). Reply in the language the person writes in.'
].join(' ');

function envNumber(name, fallback) {
    const raw = process.env[name]?.trim();
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

async function resolveModelId(apiKey) {
    let model = preferredModel(sandConfig);
    if (!model) model = await pickCheapestFlashLite(apiKey);
    return model || null;
}

async function callGemini(apiKey, model, payload) {
    const url =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent';

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    return { response, data, model };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Use POST' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });

    let model = await resolveModelId(key);
    if (!model) {
        return res.status(500).json({
            error: 'No Gemini model configured. Set GEMINI_MODEL or model in api/sand-chat.config.json'
        });
    }

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

    const temperature = envNumber('GEMINI_TEMPERATURE', sandConfig.temperature ?? 0.9);
    const maxOutputTokens = envNumber(
        'GEMINI_MAX_OUTPUT_TOKENS',
        sandConfig.maxOutputTokens ?? 80
    );

    const payload = {
        system_instruction: { parts: [{ text: PERSONA }] },
        contents: past.concat([{ role: 'user', parts: [{ text: message }] }]),
        generationConfig: { temperature, maxOutputTokens }
    };

    try {
        let { response, data } = await callGemini(key, model, payload);

        if (!response.ok && isModelUnavailable(response.status, data)) {
            const fallback = await pickCheapestFlashLite(key);
            if (fallback && fallback !== model) {
                console.warn('Gemini model unavailable, retrying with', fallback, 'was', model);
                model = fallback;
                ({ response, data } = await callGemini(key, model, payload));
            }
        }

        if (!response.ok) {
            console.error('Gemini error', response.status, model, JSON.stringify(data).slice(0, 500));
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
}

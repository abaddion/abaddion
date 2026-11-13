/**
 * Resolve a Gemini model id for sand-chat (flash / lite only — no pro/ultra).
 */

const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export function preferredModel(sandConfig) {
    const fromEnv = process.env.GEMINI_MODEL?.trim();
    if (fromEnv) return fromEnv;
    const fromConfig = typeof sandConfig?.model === 'string' ? sandConfig.model.trim() : '';
    return fromConfig || null;
}

function cheapnessScore(id) {
    const lower = id.toLowerCase();
    if (!lower.includes('gemini')) return -1;
    if (/\b(pro|ultra|deep)\b/.test(lower)) return -1;
    if (/preview|exp|experimental/i.test(lower)) return 50;
    if (lower.includes('flash-lite') || lower.includes('flashlite')) return 0;
    if (lower.includes('lite')) return 5;
    if (lower.includes('flash')) return 10;
    return 20;
}

/** Cheapest generateContent-capable flash/lite model from ListModels. */
export async function pickCheapestFlashLite(apiKey) {
    const url = new URL(LIST_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '100');

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const ranked = (data.models || [])
        .filter((m) => m.name && m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
        .map((id) => ({ id, score: cheapnessScore(id) }))
        .filter((m) => m.score >= 0)
        .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return b.id.localeCompare(a.id);
        });

    return ranked[0]?.id ?? null;
}

export function isModelUnavailable(status, data) {
    if (status === 404) return true;
    const msg = String(data?.error?.message || '').toLowerCase();
    return msg.includes('no longer available') || msg.includes('not found') || msg.includes('invalid model');
}

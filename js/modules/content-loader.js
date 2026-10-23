/**
 * Fetch /content.json, validate, filter draft items on production hosts.
 */

let cached = null;

export function isDevHost() {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (h.endsWith('.local')) return true;
    return false;
}

function validateContent(data) {
    if (!data?.site?.name || !Array.isArray(data.floors) || data.floors.length === 0) {
        throw new Error('Invalid content.json shape');
    }
    data.floors.forEach((floor, i) => {
        if (!floor.id || !floor.route || !floor.title) {
            throw new Error(`Floor ${i} missing id/route/title`);
        }
    });
    return data;
}

function filterFloors(data) {
    const dev = isDevHost();
    const floors = data.floors.map((floor) => {
        if (!Array.isArray(floor.items)) return { ...floor };
        const items = floor.items.filter((item) => item.approved !== false || dev);
        return { ...floor, items };
    });
    return { ...data, floors };
}

export async function loadContent() {
    if (cached) return cached;
    const res = await fetch('/content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`content.json ${res.status}`);
    const json = validateContent(await res.json());
    cached = filterFloors(json);
    return cached;
}

export function getFloors() {
    if (!cached) throw new Error('Content not loaded');
    return cached.floors;
}

export function getSite() {
    if (!cached) throw new Error('Content not loaded');
    return cached.site;
}

export function getItems(floorId) {
    const floor = getFloors().find((f) => f.id === floorId);
    return floor?.items ?? [];
}

export function getFloorByRoute(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (path === '/contact') {
        return getFloors().find((f) => f.id === 'about');
    }
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 1) {
        const base = `/${parts[0]}`;
        const byBase = getFloors().find((f) => f.route === base);
        if (byBase) return byBase;
    }
    return getFloors().find((f) => f.route === path);
}

export function getFloorIndex(floor) {
    return getFloors().findIndex((f) => f.id === floor.id);
}

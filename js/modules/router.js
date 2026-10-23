/**
 * History API routing — deep links, title/meta updates, canvas slugs.
 */

import { getFloorByRoute, getFloorIndex, getFloors, getSite } from './content-loader.js';

function parsePath(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'canvas') {
        const floor = getFloorByRoute('/canvas');
        if (floor) {
            return {
                floor,
                index: getFloorIndex(floor),
                openOnLoad: true,
                canvasSlug: parts[1],
                scrollContact: false
            };
        }
    }
    const floor = getFloorByRoute(path);
    if (!floor) return null;
    return {
        floor,
        index: getFloorIndex(floor),
        openOnLoad: path !== '/',
        canvasSlug: null,
        scrollContact: path === '/contact'
    };
}

export class AppRouter {
    constructor({ onRoute }) {
        this.onRoute = onRoute;
        window.addEventListener('popstate', () => this.syncFromLocation(false));
    }

    start() {
        this.syncFromLocation(true);
    }

    navigate(path, replace = false) {
        const url = path.startsWith('/') ? path : `/${path}`;
        if (replace) history.replaceState({}, '', url);
        else history.pushState({}, '', url);
        this.syncFromLocation(false);
    }

    syncFromLocation(isInitial) {
        const parsed = parsePath(location.pathname);
        if (!parsed) {
            if (location.pathname.replace(/\/+$/, '') !== '') {
                history.replaceState({}, '', '/');
            }
            const fallback = parsePath('/');
            if (!fallback) return;
            this.onRoute({ ...fallback, path: '/', isInitial });
            return;
        }

        const { floor, index, openOnLoad, canvasSlug, scrollContact } = parsed;
        const site = getSite();
        document.title = `${floor.title} · ${site.name}`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) {
            meta.content = `${site.headline} — ${floor.title}`;
        }

        this.onRoute({
            floor,
            index,
            path: location.pathname,
            openOnLoad: isInitial && openOnLoad,
            scrollContact,
            canvasSlug,
            isInitial
        });
    }

    routeForIndex(index) {
        return getFloors()[index]?.route ?? '/';
    }
}

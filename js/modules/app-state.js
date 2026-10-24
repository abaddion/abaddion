/** Test-only introspection — does not change runtime behavior. */

export function patchAppState(update) {
    window.__APP_STATE = { ...(window.__APP_STATE || {}), ...update };
}

/**
 * Hash router: maps routes to async render functions. Routes are registered
 * by pages/*.js. Direct paths (/jekijink223, /dashboard...) are normalized
 * into the router on boot so the SPA fallback rules work.
 */

const routes = new Map();
let notFoundHandler = null;
let beforeNavigate = null;   // async guard (auth gate) returning bool
let currentPath = null;
let renderSerial = 0;
const listeners = new Set();

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function registerNotFound(handler) {
  notFoundHandler = handler;
}

/** Auth-gate hook. Return { ok: true } or { ok: false, redirect } */
export function setBeforeNavigate(fn) {
  beforeNavigate = fn;
}

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange(path) {
  for (const fn of listeners) { try { fn(path); } catch (err) { console.error(err); } }
}

/** Normalize the current window URL into a slash path. */
export function resolvePath() {
  const hash = window.location.hash;
  // history.replaceState/pushState can update the URL without firing
  // hashchange. Prefer the actual hash, then the router state fallback.
  let path = hash && hash.startsWith('#')
    ? hash.slice(1)
    : (window.history.state && window.history.state.route) || window.location.pathname;
  // Clean
  if (!path || path === '/') path = '/';
  const qIdx = path.indexOf('?');
  if (qIdx >= 0) path = path.slice(0, qIdx);
  // Map known pathname-only routes (for direct Netlify navigation)
  const special = ['/jekijink223', '/dashboard', '/leaderboard', '/history', '/profile', '/settings'];
  if (special.includes(path)) return path;
  // The admin route also lives at #/admin for the admin-only landing.
  if (path === '/admin') return '/admin';
  return path;
}

/**
 * Default navigation target helper: hash routes for SPA pages, except
 * the admin route which uses a real path so /jekijink223 is shareable.
 */
export function routeHref(path) {
  if (path === '/jekijink223') return path;
  return `#${path}`;
}

/** Navigate programmatically. */
export function navigate(path) {
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '')}`;
  const target = routeHref(normalized);

  // Hash routes stay inside the SPA. Update the URL and render immediately;
  // relying only on hashchange made some mobile WebViews visibly lag until a
  // refresh. hashchange is still listened to by app.js for browser/back links.
  if (target.startsWith('#')) {
    const nextHash = target.slice(1) || '/';
    const nextUrl = `${window.location.pathname}${window.location.search}#${nextHash}`;

    // Do not assign window.location.hash here. That fires hashchange while
    // render() is already running and can mount the arena twice, disposing
    // the first async generation before its questions reach the screen.
    // replaceState updates the URL immediately without triggering a second
    // render, so the selected quiz can render its questions directly. It also
    // keeps SPA navigation from building a Back-stack between quiz steps.
    const absoluteNext = `${window.location.origin}${nextUrl}`;
    if (window.location.href !== absoluteNext) {
      window.history.replaceState({ ...(window.history.state || {}), route: nextHash }, '', nextUrl);
    } else {
      // Keep the router state explicit even when the URL is already correct.
      window.history.replaceState({ ...(window.history.state || {}), route: nextHash }, '', nextUrl);
    }

    // Render the requested route immediately. Do not wait for hashchange:
    // mobile WebViews can delay/suppress that event, which caused the old
    // "press Back before the question appears" bug.
    currentPath = nextHash || '/';
    return render();
  }

  // Standalone admin routes intentionally remain real paths.
  if (window.location.pathname === target) return render();
  window.location.assign(target);
}

/** Render the current route. Guards run first (auth gate). The active page
 *  is tracked so pages can clean up (unsubscribe realtime). */
export async function render() {
  const serial = ++renderSerial;
  const view = document.getElementById('view');
  if (!view) return;
  const path = resolvePath();

  if (beforeNavigate) {
    const decision = await beforeNavigate(path);
    if (decision && decision.ok === false) {
      const redir = decision.redirect || '/login';
      if (path !== redir) {
        window.location.hash = redir;
      }
      return;
    }
  }

  // An async auth guard may have yielded while the user navigated again.
  if (serial !== renderSerial) return;

  const handler = routes.get(path) || notFoundHandler || (() => {
    view.innerHTML = '<div class="view-empty"><p>Halaman tidak ditemukan.</p></div>';
  });
  currentPath = path;
  emitChange(path);

  // Let the previous page clean up.
  if (view._cleanup && typeof view._cleanup === 'function') {
    try { view._cleanup(); } catch (err) { console.warn('[cleanup]', err); }
  }

  view.innerHTML = '';
  const result = handler(view);
  if (result && typeof result === 'object' && typeof result.cleanup === 'function') {
    view._cleanup = result.cleanup;
  } else {
    view._cleanup = null;
  }
}

export function getCurrentPath() {
  return currentPath || resolvePath();
}

export default { registerRoute, registerNotFound, setBeforeNavigate, onRouteChange, resolvePath, navigate, render, routeHref, getCurrentPath };

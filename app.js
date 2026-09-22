/**
 * QuestionRy Multi Quest — application entry.
 *
 * Boots Supabase, wires the auth state machine, initializes the router,
 * registers pages, attaches the auth gate, initializes the icon sprite and
 * realtime server status, and handles the standalone admin route
 * (/jekijink223) so it opens correctly on direct navigation.
 */

import { CONFIG } from './config.js';
import * as utils from './utils.js';
import * as icons from './components/icons.js';
import * as status from './components/status.js';

import { isSupabaseAvailable, tryGetClient, invalidateClient } from './supabase/client.js';
import { onAuthStateChange, getSession, getUser, getCurrentUserProfile, signOutAndCleanup } from './supabase/auth.js';
import { readServerStatus, getSystemSettings, syncDevicePresence } from './supabase/database.js';
import { subscribeServerStatus, unsubscribeAll } from './supabase/realtime.js';

import * as router from './router.js';
import { default as navigation } from './navigation.js';

/* ---- page modules ---- */
import * as landingPage from './pages/landing.js';
import * as authPage from './pages/auth.js';
import * as subjectSelect from './pages/subject-select.js';
import * as levelSelect from './pages/level-select.js';
import * as countSelect from './pages/question-count-select.js';
import * as quizPage from './pages/quiz-page.js';
import * as resultPage from './pages/result-page.js';
import * as dashboardPage from './pages/dashboard.js';
import * as leaderboardPage from './pages/leaderboard.js';
import * as profilePage from './pages/profile.js';
import * as settingsPage from './pages/settings.js';
import * as adminPage from './pages/admin.js';
import * as userManagementPage from './pages/user-management.js';
import * as devPortfolioPage from './pages/dev-portfolio.js';
import * as restApiPage from './pages/rest-api.js';

/* ------------------------------------------------------------------ */
/* Global app state                                                    */
/* ------------------------------------------------------------------ */
export const app = {
  mode: 'loading',        // loading | online | offline
  user: null,             // Supabase user
  profile: null,          // profiles row (+email merge)
  offline: false,
  maintenance: null,
  ready: false,
};

const stateListeners = new Set();

/** Register to be notified on any app state change. */
export function onAppState(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function getAuthState() {
  return { user: app.user, profile: app.profile, offline: app.offline, mode: app.mode, ready: app.ready };
}

/** Enter offline guest mode (used when Supabase/sandbox auth is unavailable). */
export function beginOfflineGuest() {
  setState({ offline: true, mode: 'offline', user: null, profile: null, ready: true });
}

function setState(patch) {
  Object.assign(app, patch);
  for (const fn of stateListeners) { try { fn(getAuthState()); } catch (err) { console.error(err); } }
}

/* ------------------------------------------------------------------ */
/* Route guard (shared with router)                                    */
/* ------------------------------------------------------------------ */
const PUBLIC_ROUTES = new Set(['/', '/login', '/jekijink223', '/admin']);
const PROTECTED = (path) => !PUBLIC_ROUTES.has(path);

async function authGate(path) {
  if (path === '/jekijink223' || path === '/admin') return { ok: true }; // admin.js enforces its own gate
  if (PROTECTED(path)) {
    // Wait for the initial session resolution before deciding.
    if (!app.ready) {
      await waitForReady(4000);
    }
    const signedIn = Boolean(app.user) || app.offline;
    if (!signedIn) return { ok: false, redirect: '/login' };
  }
  return { ok: true };
}

function waitForReady(timeoutMs) {
  return new Promise((resolve) => {
    if (app.ready) return resolve();
    const t = setTimeout(() => resolve(), timeoutMs);
    const off = onAppState((s) => { if (s.ready) { clearTimeout(t); off(); resolve(); } });
  });
}

/* ------------------------------------------------------------------ */
/* Auth flow                                                           */
/* ------------------------------------------------------------------ */
async function resolveUserState() {
  if (!isSupabaseAvailable()) {
    setState({ offline: true, mode: 'offline', user: null, profile: null, ready: true });
    return;
  }
  try {
    const user = await getUser();
    if (user) {
      const profile = await getCurrentUserProfile();
      setState({ user, profile, offline: false, mode: 'online', ready: true });
      // Presence is best-effort and never blocks the app from opening.
      syncDevicePresence(user.id, profile?.device_info).then((saved) => {
        if (saved?.device_info) {
          setState({ profile: { ...(app.profile || profile || {}), device_info: saved.device_info } });
        }
      }).catch(() => {});
    } else {
      setState({ user: null, profile: null, offline: false, mode: 'online', ready: true });
    }
  } catch (err) {
    setState({ user: null, profile: null, offline: true, mode: 'offline', ready: true });
  }
}

function handleSignedIn() {
  resolveUserState().then(() => {
    navigation.refreshNavigation(getAuthState);
    // Re-render current view so protected pages unlock.
    router.render();
    flushOfflineLogs();
  });
}

function handleSignedOut() {
  setState({ user: null, profile: null, offline: app.offline, ready: true });
  navigation.refreshNavigation(getAuthState);
  router.render();
}

/* ------------------------------------------------------------------ */
/* Server status (initial + realtime)                                  */
/* ------------------------------------------------------------------ */
async function initServerStatus() {
  if (!isSupabaseAvailable()) { status.setServerStatus('online'); return; }
  try {
    const s = await readServerStatus();
    status.setServerStatus(s);
  } catch (err) { status.setServerStatus('online'); }
  // Realtime subscription lives for the app lifetime (cheap, no polling)
  subscribeServerStatus((s) => status.setServerStatus(s));
}

/* ------------------------------------------------------------------ */
/* System settings → provider keys                                     */
/* ------------------------------------------------------------------ */
async function initSystemSettings() {
  if (!isSupabaseAvailable()) return;
  try {
    const settings = await getSystemSettings();
    applyGlobalMaintenance(settings);
    showServerNotification(settings);
    const keysRaw = settings[CONFIG.supabase.settingsKeys.aiKeys];
    const endpointRaw = settings[CONFIG.supabase.settingsKeys.aiApiEndpoint];
    if (endpointRaw && typeof endpointRaw === 'string' && endpointRaw.trim()) {
      applyEndpointOverride(endpointRaw.trim());
    }
    if (keysRaw) {
      let keys = [];
      try { keys = JSON.parse(keysRaw); } catch (err) {
        keys = String(keysRaw).split(',').map((k) => k.trim()).filter(Boolean);
      }
    }
  } catch (err) { /* non-fatal */ }
}

function applyEndpointOverride(endpoint) {
  // Expose to providers without mutating frozen CONFIG.
  import('./ai/providers.js').then((p) => {
    if (typeof p.setEndpointOverride === 'function') p.setEndpointOverride(endpoint);
  });
}

/* ------------------------------------------------------------------ */
/* Global maintenance + server notification                            */
/* ------------------------------------------------------------------ */
function applyGlobalMaintenance(settings) {
  const raw = settings?.maintenance;
  let cfg = null;
  try { cfg = raw ? JSON.parse(raw) : null; } catch (_) { cfg = null; }
  if (!cfg || !cfg.enabled || window.location.pathname === '/jekijink223') {
    app.maintenance = null;
    document.getElementById('questionry-maintenance')?.remove();
    return;
  }
  if (cfg.endAt && Date.now() >= new Date(cfg.endAt).getTime()) {
    app.maintenance = null;
    document.getElementById('questionry-maintenance')?.remove();
    return;
  }
  app.maintenance = cfg;
  let overlay = document.getElementById('questionry-maintenance');
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id='questionry-maintenance'; overlay.className='questionry-maintenance';
    overlay.innerHTML='<div class="questionry-maintenance__box"><strong>SERVER MAINTENANCE</strong><p data-maintenance-text></p><span data-maintenance-countdown></span></div>';
    document.body.appendChild(overlay);
  }
  overlay.querySelector('[data-maintenance-text]').textContent = cfg.text || 'Server sedang maintenance.';
  const countdown=overlay.querySelector('[data-maintenance-countdown]');
  const tick=()=>{ if(!cfg.endAt){countdown.textContent='Durasi tidak ditentukan';return;} const ms=new Date(cfg.endAt).getTime()-Date.now(); if(ms<=0){overlay.remove();window.location.reload();return;} const sec=Math.ceil(ms/1000); const m=Math.floor(sec/60), s=sec%60; countdown.textContent=`Selesai dalam ${m}m ${String(s).padStart(2,'0')}s`; };
  tick(); clearInterval(overlay._timer); overlay._timer=setInterval(tick,1000);
}

function showServerNotification(settings) {
  const raw=settings?.server_notification; let cfg; try{cfg=raw?JSON.parse(raw):null;}catch(_){cfg=null;}
  if(!cfg?.enabled || !cfg.text) return;
  const n=document.createElement('div'); n.className=`questionry-notification questionry-notification--${cfg.position||'top'} questionry-notification--${cfg.style||'smooth'}`; n.textContent=cfg.text; document.body.appendChild(n);
  requestAnimationFrame(()=>n.classList.add('is-visible')); setTimeout(()=>{n.classList.remove('is-visible');setTimeout(()=>n.remove(),350);},Math.max(500,Number(cfg.duration)||3000));
}

/* ------------------------------------------------------------------ */
/* Offline quiz-log queue flush                                        */
/* ------------------------------------------------------------------ */
async function flushOfflineLogs() {
  if (!app.user) return;
  const results = await import('./quiz/results.js');
  const pending = results.peekOfflineLogs();
  if (!pending.length) return;
  const db = await import('./supabase/database.js');
  for (const record of pending.slice(0, 20)) {
    try { await db.insertQuizLog(record); } catch (err) { /* keep queued */ }
  }
  results.clearOfflineLogs();
}

/* ------------------------------------------------------------------ */
/* Register pages + boot                                               */
/* ------------------------------------------------------------------ */
function registerPages() {
  router.registerRoute('/', landingPage.renderLanding);
  router.registerRoute('/login', authPage.renderAuth);
  router.registerRoute('/quiz', subjectSelect.renderSubjectSelect);
  router.registerRoute('/level', levelSelect.renderLevelSelect);
  router.registerRoute('/count', countSelect.renderCountSelect);
  router.registerRoute('/arena', quizPage.renderQuizPage);
  router.registerRoute('/result', resultPage.renderResultPage);
  router.registerRoute('/dashboard', dashboardPage.renderDashboard);
  router.registerRoute('/leaderboard', leaderboardPage.renderLeaderboard);
  router.registerRoute('/history', dashboardPage.renderHistory);
  router.registerRoute('/profile', profilePage.renderProfile);
  router.registerRoute('/settings', settingsPage.renderSettings);
  router.registerRoute('/admin', adminPage.renderAdmin);
  router.registerRoute('/jekijink223', adminPage.renderAdmin);
  router.registerRoute('/rest-api', restApiPage.renderRestApi);
  router.registerRoute('/dev', devPortfolioPage.renderDevPortfolio);
  router.registerNotFound((view) => {
    view.innerHTML = '<div class="view-empty"><h2>404</h2><p>Halaman tidak ditemukan.</p><a class="btn btn--primary" href="#/">Kembali ke Beranda</a></div>';
  });
  router.setBeforeNavigate(authGate);
}

function renderChrome() {
  const components = Promise.all([
    import('./components/header.js'),
    import('./components/navigation.js'),
  ]).then(([header, nav]) => {
    header.renderHeader(getAuthState);
    nav.renderBottomNav(getAuthState);
    renderFooter();
  });
}

function renderFooter() {
  const footer = document.getElementById('app-footer');
  if (!footer) return;
  footer.innerHTML = '<div class="footer-inner"><span class="font-brand">QUESTIONRY</span><span>Multi Quest — Tantangan Kuis Dinamis &amp; Realtime</span></div>';
}

const isAdminPath = () => ['/jekijink223'].includes(window.location.pathname);

async function boot() {
  // Icon sprite (needed for every view)
  try { await icons.initIcons(); } catch (err) { /* icons degrade to text */ }

  renderChrome();

  if (isAdminPath()) {
    // Standalone admin: no normal chrome — admin.js renders its own shell.
    const headerEl = document.getElementById('app-header');
    const navEl = document.getElementById('app-nav');
    const footerEl = document.getElementById('app-footer');
    if (headerEl) headerEl.style.display = 'none';
    if (navEl) navEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'none';
    const view = document.getElementById('view');
    await resolveUserState(); // needed before the admin gate evaluates
        else adminPage.renderAdmin(view);
    return;
  }

  registerPages();

  // auth listener BEFORE initial resolution
  onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') handleSignedIn();
    else if (event === 'SIGNED_OUT') handleSignedOut();
    else if (event === 'USER_UPDATED') handleSignedIn();
  });

  await resolveUserState();
  await initServerStatus();
  await initSystemSettings();
  navigation.refreshNavigation(getAuthState);
  navigation.initNavigation(getAuthState);

  // Hash changes and browser history changes both re-render the SPA.
  // navigate() already renders immediately, so these listeners only handle
  // external URL changes / browser navigation and never require Back first.
  const rerenderFromNavigation = () => { router.render(); };
  window.addEventListener('hashchange', rerenderFromNavigation);
  window.addEventListener('popstate', rerenderFromNavigation);

  await router.render();
  flushOfflineLogs();
}

/* Run */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export default app;

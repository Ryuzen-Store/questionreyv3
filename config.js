/**
 * QuestionRy Multi Quest — central configuration.
 *
 * IMPORTANT SECURITY NOTES (see README.md):
 *  - Supabase credentials below are PUBLISHABLE (anon) keys. They are designed
 *    to be shipped to the browser and are protected by Row Level Security.
 *  - The AI provider URL + key pool are shipped to the browser because the
 *    project spec explicitly uses client-side REST endpoints. Anything placed
 *    here is PUBLIC and visible to any visitor. For production, move AI keys
 *    behind a Netlify Function / Edge Function. See README "Security Warnings".
 */

export const CONFIG = Object.freeze({
  app: {
    name: 'QuestionRy',
    title: 'QuestionRy Multi Quest',
    tagline: 'Tantangan Kuis Dinamis & Realtime',
    version: '1.0.0',
    locale: 'id-ID',
    // Keep this in sync with Supabase Auth > URL Configuration.
    siteUrl: '',
    localDevUrl: 'http://localhost:8080',
  },

  supabase: {
    url: 'https://hdcrjriftlgezcvyxcgc.supabase.co',
    anonKey: 'sb_publishable_yErI-BHFSpPu6DEIYbNNzw_2mCu4zsW',
    // Build preference + mirrors used by the loader in index.html
    useEsmBuild: true,
    jsdelivrEsmUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
    unpkgUrl: 'https://unpkg.com/@supabase/supabase-js@2',
    // Schema names used throughout the app (single source of truth).
    tables: {
      profiles: 'profiles',
      questions: 'questions',
      quizLogs: 'quiz_logs',
      systemSettings: 'system_settings',
    },
    settingsKeys: {
      serverStatus: 'server_status',
      aiApiEndpoint: 'ai_api_endpoint',
      aiKeys: 'ai_keys',
    },
  },

  auth: {
    // Supabase email/password sign-up: only enabled when RLS policies allow
    // inserting into `profiles` for the new user.
    allowEmailPassword: true,
    allowGoogle: true,
    allowGuest: true,
    guestMode: true,
    // Role name for the owner/admin (must match `profiles.role = 'owner'`).
    ownerRole: 'owner',
    // Google account allowed to access the admin panel.
    ownerEmail: 'ryuxzenn@gmail.com',
    playerRole: 'player',
    einsteinRole: 'einstein',
    // Pending guest login (before entering), shared with landing.js
    emailProviderId: 'google',
  },

  quiz: {
    subjects: ['Matematika', 'IPA', 'IPS', 'Sejarah', 'Informatika'],
    difficulties: [
      { id: 'easy', label: 'Easy', short: 'EASY' },
      { id: 'normal', label: 'Normal', short: 'NORMAL' },
      { id: 'hard', label: 'Hard', short: 'HARD' },
      { id: 'impossible', label: 'Impossible', short: 'IMPOSSIBLE' },
    ],
    counts: [10, 15, 20, 30, 40, 45],
    // Difficulty > 20 questions: keep this % of questions as fundamentals.
    fundamentalsRatio: 0.3,
    // Scoring: correct answers are worth `scorePerCorrect` points.
    scorePerCorrect: 10,
    minOptionsPerQuestion: 6,
    maxOptionsPerQuestion: 6,
  },

  ai: {
    overrideEndpoint: '',
    timeoutMs: 30000,
    requestTimeoutMs: 15000,
    globalTimeoutMs: 30000,
    allowSplitRetry: true,
    maxQuestionsPerRequest: 45,
    minQuestionsPerRequest: 10,
    providers: [
      { id: 'deepai-faa', label: 'Deep AI', url: '/api/ai/deep-ai', params: { promptParam: 'text' } },
      { id: 'blackbox-faa', label: 'Blackbox', url: '/api/ai/blackbox', params: { promptParam: 'query' } },
      { id: 'claude-faa', label: 'Claude AI', url: '/api/ai/claude-ai', params: { promptParam: 'text' } },
    ],
    keys: [],
  },

  cache: {
    storageKeyPrefix: 'qrquest:cache:v4:',
    ttlMs: 1000 * 60 * 60 * 24 * 2, // 48 hours
    maxEntries: 40,
  },

  realtime: {
    enabled: true,
    channelNS: 'qrquest-realtime',
  },

  router: {
    defaultRoute: '/',
    authRoute: '/login',
  },

  meta: {
    // Keep OG image publicly reachable. This file ships as a local backup in
    // ./assets/images/og-image.png for crawlers that cannot reach the CDN.
    ogImage: 'https://cdn.nekohime.site/file/wv9vhp3k.png',
  },
});

/** Effective AI base URL: `ai_keys` / `ai_api_endpoint` system settings may override. */
export const AI = {
  overrideEndpoint: CONFIG.ai.overrideEndpoint,
};

/**
 * Landing page. Hero + primary actions (START QUIZ / DASHBOARD / LEADERBOARD /
 * PROFILE) with contextual SVG icons. No emojis.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { getAuthState } from '../app.js';
import { isOwner } from '../supabase/database.js';

export function renderLanding(view) {
  const container = document.createElement('div');
  container.className = 'page landing container';

  /* Hero */
  const hero = document.createElement('section');
  hero.className = 'hero';
  const kicker = document.createElement('p');
  kicker.className = 'hero__kicker';
  kicker.textContent = 'WELCOME TO';
  const h1 = document.createElement('h1');
  h1.className = 'hero__title font-brand';
  h1.textContent = 'WEBSITE QUESTIONRY';
  const sub = document.createElement('p');
  sub.className = 'hero__sub';
  sub.textContent = 'Multi Quest — tantangan kuis dinamis lintas mapel, realtime, dengan pembahasan soal yang mencerahkan.';
  hero.appendChild(kicker);
  hero.appendChild(h1);
  hero.appendChild(sub);
  container.appendChild(hero);

  /* Primary actions — only Quiz and Dashboard */
  const actions = document.createElement('div');
  actions.className = 'landing-actions landing-actions--center';

  const items = [
    { route: '#/quiz', icon: 'i-play', title: 'QUIZ', desc: 'Mulai tantangan kuis baru', variant: 'primary' },
    { route: '#/dashboard', icon: 'i-dashboard', title: 'DASHBOARD', desc: 'Statistik & profil akun', variant: 'secondary' },
  ];

  for (const it of items) {
    const a = document.createElement('a');
    a.className = `landing-action landing-action--${it.variant}`;
    a.href = it.route;
    const head = document.createElement('span');
    head.className = 'landing-action__icon';
    head.appendChild(icon(it.icon, 'ic ic-lg'));
    const body = document.createElement('span');
    body.className = 'landing-action__body';
    const t = document.createElement('strong');
    t.textContent = it.title;
    const d = document.createElement('span');
    d.textContent = it.desc;
    body.appendChild(t);
    body.appendChild(d);
    a.appendChild(head);
    a.appendChild(body);
    actions.appendChild(a);
  }
  container.appendChild(actions);

  /* Session strip */
  const strip = document.createElement('section');
  strip.className = 'landing-session';
  const auth = getAuthState();
  if (auth.profile) {
    const tag = document.createElement('p');
    tag.className = 'landing-session__tag';
    tag.appendChild(icon('i-user', 'ic'));
    const s = document.createElement('span');
    s.textContent = `Masuk sebagai ${auth.profile.player_tag || 'Pemain'} (skor ${auth.profile.score || 0})`;
    tag.appendChild(s);
    strip.appendChild(tag);
    if (isOwner(auth.profile)) {
      const adminLink = document.createElement('a');
      adminLink.className = 'btn btn--secondary btn--sm';
      adminLink.href = '/jekijink223';
      adminLink.appendChild(icon('i-admin', 'ic'));
      const lbl = document.createElement('span');
      lbl.textContent = 'ADMIN';
      adminLink.appendChild(lbl);
      strip.appendChild(adminLink);
    }
  } else if (auth.offline) {
    const p = document.createElement('p');
    p.appendChild(icon('i-server', 'ic'));
    const s = document.createElement('span');
    s.textContent = 'Mode offline (tamu) — data tersimpan di perangkat ini.';
    p.appendChild(s);
    strip.appendChild(p);
  } else {
    const a = document.createElement('a');
    a.className = 'btn btn--primary btn--sm';
    a.href = '#/login';
    const lbl = document.createElement('span');
    lbl.textContent = 'MASUK';
    a.appendChild(lbl);
    strip.appendChild(a);
  }
  container.appendChild(strip);

  /* Developer portfolio — intentionally below the main actions so it
   * appears only when the user scrolls down. */
  const devLink = document.createElement('a');
  devLink.className = 'landing-dev-card';
  devLink.href = '#/dev';

  const devHead = document.createElement('div');
  devHead.className = 'landing-dev-card__head';
  const devKicker = document.createElement('span');
  devKicker.className = 'landing-dev-card__kicker';
  devKicker.textContent = 'DEVELOPER PORTFOLIO';
  const devTitle = document.createElement('strong');
  devTitle.textContent = 'Ry Dev';
  devHead.appendChild(devKicker);
  devHead.appendChild(devTitle);

  const devDesc = document.createElement('p');
  devDesc.textContent = 'UI, Frontend, Backend, DevOps — Python, JS, Java';
  const devArrow = document.createElement('span');
  devArrow.className = 'landing-dev-card__arrow';
  devArrow.textContent = '→';
  devLink.appendChild(devHead);
  devLink.appendChild(devDesc);
  devLink.appendChild(devArrow);
  container.appendChild(devLink);

  view.appendChild(container);

  return { cleanup: () => {} };
}

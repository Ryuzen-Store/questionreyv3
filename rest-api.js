import { CONFIG } from '../config.js';
import { esc } from '../utils.js';
import { toast } from '../components/toast.js';

const PROVIDER_EXAMPLES = [
  { id: 'deepai-faa', label: 'Deep AI', method: 'GET', url: 'https://api-faa.my.id/faa/deep-ai', param: 'text', type: '' },
  { id: 'blackbox-faa', label: 'Blackbox', method: 'GET', url: 'https://api-faa.my.id/faa/blackbox', param: 'query', type: '' },
  { id: 'claude-faa', label: 'Claude AI', method: 'GET', url: 'https://api-faa.my.id/faa/claude-ai', param: 'text', type: '' },
];

export function renderRestApi(view) {
  const page = document.createElement('div');
  page.className = 'page container wide rest-api-page';
  page.innerHTML = `
    <div class="rest-api-head">
      <div><span class="rest-api-kicker">QUESTIONRY / REST API</span><h1 class="font-brand">REST API</h1><p>Endpoint AI yang dipakai Generate Quiz. Semua provider dikirim paralel dan provider lambat/error tidak menghentikan provider lain.</p></div>
      <a href="#/dev" class="btn btn--secondary btn--sm">PORTO DEV</a>
    </div>
    <section class="rest-api-card rest-api-card--hero">
      <div><span class="rest-api-label">AUTH</span><strong>TANPA API KEY</strong></div>
      <div><span class="rest-api-label">PROVIDER</span><strong>${PROVIDER_EXAMPLES.length}</strong></div>
      <div><span class="rest-api-label">METHOD</span><strong>GET</strong></div>
      <div><span class="rest-api-label">FORMAT</span><strong>JSON</strong></div>
    </section>
    <div class="rest-api-list"></div>
  `;
  const list = page.querySelector('.rest-api-list');
  for (const p of PROVIDER_EXAMPLES) list.appendChild(buildEndpointCard(p));
  view.appendChild(page);
  return { cleanup: () => {} };
}

function buildEndpointCard(provider) {
  const card = document.createElement('article');
  card.className = 'rest-api-card rest-endpoint';
  const sampleQuery = provider.param === 'query' ? 'Kapan Indonesia Merdeka?' : 'Buat 10 soal matematika kelas 9.';
  const params = `${provider.param}=${encodeURIComponent(sampleQuery)}${provider.type ? `&type=${provider.type}` : ''}`;
  const url = `${provider.url}?${params}`;
  card.innerHTML = `
    <div class="rest-endpoint__top"><div><span class="rest-api-method">GET</span><strong>${esc(provider.label)}</strong><small>${esc(provider.url)}</small></div><span class="rest-api-status">ACTIVE</span></div>
    <div class="rest-code"><code>${esc(`curl -X GET "${url}" -H "accept: application/json"`)}</code><button type="button" data-copy>Copy</button></div>
    <div class="rest-endpoint__actions"><button type="button" class="btn btn--secondary btn--sm" data-test>TEST API</button><span data-result>Belum dites</span></div>
  `;
  card.querySelector('[data-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`curl -X GET "${url}" -H "accept: application/json"`); toast({type:'success',title:'REST API',message:'Contoh request disalin.'}); }
    catch { toast({type:'error',title:'Gagal',message:'Clipboard tidak tersedia.'}); }
  });
  card.querySelector('[data-test]').addEventListener('click', async () => {
    const out = card.querySelector('[data-result]');
    out.textContent = 'Testing...';
    try {
      const started = Date.now();
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      const text = await res.text();
      out.textContent = `${res.ok ? 'OK' : 'ERROR'} · HTTP ${res.status} · ${Date.now()-started}ms`;
      if (!res.ok) toast({type:'error',title:provider.label,message:`HTTP ${res.status}`});
    } catch (err) {
      out.textContent = 'NETWORK ERROR';
      toast({type:'error',title:provider.label,message:'Request gagal atau CORS diblokir.'});
    }
  });
  return card;
}

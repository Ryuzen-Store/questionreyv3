/**
 * QuestionRy owner admin — single-page control center.
 * Every section is rendered inside the same page; tabs only swap the active
 * panel, so no admin sub-route/reload is needed.
 */
import { CONFIG } from '../config.js';
import { createButton } from '../components/button.js';
import { toast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { getClient } from '../supabase/client.js';
import { signOutAndCleanup } from '../supabase/auth.js';
import {
  adminFetchProfiles, adminFetchQuizLogs, adminUpdateUserRole,
  adminGetSystemSettings, adminSetSystemSetting,
} from '../supabase/database.js';
import { subscribeToTable, unsubscribeScope } from '../supabase/realtime.js';
import { esc, fmtDateTime, fmtNumber } from '../utils.js';

const SCOPE = 'admin-single-page';
const ADMIN_EMAIL = 'ryuxzenn@gmail.com';
const ADMIN_PASSWORD_SHA256 = 'f28ac9ada09e99211b6748e561bba386d2bdbef9b27c321ab5135ef9f0e250d5';
const ADMIN_SESSION_KEY = 'questionry.admin.verified';
const DEFAULT_DEV = {
  name: 'Ry dev', languages: 'Python, JavaScript, Java', fields: 'UI, Frontend, Backend, DevOps',
  location: 'Bogor, Jawa Barat, Indonesia', bio: 'Developer QuestionRy',
};
const ROLE_LABEL = { player: 'USER BIASA', einstein: 'ALBERT EINSTEIN', owner: 'MAHA RAJA' };
const TAB_LABELS = [
  ['quiz','Total Quiz'], ['users','Management User'], ['dev','Dev Profile'],
  ['notify','Notifikasi'], ['settings','Setting API Key'],
];

const state = { users: [], logs: [], settings: {}, activeTab: 'quiz', serverOnline: true };

export function renderAdmin(view) {
  let disposed = false;
  view.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'page admin container admin--single';
  view.appendChild(root);
  boot();

  return { cleanup() { disposed = true; unsubscribeScope(SCOPE); } };

  async function boot() {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== '1') return renderLogin();
    renderShell();
    await refreshData();
    if (!disposed) subscribeRealtime();
  }

  function renderLogin() {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'card admin-login';
    wrap.innerHTML = '<div class="admin-login__brand"><span class="admin-login__logo">Q</span><h1 class="font-brand">ADMIN LOGIN</h1></div><p class="admin-login__sub">Masukkan Gmail dan password admin.</p>';
    const email = input('email', 'Gmail owner');
    const password = input('password', 'Password admin');
    const msg = document.createElement('p'); msg.className = 'admin-login__note';
    const submit = createButton({ type:'button', label:'MASUK', variant:'primary', size:'block' });
    wrap.append(email, password, msg, submit); root.appendChild(wrap);
    submit.addEventListener('click', async () => {
      const e = email.value.trim().toLowerCase();
      if (e !== ADMIN_EMAIL) { msg.textContent = 'Gmail tidak valid.'; return; }
      if (!password.value) { msg.textContent = 'Password wajib diisi.'; return; }
      submit.disabled = true;
      try {
        const data = new TextEncoder().encode(password.value);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const hash = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
        if (hash !== ADMIN_PASSWORD_SHA256) { msg.textContent = 'Password salah.'; return; }
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
        renderShell(); await refreshData(); subscribeRealtime();
      } catch (_) { msg.textContent = 'Gagal memverifikasi. Coba lagi.'; }
      finally { submit.disabled = false; }
    });
  }

  function renderShell() {
    root.innerHTML = '';
    const shell = document.createElement('div'); shell.className = 'admin-shell admin-shell--single';
    const header = document.createElement('header'); header.className = 'admin-header';
    header.innerHTML = '<div class="admin-header__titles"><span class="admin-eyebrow">QUESTIONRY / CONTROL CENTER</span><h1 class="font-brand">ADMIN PANEL</h1><p>Satu halaman. Pilih bagian untuk merender panel tanpa pindah URL.</p></div>';
    const actions = document.createElement('div'); actions.className = 'admin-header__actions';
    const live = document.createElement('span'); live.className='admin-live'; live.innerHTML='<span class="live-dot"></span><span>LIVE</span>';
    const logout = createButton({label:'LOGOUT', variant:'danger', size:'sm', onClick:()=>confirmDialog({title:'Keluar dari admin?',message:'Sesi admin akan diakhiri.',confirmLabel:'YA',danger:true,onConfirm:async()=>{try{await signOutAndCleanup();}catch(_){} sessionStorage.removeItem(ADMIN_SESSION_KEY); renderLogin();}})});
    actions.append(live, logout); header.appendChild(actions); shell.appendChild(header);

    const tabs = document.createElement('nav'); tabs.className='admin-tabs'; tabs.setAttribute('aria-label','Admin sections');
    for (const [id,label] of TAB_LABELS) {
      const b=document.createElement('button'); b.type='button'; b.className='admin-tab'; b.dataset.tab=id; b.textContent=label;
      b.addEventListener('click',()=>showTab(id)); tabs.appendChild(b);
    }
    shell.appendChild(tabs);
    const content=document.createElement('main'); content.className='admin-content admin-content--single'; content.id='admin-panel-content'; shell.appendChild(content);
    root.appendChild(shell);
    showTab(state.activeTab);
  }

  function showTab(id) {
    state.activeTab=id;
    root.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===id));
    const panel=root.querySelector('#admin-panel-content'); if(!panel)return;
    panel.innerHTML='';
    const builders={quiz:renderQuiz,users:renderUsers,dev:renderDev,notify:renderNotify,settings:renderApiKeys};
    panel.appendChild(builders[id] ? builders[id]() : document.createElement('div'));
  }

  function renderQuiz() {
    const section=panel('TOTAL QUIZ','Semua data quiz yang tercatat di database, bukan data satu user.');
    const totalRequests=state.logs.reduce((n,l)=>n+(Number(l.total_questions)||0),0);
    const correct=state.logs.reduce((n,l)=>n+(Number(l.correct_count)||0),0);
    const wrong=Math.max(0,totalRequests-correct);
    const grid=document.createElement('div'); grid.className='admin-stat-grid';
    [['TOTAL QUIZ',state.logs.length],['TOTAL SOAL / REQUEST',totalRequests],['BENAR',correct],['SALAH',wrong],['TOTAL USER',state.users.length]].forEach(([a,b])=>grid.appendChild(stat(a,b)));
    section.appendChild(grid);
    const note=document.createElement('div'); note.className='admin-flat-note'; note.textContent=`Terakhir diperbarui: ${new Date().toLocaleString('id-ID')}`; section.appendChild(note);
    return section;
  }

  function renderUsers() {
    const section=panel('MANAGEMENT USER','Nomor 1 sampai seterusnya dari seluruh user yang tersimpan.');
    const search=input('search','Cari Gmail'); search.className='admin-search'; section.appendChild(search);
    const wrap=document.createElement('div'); wrap.className='admin-user-table-wrap'; section.appendChild(wrap);
    const draw=()=>{
      const q=search.value.trim().toLowerCase(); const users=state.users.filter(u=>!q||String(u.email||'').toLowerCase().includes(q));
      wrap.innerHTML=''; const table=document.createElement('table'); table.className='admin-user-table';
      table.innerHTML='<thead><tr><th>No.</th><th>Role</th><th>Gmail</th><th>IP Address</th><th>Akun Dibuat</th></tr></thead>';
      const tbody=document.createElement('tbody');
      users.forEach((u,i)=>{const d=u.device_info&&typeof u.device_info==='object'?u.device_info:{}; const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td><span class="pill">${esc(ROLE_LABEL[u.role]||u.role||'USER BIASA')}</span></td><td>${esc(u.email||'—')}</td><td>${esc(d.ip||'—')}</td><td>${esc(fmtDateTime(u.created_at))}</td>`; tbody.appendChild(tr);});
      if(!users.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="5" class="admin-empty">Tidak ada user.</td>';tbody.appendChild(tr);} table.appendChild(tbody);wrap.appendChild(table);
    };
    search.addEventListener('input',draw); draw(); return section;
  }

  function renderDev() {
    const section=panel('DEV PROFILE','Profil default tetap ada. Semua field di bawah dapat diedit dan disimpan.');
    const current=parseJson(state.settings.dev_profile,DEFAULT_DEV); const grid=document.createElement('div'); grid.className='admin-form-grid admin-form-grid--wide';
    const fields=[['name','Nama'],['languages','Languages'],['fields','Fields / Skill'],['location','Location'],['bio','Bio']];
    const els={}; fields.forEach(([k,l])=>{const w=document.createElement('label');w.className='field';w.innerHTML=`<span class="field__label">${l}</span>`;const el=document.createElement(k==='bio'?'textarea':'input');el.className='field__input';el.value=current[k]??'';els[k]=el;w.appendChild(el);grid.appendChild(w);});
    section.appendChild(grid); const row=actionsRow(); const save=createButton({label:'SIMPAN DEV PROFILE',variant:'primary',size:'sm',onClick:async()=>{const value={};fields.forEach(([k])=>value[k]=els[k].value.trim());try{await saveSetting('dev_profile',value);toast({type:'success',title:'Dev Profile',message:'Profil tersimpan.'});}catch(e){toast({type:'error',title:'Gagal',message:e.message||'Tidak bisa menyimpan.'});}}});row.appendChild(save);section.appendChild(row);return section;
  }

  function renderNotify() {
    const section=panel('NOTIFIKASI','Atur notifikasi global dan maintenance server dari satu bagian.');

    const noticeTitle=document.createElement('div');
    noticeTitle.className='admin-subsection-title';
    noticeTitle.innerHTML='<strong>NOTIFIKASI</strong><small>Atur posisi, gaya, teks, dan durasi notifikasi global.</small>';
    section.appendChild(noticeTitle);

    const cfg=parseJson(state.settings.server_notification,{enabled:true,position:'top',style:'smooth',text:'IP berhasil diperbarui',duration:3000});
    const grid=document.createElement('div');grid.className='admin-form-grid';
    const position=select('Posisi',[['top','Atas'],['bottom','Bawah']],cfg.position);
    const style=select('Style',[['smooth','Smooth'],['slide','Slide'],['fade','Fade']],cfg.style);
    const duration=input('number','Durasi (ms)');duration.value=String(cfg.duration||3000);
    const text=input('text','Teks notifikasi');text.value=cfg.text||'';
    [position,style,duration,text].forEach(x=>grid.appendChild(x.wrap));
    section.appendChild(grid);
    const row=actionsRow();
    const save=createButton({label:'DONE / SIMPAN',variant:'primary',size:'sm',onClick:async()=>{try{await saveSetting('server_notification',{enabled:true,position:position.value,style:style.value,text:text.value.trim(),duration:Math.max(500,Math.min(15000,Number(duration.value)||3000))});toast({type:'success',title:'Notifikasi',message:'Pengaturan notifikasi tersimpan.'});}catch(e){toast({type:'error',title:'Gagal',message:e.message||'Tidak bisa menyimpan.'});}}});
    row.appendChild(save);section.appendChild(row);

    const divider=document.createElement('div');divider.className='admin-subsection-divider';section.appendChild(divider);
    const maintenanceTitle=document.createElement('div');
    maintenanceTitle.className='admin-subsection-title';
    maintenanceTitle.innerHTML='<strong>MAINTENANCE SERVER</strong><small>Jika aktif, fitur user diblokir secara global. Admin tetap dapat masuk untuk mematikannya.</small>';
    section.appendChild(maintenanceTitle);

    const maintenance=parseJson(state.settings.maintenance,{enabled:false,duration:0,endAt:null,text:'Server sedang maintenance.'});
    const status=document.createElement('div');status.className='admin-maintenance-status';
    status.innerHTML=`<strong>${maintenance.enabled?'MAINTENANCE ON':'SERVER ONLINE'}</strong><span>${maintenance.enabled&&maintenance.endAt?`Selesai: ${new Date(maintenance.endAt).toLocaleString('id-ID')}`:'Tidak ada maintenance aktif.'}</span>`;
    section.appendChild(status);
    const mgrid=document.createElement('div');mgrid.className='admin-form-grid';
    const mDuration=input('number','Durasi maintenance (menit)');mDuration.value=maintenance.duration?String(Math.ceil(maintenance.duration/60000)):'';
    const mText=input('text','Teks maintenance');mText.value=maintenance.text||'Server sedang maintenance.';
    mgrid.append(mDuration.wrap,mText.wrap);section.appendChild(mgrid);
    const mrow=actionsRow();
    const on=createButton({label:'MAINTENANCE ON',variant:'danger',size:'sm',onClick:async()=>{const mins=Math.max(0,Number(mDuration.value)||0);const endAt=mins>0?new Date(Date.now()+mins*60000).toISOString():null;await saveSetting('maintenance',{enabled:true,duration:mins*60000,endAt,text:mText.value.trim()||'Server sedang maintenance.'});toast({type:'success',title:'Server',message:'Maintenance diaktifkan.'});showTab('notify');}});
    const off=createButton({label:'MAINTENANCE OFF',variant:'secondary',size:'sm',onClick:async()=>{await saveSetting('maintenance',{enabled:false,duration:0,endAt:null,text:mText.value.trim()||'Server sedang maintenance.'});toast({type:'success',title:'Server',message:'Maintenance dimatikan.'});showTab('notify');}});
    mrow.append(on,off);section.appendChild(mrow);
    return section;
  }

  function renderApiKeys() {
    const section=panel('SETTING API KEY','API key default tidak diubah. Tambahkan endpoint + API key baru sebagai tambahan.');
    const list=parseJson(state.settings.additional_api_keys,[]); const wrap=document.createElement('div');wrap.className='admin-api-list';
    const draw=()=>{wrap.innerHTML='';if(!list.length){wrap.innerHTML='<div class="admin-empty">Belum ada API key tambahan.</div>';return;}list.forEach((x,i)=>{const row=document.createElement('div');row.className='admin-api-row';row.innerHTML=`<div><strong>${esc(x.endpoint||'—')}</strong><small>${esc(maskKey(x.apikey||''))}</small></div>`;const del=createButton({label:'HAPUS',variant:'danger',size:'sm',onClick:async()=>{list.splice(i,1);await saveSetting('additional_api_keys',list);draw();}});row.appendChild(del);wrap.appendChild(row);});};
    section.appendChild(wrap);draw();
    const grid=document.createElement('div');grid.className='admin-form-grid';const endpoint=input('url','Endpoint');const key=input('password','API Key');grid.append(endpoint.wrap,key.wrap);section.appendChild(grid);const row=actionsRow();const add=createButton({label:'ADD API KEY',variant:'primary',size:'sm',onClick:async()=>{if(!endpoint.value.trim()||!key.value.trim()){toast({type:'error',title:'API Key',message:'Endpoint dan API key wajib diisi.'});return;}list.push({endpoint:endpoint.value.trim(),apikey:key.value.trim(),added_at:new Date().toISOString()});await saveSetting('additional_api_keys',list);endpoint.value='';key.value='';draw();toast({type:'success',title:'API Key',message:'API key tambahan ditambahkan.'});}});row.appendChild(add);section.appendChild(row);return section;
  }

  async function refreshData(){
    try { const [users,logs,settings]=await Promise.all([adminFetchProfiles(),adminFetchQuizLogs(),adminGetSystemSettings()]); state.users=users||[];state.logs=logs||[];state.settings=settings||{}; if(!state.settings.dev_profile)state.settings.dev_profile=JSON.stringify(DEFAULT_DEV); } catch(e){toast({type:'error',title:'Admin data',message:'Gagal mengambil data admin. Periksa koneksi/RLS.'});}
    if(root.querySelector('#admin-panel-content'))showTab(state.activeTab);
  }
  function subscribeRealtime(){
    unsubscribeScope(SCOPE);
    subscribeToTable(SCOPE,CONFIG.supabase.tables.profiles,()=>refreshData());
    subscribeToTable(SCOPE,CONFIG.supabase.tables.quizLogs,()=>refreshData());
    subscribeToTable(SCOPE,CONFIG.supabase.tables.systemSettings,()=>refreshData());
  }
  async function saveSetting(key,value){await adminSetSystemSetting(key,typeof value==='string'?value:JSON.stringify(value));state.settings[key]=typeof value==='string'?value:JSON.stringify(value);}
}

function input(type,placeholder){const el=document.createElement('input');el.type=type;el.placeholder=placeholder;el.className='field__input';el.autocomplete='off';return el;}
function select(label,options,value){const wrap=document.createElement('label');wrap.className='field';wrap.innerHTML=`<span class="field__label">${label}</span>`;const el=document.createElement('select');el.className='field__input';options.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;el.appendChild(o);});el.value=value;wrap.appendChild(el);return {wrap,value:el};}
function panel(title,sub){const s=document.createElement('section');s.className='admin-panel-card admin-single-panel';s.innerHTML=`<div class="admin-section-title"><div><strong>${title}</strong><small>${sub}</small></div></div>`;return s;}
function stat(label,value){const s=document.createElement('div');s.className='admin-stat-card';s.innerHTML=`<span>${esc(label)}</span><strong>${fmtNumber(value)}</strong>`;return s;}
function actionsRow(){const d=document.createElement('div');d.className='admin-key-actions';return d;}
function parseJson(raw,fallback){try{return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
function maskKey(k){if(k.length<=8)return '••••••';return `${k.slice(0,4)}••••${k.slice(-4)}`;}

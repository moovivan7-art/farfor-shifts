/* ═══════════════════════════════════════════════════════════════
   СМЕНА — логика сайта: доступ по коду, конструктор графика,
   показ чужого графика по ссылке.
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const pad2 = n => String(n).padStart(2, '0');
const isoD = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const fromD = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
const rub = n => Math.round(n || 0).toLocaleString('ru-RU') + ' ₽';
const WD = ['вс','пн','вт','ср','чт','пт','сб'];
const DAY_MS = 86400000;

function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ── SHA-256 (чистый JS: работает и без https, и без secure context) ── */
const K256 = [
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

function sha256(str){
  const utf8 = unescape(encodeURIComponent(str));
  const bytes = [];
  for(let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  const bitLen = utf8.length * 8;
  bytes.push(0x80);
  while(bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const W = new Array(64);
  for(let off = 0; off < bytes.length; off += 64){
    for(let i = 0; i < 16; i++)
      W[i] = (bytes[off+i*4] << 24) | (bytes[off+i*4+1] << 16) | (bytes[off+i*4+2] << 8) | bytes[off+i*4+3];
    for(let i = 16; i < 64; i++){
      const x = W[i-15], y = W[i-2];
      const s0 = rotr(x,7) ^ rotr(x,18) ^ (x >>> 3);
      const s1 = rotr(y,17) ^ rotr(y,19) ^ (y >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for(let i = 0; i < 64; i++){
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[i] + W[i]) | 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8,'0')).join('');
}

/* ── доступ по коду ── */
const LS_KEY = 'smena.invite.ok';
function hasAccess(){ try{ return localStorage.getItem(LS_KEY) === '1'; }catch(e){ return false; } }
function setAccess(){ try{ localStorage.setItem(LS_KEY, '1'); }catch(e){} }

function checkCode(code){
  const c = (code || '').trim().toUpperCase();
  if(!c) return false;
  const h = sha256('smena-invite:' + c);
  return SITE.inviteHashes.indexOf(h) >= 0;
}
function openGate(){
  const g = $('#gate');
  g.classList.add('on');
  const inp = $('#codeIn');
  inp.value = '';
  $('#codeErr').textContent = '';
  setTimeout(() => inp.focus(), 120);
}
function closeGate(){ $('#gate').classList.remove('on'); }

function initGate(){
  $$('[data-gate]').forEach(b => b.onclick = () => {
    if(hasAccess()){ downloadApk(); return; }
    openGate();
  });
  const inp = $('#codeIn');
  const tryCode = () => {
    const v = inp.value.trim();
    if(checkCode(v)){ setAccess(); closeGate(); toast('Доступ открыт'); downloadApk(); }
    else $('#codeErr').textContent = 'Такой код не подходит. Спроси автора.';
  };
  $('#codeGo').onclick = tryCode;
  inp.onkeydown = e => { if(e.key === 'Enter') tryCode(); };
  $('#gate').addEventListener('click', e => { if(e.target === $('#gate')) closeGate(); });
  /* код может прийти в ссылке: site/#inv=CODE */
  const m = location.hash.match(/inv=([^&]+)/i);
  if(m){
    const c = decodeURIComponent(m[1]);
    if(checkCode(c)){ setAccess(); toast('Доступ открыт'); history.replaceState(null, '', location.pathname); }
    else { inp.value = c.toUpperCase(); openGate(); }
  }
}
function downloadApk(){
  const url = SITE.siteUrl ? (SITE.siteUrl.replace(/\/+$/,'') + '/' + SITE.apk) : SITE.apk;
  const a = document.createElement('a');
  a.href = url; a.download = '';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Качаем APK…');
}

/* ── конструктор графика ── */
const CYC_PRESETS = [
  { id:'c11', cyc:'',          name:'1 / 1' },
  { id:'c22', cyc:'',          name:'2 / 2' },
  { id:'c33', cyc:'',          name:'3 / 3' },
  { id:'clad',cyc:'1/1,2/2,3/3',name:'1-1-2-2-3-3' },
  { id:'clad2',cyc:'2/2,3/3',  name:'2-2-3-3' },
  { id:'c52', cyc:'',          name:'5 / 2' },
  { id:'c21', cyc:'',          name:'2 / 1' }
];
const state = {
  cycle:'', spd:1, start: isoD(today()), rate:SITE.rate, hours:SITE.hours,
  advPct:SITE.advPct, advDays:SITE.advDays, mate:false, mateRate:SITE.rate,
  viewYm: isoD(today()).slice(0,7), preset:'c22'
};
/* рабочие паттерны для пресетов без своего цикла */
const BASE_PAT = { c11:[1,1], c22:[2,2], c33:[3,3], c52:[5,2], c21:[2,1] };

function blocks(){
  if(state.cycle){
    const out = [];
    state.cycle.split(',').forEach(p => {
      const m = p.split('/');
      const w = parseInt(m[0],10), o = parseInt(m[1],10);
      if(w > 0) out.push({ w, o: isNaN(o) ? 0 : o });
    });
    if(out.length) return out;
  }
  const b = BASE_PAT[state.preset] || BASE_PAT.c22;
  return [{ w:b[0], o:b[1] }];
}
function cycleLen(){ return blocks().reduce((a,b) => a + b.w + b.o, 0); }
function isWork(i){
  const len = cycleLen();
  let rem = ((i % len) + len) % len;
  const bs = blocks();
  for(let k = 0; k < bs.length; k++){
    const bl = bs[k];
    if(rem < bl.w) return true;      // рабочие дни блока
    rem -= bl.w;
    if(rem < bl.o) return false;     // выходные блока
    rem -= bl.o;
  }
  return false;
}
function monthInfo(ym){
  const y = +ym.slice(0,4), m = +ym.slice(5,7);
  const first = new Date(y, m-1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const origin = fromD(state.start);
  const out = [];
  for(let d = 1; d <= days; d++){
    const dt = new Date(y, m-1, d);
    const idx = Math.round((dt - origin) / DAY_MS);
    const work = isWork(idx);
    out.push({ d, dt, work, idx, inWindow: d <= state.advDays });
  }
  return { y, m, first, days, lead, list: out };
}
function renderBuilder(){
  const mi = monthInfo(state.viewYm);
  const title = mi.first.toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  $('#monthTitle').textContent = title.charAt(0).toUpperCase() + title.slice(1);
  let html = WD.slice(1).concat(WD[0]).map(d => `<div class="wd">${d}</div>`).join('');
  for(let i = 0; i < mi.lead; i++) html += '<div class="mcell blank"></div>';
  mi.list.forEach(c => {
    let cls = 'mcell';
    if(c.work){
      cls += ' w';
      if(state.spd > 1) cls += ' w' + state.spd;
      if(c.inWindow) cls += ' half';
    }
    html += `<div class="${cls}">${c.d}${c.work && state.spd > 1 ? '<span class="d2">' + state.spd + ' окна</span>' : ''}</div>`;
  });
  $('#monthGrid').innerHTML = html;

  const workDays = mi.list.filter(c => c.work);
  const winDays  = workDays.filter(c => c.inWindow);
  const hours    = workDays.length * state.hours;
  const money    = hours * state.rate;
  const winMoney = winDays.length * state.hours * state.rate;
  const adv      = winMoney * state.advPct / 100;
  const prem     = winMoney - adv + (money - winMoney);
  const mateMoney= state.mate ? money : 0;

  const rows = [
    ['Смен в месяце', workDays.length + ' · ' + Math.round(hours) + ' ч'],
    ['Заработано', rub(money)],
    ['Из них в аванс (' + state.advPct + '% от первых ' + state.advDays + ' дней)', rub(adv), 'g'],
    ['Премия и остаток месяца', rub(prem)]
  ];
  if(state.mate) rows.push(['Вдвоём с напарником', rub(money + mateMoney), 'g']);
  rows.push(['Ставка', state.rate + ' ₽/час · смена ' + state.hours + ' ч']);
  let html2 = rows.map(r =>
    `<div class="r${r[0] === 'Заработано' ? ' big' : ''}"><span>${r[0]}</span><b class="${r[2] === 'g' ? 'g' : ''}">${r[1]}</b></div>`).join('');
  $('#sum').innerHTML = html2;

  const winTxt = 'окон в день: ' + state.spd + (state.spd > 1 ? ' (день делится на окна по ' + (state.hours / state.spd).toFixed(2).replace('.', ',') + ' ч)' : '');
  $('#calcNote').innerHTML = 'Цикл: <b style="color:var(--txt)">' + (state.cycle || (BASE_PAT[state.preset] || []).join('/')) +
    '</b> · ' + winTxt + ' · аванс ' + state.advPct + '% от первых ' + state.advDays + ' дней.';
}
function initBuilder(){
  const s = $('#startDate'); s.value = state.start;
  $('#rate').value = state.rate;
  $('#hours').value = state.hours;
  $('#advPct').value = state.advPct;
  $('#advDaysLbl').textContent = state.advDays;

  $('#cycChips').innerHTML = CYC_PRESETS.map(p => `<button class="chip" data-cyc="${p.id}">${p.name}</button>`).join('');
  const paintChips = () => {
    $$('#cycChips .chip').forEach(c => {
      const p = CYC_PRESETS.find(x => x.id === c.dataset.cyc);
      const on = state.cycle ? (state.cycle === p.cyc) : (state.preset === p.id);
      c.classList.toggle('on', on);
    });
    $$('#spdChips .chip').forEach(c => c.classList.toggle('on', +c.dataset.spd === state.spd));
    $('#mateSw').classList.toggle('on', state.mate);
    $('#mateRow').style.display = state.mate ? '' : 'none';
  };
  $$('#cycChips .chip').forEach(c => c.onclick = () => {
    const p = CYC_PRESETS.find(x => x.id === c.dataset.cyc);
    state.preset = p.id;
    state.cycle = p.cyc;
    paintChips(); renderBuilder();
  });
  $('#cycApply').onclick = () => {
    const raw = ($('#cycInput').value || '').replace(/\s/g,'').replace(/-/g,'/');
    const parts = raw.split(/[,;|]/).map(x => x.trim()).filter(Boolean).map(p => {
      const m = p.split('/');
      const w = parseInt(m[0],10), o = m.length > 1 ? parseInt(m[1],10) : 0;
      if(isNaN(w) || w < 1) return null;
      return w + '/' + (isNaN(o) ? 0 : o);
    }).filter(Boolean);
    if(!parts.length){ toast('Формат: например 1/1, 2/2, 3/3'); return; }
    state.cycle = parts.join(',');
    paintChips(); renderBuilder();
    toast('Цикл: ' + state.cycle);
  };
  $('#cycInput').onkeydown = e => { if(e.key === 'Enter') $('#cycApply').click(); };
  $$('#spdChips .chip').forEach(c => c.onclick = () => { state.spd = +c.dataset.spd; paintChips(); renderBuilder(); });
  s.onchange = () => { state.start = s.value || isoD(today()); state.viewYm = state.start.slice(0,7); renderBuilder(); };
  $('#rate').oninput = () => { state.rate = +$('#rate').value || 0; renderBuilder(); };
  $('#hours').oninput = () => { state.hours = +$('#hours').value || 0; renderBuilder(); };
  $('#advPct').oninput = () => { state.advPct = Math.max(0, Math.min(100, +$('#advPct').value || 0)); renderBuilder(); };
  $('#mateSw').onclick = () => { state.mate = !state.mate; paintChips(); renderBuilder(); };
  $('#mateRate').oninput = () => { state.mateRate = +$('#mateRate').value || 0; renderBuilder(); };

  /* листание месяцев */
  const nav = document.createElement('div');
  nav.style.cssText = 'display:flex;gap:8px;align-items:center';
  nav.innerHTML = '<button class="btn g s" id="mPrev">‹</button><button class="btn g s" id="mNext">›</button>';
  $('#monthTitle').parentNode.insertBefore(nav, $('#monthTitle').nextSibling);
  $('#mPrev').onclick = () => { const d = new Date(+state.viewYm.slice(0,4), +state.viewYm.slice(5,7)-2, 1); state.viewYm = isoD(d).slice(0,7); renderBuilder(); };
  $('#mNext').onclick = () => { const d = new Date(+state.viewYm.slice(0,4), +state.viewYm.slice(5,7), 1); state.viewYm = isoD(d).slice(0,7); renderBuilder(); };

  $('#copyBtn').onclick = () => {
    const mi = monthInfo(state.viewYm);
    const workDays = mi.list.filter(c => c.work);
    const hours = workDays.length * state.hours;
    const txt = 'График: ' + (state.cycle || (BASE_PAT[state.preset] || []).join('/')) +
      ' · смен: ' + workDays.length + ' · часов: ' + Math.round(hours) +
      ' · при ' + state.rate + ' ₽/час = ' + rub(hours * state.rate);
    if(navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Скопировано')).catch(() => toast('Скопируй вручную'));
    else toast(txt);
  };
  $('#dlBtn2').onclick = () => { hasAccess() ? downloadApk() : openGate(); };

  paintChips(); renderBuilder();
}

/* ── чужой график по ссылке (#g=…) ── */
function b64uDec(s){
  let t = s.replace(/-/g,'+').replace(/_/g,'/');
  while(t.length % 4) t += '=';
  return decodeURIComponent(escape(atob(t)));
}
function initShared(){
  const m = location.hash.match(/g=([^&]+)/);
  if(!m) return;
  let data;
  try{ data = JSON.parse(b64uDec(m[1])); }catch(e){ return; }
  if(!data || !data.s) return;
  const box = $('#sharedBox');
  $('#sharedTitle').textContent = 'График: ' + (data.n || 'сотрудник');
  const work = {};
  data.s.forEach(x => { work[+x[0]] = x[1]; });
  const ymNow = isoD(today()).slice(0,7);
  const yy = +ymNow.slice(0,4), mm = +ymNow.slice(5,7);
  const days = new Date(yy, mm, 0).getDate();
  const lead = (new Date(yy, mm-1, 1).getDay() + 6) % 7;
  let html = WD.slice(1).concat(WD[0]).map(d => `<div class="wd">${d}</div>`).join('');
  for(let i = 0; i < lead; i++) html += '<div class="mcell blank"></div>';
  let total = 0;
  for(let d = 1; d <= days; d++){
    if(work[d]){ html += `<div class="mcell w">${d}<span class="d2">${work[d]} ч</span></div>`; total += work[d]; }
    else html += `<div class="mcell">${d}</div>`;
  }
  $('#sharedGrid').innerHTML = html;
  const money = total * (data.r || 0);
  $('#sharedText').innerHTML = (data.p ? data.p + ' · ' : '') + 'смен: ' + Object.keys(work).length +
    ' · часов: ' + Math.round(total) + ' · при ' + (data.r || 0) + ' ₽/час это <b style="color:var(--acc2)">' + rub(money) + '</b>';
  box.classList.add('on');
}

/* ── ссылки и мелочи ── */
function initLinks(){
  $('#repoBtn').href = SITE.repo; $('#repoBtn2').href = SITE.repo; $('#ghBox').href = SITE.repo;
  $('#mailBox').href = 'mailto:' + SITE.email;
  $('#mailTxt').textContent = SITE.email;
  $('#verLbl').textContent = SITE.version;
  $('#year').textContent = new Date().getFullYear();
  if(SITE.telegram){
    $('#tgBox').href = SITE.telegram.startsWith('http') ? SITE.telegram : ('https://t.me/' + SITE.telegram.replace(/^@/,''));
    $('#tgTxt').textContent = SITE.telegram;
  }else{
    $('#tgBox').href = 'mailto:' + SITE.email;
    $('#tgTxt').textContent = 'пока нет — напиши на почту';
  }
}
function initReveal(){
  const els = $$('.rv');
  if(!('IntersectionObserver' in window)){ els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold:.12, rootMargin:'0px 0px -40px 0px' });
  els.forEach((e, i) => { e.style.transitionDelay = Math.min(i % 6, 5) * 55 + 'ms'; io.observe(e); });
}

/* ── старт ── */
document.addEventListener('DOMContentLoaded', () => {
  initGate();
  initBuilder();
  initShared();
  initLinks();
  initReveal();
});
})();

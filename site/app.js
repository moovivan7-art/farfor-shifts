/* ═══════════════════════════════════════════════════════════════════════
   ОБЖИГ — логика сайта: закрытый доступ, конструктор, кабинет, интерактив.
   Без зависимостей.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const pad2 = n => String(n).padStart(2, '0');
const isoD = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const fromD = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
const rub = n => Math.round(n||0).toLocaleString('ru-RU') + ' ₽';
const WD = ['пн','вт','ср','чт','пт','сб','вс'];
const DAY_MS = 86400000;

function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ═══════════ SHA-256 (чистый JS) ═══════════ */
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
  const utf8 = unescape(encodeURIComponent(str)), bytes = [];
  for(let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  const bitLen = utf8.length * 8;
  bytes.push(0x80);
  while(bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
  bytes.push((hi>>>24)&0xff,(hi>>>16)&0xff,(hi>>>8)&0xff,hi&0xff);
  bytes.push((lo>>>24)&0xff,(lo>>>16)&0xff,(lo>>>8)&0xff,lo&0xff);
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const W = new Array(64);
  for(let off = 0; off < bytes.length; off += 64){
    for(let i = 0; i < 16; i++)
      W[i] = (bytes[off+i*4]<<24)|(bytes[off+i*4+1]<<16)|(bytes[off+i*4+2]<<8)|bytes[off+i*4+3];
    for(let i = 16; i < 64; i++){
      const x = W[i-15], y = W[i-2];
      W[i] = (W[i-16] + (rotr(x,7)^rotr(x,18)^(x>>>3)) + W[i-7] + (rotr(y,17)^rotr(y,19)^(y>>>10))) | 0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i = 0; i < 64; i++){
      const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25), ch = (e&f)^(~e&g);
      const t1 = (h + S1 + ch + K256[i] + W[i]) | 0;
      const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22), maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;
    H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
  }
  return H.map(x => (x>>>0).toString(16).padStart(8,'0')).join('');
}

/* ═══════════ закрытый доступ ═══════════ */
const LS_ACCESS = 'obzhig.access', LS_ACC = 'obzhig.account';
const hasAccess = () => { try{ return localStorage.getItem(LS_ACCESS) === '1'; }catch(e){ return false; } };
const setAccess = () => { try{ localStorage.setItem(LS_ACCESS,'1'); }catch(e){} };

function checkCode(code){
  const c = (code || '').trim().toUpperCase();
  if(!c) return false;
  return SITE.inviteHashes.indexOf(sha256('smena-invite:' + c)) >= 0;
}
function initGate(){
  const gate = $('#gate'), inp = $('#gateCode'), err = $('#gateErr');
  const open = () => {
    gate.classList.remove('off');
    document.body.classList.add('locked');
    setTimeout(() => inp.focus(), 150);
  };
  const close = () => { gate.classList.add('off'); document.body.classList.remove('locked'); };
  const tryCode = () => {
    if(checkCode(inp.value)){ setAccess(); close(); toast('Доступ открыт'); initAccount(); }
    else err.textContent = 'Такой код не подходит. Спроси автора.';
  };
  $('#gateGo').onclick = tryCode;
  inp.onkeydown = e => { if(e.key === 'Enter') tryCode(); };
  if(hasAccess()) close(); else open();
  /* код мог прийти в ссылке */
  const m = location.hash.match(/inv=([^&]+)/i);
  if(m){
    const c = decodeURIComponent(m[1]);
    inp.value = c.toUpperCase();
    if(checkCode(c)){ setAccess(); close(); history.replaceState(null,'',location.pathname); }
  }
}

/* ═══════════ конструктор ═══════════ */
const CYC = [
  { id:'c11', cyc:'', name:'1 / 1' },
  { id:'c22', cyc:'', name:'2 / 2' },
  { id:'c33', cyc:'', name:'3 / 3' },
  { id:'lad', cyc:'1/1,2/2,3/3', name:'1-1-2-2-3-3' },
  { id:'lad2',cyc:'2/2,3/3', name:'2-2-3-3' },
  { id:'c52', cyc:'', name:'5 / 2' },
  { id:'c21', cyc:'', name:'2 / 1' }
];
const BASE = { c11:[1,1], c22:[2,2], c33:[3,3], c52:[5,2], c21:[2,1] };
const st = {
  cycle:'', preset:'c22', spd:1, duo:false, start: isoD(today()),
  rate:SITE.rate, hours:SITE.hours, advPct:SITE.advPct, advDays:SITE.advDays,
  mateRate:SITE.rate, viewYm: isoD(today()).slice(0,7)
};
function blocks(){
  if(st.cycle){
    const out = [];
    st.cycle.split(',').forEach(p => {
      const m = p.split('/');
      const w = parseInt(m[0],10), o = m.length > 1 ? parseInt(m[1],10) : 0;
      if(w > 0) out.push({ w, o: isNaN(o) ? 0 : o });
    });
    if(out.length) return out;
  }
  const b = BASE[st.preset] || BASE.c22;
  return [{ w:b[0], o:b[1] }];
}
function cycleLen(){ return blocks().reduce((a,b) => a + b.w + b.o, 0); }
function isWork(i){
  const len = cycleLen();
  let rem = ((i % len) + len) % len;
  for(const bl of blocks()){
    if(rem < bl.w) return true;
    rem -= bl.w;
    if(rem < bl.o) return false;
    rem -= bl.o;
  }
  return false;
}
function monthCells(ym){
  const y = +ym.slice(0,4), m = +ym.slice(5,7);
  const days = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m-1, 1).getDay() + 6) % 7;
  const origin = fromD(st.start);
  const out = [];
  for(let d = 1; d <= days; d++){
    const dt = new Date(y, m-1, d);
    out.push({ d, dt, work: isWork(Math.round((dt - origin) / DAY_MS)) });
  }
  return { lead, list: out };
}
function moneyModel(){
  const { list } = monthCells(st.viewYm);
  const work = list.filter(c => c.work);
  const hours = work.length * st.hours;
  const money = hours * st.rate;
  const winDays = work.filter(c => c.d <= st.advDays);
  const winMoney = winDays.length * st.hours * st.rate;
  const adv = winMoney * st.advPct / 100;
  const prem = winMoney - adv + (money - winMoney);
  const duo = st.duo ? money + (work.length * st.hours * st.mateRate) : 0;
  return { work, hours, money, winMoney, adv, prem, duo, winDays };
}
function renderBuilder(){
  const { lead, list } = monthCells(st.viewYm);
  const title = new Date(+st.viewYm.slice(0,4), +st.viewYm.slice(5,7)-1, 1)
    .toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  $('#monthTitle').textContent = title.charAt(0).toUpperCase() + title.slice(1);
  let html = WD.map(d => `<div class="wd">${d}</div>`).join('');
  for(let i = 0; i < lead; i++) html += '<div class="mcell blank"></div>';
  list.forEach((c, i) => {
    let cls = 'mcell';
    if(c.work){ cls += ' w'; if(st.spd > 1) cls += ' w' + st.spd; }
    html += `<div class="${cls}" style="animation-delay:${i*12}ms">${c.d}</div>`;
  });
  $('#monthGrid').innerHTML = html;
  $$('#monthGrid .mcell:not(.blank)').forEach(el => el.classList.add('pop'));

  const m = moneyModel();
  const rows = [
    ['Смен за месяц', m.work.length + ' · ' + Math.round(m.hours) + ' ч'],
    ['Заработано', rub(m.money)],
    ['В аванс (' + st.advPct + '% от первых ' + st.advDays + ' дней)', rub(m.adv), 'g'],
    ['В премию и остаток', rub(m.prem)]
  ];
  if(st.duo) rows.push(['Вдвоём с напарником', rub(m.duo), 'g']);
  $('#bSum').innerHTML = rows.map(r =>
    `<div class="b-row${r[0] === 'Заработано' ? ' big' : ''}"><span>${r[0]}</span><b class="${r[2] === 'g' ? 'g' : ''}">${r[1]}</b></div>`).join('');
  $('#splitBox').innerHTML = `
    <div class="s-row"><span>Окно 1–${st.advDays}: смен</span><b>${m.winDays.length}</b></div>
    <div class="s-row acc"><span>Аванс</span><b>${rub(m.adv)}</b></div>
    <div class="s-row gold"><span>Премия</span><b>${rub(m.prem)}</b></div>`;
  /* та же логика в блоке про деньги */
  $('#vacSplit').innerHTML = `
    <div class="s-row"><span>Если 10 смен в окне — заработано</span><b>${rub(10 * st.hours * st.rate)}</b></div>
    <div class="s-row acc"><span>Аванс · ${st.advPct}%</span><b>${rub(10 * st.hours * st.rate * st.advPct / 100)}</b></div>
    <div class="s-row gold"><span>Премия · ${100 - st.advPct}%</span><b>${rub(10 * st.hours * st.rate * (100 - st.advPct) / 100)}</b></div>`;
  paintChips();
  if(window.__acc) window.__acc();
}
function paintChips(){
  $$('#cycChips .chip').forEach(c => {
    const p = CYC.find(x => x.id === c.dataset.cyc);
    c.classList.toggle('on', st.cycle ? st.cycle === p.cyc : st.preset === p.id);
  });
  $$('#spdChips .chip').forEach(c => c.classList.toggle('on', +c.dataset.spd === st.spd));
}
function initBuilder(){
  $('#cycChips').innerHTML = CYC.map(p => `<button class="chip" data-cyc="${p.id}">${p.name}</button>`).join('');
  $$('#cycChips .chip').forEach(c => c.onclick = () => {
    const p = CYC.find(x => x.id === c.dataset.cyc);
    st.preset = p.id; st.cycle = p.cyc; renderBuilder();
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
    st.cycle = parts.join(','); renderBuilder(); toast('Цикл: ' + st.cycle);
  };
  $('#cycInput').onkeydown = e => { if(e.key === 'Enter') $('#cycApply').click(); };
  $$('#spdChips .chip').forEach(c => c.onclick = () => { st.spd = +c.dataset.spd; renderBuilder(); });
  $$('#bTabs button').forEach(b => b.onclick = () => {
    $$('#bTabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    st.duo = b.dataset.tab === 'duo';
    $('#duoRow').style.display = st.duo ? '' : 'none';
    renderBuilder();
  });
  $('#startDate').value = st.start;
  $('#rate').value = st.rate; $('#hours').value = st.hours; $('#advPct').value = st.advPct;
  $('#advDaysLbl').textContent = st.advDays; $('#mateRate').value = st.mateRate;
  $('#startDate').onchange = e => { st.start = e.target.value || isoD(today()); st.viewYm = st.start.slice(0,7); renderBuilder(); };
  $('#rate').oninput = e => { st.rate = +e.target.value || 0; renderBuilder(); };
  $('#hours').oninput = e => { st.hours = +e.target.value || 0; renderBuilder(); };
  $('#advPct').oninput = e => { st.advPct = Math.max(0, Math.min(100, +e.target.value || 0)); renderBuilder(); };
  $('#mateRate').oninput = e => { st.mateRate = +e.target.value || 0; renderBuilder(); };
  $('#mPrev').onclick = () => { const d = new Date(+st.viewYm.slice(0,4), +st.viewYm.slice(5,7)-2, 1); st.viewYm = isoD(d).slice(0,7); renderBuilder(); };
  $('#mNext').onclick = () => { const d = new Date(+st.viewYm.slice(0,4), +st.viewYm.slice(5,7), 1); st.viewYm = isoD(d).slice(0,7); renderBuilder(); };
  $('#copyBtn').onclick = () => {
    const m = moneyModel();
    const txt = 'Обжиг · график ' + (st.cycle || (BASE[st.preset]||[]).join('/')) +
      ' · смен: ' + m.work.length + ' · часов: ' + Math.round(m.hours) +
      ' · при ' + st.rate + ' ₽/час = ' + rub(m.money);
    copy(txt); toast('Скопировано');
  };
  $('#toAppBtn').onclick = () => {
    const link = buildAppLink();
    copy('График из Обжига (вставь в приложении: Ещё → Вставить график по ссылке):\n' + link);
    toast('Ссылка скопирована — вставь в приложении');
  };
  $('#pngBtn').onclick = exportPng;
}
function copy(text){
  if(navigator.clipboard) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  ta.remove();
}
/* ссылка, которую понимает приложение */
function buildAppLink(){
  const { list } = monthCells(st.viewYm);
  const payload = {
    v: 1, ym: st.viewYm,
    n: (window.__accProfile && window.__accProfile.name) || '',
    p: (window.__accProfile && window.__accProfile.point) || '',
    r: st.rate, h: st.hours,
    s: list.filter(c => c.work).map(c => [c.d, st.hours, 0])
  };
  const b = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const base = SITE.siteUrl ? SITE.siteUrl.replace(/\/+$/,'') : location.origin + location.pathname;
  return base + '#g=' + b;
}
/* экспорт картинкой */
function exportPng(){
  const { lead, list } = monthCells(st.viewYm);
  const m = moneyModel();
  const W = 900, H = 700, cell = 96, gap = 10, x0 = 60, y0 = 130;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0B10'); bg.addColorStop(1, '#121016');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W*0.75, 40, 10, W*0.75, 40, 420);
  glow.addColorStop(0, 'rgba(255,90,20,.30)'); glow.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = '#FF5A14';
  for(let i = 0; i < 5; i++){
    const h = [18, 30, 44, 26, 14][i];
    g.fillRect(60 + i * 16, 64 - h, 8, h);
  }
  g.fillStyle = '#F2F3F5'; g.font = '800 44px Montserrat, sans-serif';
  g.fillText('Обжиг', 156, 76);
  g.fillStyle = '#9AA1AE'; g.font = '600 20px Inter, sans-serif';
  const t = new Date(+st.viewYm.slice(0,4), +st.viewYm.slice(5,7)-1, 1)
    .toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  g.fillText(t.charAt(0).toUpperCase() + t.slice(1), 60, 112);
  WD.forEach((d, i) => {
    g.fillStyle = '#6C7383'; g.font = '800 15px Inter, sans-serif';
    g.fillText(d.toUpperCase(), x0 + i * (cell + gap), y0 - 14);
  });
  list.forEach((cellInfo, i) => {
    const row = Math.floor((i + lead) / 7), col = (i + lead) % 7;
    const x = x0 + col * (cell + gap), y = y0 + row * (cell + gap);
    const r = 16;
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + cell, y, x + cell, y + cell, r);
    g.arcTo(x + cell, y + cell, x, y + cell, r); g.arcTo(x, y + cell, x, y, r);
    g.arcTo(x, y, x + cell, y, r); g.closePath();
    if(cellInfo.work){
      const gr = g.createLinearGradient(x, y, x, y + cell);
      gr.addColorStop(0, '#FF6A22'); gr.addColorStop(1, '#D94000');
      g.fillStyle = gr; g.fill();
    }else{
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fill();
    }
    g.fillStyle = cellInfo.work ? '#fff' : '#6C7383';
    g.font = '800 26px Inter, sans-serif'; g.textAlign = 'center';
    g.fillText(String(cellInfo.d), x + cell/2, y + cell/2 + 9);
  });
  g.textAlign = 'left';
  g.fillStyle = '#F2F3F5'; g.font = '800 26px Montserrat, sans-serif';
  g.fillText(rub(m.money), 60, H - 86);
  g.fillStyle = '#9AA1AE'; g.font = '600 17px Inter, sans-serif';
  g.fillText(m.work.length + ' смен · ' + Math.round(m.hours) + ' ч · ' + st.rate + ' ₽/час', 60, H - 58);
  g.fillStyle = '#FFC857'; g.font = '800 19px Inter, sans-serif';
  g.fillText('аванс ' + rub(m.adv) + ' · премия ' + rub(m.prem), 60, H - 28);
  const a = document.createElement('a');
  a.download = 'obzhig-grafik-' + st.viewYm + '.png';
  a.href = c.toDataURL('image/png');
  document.body.appendChild(a); a.click(); a.remove();
  toast('Картинка сохранена');
}

/* ═══════════ личный кабинет ═══════════ */
function loadAcc(){
  try{ return JSON.parse(localStorage.getItem(LS_ACC)) || null; }catch(e){ return null; }
}
function initAccount(){
  const acc = loadAcc();
  const form = $('#accForm'), out = $('#accOut');
  $('#accRoles').innerHTML = SITE.roles.map((r, i) =>
    `<button class="chip${i === 0 ? ' on' : ''}" data-role="${r.id}">${r.name}</button>`).join('');
  let role = SITE.roles[0].id;
  $$('#accRoles .chip').forEach(c => c.onclick = () => {
    role = c.dataset.role;
    $$('#accRoles .chip').forEach(x => x.classList.toggle('on', x.dataset.role === role));
  });
  $('#accGo').onclick = () => {
    const code = $('#accCode').value.trim();
    if(!checkCode(code)){ $('#accErr').textContent = 'Код не подходит.'; return; }
    setAccess();
    const prof = {
      name: $('#accName').value.trim() || 'Сотрудник',
      point: $('#accPoint').value.trim(),
      role: role
    };
    localStorage.setItem(LS_ACC, JSON.stringify(prof));
    window.__accProfile = prof;
    showAcc(prof);
    toast('Кабинет создан');
  };
  if(acc){ window.__accProfile = acc; showAcc(acc); }
  function showAcc(prof){
    form.hidden = true; out.hidden = false;
    $('#accAvatar').textContent = (prof.name || 'С')[0].toUpperCase();
    $('#accNameOut').textContent = prof.name || 'Сотрудник';
    const rn = (SITE.roles.find(r => r.id === prof.role) || {}).name || '';
    $('#accMeta').textContent = [rn, prof.point].filter(Boolean).join(' · ');
    const code = $('#accCode').value.trim() || '—';
    $('#accCodeOut').textContent = code.toUpperCase();
    updateAccStats();
  }
  window.__acc = updateAccStats;
  function updateAccStats(){
    const m = moneyModel();
    $('#accMonth').textContent = m.work.length;
    $('#accMoney').textContent = rub(m.money);
    const link = buildAppLink();
    const le = $('#accLink');
    le.textContent = link.length > 40 ? link.slice(0, 26) + '…' + link.slice(-8) : link;
    le.title = link;
    le.dataset.full = link;
  }
  $('#dlApk').onclick = downloadApk;
  $('#accLinkBtn').onclick = () => { copy(buildAppLink()); toast('Ссылка скопирована'); };
  $('#accOutBtn').onclick = () => { localStorage.removeItem(LS_ACC); window.__accProfile = null; out.hidden = true; form.hidden = false; };
}
function downloadApk(){
  const base = SITE.siteUrl ? SITE.siteUrl.replace(/\/+$/,'') + '/' : '';
  const direct = base + SITE.apk, zipped = base + SITE.apkZip;
  if(window.fetch){
    fetch(direct, { method:'HEAD' }).then(r => go(r.ok ? direct : zipped)).catch(() => go(zipped));
  }else go(direct);
}
function go(url){
  const a = document.createElement('a');
  a.href = url; a.download = '';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Качаем APK…');
}

/* ═══════════ интерактив ═══════════ */
function initPointer(){
  const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(!fine) return;
  /* свет следует за курсором */
  $$('.why,.tech').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
  /* наклон карточек */
  $$('.tilt').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(900px) rotateY(${px*7}deg) rotateX(${-py*7}deg) translateY(-5px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
  /* телефон реагирует на курсор */
  const frame = $('.phone-frame');
  if(frame){
    const hero = $('.hero-r');
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      frame.style.transform = `perspective(1200px) rotateY(${px*10}deg) rotateX(${-py*10}deg)`;
    });
    hero.addEventListener('pointerleave', () => { frame.style.transform = ''; });
  }
}
function initReveal(){
  const els = $$('.rv');
  if(!('IntersectionObserver' in window)){ els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(en => {
    en.forEach(x => { if(x.isIntersecting){ x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { threshold:.12, rootMargin:'0px 0px -60px 0px' });
  els.forEach((e, i) => { e.style.transitionDelay = Math.min(i % 5, 4) * 60 + 'ms'; io.observe(e); });
}
function splitWords(){
  $$('.display').forEach(el => {
    if(el.dataset.split) return;
    el.dataset.split = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="word"><span>${w}</span></span>`).join(' ');
  });
}
function countUp(){
  const nums = $$('.specs b.num, .st b.num');
  if(!nums.length) return;
  const io = new IntersectionObserver(en => {
    en.forEach(x => {
      if(!x.isIntersecting) return;
      const el = x.target, raw = el.textContent.trim();
      if(!/^\d+$/.test(raw)) return;
      const target = +raw;
      const t0 = performance.now(), dur = 900;
      const tick = t => {
        const k = Math.min(1, (t - t0) / dur);
        const e2 = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * e2);
        if(k < 1) requestAnimationFrame(tick); else el.textContent = raw;
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold:.5 });
  nums.forEach(n => io.observe(n));
}
function initMarquee(){
  const track = $('.mq-track');
  if(track) track.innerHTML = track.innerHTML + track.innerHTML;
}
function initSticky(){
  const top = $('#top');
  const onScroll = () => { top.classList.toggle('stuck', window.scrollY > 24); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive:true });
}
function initLinks(){
  $('#repoBtn').href = SITE.repo; $('#repoBtn2').href = SITE.repo; $('#repoFoot').href = SITE.repo;
  $('#mailFoot').href = 'mailto:' + SITE.email; $('#mailFoot').textContent = SITE.email;
  $('#verLbl').textContent = SITE.version;
  if(SITE.telegram){
    $('#tgFoot').href = SITE.telegram.startsWith('http') ? SITE.telegram : 'https://t.me/' + SITE.telegram.replace(/^@/,'');
    $('#tgFoot').textContent = SITE.telegram;
  }else{ $('#tgFoot').href = 'mailto:' + SITE.email; $('#tgFoot').textContent = 'написать автору'; }
}

/* ═══════════ чужой график по ссылке ═══════════ */
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
  const box = $('#account');
  if(!box) return;
  const ym = data.ym || isoD(today()).slice(0,7);
  const work = {};
  data.s.forEach(x => { work[+x[0]] = x[1]; });
  const y = +ym.slice(0,4), mo = +ym.slice(5,7);
  const days = new Date(y, mo, 0).getDate();
  const lead = (new Date(y, mo-1, 1).getDay() + 6) % 7;
  let html = WD.map(d => `<div class="wd">${d}</div>`).join('');
  for(let i = 0; i < lead; i++) html += '<div class="mcell blank"></div>';
  let total = 0;
  for(let d = 1; d <= days; d++){
    if(work[d]){
      html += `<div class="mcell w">${d}</div>`;
      total += work[d];
    }else html += `<div class="mcell">${d}</div>`;
  }
  const money = total * (data.r || 0);
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.marginBottom = '20px';
  panel.innerHTML = `<div class="panel-head"><h3>График: ${data.n || 'сотрудник'}</h3>
      <span class="pill-live"><i></i>по ссылке</span></div>
    <div class="mgrid">${html}</div>
    <div class="split">
      <div class="s-row"><span>Смен</span><b>${Object.keys(work).length}</b></div>
      <div class="s-row"><span>Часов</span><b>${Math.round(total)}</b></div>
      <div class="s-row acc"><span>При ${data.r || 0} ₽/час</span><b>${rub(money)}</b></div>
    </div>
    <div class="b-actions">
      <button class="btn p s" onclick="location.hash='';location.reload()">Собрать свой график</button>
    </div>`;
  box.insertBefore(panel, box.firstChild);
}

/* доступ извне: конструктор и мост с приложением */
window.buildAppLink = buildAppLink;
window.moneyModel = moneyModel;
window.__siteState = st;

/* ═══════════ старт ═══════════ */
document.addEventListener('DOMContentLoaded', () => {
  initGate();
  initBuilder();
  initAccount();
  initLinks();
  initShared();
  splitWords();
  initReveal();
  countUp();
  initMarquee();
  initSticky();
  initPointer();
  renderBuilder();
});
})();

/* если .gif не найден (например, репозиторий без бинарников) —
   подставляем анимацию из текстовой копии */
window.fxGifFallback = function(img){
  /* .gif недоступен (репозиторий без бинарников) — ставим вшитый постер */
  img.src = getComputedStyle(document.documentElement).getPropertyValue('--poster').trim().replace(/^url\(['"]?|['"]?\)$/g, '');
  img.onerror = null;
};

/* ═══════════════════════════════════════════════════════════
   СМЕНА v1.4 — расширения
   · свой цикл графика (любой ритм: 1/1, 2/2, 3/3, лесенка)
   · окон в день (двойная/тройная смена)
   · доплаты списком (+10 за план, +10 за скорость…)
   · правило выплат: % от первых дней (40% → аванс, остальное → премия)
   · напарник: две смены в один день, у каждого свои часы и деньги
   · копии (смена → дни, месяц → месяц)
   · отправка: ссылка на график, календарь .ics, share
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

const qs  = (s, r) => (r || document).querySelector(s);
const qsa = (s, r) => [...(r || document).querySelectorAll(s)];
const pad2 = n => String(n).padStart(2, '0');
const isoD = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const fromD = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayD = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
const rub = n => (Math.round(n) || 0).toLocaleString('ru-RU') + ' ₽';
const rubShort = n => { n = Math.round(n || 0); return Math.abs(n) >= 10000 ? Math.round(n/1000) + ' тыс ₽' : n.toLocaleString('ru-RU') + ' ₽'; };
const WD = ['вс','пн','вт','ср','чт','пт','сб'];
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmtD = s => { const d = fromD(s); return d.getDate() + ' ' + d.toLocaleDateString('ru-RU', { month:'short' }); };

/* ── состояние слоя ── */
let fxParts = [];        // окна смены в шторке дня
let fxPartsTouched = false;
let fxWho = 'me';        // кого правим: me | mate
let fxWhoManual = false; // выбор пользователя, не угадывать по записям

/* ═════════════ 1. ЦИКЛ ГРАФИКА ═════════════ */
const CYCLE_PRESETS = [
  { id:'p11',  cyc:'',           pat:'1-1', name:'1 день / 1 день' },
  { id:'p22',  cyc:'',           pat:'2-2', name:'2 / 2' },
  { id:'p33',  cyc:'',           pat:'3-3', name:'3 / 3' },
  { id:'lad',  cyc:'1/1,2/2,3/3', pat:'',  name:'лесенка 1-1-2-2-3-3' },
  { id:'lad2', cyc:'2/2,3/3',     pat:'',  name:'2-2-3-3' },
  { id:'p21',  cyc:'',           pat:'2-1', name:'2 / 1' },
  { id:'p52',  cyc:'',           pat:'5-2', name:'5 / 2' }
];

function fxRenderCycle(){
  const box = qs('#cycleChips');
  if(!box) return;
  const cur = (S.plan.cycle || '').trim();
  box.innerHTML = CYCLE_PRESETS.map(p => {
    const on = (cur && cur === p.cyc) || (!cur && S.plan.pattern === p.pat);
    return `<button class="chip${on ? ' on' : ''}" data-cyc="${p.id}">${p.name}</button>`;
  }).join('');
  const inp = qs('#cycleInput');
  if(inp && document.activeElement !== inp) inp.value = cur;
  const pill = qs('#cyclePill');
  if(pill) pill.textContent = cycleLabel();
  qsa('#spdChips .chip').forEach(c =>
    c.classList.toggle('on', parseInt(c.dataset.spd,10) === (parseInt(S.plan.shiftsPerDay,10) || 1)));
  fxRenderCycleViz();
}
function fxRenderCycleViz(){
  const box = qs('#cycleViz');
  if(!box) return;
  const cells = [];
  cycleBlocks().forEach(b => {
    for(let i = 0; i < b.w; i++) cells.push('<i class="w"></i>');
    for(let i = 0; i < b.o; i++) cells.push('<i class="o"></i>');
  });
  const spd = parseInt(S.plan.shiftsPerDay,10) || 1;
  box.innerHTML = `<div class="cyc-strip">${cells.join('')}</div>
    <div class="muted small" style="margin-top:8px">Цикл <b>${esc(cycleLabel())}</b> · ${cycleLen()} дн. ·
    окон в день: <b>${spd}</b>${spd > 1 ? ' (сумма часов за день делится на окна)' : ''}</div>`;
}
function fxApplyCycle(){
  const inp = qs('#cycleInput');
  if(!inp) return;
  const raw = (inp.value || '').replace(/\s/g,'').replace(/-/g,'/');
  const parts = raw.split(/[,;|]/).map(x => x.trim()).filter(Boolean).map(p => {
    const m = p.split('/');
    const w = parseInt(m[0],10);
    const o = m.length > 1 ? parseInt(m[1],10) : 0;
    if(isNaN(w) || w < 1 || w > 31) return null;
    return w + '/' + (isNaN(o) || o < 0 ? 0 : o);
  }).filter(Boolean);
  if(!parts.length){ toast('Формат: сколько работаешь / сколько отдыхаешь. Например 1/1, 2/2, 3/3'); return; }
  S.plan.cycle = parts.join(',');
  S.plan.pattern = '';
  save();
  fxRenderCycle(); renderSched(); renderAll();
  toast('Цикл: ' + S.plan.cycle);
}
function fxResetCycle(){
  S.plan.cycle = ''; S.plan.pattern = '2-2';
  save(); fxRenderCycle(); renderSched(); toast('Вернулся 2-2');
}

/* ═════════════ 2. ОКОН В ДЕНЬ ═════════════ */
function fxSetSpd(n){
  S.plan.shiftsPerDay = Math.max(1, Math.min(3, n));
  save(); fxRenderCycle(); renderSched();
  toast(S.plan.shiftsPerDay > 1 ? ('В дне ' + S.plan.shiftsPerDay + ' окна') : 'Одно окно в день');
}

/* ═════════════ 3. ДОПЛАТЫ СПИСКОМ ═════════════ */
const BONUS_QUICK = [
  { name:'Выполнил план', amount:10 },
  { name:'Скорость', amount:10 },
  { name:'Качество', amount:50 },
  { name:'Чаевые', amount:100 }
];
function fxRenderBonus(){
  const box = qs('#bonusItems');
  if(!box) return;
  const ym = currentTabYm();
  const items = bonusItems(ym);
  const pill = qs('#bonusPill');
  if(pill) pill.textContent = rub(bonusOf(ym));
  box.innerHTML = items.length ? items.map(i =>
    `<div class="li"><div class="li-d">₽</div>
      <div class="li-t"><b>${esc(i.name || 'Доплата')}</b><span>${i.date ? esc(fmtD(i.date)) : 'за месяц'}</span></div>
      <div class="li-m">${rub(i.amount)}</div>
      <button class="li-x" data-del="${esc(i.id)}" title="Убрать">✕</button></div>`).join('')
    : '<div class="empty">Пока пусто. Добавь доплаты — всё сложится в одну сумму.</div>';
  qsa('#bonusItems .li-x').forEach(b => b.onclick = () => {
    const ym2 = currentTabYm();
    const rec = S.bonuses[ym2] || { amount:0, note:'', items:[] };
    if(!rec.items) rec.items = [];
    rec.items = rec.items.filter(i => i.id !== b.dataset.del);
    rec.amount = rec.items.reduce((a,i) => a + (parseInt(i.amount,10) || 0), 0);
    if(!rec.items.length) delete S.bonuses[ym2]; else S.bonuses[ym2] = rec;
    save(); fxRenderBonus(); renderTab(); toast('Убрано');
  });
  const qbox = qs('#bonusQuick');
  if(qbox){
    qbox.innerHTML = BONUS_QUICK.map((q,i) =>
      `<button class="chip" data-qi="${i}">${esc(q.name)} +${q.amount}</button>`).join('');
    qsa('#bonusQuick .chip').forEach(c => c.onclick = () => {
      const q = BONUS_QUICK[parseInt(c.dataset.qi,10)];
      fxAddBonus(q.name, q.amount);
    });
  }
}
function fxAddBonus(name, amount){
  const ym = currentTabYm();
  const rec = S.bonuses[ym] || { amount:0, note:'', items:[] };
  if(!rec.items) rec.items = [];
  rec.items.push({ id:'i' + Date.now() + Math.floor(Math.random()*1000), name: name || 'Доплата', amount: parseInt(amount,10) || 0, date: todayISO() });
  rec.amount = rec.items.reduce((a,i) => a + (parseInt(i.amount,10) || 0), 0);
  rec.note = rec.items.map(i => i.name).join(', ');
  S.bonuses[ym] = rec;
  save(); fxRenderBonus(); renderTab();
  toast('+ ' + rub(amount));
}

/* ═════════════ 3b. СПИСАНИЯ И ШТРАФЫ ═════════════ */
const DED_QUICK = [
  { name:'Штраф', amount:300 },
  { name:'Опоздал на смену', amount:200 },
  { name:'Разбитая посуда', amount:150 },
  { name:'Брак блюда', amount:250 }
];
function fxRenderDeductions(){
  const box = qs('#deductionsList');
  if(!box) return;
  const ym = currentTabYm();
  const items = deductionItems(ym);
  const pill = qs('#deductionPill');
  if(pill) pill.textContent = '− ' + rub(deductionOf(ym));
  box.innerHTML = items.length ? items.map(i =>
    `<div class="li"><div class="li-d">−</div>
      <div class="li-t"><b>${esc(i.name || 'Списание')}</b><span>${i.date ? esc(fmtD(i.date)) : 'за месяц'}</span></div>
      <div class="li-m" style="color:var(--red)">−${rub(i.amount)}</div>
      <button class="li-x" data-del="${esc(i.id)}" title="Убрать">✕</button></div>`).join('')
    : '<div class="empty">Штрафов и списаний не было. Если что-то прилетит — запиши сюда, чтобы помнить, за что.</div>';
  qsa('#deductionsList .li-x').forEach(b => b.onclick = () => {
    const ym2 = currentTabYm();
    const rec = S.deductions[ym2] || { amount:0, note:'', items:[] };
    if(!rec.items) rec.items = [];
    rec.items = rec.items.filter(i => i.id !== b.dataset.del);
    rec.amount = rec.items.reduce((a,i) => a + (parseInt(i.amount,10) || 0), 0);
    if(!rec.items.length) delete S.deductions[ym2]; else S.deductions[ym2] = rec;
    save(); fxRenderDeductions(); renderTab(); toast('Убрано');
  });
  const qbox = qs('#dedQuick');
  if(qbox){
    qbox.innerHTML = DED_QUICK.map((q,i) =>
      `<button class="chip" data-di="${i}">${esc(q.name)} −${q.amount}</button>`).join('');
    qsa('#dedQuick .chip').forEach(c => c.onclick = () => {
      const q = DED_QUICK[parseInt(c.dataset.di,10)];
      fxAddDeduction(q.name, q.amount);
    });
  }
}
function fxAddDeduction(name, amount){
  const ym = currentTabYm();
  const rec = S.deductions[ym] || { amount:0, note:'', items:[] };
  if(!rec.items) rec.items = [];
  rec.items.push({ id:'d' + Date.now() + Math.floor(Math.random()*1000), name: name || 'Списание', amount: parseInt(amount,10) || 0, date: todayISO() });
  rec.amount = rec.items.reduce((a,i) => a + (parseInt(i.amount,10) || 0), 0);
  rec.note = rec.items.map(i => i.name).join(', ');
  S.deductions[ym] = rec;
  save(); fxRenderDeductions(); renderTab();
  toast('− ' + rub(amount));
}

/* ═════════════ 4. РАЗБИВКА ВЫПЛАТ ═════════════ */
function fxRenderPayBreak(){
  const box = qs('#payBreak');
  if(!box) return;
  const b = payBreakdown();
  const mode = qs('#pbMode');
  if(mode) mode.textContent = b.mode === 'pct' ? (b.pct + '% → аванс') : 'половина месяца';
  const rows = [];
  rows.push(['Окно 1–' + b.aw + ' ' + b.ym.slice(5) + ': смен', b.win.shifts + ' · ' + b.win.hours + ' ч']);
  rows.push(['Заработано в окне', rub(b.win.money)]);
  if(b.mode === 'pct'){
    rows.push(['→ в аванс (' + b.pct + '%)', rub(b.adv)]);
    rows.push(['→ в премию (' + (100 - b.pct) + '%)', rub(b.win.money - b.adv)]);
  }
  rows.push(['Остаток месяца', rub(b.rest.money)]);
  if(b.bonus) rows.push(['Доплаты и премии', '+' + rub(b.bonus)]);
  const ded = deductionOf(b.ym);
  if(ded) rows.push(['Списания и штрафы', '−' + rub(ded)]);
  rows.push(['Итого за месяц', rub(b.win.money + b.rest.money + b.bonus - ded)]);
  box.innerHTML = rows.map((r,i) =>
    `<div class="br${i === rows.length - 1 ? ' br-total' : ''}"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('');
}

/* ═════════════ 5. ОКНА СМЕНЫ (шторка дня) ═════════════ */
function fxOpenSheet(){
  window.__fxMate = (fxWho === 'mate');
  const sh = fxWho === 'mate' ? getMateShift(sheetDate) : getShift(sheetDate);
  fxParts = [];
  fxPartsTouched = false;
  if(sh && sh.kind === 'work'){
    if(sh.parts && sh.parts.length){
      fxParts = sh.parts.map(pt => ({ slot: pt.slot || 'day', hours: parseFloat(pt.hours) || 0 }));
    }else{
      fxParts = [{ slot: sh.slot || 'day', hours: parseFloat(sh.hours) || 0 }];
    }
  }else{
    fxParts = [{ slot:'day', hours: parseFloat(S.profile.hours) || 13.75 }];
  }
  const mf = qs('#mateField');
  if(mf) mf.style.display = (S.mate && S.mate.name) ? '' : 'none';
  qsa('#mateChips .chip').forEach(c => c.classList.toggle('on', c.dataset.who === fxWho));
  fxRenderParts();
}
function fxRenderParts(){
  const box = qs('#partsList');
  if(!box) return;
  if(!fxParts.length) fxParts = [{ slot:'day', hours: parseFloat(S.profile.hours) || 13.75 }];
  box.innerHTML = fxParts.map((p,i) =>
    `<div class="part">
      <div class="chips" data-slotrow="${i}">
        ${slotList().map(sl => `<button class="chip${sl.id === p.slot ? ' on' : ''}" data-slot="${sl.id}" data-i="${i}">${esc(sl.label)}</button>`).join('')}
      </div>
      <div class="hours-row">
        <input type="number" class="part-h" data-i="${i}" value="${p.hours}" min="0" max="24" step="0.25" inputmode="decimal">
        <span>ч${fxParts.length > 1 ? ' · окно ' + (i+1) : ''}</span>
        ${fxParts.length > 1 ? `<button class="li-x" data-rm="${i}">✕</button>` : ''}
      </div>
    </div>`).join('');
  qsa('#partsList .chip[data-slot]').forEach(c => c.onclick = () => {
    const i = parseInt(c.dataset.i,10);
    fxParts[i].slot = c.dataset.slot;
    fxPartsTouched = true;
    const sl = slotList().find(x => x.id === c.dataset.slot);
    if(sl && fxParts.length === 1 && sl.hours) fxParts[i].hours = sl.hours;
    fxRenderParts(); fxSyncParts();
  });
  qsa('#partsList .part-h').forEach(inp => inp.oninput = () => {
    const i = parseInt(inp.dataset.i,10);
    fxParts[i].hours = parseFloat(inp.value) || 0;
    fxPartsTouched = true;
    fxSyncParts();
  });
  qsa('#partsList .li-x[data-rm]').forEach(b => b.onclick = () => {
    const i = parseInt(b.dataset.rm,10);
    fxParts.splice(i, 1);
    fxPartsTouched = true;
    fxRenderParts(); fxSyncParts();
  });
  fxSyncParts();
}
function fxSyncParts(){
  window.__fxParts = fxParts.slice();
  const total = fxParts.reduce((a,p) => a + (parseFloat(p.hours) || 0), 0);
  const h = qs('#shHours');
  if(h && document.activeElement !== h) h.value = Math.round(total * 100) / 100;
  updateSheetSum();
}
function fxAddPart(){
  const last = fxParts[fxParts.length - 1] || { slot:'day', hours:0 };
  fxParts.push({ slot: last.slot || 'day', hours: 4 });
  fxPartsTouched = true;
  fxRenderParts();
}

/* ═════════════ 6. НАПАРНИК ═════════════ */
function fxRenderMate(){
  const box = qs('#mateCard');
  if(!box) return;
  const name = (S.mate && S.mate.name) || '';
  const shifts = (S.mate && S.mate.shifts) || {};
  const ym = currentTabYm();
  const m = monthRange(ym);
  const days = Object.keys(shifts).filter(d => d >= m.from && d <= m.to);
  let hours = 0, money_ = 0;
  days.forEach(d => { const s = shifts[d]; if(s.kind === 'work'){ hours += shiftHours(s); money_ += shiftMoney(s, d); } });
  const both = Object.keys(shifts).filter(d => S.shifts[d] && S.shifts[d].kind === 'work').length;
  box.innerHTML = name
    ? `<div class="br"><span>Напарник</span><b>${esc(name)}</b></div>
       <div class="br"><span>Смен за месяц</span><b>${days.length} · ${hours} ч</b></div>
       <div class="br"><span>Заработано</span><b>${rub(money_)}</b></div>
       <div class="br"><span>Смен вдвоём</span><b>${both}</b></div>
       <button class="btn ghost" data-act="mate-shift" style="width:100%;margin-top:10px">Отметить смену напарника</button>`
    : `<p class="muted small">Напарник не задан. Если смену делите вдвоём — укажи его в профиле, тогда у каждого будут свои часы и свои деньги.</p>`;
  const btn = qs('#mateCard [data-act="mate-shift"]');
  if(btn) btn.onclick = () => { window.fxOpenAs('mate', todayISO()); };
}
function fxFillMateFields(){
  const n = qs('#fMateName'), r = qs('#fMateRate');
  if(n) n.value = (S.mate && S.mate.name) || '';
  if(r) r.value = (S.mate && S.mate.rate) || 0;
  const pm = qs('#payModeChips');
  if(pm) qsa('#payModeChips .chip').forEach(c => c.classList.toggle('on', c.dataset.pm === (S.profile.payMode || 'half')));
  const ap = qs('#fAdvPct'), ad = qs('#fAdvDays');
  if(ap) ap.value = S.profile.advPct == null ? 40 : S.profile.advPct;
  if(ad) ad.value = S.profile.advDays == null ? 20 : S.profile.advDays;
}

/* ═════════════ 7. КОПИИ ═════════════ */
function fxOpenCopy(){
  const wrap = qs('#copyWrap');
  if(!wrap) return;
  const list = qs('#copyList');
  const src = fxMate ? getMateShift(sheetDate) : S.shifts[sheetDate];
  if(!src){ toast('Сначала сохрани смену'); return; }
  const days = [];
  for(let i = 1; i <= 14; i++){
    const d = isoD(addD(todayD(), i));
    days.push(d);
  }
  list.innerHTML = days.map(d => {
    const dt = fromD(d);
    const ex = (fxMate ? getMateShift(d) : S.shifts[d]);
    return `<button class="li li-btn" data-cp="${d}">
      <div class="li-d"><b>${dt.getDate()}</b><span>${WD[dt.getDay()]}</span></div>
      <div class="li-t"><b>${esc(fmtD(d))}</b><span>${ex ? (ex.kind === 'work' ? 'уже есть смена' : ex.kind === 'off' ? 'отдых' : 'отпуск') : 'свободно'}</span></div>
      <div class="li-m">⧉</div></button>`;
  }).join('');
  qsa('#copyList [data-cp]').forEach(b => b.onclick = () => {
    const d = b.dataset.cp;
    const rec = JSON.parse(JSON.stringify(src));
    if(fxMate){ if(!S.mate.shifts) S.mate.shifts = {}; S.mate.shifts[d] = rec; }
    else S.shifts[d] = rec;
    save(); renderAll(); toast('Скопировано на ' + fmtD(d));
  });
  wrap.classList.add('on');
}
function fxCopyMonth(){
  const ym = `${calY}-${pad2(calM+1)}`;
  const m = monthRange(ym);
  const keys = Object.keys(S.shifts).filter(d => d >= m.from && d <= m.to);
  if(!keys.length){ toast('В этом месяце пусто'); return; }
  const shift = (calM === 11) ? 12 : 1;
  const ny = (calM === 11) ? calY + 1 : calY;
  const target = `${ny}-${pad2(shift)}`;
  const nm = monthRange(target);
  const map = {};
  keys.forEach(d => {
    const nd = isoD(addD(fromD(d), (fromD(nm.from) - fromD(m.from)) / 86400000));
    map[nd] = S.shifts[d];
  });
  if(!confirm(`Скопировать ${keys.length} записей из ${ym} в ${target}?`)) return;
  Object.keys(map).forEach(d => { S.shifts[d] = map[d]; });
  save(); renderAll(); toast('Скопировано в ' + target);
}

/* ═════════════ 8. ОТПРАВКА: ссылка, .ics, share ═════════════ */
function b64u(str){
  const b = btoa(unescape(encodeURIComponent(str)));
  return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fxSharePayload(){
  const ym = monthKey(todayISO());
  const m = monthRange(ym);
  const days = Object.keys(S.shifts).filter(d => d >= m.from && d <= m.to && S.shifts[d].kind === 'work').sort();
  return b64u(JSON.stringify({
    n: S.profile.name || 'Сотрудник',
    p: S.profile.point || '',
    r: S.profile.rate || 0,
    h: S.profile.hours || 13.75,
    s: days.map(d => [d.slice(8), shiftHours(S.shifts[d]), S.shifts[d].bonus || 0])
  }));
}
function fxShareLink(){
  const base = (S.profile.siteUrl || '').replace(/\/+$/,'');
  return (base ? base + '/' : '') + '#g=' + fxSharePayload();
}
function fxDoShareLink(){
  const link = fxShareLink();
  const text = 'Мой график смен — ' + (S.profile.name || '') + (S.profile.point ? ' · ' + S.profile.point : '');
  if(navigator.share){
    navigator.share({ title:'График смен', text, url: link }).catch(()=>{});
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text + '\n' + link)
      .then(() => toast('Ссылка в буфере — отправь шефу'))
      .catch(() => toast('Скопируй вручную: ' + link));
  }else{
    toast('Ссылка: ' + link);
  }
}
function fxSlotTimes(slotId){
  const p = S.profile;
  if(slotId === 'day') return [p.shiftStart || '10:00', p.shiftEnd || '23:45'];
  const map = { morning:['07:00','15:00'], evening:['17:00','01:00'], night:['23:00','07:00'] };
  return map[slotId] || map.morning;
}
function fxICS(){
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Smena//RU', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:' + (S.profile.name || 'Смены'), 'METHOD:PUBLISH'
  ];
  Object.keys(S.shifts).sort().forEach(d => {
    const sh = S.shifts[d];
    if(sh.kind !== 'work') return;
    const parts = (sh.parts && sh.parts.length) ? sh.parts : [{ slot: sh.slot || 'day', hours: parseFloat(sh.hours) || 0 }];
    parts.forEach((pt, i) => {
      const t = fxSlotTimes(pt.slot || 'day');
      const dd = d.replace(/-/g,'');
      let endDay = dd;
      if(t[1] <= t[0]) endDay = isoD(addD(fromD(d), 1)).replace(/-/g,'');
      const st = t[0].replace(':','') , en = t[1].replace(':','');
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + dd + '-' + i + '@smena');
      lines.push('DTSTAMP:' + dd + 'T000000');
      lines.push('DTSTART:' + dd + 'T' + (st.length === 4 ? st : '0000'));
      lines.push('DTEND:' + endDay + 'T' + (en.length === 4 ? en : '0000'));
      lines.push('SUMMARY:' + (S.profile.point ? 'Смена · ' + S.profile.point : 'Смена'));
      lines.push('DESCRIPTION:Отработано ' + String(pt.hours).replace('.', ',') + ' ч · ' +
        rub(rateOf(sh) * (parseFloat(pt.hours) || 0)));
      lines.push('END:VEVENT');
    });
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function rateOf(sh){
  return (sh.rate === null || sh.rate === undefined) ? (S.profile.rate || 0) : sh.rate;
}
function fxExportICS(){
  const txt = fxICS();
  const b = new Blob([txt], { type:'text/calendar;charset=utf-8' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = 'smena-shifts.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
  toast('Файл календаря сохранён');
}
function fxShareReport(){
  makeReport();
  setTimeout(() => {
    const box = qs('#txtModal .txtbox');
    if(!box) return;
    const txt = box.textContent;
    if(navigator.share) navigator.share({ title:'Табель', text: txt }).catch(()=>{});
    else if(navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Отчёт в буфере')).catch(()=>{});
  }, 350);
}

/* ═════════════ 9. СВЯЗЫВАНИЕ ═════════════ */
function fxInit(){
  if(window.__fxReady) return;
  window.__fxReady = true;
  /* цикл */
  const ca = qs('#cycleApply');
  if(ca) ca.onclick = fxApplyCycle;
  const cr = qs('#cycleReset');
  if(cr) cr.onclick = fxResetCycle;
  const ci = qs('#cycleInput');
  if(ci) ci.onkeydown = e => { if(e.key === 'Enter') fxApplyCycle(); };
  qsa('#spdChips .chip').forEach(c => c.onclick = () => fxSetSpd(parseInt(c.dataset.spd,10)));

  /* доплаты */
  const ba = qs('#bonusAdd');
  if(ba) ba.onclick = () => {
    const n = qs('#bonusName'), a = qs('#bonusAmt');
    const amt = parseInt(a.value,10);
    if(!amt){ toast('Сколько рублей?'); return; }
    fxAddBonus(n.value.trim() || 'Доплата', amt);
    n.value = ''; a.value = '';
  };
  qsa('#bonusAmt').forEach(i => i.onkeydown = e => { if(e.key === 'Enter') qs('#bonusAdd').click(); });
  qsa('#bonusName').forEach(i => i.onkeydown = e => { if(e.key === 'Enter') qs('#bonusAdd').click(); });

  /* списания и штрафы */
  const dd = qs('#dedAdd');
  if(dd) dd.onclick = () => {
    const n = qs('#dedName'), a = qs('#dedAmt');
    const amt = parseInt(a.value,10);
    if(!amt){ toast('Сколько рублей?'); return; }
    fxAddDeduction(n.value.trim() || 'Списание', amt);
    n.value = ''; a.value = '';
  };
  qsa('#dedAmt').forEach(i => i.onkeydown = e => { if(e.key === 'Enter') qs('#dedAdd').click(); });
  qsa('#dedName').forEach(i => i.onkeydown = e => { if(e.key === 'Enter') qs('#dedAdd').click(); });

  /* правило выплат */
  qsa('#payModeChips .chip').forEach(c => c.onclick = () => {
    S.profile.payMode = c.dataset.pm; save(); fxFillMateFields(); renderAll();
    toast(c.dataset.pm === 'pct' ? 'Аванс = % от первых дней' : 'Аванс = половина месяца');
  });
  const ap = qs('#fAdvPct');
  if(ap) ap.onchange = () => { S.profile.advPct = Math.max(0, Math.min(100, parseInt(ap.value,10) || 0)); save(); renderAll(); };
  const ad = qs('#fAdvDays');
  if(ad) ad.onchange = () => { S.profile.advDays = Math.max(1, Math.min(28, parseInt(ad.value,10) || 20)); save(); renderAll(); };

  /* напарник */
  const mn = qs('#fMateName');
  if(mn) mn.onchange = () => { S.mate.name = mn.value.trim(); save(); renderAll(); };
  const mr = qs('#fMateRate');
  if(mr) mr.onchange = () => { S.mate.rate = parseInt(mr.value,10) || 0; save(); renderAll(); };

  /* окна смены */
  const ap2 = qs('#addPart');
  if(ap2) ap2.onclick = fxAddPart;
  qsa('#mateChips .chip').forEach(c => c.onclick = () => { window.fxOpenAs(c.dataset.who, sheetDate); });
  const cs = qs('#copyShift');
  if(cs) cs.onclick = fxOpenCopy;

  /* копии / отправка */
  qsa('[data-act="copy-month"]').forEach(b => b.onclick = fxCopyMonth);
  qsa('[data-act="share-link"]').forEach(b => b.onclick = fxDoShareLink);
  qsa('[data-act="export-ics"]').forEach(b => b.onclick = fxExportICS);
  qsa('[data-act="share-report"]').forEach(b => b.onclick = fxShareReport);

  /* закрыть окно копирования */
  const cw = qs('#copyWrap');
  if(cw){
    qs('#copyClose', cw).onclick = () => cw.classList.remove('on');
    qs('#copyBg', cw).onclick = () => cw.classList.remove('on');
  }

  /* обёртки рендеров */
  const _openSheet = openSheet;
  window.openSheet = function(date){
    fxWhoManual = false;
    fxWho = (getMateShift(date) && !getShift(date)) ? 'mate' : 'me';
    _openSheet(date);
    fxOpenSheet();
  };
  window.fxOpenAs = function(who, date){
    fxWhoManual = true;
    fxWho = (who === 'mate') ? 'mate' : 'me';
    _openSheet(date || sheetDate);
    fxOpenSheet();
  };
  const _renderHome = renderHome;
  window.renderHome = function(){ _renderHome(); fxRenderPayBreak(); };
  const _renderTab  = renderTab;
  window.renderTab  = function(){ _renderTab(); fxRenderBonus(); fxRenderMate(); fxRenderDeductions(); };
  const _renderSet  = renderSet;
  window.renderSet  = function(){ _renderSet(); fxFillMateFields(); };
  const _updateSheetSum = updateSheetSum;
  window.updateSheetSum = function(){
    if(fxParts.length){
      const rate = parseInt(qs('#shRate').value || 0, 10);
      const bonus = parseInt(qs('#shBonus').value || 0, 10);
      let base = 0; const pp = [];
      fxParts.forEach(p => {
        const h = parseFloat(p.hours) || 0;
        base += h * rate;
        pp.push(fmtHours(h) + ' × ' + rate + ' ₽');
      });
      const total = base + bonus;
      const box = qs('#shSum');
      if(box) box.innerHTML = `<b>${rub(total)}</b><span>${pp.join(' · ')}${bonus ? ' + чаевые ' + rub(bonus) : ''}</span>`;
      return;
    }
    _updateSheetSum();
  };
  /* перепривязываем обработчики: app.js присвоил их до обёртки */
  const bindSum = () => { window.updateSheetSum(); };
  const sr = qs('#shRate'), sb = qs('#shBonus'), sh = qs('#shHours');
  if(sr) sr.oninput = bindSum;
  if(sb) sb.oninput = bindSum;
  if(sh) sh.oninput = function(){
    const v = parseFloat(this.value);
    qsa('#hoursChips .chip').forEach(x => x.classList.toggle('on', parseFloat(x.dataset.h) === v));
    if(fxParts.length) fxParts[0].hours = isNaN(v) ? 0 : v;
    window.updateSheetSum();
  };

  fxRenderCycle(); fxRenderBonus(); fxRenderPayBreak(); fxRenderMate(); fxFillMateFields();
}
function fxRenderAll(){
  fxRenderCycle(); fxRenderBonus(); fxRenderPayBreak(); fxRenderMate(); fxRenderDeductions();
}

window.fxInit = fxInit;
window.fxRenderAll = fxRenderAll;
window.fxShareLink = fxShareLink;

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => { try{ fxInit(); }catch(e){ console.warn('fx', e); } });
}else{
  try{ fxInit(); }catch(e){ console.warn('fx', e); }
}
})();

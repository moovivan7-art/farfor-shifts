/* ═══════════════════════════════════════════════════════════
   КОМАНДА ФАРФОР — учёт смен, часов и зарплаты
   Всё хранится локально на телефоне. Без сети, без аккаунтов.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const KEY = 'farfor.shifts.v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ─────────────── ПРАЗДНИКИ РФ ─────────────── */
// Производственный календарь РФ на 2026 (Постановление Правительства №1466 от 24.09.2025)
const HOLIDAY_SETS = {
  '2026': {
    off: {
      '2026-01-01':'Новогодние каникулы', '2026-01-02':'Новогодние каникулы',
      '2026-01-03':'Новогодние каникулы', '2026-01-04':'Новогодние каникулы',
      '2026-01-05':'Новогодние каникулы', '2026-01-06':'Новогодние каникулы',
      '2026-01-07':'Рождество Христово',  '2026-01-08':'Новогодние каникулы',
      '2026-01-09':'Перенос выходного (с 3 января)',
      '2026-02-21':'День защитника Отечества', '2026-02-22':'День защитника Отечества',
      '2026-02-23':'День защитника Отечества',
      '2026-03-07':'8 Марта', '2026-03-08':'8 Марта', '2026-03-09':'8 Марта',
      '2026-05-01':'Праздник Весны и Труда', '2026-05-02':'Праздник Весны и Труда',
      '2026-05-03':'Праздник Весны и Труда',
      '2026-05-09':'День Победы', '2026-05-10':'День Победы', '2026-05-11':'День Победы',
      '2026-06-12':'День России', '2026-06-13':'День России', '2026-06-14':'День России',
      '2026-11-04':'День народного единства',
      '2026-12-31':'Перенос выходного (с 4 января)'
    },
    short5: ['2026-04-30','2026-05-08','2026-06-11','2026-11-03'],
    short6: ['2026-03-07','2026-04-30','2026-05-08','2026-06-11','2026-11-03']
  },
  '2027': {
    off: {
      '2027-01-01':'Новогодние каникулы','2027-01-02':'Новогодние каникулы',
      '2027-01-03':'Новогодние каникулы','2027-01-04':'Новогодние каникулы',
      '2027-01-05':'Новогодние каникулы','2027-01-06':'Новогодние каникулы',
      '2027-01-07':'Рождество Христово','2027-01-08':'Новогодние каникулы',
      '2027-02-23':'День защитника Отечества','2027-03-08':'8 Марта',
      '2027-05-01':'Праздник Весны и Труда','2027-05-09':'День Победы',
      '2027-06-12':'День России','2027-11-04':'День народного единства'
    },
    short5: [], short6: []
  }
};
const holidayOff = d => HOLIDAY_SETS[d.slice(0,4)]?.off[d] || null;
const isHoliday  = d => !!holidayOff(d);
const isShort    = (d, mode) => (HOLIDAY_SETS[d.slice(0,4)]?.[mode === '6' ? 'short6' : 'short5'] || []).includes(d);

/* ─────────────── ПАТТЕРНЫ ГРАФИКА ─────────────── */
const PATTERNS = [
  { id:'1-1', w:1, o:1, desc:'сутки через день' },
  { id:'1-2', w:1, o:2, desc:'день, потом 2 отдыха' },
  { id:'2-2', w:2, o:2, desc:'классика: 2 смены — 2 дня' },
  { id:'2-3', w:2, o:3, desc:'2 смены — 3 дня дома' },
  { id:'3-3', w:3, o:3, desc:'три смены — три дня' },
  { id:'5-2', w:5, o:2, desc:'пятидневка' },
  { id:'6-1', w:6, o:1, desc:'шестидневка' },
  { id:'7-1', w:7, o:1, desc:'через день' }
];

/* ─────────────── ХРАНИЛИЩЕ ─────────────── */
const DEFAULTS = {
  profile: { name:'', rate:350, hours:12, point:'', payday:10, nightPct:20, holPct:100 },
  shifts: {},
  plan: { pattern:'2-2', start:'', hours:12, shortMode:'6' },
  ui: { range:'month', theme:'dark', tabRange:'month' }
};
let S = load();

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw);
    return {
      profile: Object.assign({}, DEFAULTS.profile, p.profile || {}),
      shifts: p.shifts || {},
      plan: Object.assign({}, DEFAULTS.plan, p.plan || {}),
      ui: Object.assign({}, DEFAULTS.ui, p.ui || {})
    };
  }catch(e){ return structuredClone(DEFAULTS); }
}
function applyTheme(){
  const t = (S.ui && S.ui.theme) || 'dark';
  document.body.dataset.theme = t;
  const b = $('#themeBtn'); if(b) b.textContent = t === 'dark' ? '☀' : '☾';
  $$('#themeChips .chip').forEach(c => c.classList.toggle('on', c.dataset.theme === t));
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ toast('Не удалось сохранить: нет места в памяти'); }
}
function resetAll(){
  S = structuredClone(DEFAULTS); save(); renderAll(); toast('Всё сброшено');
}

/* ─────────────── УТИЛИТЫ ─────────────── */
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const today = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const todayISO = () => iso(today());
const money = n => (Math.round(n)||0).toLocaleString('ru-RU') + ' ₽';
const moneyShort = n => {
  n = Math.round(n||0);
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(1).replace('.',',') + ' млн ₽';
  if (Math.abs(n) >= 10000) return Math.round(n/1000) + ' тыс ₽';
  return n.toLocaleString('ru-RU') + ' ₽';
};
const plural = (n, a, b, c) => {
  n = Math.abs(n) % 100; const n1 = n % 10;
  if (n > 10 && n < 20) return c;
  if (n1 > 1 && n1 < 5) return b;
  if (n1 === 1) return a;
  return c;
};
const fmtDay = d => d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
const fmtDayShort = d => d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
const WEEK = ['вс','пн','вт','ср','чт','пт','сб'];

/* ─────────────── СМЕНЫ ─────────────── */
const SLOTS = [
  { id:'morning', label:'Утро 07–15', night:false },
  { id:'day',     label:'День 11–19',  night:false },
  { id:'evening', label:'Вечер 17–01', night:false },
  { id:'night',   label:'Ночь 23–07',  night:true  }
];
const getShift = d => S.shifts[d] || null;
function shiftMoney(sh, date){
  if(!sh || sh.kind !== 'work') return 0;
  const d = date || '';
  const base = (sh.rate ?? S.profile.rate) * (sh.hours || 0);
  let add = 0;
  const slot = SLOTS.find(s => s.id === (sh.slot || 'day'));
  if(slot && slot.night) add += base * (S.profile.nightPct || 0) / 100;
  if(d && isHoliday(d)) add += base * (S.profile.holPct || 0) / 100;
  return base + add + (sh.bonus || 0);
}
function rangeSum(from, to){
  let money_ = 0, hours = 0, shifts = 0;
  for(const [d, sh] of Object.entries(S.shifts)){
    if(d < from || d > to) continue;
    if(sh.kind === 'work'){ money_ += shiftMoney(sh, d); hours += sh.hours || 0; shifts++; }
  }
  return { money: money_, hours, shifts };
}
function monthKey(d){ return d.slice(0,7); }
function monthRange(ym){
  const [y,m] = ym.split('-').map(Number);
  const a = new Date(y, m-1, 1), b = new Date(y, m, 0);
  return { from: iso(a), to: iso(b), days: b.getDate() };
}
function plannedShifts(from, to){
  // сколько смен по текущему графику в период
  const p = PATTERNS.find(x => x.id === S.plan.pattern) || PATTERNS[2];
  const start = S.plan.start ? fromIso(S.plan.start) : fromIso(from);
  const cyc = p.w + p.o, out = [];
  let d = new Date(start);
  if (d < fromIso(from)) {
    const diff = Math.floor((fromIso(from) - d) / 86400000);
    d = addDays(d, diff - (diff % cyc));
  }
  while (d <= fromIso(to)){
    const idx = Math.floor((d - start) / 86400000) % cyc;
    if (idx < p.w) out.push(iso(d));
    d = addDays(d, 1);
  }
  return out;
}

/* ─────────────── ТОСТ ─────────────── */
let toastT;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ─────────────── ЗАСТАВКА ─────────────── */
function initSplash(){
  const sp = $('#splash');
  const go = () => { sp.classList.add('hide'); setTimeout(() => sp.remove(), 500); };
  $('#splashSkip').onclick = go;
  sp.onclick = e => { if(e.target === sp) go(); };
  setTimeout(go, 3900);
}

/* ─────────────── ТАБЫ ─────────────── */
function initTabs(){
  $$('.tabbar button').forEach(b => b.onclick = () => {
    $$('.tabbar button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const v = b.dataset.tab;
    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
    window.scrollTo(0,0);
    if(v === 'cal') renderCal();
    if(v === 'sched') renderSched();
    if(v === 'stats') renderStats();
    if(v === 'tab') renderTab();
    if(v === 'set') renderSet();
    if(v === 'home') renderHome();
  });
}

/* ─────────────── ГЛАВНАЯ ─────────────── */
function renderHome(){
  const t = today(), ti = todayISO();
  const now = new Date();
  const prof = S.profile;
  $('#tbRate').textContent = prof.rate || 0;
  $('#heroHi').textContent = prof.name ? `Привет, ${prof.name}` : 'Привет';
  $('#heroDate').textContent = now.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' });

  const sh = getShift(ti);
  $('#heroShift').textContent = sh ? (sh.kind === 'work' ? sh.hours + ' ч' : ({off:'отдых', vacation:'отпуск', sick:'больничный'})[sh.kind] || '—') : 'не отмечена';
  $('#heroAmt').textContent = sh && sh.kind === 'work' ? money(shiftMoney(sh, ti)) : '0 ₽';
  $('#heroCap').textContent = sh && sh.kind === 'work' ? 'заработано сегодня' : (sh ? 'сегодня — выходной' : 'смену не отмечал');

  const m = monthRange(monthKey(ti));
  const ms = rangeSum(m.from, m.to);
  $('#heroMonth').textContent = moneyShort(ms.money);
  const payDayN = (() => {
    let pd = new Date(now.getFullYear(), now.getMonth(), S.profile.payday || 10);
    if(pd < now) pd = new Date(now.getFullYear(), now.getMonth()+1, S.profile.payday || 10);
    return Math.max(0, Math.ceil((pd - now) / 86400000));
  })();
  $('#heroLeft').textContent = payDayN + ' ' + plural(payDayN,'день','дня','дней');
  $('#stMonth').textContent = moneyShort(ms.money);
  $('#stWeek').textContent = moneyShort(rangeSum(iso(addDays(t,-6)), ti).money);
  const all = rangeSum('0000-01-01','9999-12-31');
  $('#stAll').textContent = moneyShort(all.money);
  $('#stShifts').textContent = all.shifts;
  const target = Math.max(1, ms.money + (S.profile.rate||0) * (S.profile.hours||0) * 4);
  $('#heroBar').style.width = Math.min(100, ms.money / target * 100) + '%';

  /* прогноз до зарплаты */
  const payday = S.profile.payday || 10;
  let payDate = new Date(now.getFullYear(), now.getMonth(), payday);
  if (payDate < now) payDate = new Date(now.getFullYear(), now.getMonth()+1, payday);
  const periodFrom = iso(new Date(payDate.getFullYear(), payDate.getMonth(), 1));
  const fact = rangeSum(periodFrom, iso(addDays(payDate,-1))).money;
  const planned = plannedShifts(periodFrom, iso(payDate)).length;
  const planMoney = planned * (S.profile.rate||0) * (S.plan.hours||12);
  const total = fact + planMoney;
  $('#fcFact').textContent = money(fact);
  $('#fcPlan').textContent = money(planMoney) + ` (${planned} ${plural(planned,'смена','смены','смен')})`;
  $('#fcTotal').textContent = money(total);
  $('#fcBar').style.width = Math.min(100, (fact / Math.max(1,total)) * 100) + '%';
  $('#fcNote').textContent = `Зарплата ${payday}-го числа. До неё ${Math.max(0, Math.ceil((payDate - now)/86400000))} ${plural(Math.ceil((payDate-now)/86400000),'день','дня','дней')}.`;
  $('#payPill').textContent = `зарплата ${payday}-го`;

  /* серия смен подряд */
  let streak = 0;
  for(let i = 0; i < 400; i++){
    const d = iso(addDays(t, -i));
    const s = getShift(d);
    if(s && s.kind === 'work') streak++;
    else if(i === 0 && s && s.kind === 'off') continue;
    else break;
  }
  $('#streakVal').textContent = streak;
  $('#streakTxt').textContent = streak ? 'смен подряд' : 'начни серию';

  /* сравнение с прошлым месяцем */
  const pm = monthRange(monthKey(iso(new Date(t.getFullYear(), t.getMonth()-1, 1))));
  const prev = rangeSum(pm.from, pm.to).money;
  const diff = ms.money - prev;
  const dpct = prev > 0 ? Math.round(diff / prev * 100) : null;
  $('#deltaVal').textContent = prev > 0 ? (diff >= 0 ? '+' : '−') + Math.abs(dpct) + '%' : (diff > 0 ? '+' + moneyShort(diff) : '—');
  $('#deltaVal').style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  $('#deltaTxt').textContent = prev > 0 ? 'к прошлому месяцу' : 'прошлый месяц пустой';

  /* ближайшие смены */
  const list = [];
  for(let i = 0; i < 30; i++){
    const d = iso(addDays(t,i));
    const s = getShift(d);
    if(s && s.kind === 'work') list.push({ d, s });
    if(list.length >= 5) break;
  }
  $('#nextPill').textContent = list.length ? list.length + ' ' + plural(list.length,'смена','смены','смен') : '';
  $('#nextList').innerHTML = list.length ? list.map(({d,s}) => {
    const dt = fromIso(d);
    return `<div class="li"><div class="li-d"><b>${dt.getDate()}</b><span>${WEEK[dt.getDay()]}</span></div>
      <div class="li-t"><b>${s.hours} ч${(s.bonus? ' + ' + money(s.bonus) : '')}</b><span>${fmtDayShort(dt)}${s.note? ' · '+s.note : ''}</span></div>
      <div class="li-m">${moneyShort(shiftMoney(s, d))}</div></div>`;
  }).join('') : '<div class="empty">Пока нет отмеченных смен — жми «Отметить смену»</div>';
}

/* ─────────────── КАЛЕНДАРЬ ─────────────── */
let calY, calM;
function initCal(){
  const n = today();
  calY = n.getFullYear(); calM = n.getMonth();
  $$('[data-cal]').forEach(b => b.onclick = () => {
    const a = b.dataset.cal;
    if(a === 'prev'){ calM--; if(calM < 0){ calM = 11; calY--; } }
    if(a === 'next'){ calM++; if(calM > 11){ calM = 0; calY++; } }
    if(a === 'fill') fillMonthByPattern();
    if(a === 'clear') clearMonth();
    renderCal();
  });
}
function renderCal(){
  const cm = new Date(calY, calM, 1).toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  $('#calMonth').textContent = cm.charAt(0).toUpperCase() + cm.slice(1).replace(' г.', '');
  const first = new Date(calY, calM, 1);
  const lead = (first.getDay() + 6) % 7;           // пн = 0
  const days = new Date(calY, calM+1, 0).getDate();
  const cells = [];
  for(let i = 0; i < lead; i++) cells.push(null);
  for(let d = 1; d <= days; d++) cells.push(new Date(calY, calM, d));
  const tISO = todayISO();
  let hours = 0, cnt = 0, earn = 0;
  $('#calGrid').innerHTML = cells.map(dt => {
    if(!dt) return '<div class="day blank"></div>';
    const key = iso(dt), sh = getShift(key);
    const hol = holidayOff(key);
    const wknd = dt.getDay() === 0 || dt.getDay() === 6;
    let cls = 'day';
    if(hol) cls += ' hol';
    else if(wknd) cls += ' wknd';
    if(sh){
      if(sh.kind === 'work'){ cls += ' work'; hours += sh.hours || 0; cnt++; earn += shiftMoney(sh); }
      else if(sh.kind === 'vacation' || sh.kind === 'sick') cls += ' vac';
      else cls += ' off';
    }
    if(key === tISO) cls += ' today';
    const short = isShort(key, S.plan.shortMode);
    const hh = sh && sh.kind === 'work' ? `<i class="dh">${sh.hours}ч</i>` : (short ? '<i class="dh">−1ч</i>' : '');
    return `<div class="${cls}" data-day="${key}"><i class="dn">${dt.getDate()}</i>${hh}</div>`;
  }).join('');
  $$('#calGrid .day[data-day]').forEach(el => el.onclick = () => openSheet(el.dataset.day));
  const ym = `${calY}-${pad(calM+1)}`;
  const r = monthRange(ym);
  const s = rangeSum(r.from, r.to);
  const holCount = Object.keys(HOLIDAY_SETS[ym.slice(0,4)]?.off || {}).filter(d => d.startsWith(ym)).length;
  $('#calSum').innerHTML = `<span>Смен: <b>${s.shifts}</b> · ${s.hours} ч</span><span>Заработано: <b>${moneyShort(s.money)}</b></span><span>Праздников: <b>${holCount}</b></span>`;
}
function fillMonthByPattern(){
  const ym = `${calY}-${pad(calM+1)}`, r = monthRange(ym);
  const days = plannedShifts(r.from, r.to);
  let added = 0;
  days.forEach(d => {
    const ex = getShift(d);
    if(ex && (ex.kind === 'vacation' || ex.kind === 'sick')) return;
    S.shifts[d] = { kind:'work', hours:S.plan.hours || 12, rate:S.profile.rate, bonus:0, note:'', slot:'day' };
    added++;
  });
  save(); renderCal(); toast(`Заполнено смен: ${added}`);
}
function clearMonth(){
  const ym = `${calY}-${pad(calM+1)}`, r = monthRange(ym);
  let n = 0;
  Object.keys(S.shifts).forEach(d => {
    if(d >= r.from && d <= r.to){ delete S.shifts[d]; n++; }
  });
  save(); renderCal(); toast(`Удалено записей: ${n}`);
}

/* ─────────────── ШТОРКА ДНЯ ─────────────── */
let sheetDate = null, sheetKind = 'work', sheetSlot = 'day', sheetShort = 0;

function openSheet(date){
  sheetDate = date;
  const dt = fromIso(date);
  const sh = getShift(date);
  sheetKind = sh ? sh.kind : 'work';
  sheetSlot = (sh && sh.slot) || 'day';
  sheetShort = sh ? (sh.shortApplied ? 1 : 0) : (isShort(date, S.plan.shortMode) ? 1 : 0);

  $('#shDate').textContent = dt.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const hol = holidayOff(date);
  let ht = hol ? ('🎉 ' + hol) : (dt.getDay() === 0 || dt.getDay() === 6 ? 'Выходной' : '');
  if(isShort(date, S.plan.shortMode)) ht += (ht ? ' · ' : '') + 'предпраздничный: −1 час';
  $('#shHol').textContent = ht;
  $('#shHol').style.color = hol ? 'var(--acc2)' : 'var(--mut2)';

  $$('#kindChips button').forEach(b => b.classList.toggle('on', b.dataset.kind === sheetKind));
  const defH = (sh && sh.hours) || Math.max(1, (S.profile.hours || 12) - (sheetShort ? 1 : 0));
  renderHourChips(defH);
  renderSlotChips();
  renderShortChips();
  $('#shRate').value = (sh && sh.rate != null) ? sh.rate : S.profile.rate;
  $('#shBonus').value = (sh && sh.bonus) || 0;
  $('#shNote').value = (sh && sh.note) || '';
  $('#hoursField').style.display = sheetKind === 'work' ? '' : 'none';
  $('#slotField').style.display  = sheetKind === 'work' ? '' : 'none';
  $('#shortField').style.display = sheetKind === 'work' ? '' : 'none';
  updateSheetSum();
  $('#sheetWrap').classList.add('on');
}
function renderHourChips(h){
  const opts = [6,8,10,11,12,24];
  if(!opts.includes(h)) opts.push(h);
  opts.sort((a,b) => a-b);
  $('#hoursChips').innerHTML = opts.map(o => `<button class="chip${o===h?' on':''}" data-h="${o}">${o} ч</button>`).join('');
  $$('#hoursChips .chip').forEach(c => c.onclick = () => {
    $$('#hoursChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); updateSheetSum();
  });
}
function renderSlotChips(){
  $('#slotChips').innerHTML = SLOTS.map(sl =>
    `<button class="chip${sl.id===sheetSlot?' on':''}" data-slot="${sl.id}">${sl.label}</button>`).join('');
  $$('#slotChips .chip').forEach(c => c.onclick = () => {
    sheetSlot = c.dataset.slot;
    $$('#slotChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); updateSheetSum();
  });
}
function renderShortChips(){
  $$('#shortChips .chip').forEach(c => c.classList.toggle('on', (c.dataset.short === '1') === !!sheetShort));
}
function updateSheetSum(){
  const h = parseInt((($('#hoursChips .chip.on')||{}).dataset?.h) || 0);
  const rate = parseInt($('#shRate').value || 0);
  const bonus = parseInt($('#shBonus').value || 0);
  if(sheetKind !== 'work'){ $('#shSum').innerHTML = '<b>—</b><span>' + ({off:'выходной', vacation:'отпуск', sick:'больничный'}[sheetKind]||'—') + '</span>'; return; }
  const base = h * rate;
  const sl = SLOTS.find(x => x.id === sheetSlot);
  const nightAdd = sl && sl.night ? base * (S.profile.nightPct||0) / 100 : 0;
  const holAdd = isHoliday(sheetDate) ? base * (S.profile.holPct||0) / 100 : 0;
  const total = base + nightAdd + holAdd + bonus;
  const parts = [`${h} ч × ${rate} ₽`];
  if(nightAdd) parts.push(`ночь +${Math.round(S.profile.nightPct||0)}%`);
  if(holAdd) parts.push(`праздник +${Math.round(S.profile.holPct||0)}%`);
  if(bonus) parts.push('чаевые');
  $('#shSum').innerHTML = `<b>${money(total)}</b><span>${parts.join(' · ')}</span>`;
}
function initSheet(){
  $('#shClose').onclick = () => $('#sheetWrap').classList.remove('on');
  $('#sheetBg').onclick = () => $('#sheetWrap').classList.remove('on');
  $$('#kindChips button').forEach(b => b.onclick = () => {
    sheetKind = b.dataset.kind;
    $$('#kindChips button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const vis = sheetKind === 'work';
    $('#hoursField').style.display = vis ? '' : 'none';
    $('#slotField').style.display  = vis ? '' : 'none';
    $('#shortField').style.display = vis ? '' : 'none';
    updateSheetSum();
  });
  $$('#shortChips .chip').forEach(c => c.onclick = () => {
    const want = c.dataset.short === '1';
    const cur = parseInt((($('#hoursChips .chip.on')||{}).dataset?.h) || 0);
    const base = S.profile.hours || 12;
    if(want && !sheetShort && cur === base) renderHourChips(Math.max(1, base - 1));
    if(!want && sheetShort && cur === base - 1) renderHourChips(base);
    sheetShort = want ? 1 : 0;
    renderShortChips();
    updateSheetSum();
  });
  $('#shRate').oninput = updateSheetSum;
  $('#shBonus').oninput = updateSheetSum;
  $('#shSave').onclick = () => {
    const h = parseInt((($('#hoursChips .chip.on')||{}).dataset?.h) || S.profile.hours || 12);
    const rec = sheetKind === 'work'
      ? { kind:'work', hours:h, rate:parseInt($('#shRate').value||0), bonus:parseInt($('#shBonus').value||0),
          note:$('#shNote').value.trim(), slot:sheetSlot, shortApplied:!!sheetShort }
      : { kind:sheetKind, hours:0, rate:0, bonus:0, note:$('#shNote').value.trim() };
    S.shifts[sheetDate] = rec;
    save(); $('#sheetWrap').classList.remove('on');
    renderAll(); celebrate(); toast('Сохранено');
  };
  $('#shDel').onclick = () => {
    if(S.shifts[sheetDate]){ delete S.shifts[sheetDate]; save(); $('#sheetWrap').classList.remove('on'); renderAll(); toast('Удалено'); }
    else $('#sheetWrap').classList.remove('on');
  };
}

/* ─────────────── ОТЧЁТ ТЕКСТОМ ─────────────── */
function makeReport(){
  const m = monthRange(monthKey(todayISO()));
  const s = rangeSum(m.from, m.to);
  const kinds = { off:'выходной', vacation:'отпуск', sick:'больничный' };
  const lines = Object.keys(S.shifts).filter(d => d >= m.from && d <= m.to).sort().map(d => {
    const sh = S.shifts[d];
    const dd = fromIso(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
    if(sh.kind === 'work'){
      const sl = SLOTS.find(x => x.id === (sh.slot || 'day'));
      return `• ${dd} — ${sh.hours} ч (${sl ? sl.label.split(' ')[0] : 'день'}) — ${money(shiftMoney(sh, d))}`;
    }
    return `• ${dd} — ${kinds[sh.kind] || '—'}`;
  });
  const head = `📋 Табель за ${fromIso(m.from).toLocaleDateString('ru-RU', { month:'long', year:'numeric' })}
Смен: ${s.shifts} · часов: ${s.hours} · итого: ${money(s.money)}`;
  const tail = `Команда Фарфор · ${S.profile.point || 'FARFOR'}`;
  const txt = [head, '', ...lines, '', tail].join('\n');
  showTextModal('Отчёт за месяц', txt);
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(()=>toast('Отчёт скопирован')).catch(()=>{});
}
function showTextModal(title, txt){
  let m = $('#txtModal');
  if(!m){
    m = document.createElement('div');
    m.id = 'txtModal'; m.className = 'sheet-wrap';
    m.innerHTML = `<div class="sheet-bg"></div><div class="sheet"><div class="sh-head">
      <div><div class="sh-date"></div><div class="sh-hol"></div></div><button class="sh-x">✕</button></div>
      <pre class="txtbox"></pre><button class="btn primary txt-copy">Скопировать</button></div>`;
    document.body.appendChild(m);
    m.querySelector('.sh-bg').onclick = () => m.classList.remove('on');
    m.querySelector('.sh-x').onclick = () => m.classList.remove('on');
    m.querySelector('.txt-copy').onclick = () => {
      navigator.clipboard.writeText(m.querySelector('.txtbox').textContent)
        .then(()=>toast('Скопировано')).catch(()=>toast('Не удалось'));
    };
  }
  m.querySelector('.sh-date').textContent = title;
  m.querySelector('.sh-hol').textContent = 'можно скопировать и отправить';
  m.querySelector('.txtbox').textContent = txt;
  m.classList.add('on');
}

/* ─────────────── ТАБЕЛЬ ─────────────── */
let tabOff = 0;
function renderTab(){
  $$('#tabSeg button').forEach(b => b.classList.toggle('on', b.dataset.tr === (S.ui.tabRange || 'month')));
  let from, to, title;
  if((S.ui.tabRange || 'month') === 'month'){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + tabOff);
    const r = monthRange(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
    from = r.from; to = r.to; title = d.toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  }else if(S.ui.tabRange === 'q'){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2);
    from = iso(d); to = todayISO(); title = 'Последние 3 месяца';
  }else{
    const ks = Object.keys(S.shifts).sort();
    from = ks[0] || todayISO(); to = ks[ks.length-1] || todayISO(); title = 'Всё время';
  }
  $('#tabTitle').textContent = title;
  const days = Object.keys(S.shifts).filter(d => d >= from && d <= to).sort();
  const s = rangeSum(from, to);
  $('#tabList').innerHTML = days.length ? days.map(d => {
    const sh = S.shifts[d], dt = fromIso(d);
    const sl = SLOTS.find(x => x.id === (sh.slot || 'day'));
    const right = sh.kind === 'work'
      ? `<div class="li-m">${moneyShort(shiftMoney(sh, d))}</div>`
      : `<div class="li-m" style="color:var(--mut2)">${({off:'отдых', vacation:'отпуск', sick:'больничный'})[sh.kind] || ''}</div>`;
    const mid = sh.kind === 'work'
      ? `<b>${sh.hours} ч${sh.bonus ? ' · +' + moneyShort(sh.bonus) : ''}</b><span>${sl ? sl.label : 'смена'}${sh.note ? ' · ' + sh.note : ''}${isHoliday(d) ? ' · 🎉' : ''}</span>`
      : `<b>${({off:'Выходной', vacation:'Отпуск', sick:'Больничный'})[sh.kind] || '—'}</b><span>${sh.note || ''}</span>`;
    return `<div class="li"><div class="li-d"><b>${dt.getDate()}</b><span>${WEEK[dt.getDay()]}</span></div>
      <div class="li-t">${mid}</div>${right}</div>`;
  }).join('') : '<div class="empty">Пока пусто</div>';
  $('#tabSum').innerHTML = `<span>Смен: <b>${s.shifts}</b> · <b>${s.hours} ч</b></span><span>Итого: <b>${money(s.money)}</b></span>`;
}
function initTab(){
  $$('#tabSeg button').forEach(b => b.onclick = () => { S.ui.tabRange = b.dataset.tr; tabOff = 0; save(); renderTab(); });
  $$('[data-tab-range]').forEach(b => b.onclick = () => {
    tabOff += b.dataset.tabRange === 'next' ? 1 : -1; renderTab();
  });
}

/* ─────────────── АНИМАЦИЯ СОХРАНЕНИЯ ─────────────── */
function celebrate(){
  const host = document.createElement('div');
  host.className = 'confetti';
  host.innerHTML = Array.from({length:16}, (_,i) =>
    `<i style="--x:${(i*37)%100}%;--d:${(i%5)*0.08}s;--c:${['#fe5000','#ffc857','#4aa8ff','#2ecc71'][i%4]};--r:${(i*53)%360}deg"></i>`).join('');
  document.body.appendChild(host);
  setTimeout(()=>host.remove(), 1300);
}

/* ─────────────── ГРАФИК ─────────────── */
function initSched(){
  if(!S.plan.start) S.plan.start = todayISO();
  $('#schedStart').value = S.plan.start;
  $('#schedShort').value = S.plan.shortMode || '6';
  renderHourChipsForSched();
  $('#schedStart').onchange = e => { S.plan.start = e.target.value; save(); renderSched(); };
  $('#schedShort').onchange = e => { S.plan.shortMode = e.target.value; save(); renderSched(); };
  $$('#schedHours .chip').forEach(c => c.onclick = () => {
    S.plan.hours = parseInt(c.dataset.h); save();
    $$('#schedHours .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); renderSched();
  });
  $$('[data-act="apply-sched"]').forEach(b => b.onclick = applyPattern);
}
function renderHourChipsForSched(){
  const opts = [6,8,10,11,12,24];
  $('#schedHours').innerHTML = opts.map(o => `<button class="chip${o===(S.plan.hours||12)?' on':''}" data-h="${o}">${o} ч</button>`).join('');
}
function renderSched(){
  const p = PATTERNS.find(x => x.id === S.plan.pattern) || PATTERNS[2];
  $('#schedPill').textContent = p.id;
  $('#pats').innerHTML = PATTERNS.map(x => {
    const viz = [];
    for(let i = 0; i < x.w + x.o; i++) viz.push(`<i class="${i < x.w ? 'w' : ''}"></i>`);
    const per = x.w + x.o;
    const perMonth = 30 / per * x.w;
    const est = Math.round(perMonth * (S.plan.hours||12) * (S.profile.rate||0));
    return `<button class="pat${x.id === S.plan.pattern ? ' on' : ''}" data-pat="${x.id}">
      <span class="pat-viz">${viz.join('')}</span>
      <span class="pat-txt"><b>${x.id}</b><span>${x.desc}</span></span>
      <span class="pat-est">≈ ${moneyShort(est)}/мес</span></button>`;
  }).join('');
  $$('#pats .pat').forEach(b => b.onclick = () => { S.plan.pattern = b.dataset.pat; save(); renderSched(); });
  renderSchedPreview();
}
function renderSchedPreview(){
  const from = S.plan.start || todayISO();
  const to = iso(addDays(fromIso(from), 41));
  const days = plannedShifts(from, to);
  const set = new Set(days);
  const cells = [];
  for(let i = 0; i < 42; i++){
    const d = iso(addDays(fromIso(from), i));
    const w = set.has(d);
    cells.push(`<div class="pv ${w ? 'w' : 'o'}">${fromIso(d).getDate()}</div>`);
  }
  const hours = days.length * (S.plan.hours||12);
  const money_ = hours * (S.profile.rate||0);
  $('#prevPill').textContent = `${days.length} смен за 6 недель`;
  $('#schedPreview').innerHTML = `<div class="preview-grid">${cells.join('')}</div>
    <div class="preview-cap">6 недель с ${fmtDayShort(fromIso(from))} · <b>${hours} ч</b> · <b>${money(money_)}</b></div>`;
}
function applyPattern(){
  const from = S.plan.start || todayISO();
  const to = iso(addDays(fromIso(from), 89));
  const days = plannedShifts(from, to);
  let n = 0;
  days.forEach(d => {
    const ex = getShift(d);
    if(ex && (ex.kind === 'vacation' || ex.kind === 'sick')) return;
    S.shifts[d] = { kind:'work', hours:S.plan.hours || 12, rate:S.profile.rate, bonus:0, note:'', slot:'day' };
    n++;
  });
  // выходные тоже помечаем, чтобы в календаре было видно ритм
  let off = 0;
  const p = PATTERNS.find(x => x.id === S.plan.pattern) || PATTERNS[2];
  const start = fromIso(from), cyc = p.w + p.o;
  for(let i = 0; i < 90; i++){
    const d = iso(addDays(start, i));
    if(days.includes(d)) continue;
    const ex = getShift(d);
    if(ex && (ex.kind === 'vacation' || ex.kind === 'sick')) continue;
    if(Math.floor((fromIso(d) - start)/86400000) % cyc >= p.w){
      S.shifts[d] = { kind:'off', hours:0, rate:0, bonus:0, note:'' }; off++;
    }
  }
  save(); renderAll();
  toast(`График ${p.id}: ${n} ${plural(n,'смена','смены','смен')} на 3 месяца`);
}

/* ─────────────── СТАТИСТИКА ─────────────── */
function initStats(){
  $$('#statsSeg button').forEach(b => b.onclick = () => {
    $$('#statsSeg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); S.ui.range = b.dataset.range; save(); renderStats();
  });
}
function rangeBounds(){
  const t = today();
  if(S.ui.range === 'month'){ const r = monthRange(monthKey(todayISO())); return {...r, label:'месяц', group:'day'}; }
  if(S.ui.range === 'q'){ const f = new Date(t.getFullYear(), t.getMonth()-2, 1); return { from: iso(f), to: iso(t), label:'3 месяца', group:'month' }; }
  if(S.ui.range === 'year'){ const f = new Date(t.getFullYear(), 0, 1); return { from: iso(f), to: iso(t), label:'год', group:'month' }; }
  const ks = Object.keys(S.shifts).sort();
  return { from: ks[0] || todayISO(), to: ks[ks.length-1] || todayISO(), label:'всё время', group:'month' };
}
function renderStats(){
  $$('#statsSeg button').forEach(b => b.classList.toggle('on', b.dataset.range === S.ui.range));
  const b = rangeBounds();
  const s = rangeSum(b.from, b.to);
  $('#chartPill').textContent = `${moneyShort(s.money)} · ${s.shifts} ${plural(s.shifts,'смена','смены','смен')}`;

  /* ── bars ── */
  const W = 320, H = 150, pl = 34, pb = 26, pt = 10;
  let bars = [], labels = [];
  if(b.group === 'day'){
    const m = monthRange(monthKey(b.from));
    for(let d = 1; d <= new Date(+m.from.slice(0,4), +m.from.slice(5,7), 0).getDate(); d++){
      const key = `${m.from.slice(0,7)}-${pad(d)}`;
      bars.push(rangeSum(key, key).money);
      labels.push(String(d));
    }
  }else{
    const map = new Map();
    Object.keys(S.shifts).forEach(d => {
      if(d < b.from || d > b.to) return;
      const k = monthKey(d);
      map.set(k, (map.get(k) || 0) + shiftMoney(S.shifts[d], d));
    });
    [...map.keys()].sort().forEach(k => {
      bars.push(map.get(k));
      const [y,m] = k.split('-');
      labels.push(new Date(+y, +m-1, 1).toLocaleDateString('ru-RU', { month:'short' }));
    });
  }
  const maxB = Math.max(1, ...bars);
  const iw = W - pl - 8, ih = H - pb - pt;
  const bw = Math.max(2, Math.min(26, iw / Math.max(1, bars.length) - 3));
  const step = iw / Math.max(1, bars.length);
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  for(let i = 0; i <= 3; i++){
    const y = pt + ih - ih * i / 3;
    svg += `<line x1="${pl}" y1="${y}" x2="${W-4}" y2="${y}" stroke="#2b2f39" stroke-width="1"/>
            <text x="${pl-5}" y="${y+3.5}" fill="#6b7280" font-size="8" text-anchor="end">${moneyShort(maxB*i/3).replace(' ₽','')}</text>`;
  }
  bars.forEach((v, i) => {
    const h = (v / maxB) * ih;
    const x = pl + i * step + (step - bw) / 2;
    const y = pt + ih - h;
    const isNow = b.group === 'day' && labels[i] === String(today().getDate());
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.5,h).toFixed(1)}" rx="${Math.min(4,bw/2).toFixed(1)}"
            fill="${isNow ? '#ffc857' : 'url(#bg1)'}"/>`;
    const showLbl = bars.length <= 16 || v === maxB;
    if(v > 0 && showLbl) svg += `<text x="${(x+bw/2).toFixed(1)}" y="${(y-3).toFixed(1)}" fill="#9aa1ae" font-size="7" text-anchor="middle">${moneyShort(v).replace(' ₽','')}</text>`;
  });
  const every = Math.ceil(labels.length / 12);
  labels.forEach((l, i) => { if(i % every === 0) svg += `<text x="${(pl+i*step+step/2).toFixed(1)}" y="${H-8}" fill="#6b7280" font-size="8" text-anchor="middle">${l}</text>`; });
  svg += `<defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="#fe5000"/></linearGradient></defs></svg>`;
  $('#chartBars').innerHTML = svg;

  /* ── line: факт vs график ── */
  const m2 = monthRange(monthKey(todayISO()));
  const daysN = new Date(+m2.from.slice(0,4), +m2.from.slice(5,7), 0).getDate();
  const planDays = plannedShifts(m2.from, m2.to);
  const planSet = new Set(planDays);
  const rate = S.profile.rate || 0, ph = S.plan.hours || 12;
  let fact = 0, plan = 0;
  const fPts = [], pPts = [];
  const LW = 320, LH = 150, lpl = 34, lpt = 10, lib = 26;
  const liw = LW - lpl - 8, lih = LH - lpt - lib;
  for(let i = 0; i < daysN; i++){
    const key = `${m2.from.slice(0,7)}-${pad(i+1)}`;
    fact += rangeSum(key, key).money;
    if(planSet.has(key)) plan += rate * ph;
    const x = lpl + liw * (i / Math.max(1, daysN - 1));
    const yF = lpt + lih - (fact / Math.max(1, plan, fact)) * lih;
    const yP = lpt + lih - (plan / Math.max(1, plan, fact)) * lih;
    fPts.push([x, yF]); pPts.push([x, yP]);
  }
  const lmax = Math.max(1, plan, fact);
  let l2 = `<svg viewBox="0 0 ${LW} ${LH}">`;
  for(let i = 0; i <= 3; i++){
    const y = lpt + lih - lih * i / 3;
    l2 += `<line x1="${lpl}" y1="${y}" x2="${LW-4}" y2="${y}" stroke="#2b2f39"/><text x="${lpl-5}" y="${y+3.5}" fill="#6b7280" font-size="8" text-anchor="end">${moneyShort(lmax*i/3).replace(' ₽','')}</text>`;
  }
  const area = fPts.map((p,i) => `${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') +
               `L${fPts[fPts.length-1][0].toFixed(1)} ${(lpt+lih).toFixed(1)} L${fPts[0][0].toFixed(1)} ${(lpt+lih).toFixed(1)} Z`;
  l2 += `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fe5000" stop-opacity=".35"/><stop offset="1" stop-color="#fe5000" stop-opacity="0"/></linearGradient></defs>`;
  l2 += `<path d="${area}" fill="url(#ag)"/>`;
  l2 += `<path d="${pPts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}" fill="none" stroke="#4aa8ff" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  l2 += `<path d="${fPts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}" fill="none" stroke="#fe5000" stroke-width="2.4" stroke-linecap="round"/>`;
  l2 += `<circle cx="${fPts[fPts.length-1][0].toFixed(1)}" cy="${fPts[fPts.length-1][1].toFixed(1)}" r="3.6" fill="#ffc857"/>`;
  l2 += `<text x="${lpl}" y="${LH-8}" fill="#6b7280" font-size="8">1-е</text><text x="${LW-10}" y="${LH-8}" fill="#6b7280" font-size="8" text-anchor="end">${daysN}-е</text>`;
  l2 += `<rect x="${LW-88}" y="${lpt-2}" width="86" height="15" rx="7" fill="#1b1d24" stroke="#2b2f39"/>`;
  l2 += `<line x1="${LW-82}" y1="${lpt+5.5}" x2="${LW-72}" y2="${lpt+5.5}" stroke="#fe5000" stroke-width="2.4"/><text x="${LW-69}" y="${lpt+9}" fill="#9aa1ae" font-size="8">факт</text>`;
  l2 += `<line x1="${LW-40}" y1="${lpt+5.5}" x2="${LW-30}" y2="${lpt+5.5}" stroke="#4aa8ff" stroke-width="1.8" stroke-dasharray="3 2"/><text x="${LW-27}" y="${lpt+9}" fill="#9aa1ae" font-size="8">график</text></svg>`;
  $('#chartLine').innerHTML = l2;

  /* ── donut ── */
  const kinds = { work:0, vacation:0, sick:0, off:0 };
  Object.entries(S.shifts).forEach(([d, sh]) => {
    if(d < b.from || d > b.to) return;
    if(kinds[sh.kind] != null) kinds[sh.kind]++;
  });
  const tot = Object.values(kinds).reduce((a,c) => a+c, 0);
  const cols = { work:'#fe5000', vacation:'#4aa8ff', sick:'#ffc857', off:'#3a3f4b' };
  const names = { work:'Смены', vacation:'Отпуск/больничный', sick:'Отпуск/больничный', off:'Отдых' };
  let ang = -Math.PI/2, segs = '';
  const R = 52, r = 33, cx = 60, cy = 60;
  if(tot > 0){
    Object.keys(kinds).forEach(k => {
      if(!kinds[k]) return;
      const a2 = ang + (kinds[k]/tot) * Math.PI * 2;
      const big = (a2-ang) > Math.PI ? 1 : 0;
      const p = (rad, a) => [cx + rad*Math.cos(a), cy + rad*Math.sin(a)];
      const [x1,y1] = p(R, ang), [x2,y2] = p(R, a2), [x3,y3] = p(r, a2), [x4,y4] = p(r, ang);
      segs += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${big} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${r} ${r} 0 ${big} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z" fill="${cols[k]}"/>`;
      ang = a2;
    });
  }
  $('#chartDonut').innerHTML = `<svg viewBox="0 0 120 120" style="max-width:150px;margin:0 auto">
    ${segs}<text x="60" y="56" text-anchor="middle" fill="#f4f5f7" font-size="19" font-weight="800">${tot}</text>
    <text x="60" y="70" text-anchor="middle" fill="#6b7280" font-size="8">дней</text></svg>
    <div class="break" style="margin-top:12px">${Object.keys(kinds).map(k => `
      <div class="br"><span><i class="lg" style="background:${cols[k]}"></i> ${names[k]}</span><b>${kinds[k]}</b></div>`).join('')}</div>`;

  const best = Object.entries(S.shifts).filter(([d,sh]) => d >= b.from && d <= b.to && sh.kind === 'work')
    .sort((a,c) => shiftMoney(c[1], c[0]) - shiftMoney(a[1], a[0]))[0];
  const perShift = s.shifts ? Math.round(s.money / s.shifts) : 0;
  const perHour = s.hours ? Math.round(s.money / s.hours) : 0;
  $('#statsBreak').innerHTML = `
    <div class="br"><span>Средняя за смену</span><b>${money(perShift)}</b></div>
    <div class="br"><span>Средняя в час</span><b>${money(perHour)}</b></div>
    <div class="br"><span>Лучший день</span><b>${best ? fmtDayShort(fromIso(best[0])) + ' · ' + moneyShort(shiftMoney(best[1], best[0])) : '—'}</b></div>`;
}

/* ─────────────── НАСТРОЙКИ ─────────────── */
function renderSet(){
  $('#fName').value = S.profile.name || '';
  $('#fRate').value = S.profile.rate || 0;
  $('#fHours').value = S.profile.hours || 12;
  $('#fPoint').value = S.profile.point || '';
  $('#fPayday').value = String(S.profile.payday || 10);
  $('#fNight').value = S.profile.nightPct ?? 20;
  $('#fHol').value = S.profile.holPct ?? 100;
  applyTheme();
  $('#abCount').textContent = Object.keys(S.shifts).length + ' ' + plural(Object.keys(S.shifts).length,'запись','записи','записей');
}
function initSet(){
  const tb = $('#themeBtn');
  if(tb) tb.onclick = () => {
    S.ui.theme = (S.ui.theme === 'light') ? 'dark' : 'light';
    save(); applyTheme(); toast(S.ui.theme === 'light' ? '☀ Светлая тема' : '🌙 Тёмная тема');
  };
  $$('#themeChips .chip').forEach(c => c.onclick = () => {
    S.ui.theme = c.dataset.theme; save(); applyTheme();
  });
  const bind = (sel, key, cast = v => v) => {
    const el = $(sel);
    el.onchange = () => { S.profile[key] = cast(el.value); save(); renderAll(); toast('Сохранено'); };
  };
  bind('#fName','name'); bind('#fRate','rate', v => parseInt(v||0)); bind('#fHours','hours', v => parseInt(v||1));
  bind('#fPoint','point'); bind('#fPayday','payday', v => parseInt(v||10));
  bind('#fNight','nightPct', v => parseInt(v||0)); bind('#fHol','holPct', v => parseInt(v||0));
  $$('[data-act="exp-json"]').forEach(b => b.onclick = exportJSON);
  $$('[data-act="exp-csv"]').forEach(b => b.onclick = exportCSV);
  $$('[data-act="imp-json"]').forEach(b => b.onclick = () => $('#impFile').click());
  $$('[data-act="copy-backup"]').forEach(b => b.onclick = copyBackup);
  $$('[data-act="reset"]').forEach(b => b.onclick = () => {
    if(confirm('Удалить все смены и настройки? Действие необратимо.')) resetAll();
  });
  $('#impFile').onchange = e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => { try{ importJSON(r.result); }catch(err){ toast('Файл не подходит'); } };
    r.readAsText(f);
    e.target.value = '';
  };
}
function download(name, text, type){
  const b = new Blob([text], { type });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
  toast('Файл сохранён');
}
function exportJSON(){
  download(`farfor-shifts-${todayISO()}.json`, JSON.stringify(S, null, 2), 'application/json');
}
function exportCSV(){
  const rows = [['Дата','Тип','Часы','Ставка','Чаевые','Заметка','Сумма']];
  Object.keys(S.shifts).sort().forEach(d => {
    const s = S.shifts[d];
    rows.push([d, s.kind, s.hours||0, s.rate||0, s.bonus||0, (s.note||'').replace(/;/g,','), shiftMoney(s)]);
  });
  download(`farfor-shifts-${todayISO()}.csv`, '\uFEFF' + rows.map(r => r.join(';')).join('\n'), 'text/csv');
}
function copyBackup(){
  const txt = JSON.stringify(S);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(() => toast('Резервная копия в буфере'), () => toast('Не удалось скопировать'));
  }else toast('Буфер недоступен');
}
function importJSON(txt){
  const p = JSON.parse(txt);
  if(!p || typeof p !== 'object' || !p.shifts) throw new Error('bad');
  S = {
    profile: Object.assign({}, DEFAULTS.profile, p.profile || {}),
    shifts: p.shifts || {},
    plan: Object.assign({}, DEFAULTS.plan, p.plan || {}),
    ui: Object.assign({}, DEFAULTS.ui, p.ui || {})
  };
  save(); renderAll(); toast('Импорт выполнен');
}

/* ─────────────── ГЛАВНЫЕ КНОПКИ ─────────────── */
function initActions(){
  $$('[data-act]').forEach(b => {
    const a = b.dataset.act;
    if(a === 'mark-today') b.onclick = () => openSheet(todayISO());
    if(a === 'open-sched') b.onclick = () => $$('.tabbar button').find(x => x.dataset.tab === 'sched').click();
    if(a === 'open-cal') b.onclick = () => $$('.tabbar button').find(x => x.dataset.tab === 'cal').click();
    if(a === 'make-report') b.onclick = makeReport;
    if(a === 'open-bonus') b.onclick = () => {
      const d = todayISO(), sh = getShift(d);
      if(!sh || sh.kind !== 'work'){ toast('Сначала отметь смену на сегодня'); openSheet(d); return; }
      const v = prompt('Чаевые / премия, ₽', sh.bonus || 0);
      if(v != null){ sh.bonus = parseInt(v||0); save(); renderAll(); toast('Чаевые добавлены'); }
    };
  });
}

/* ─────────────── ЗАПУСК ─────────────── */
function renderAll(){
  renderHome(); renderCal(); renderSched(); renderStats(); renderSet();
}
function init(){
  initSplash(); initTabs(); initCal(); initSheet(); initSched(); initStats(); initSet(); initActions(); initTab();
  applyTheme();
  $('#abVer').textContent = '1.0';
  renderAll();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded', init);

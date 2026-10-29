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
const holidayOff = d => (HOLIDAY_SETS[d.slice(0,4)] && HOLIDAY_SETS[d.slice(0,4)].off[d]) || null;
const isHoliday  = d => !!holidayOff(d);
const isShort    = (d, mode) => { const y = HOLIDAY_SETS[d.slice(0,4)] || {}; const lst = (mode === '6' ? y.short6 : y.short5) || []; return lst.indexOf(d) >= 0; };

/* ─────────────── ПАТТЕРНЫ ГРАФИКА ─────────────── */
const PATTERNS = [
  { id:'1-1', w:1, o:1, desc:'сутки через день' },
  { id:'1-2', w:1, o:2, desc:'день, потом 2 отдыха' },
  { id:'2-2', w:2, o:2, desc:'классика: 2 смены — 2 дня' },
  { id:'2-3', w:2, o:3, desc:'2 смены — 3 дня дома' },
  { id:'3-3', w:3, o:3, desc:'три смены — три дня' },
  { id:'2-1', w:2, o:1, desc:'2 смены — день дома' },
  { id:'3-1', w:3, o:1, desc:'3 смены — день дома' },
  { id:'4-2', w:4, o:2, desc:'4 смены — 2 дня дома' },
  { id:'5-2', w:5, o:2, desc:'пятидневка' },
  { id:'6-1', w:6, o:1, desc:'шестидневка' },
  { id:'7-1', w:7, o:1, desc:'через день' }
];

/* ─────────────── ХРАНИЛИЩЕ ─────────────── */
const DEFAULTS = {
  profile: { name:'', rate:275, hours:13.75, point:'', advance:1, payday:15,
             nightPct:0, holPct:0, shiftStart:'10:00', shiftEnd:'23:45',
             payMode:'half', advPct:40, advDays:20, siteUrl:'' },
  shifts: {},
  bonuses: {},
  deductions: {},
  plan: { pattern:'2-2', start:'', hours:13.75, shortMode:'6', cycle:'', shiftsPerDay:1 },
  mate: { name:'', rate:0, hours:13.75, shifts:{} },
  ui: { range:'month', theme:'dark', tabRange:'month', fs:17, sound:1, wall:'' },
  onboarded:false
};
let S = load();

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return JSON.parse(JSON.stringify(DEFAULTS));
    const p = JSON.parse(raw);
    return {
      profile: Object.assign({}, DEFAULTS.profile, p.profile || {}),
      shifts: p.shifts || {},
      bonuses: p.bonuses || {},
      deductions: p.deductions || {},
      plan: Object.assign({}, DEFAULTS.plan, p.plan || {}),
      mate: Object.assign({}, DEFAULTS.mate, p.mate || {}, { shifts: (p.mate && p.mate.shifts) || {} }),
      ui: Object.assign({}, DEFAULTS.ui, p.ui || {}),
      onboarded: !!p.onboarded,
      pin: p.pin || ''
    };
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function applyTheme(){
  const t = (S.ui && S.ui.theme) || 'dark';
  document.body.dataset.theme = t;
  const b = $('#themeBtn'); if(b) b.textContent = t === 'dark' ? '☀' : '☾';
  $$('#themeChips .chip').forEach(c => c.classList.toggle('on', c.dataset.theme === t));
  applyFs(); applyWall();
}
function applyFs(){
  const fs = S.ui.fs || 17;
  document.documentElement.style.setProperty('--fs', fs + 'px');
  $$('#fsChips .chip').forEach(c => c.classList.toggle('on', parseInt(c.dataset.fs) === fs));
}
function applyWall(){
  const w = S.ui.wall || '';
  document.body.style.backgroundImage = w ? `url(assets/wallpapers/${w}.jpg)` : 'none';
}
let audioCtx = null;
function sound(name){
  if(!S.ui.sound) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const a = new Audio(`assets/sounds/${name}.mp3`);
    a.volume = .45; a.play().catch(()=>{});
  }catch(e){}
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ toast('Не удалось сохранить: нет места в памяти'); }
}
function resetAll(){
  S = JSON.parse(JSON.stringify(DEFAULTS)); save(); renderAll(); toast('Всё сброшено');
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
  { id:'day',     label:'10:00–23:45', hours:13.75, night:false },
  { id:'morning', label:'07:00–15:00', hours:8,     night:false },
  { id:'evening', label:'17:00–01:00', hours:8,     night:false },
  { id:'night',   label:'23:00–07:00', hours:8,     night:true  }
];
function shiftLen(start, end){
  if(!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number);
  let mins = (eh*60+em) - (sh*60+sm);
  if(mins <= 0) mins += 1440;          // смена через полночь
  return Math.round(mins / 60 * 100) / 100;
}
function slotList(){
  const p = S.profile;
  const h = shiftLen(p.shiftStart, p.shiftEnd);
  return SLOTS.map((sl, i) => i === 0
    ? { ...sl, label: `${p.shiftStart||'10:00'}–${p.shiftEnd||'23:45'}`, hours: (h === null || h === undefined) ? sl.hours : h }
    : sl);
}
const fmtHours = h => {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm ? `${hh} ч ${mm} мин` : `${hh} ч`;
};
const getShift = d => S.shifts[d] || null;
const getMateShift = d => (S.mate && S.mate.shifts && S.mate.shifts[d]) || null;
function shiftHours(sh){
  if(!sh) return 0;
  if(sh.parts && sh.parts.length) return sh.parts.reduce((a,pt) => a + (parseFloat(pt.hours) || 0), 0);
  return parseFloat(sh.hours) || 0;
}
function shiftMoney(sh, date){
  if(!sh || sh.kind !== 'work') return 0;
  const d = date || '';
  const rate = ((sh.rate === null || sh.rate === undefined) ? S.profile.rate : sh.rate);
  let base = 0, add = 0;
  if(sh.parts && sh.parts.length){
    sh.parts.forEach(pt => {
      const h = parseFloat(pt.hours) || 0;
      base += rate * h;
      const slot = SLOTS.find(s => s.id === (pt.slot || 'day'));
      if(slot && slot.night) add += rate * h * (S.profile.nightPct || 0) / 100;
    });
  }else{
    base = rate * (parseFloat(sh.hours) || 0);
    const slot = SLOTS.find(s => s.id === (sh.slot || 'day'));
    if(slot && slot.night) add += base * (S.profile.nightPct || 0) / 100;
  }
  if(d && isHoliday(d)) add += base * (S.profile.holPct || 0) / 100;
  return base + add + (sh.bonus || 0);
}
function rangeSum(from, to){
  let money_ = 0, hours = 0, shifts = 0;
  for(const [d, sh] of Object.entries(S.shifts)){
    if(d < from || d > to) continue;
    if(sh.kind === 'work'){ money_ += shiftMoney(sh, d); hours += shiftHours(sh); shifts++; }
  }
  return { money: money_, hours, shifts };
}
function monthKey(d){ return d.slice(0,7); }
function bonusItems(ym){
  const b = S.bonuses && S.bonuses[ym];
  if(!b) return [];
  if(b.items && b.items.length) return b.items;
  if(b.amount || b.note) return [{ id:'legacy', name:b.note || 'Премия', amount:b.amount || 0, date:'' }];
  return [];
}
function bonusOf(ym){ return bonusItems(ym).reduce((a,i) => a + (parseInt(i.amount,10) || 0), 0); }
function deductionItems(ym){
  const d = S.deductions && S.deductions[ym];
  if(!d) return [];
  if(d.items && d.items.length) return d.items;
  if(d.amount || d.note) return [{ id:'legacy', name:d.note || 'Списание', amount:d.amount || 0, date:'' }];
  return [];
}
function deductionOf(ym){ return deductionItems(ym).reduce((a,i) => a + (parseInt(i.amount,10) || 0), 0); }
function monthTotal(ym){
  const r = monthRange(ym);
  const s = rangeSum(r.from, r.to);
  s.money += bonusOf(ym);
  s.bonus = bonusOf(ym);
  s.deduction = deductionOf(ym);
  s.money -= s.deduction;
  return s;
}
function monthRange(ym){
  const [y,m] = ym.split('-').map(Number);
  const a = new Date(y, m-1, 1), b = new Date(y, m, 0);
  return { from: iso(a), to: iso(b), days: b.getDate() };
}
function cycleBlocks(){
  const c = (S.plan.cycle || '').trim();
  if(c){
    const out = [];
    c.split(',').forEach(part => {
      const m = part.split('/');
      const w = parseInt(m[0], 10), o = parseInt(m[1], 10);
      if(w > 0) out.push({ w, o: isNaN(o) ? 0 : o });
    });
    if(out.length) return out;
  }
  const p = PATTERNS.find(x => x.id === S.plan.pattern) || PATTERNS[2];
  return [{ w:p.w, o:p.o }];
}
function cycleLen(){ return cycleBlocks().reduce((a,b) => a + b.w + b.o, 0); }
function cycleLabel(){
  const c = (S.plan.cycle || '').trim();
  if(c) return c.replace(/\s/g,'');
  const p = PATTERNS.find(x => x.id === S.plan.pattern) || PATTERNS[2];
  return p.id;
}
function isWorkIdx(i){
  const len = cycleLen();
  let rem = ((i % len) + len) % len;
  const blocks = cycleBlocks();
  for(let b = 0; b < blocks.length; b++){
    const bl = blocks[b];
    if(rem < bl.w) return true;      // рабочие дни блока
    rem -= bl.w;
    if(rem < bl.o) return false;     // выходные блока
    rem -= bl.o;
  }
  return false;
}
function plannedShifts(from, to){
  const start = S.plan.start ? fromIso(S.plan.start) : fromIso(from);
  const out = [];
  let d = new Date(start);
  if(d < fromIso(from)) d = addDays(d, Math.floor((fromIso(from) - d) / 86400000));
  while(d <= fromIso(to)){
    const idx = Math.floor((d - start) / 86400000);
    if(isWorkIdx(idx)) out.push(iso(d));
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
  if(!sp) return;
  let done = false;
  const go = () => {
    if(done) return; done = true;
    sp.classList.add('hide');
    setTimeout(() => { try{ sp.remove(); }catch(e){} }, 600);
  };
  $('#splashSkip').onclick = e => { e.stopPropagation(); go(); };
  sp.onclick = go;                       // тап в любом месте — пропустить
  setTimeout(go, 3900);                 // анимация 3,6 с + запас
  setTimeout(go, 5200);                 // страховка: точно уйдёт
  window.addEventListener('load', () => setTimeout(go, 4200));
}

/* ─────────────── ТАБЫ ─────────────── */
function initTabs(){
  $$('.tabbar button').forEach(b => b.onclick = () => {
    $$('.tabbar button').forEach(x => {
      x.classList.remove('on');
    });
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
  $('#heroHi').textContent = prof.name ? `Привет, ${prof.name}!` : 'Привет!';
  $('#heroDate').textContent = now.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' });

  const sh = getShift(ti);
  $('#heroShift').textContent = sh ? (sh.kind === 'work' ? fmtHours(sh.hours) : ({off:'отдых', vacation:'отпуск'}[sh.kind] || '—')) : 'не отмечена';
  $('#heroAmt').textContent = sh && sh.kind === 'work' ? money(shiftMoney(sh, ti)) : '0 ₽';
  $('#heroCap').textContent = sh && sh.kind === 'work' ? 'заработано сегодня' : (sh ? 'сегодня — выходной' : 'смену не отмечал');

  const m = monthRange(monthKey(ti));
  const ms = monthTotal(monthKey(ti));
  $('#heroMonth').textContent = moneyShort(ms.money);
  const pays = payPeriods();
  const near = pays[0], far = pays[1];
  $('#heroLeft').textContent = near.days + ' ' + plural(near.days,'день','дня','дней');
  $('#stMonth').textContent = moneyShort(ms.money);
  $('#stWeek').textContent = moneyShort(rangeSum(iso(addDays(t,-6)), ti).money);
  const all = rangeSum('0000-01-01','9999-12-31');
  $('#stAll').textContent = moneyShort(all.money);
  $('#stShifts').textContent = all.shifts;
  const target = Math.max(1, ms.money + (S.profile.rate||0) * (S.profile.hours||0) * 4);
  $('#heroBar').style.width = Math.min(100, ms.money / target * 100) + '%';

  /* выплаты: аванс + зарплата (pays/near/far уже посчитаны выше) */
  const curYm = monthKey(ti);
  const dayWord = n => n + ' ' + plural(n,'день','дня','дней');
  $('#fcLbl1').textContent = `${near.label} · через ${dayWord(near.days)}`;
  $('#fcPay1').textContent = money(near.total);
  $('#fcLbl2').textContent = `${far.label} · через ${dayWord(far.days)}`;
  $('#fcPay2').textContent = money(far.total);
  $('#fcLbl3').textContent = `Ближайшая выплата · ${near.label}`;
  $('#fcTotal').textContent = money(near.total);
  $('#fcBar').style.width = Math.min(100, (near.fact / Math.max(1, near.total)) * 100) + '%';
  const bo = bonusOf(curYm);
  $('#fcNote').textContent = (bo ? `Премия за месяц: +${money(bo)}. ` : '')
    + `Аванс ${S.profile.advance||1}-го — за вторую половину прошлого месяца, `
    + `зарплата ${S.profile.payday||15}-го — за первую половину этого.`
    + (near.plan ? ` По графику до выплаты ещё ${near.plan} ${plural(near.plan,'смена','смены','смен')}.` : '');
  $('#payPill').textContent = `аванс ${S.profile.advance||1}-го · зарплата ${S.profile.payday||15}-го`;

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
  const holCount = Object.keys((HOLIDAY_SETS[ym.slice(0,4)] && HOLIDAY_SETS[ym.slice(0,4)].off) || {}).filter(d => d.startsWith(ym)).length;
  $('#calSum').innerHTML = `<span>Смен: <b>${s.shifts}</b> · ${s.hours} ч</span><span>Заработано: <b>${moneyShort(s.money)}</b></span><span>Праздников: <b>${holCount}</b></span>`;
}
function fillMonthByPattern(){
  const ym = `${calY}-${pad(calM+1)}`, r = monthRange(ym);
  const days = plannedShifts(r.from, r.to);
  const spd = Math.max(1, Math.min(3, parseInt(S.plan.shiftsPerDay,10) || 1));
  const per = parseFloat(S.plan.hours) || 12;
  let added = 0;
  days.forEach(d => {
    const ex = getShift(d);
    if(ex && (ex.kind === 'vacation' || ex.kind === 'sick')) return;
    const rec = { kind:'work', hours:per, rate:S.profile.rate, bonus:0, note:'', slot:'day' };
    if(spd > 1){
      const part = Math.round(per / spd * 100) / 100;
      rec.parts = [];
      for(let i = 0; i < spd; i++) rec.parts.push({ slot:'day', hours:part });
      rec.hours = Math.round(part * spd * 100) / 100;
    }
    S.shifts[d] = rec;
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
  const sh = (window.__fxMate ? getMateShift(date) : getShift(date));
  sheetKind = sh ? sh.kind : 'work';
  sheetSlot = (sh && sh.slot) || 'day';
  sheetShort = sh ? (sh.shortApplied ? 1 : 0) : (isShort(date, S.plan.shortMode) ? 1 : 0);

  const shD = dt.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  $('#shDate').textContent = shD.charAt(0).toUpperCase() + shD.slice(1).replace(' г.', '');
  const hol = holidayOff(date);
  let ht = hol ? ('🎉 ' + hol) : (dt.getDay() === 0 || dt.getDay() === 6 ? 'Выходной' : '');
  if(isShort(date, S.plan.shortMode)) ht += (ht ? ' · ' : '') + 'предпраздничный: −1 час';
  $('#shHol').textContent = ht;
  $('#shHol').style.color = hol ? 'var(--acc2)' : 'var(--mut2)';

  $$('#kindChips button').forEach(b => b.classList.toggle('on', b.dataset.kind === sheetKind));
  const defH = (sh && sh.hours) || Math.max(1, (S.profile.hours || 13.75) - (sheetShort ? 1 : 0));
  renderHourChips(defH);
  $('#shHours').value = defH;
  renderSlotChips();
  renderShortChips();
  $('#shRate').value = (sh && sh.rate != null) ? sh.rate : (window.__fxMate ? (S.mate.rate || 0) : S.profile.rate);
  $('#shBonus').value = (sh && sh.bonus) || 0;
  $('#shNote').value = (sh && sh.note) || '';
  $('#hoursField').style.display = sheetKind === 'work' ? '' : 'none';
  $('#slotField').style.display  = sheetKind === 'work' ? '' : 'none';
  $('#shortField').style.display = sheetKind === 'work' ? '' : 'none';
  updateSheetSum();
  $('#sheetWrap').classList.add('on');
}
function renderHourChips(h){
  const opts = [4,6,8,10,11,12,13.75,16,24];
  if(!opts.includes(h)) opts.push(h);
  opts.sort((a,b) => a-b);
  $('#hoursChips').innerHTML = opts.map(o => `<button class="chip${o===h?' on':''}" data-h="${o}">${fmtHours(o)}</button>`).join('');
  $$('#hoursChips .chip').forEach(c => c.onclick = () => {
    $$('#hoursChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    const v = parseFloat(c.dataset.h);
    $('#shHours').value = v;
    updateSheetSum();
  });
  const inp = $('#shHours');
  if(inp && document.activeElement !== inp) inp.value = h;
}
function renderSlotChips(){
  $('#slotChips').innerHTML = slotList().map(sl =>
    `<button class="chip${sl.id===sheetSlot?' on':''}" data-slot="${sl.id}">${sl.label}</button>`).join('');
  $$('#slotChips .chip').forEach(c => c.onclick = () => {
    sheetSlot = c.dataset.slot;
    const sl = slotList().find(x => x.id === sheetSlot);
    if(sl) renderHourChips(sl.hours);
    $$('#slotChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); updateSheetSum();
  });
}
function renderShortChips(){
  $$('#shortChips .chip').forEach(c => c.classList.toggle('on', (c.dataset.short === '1') === !!sheetShort));
}
function updateSheetSum(){
  const h = parseFloat($('#shHours').value || 0);
  const rate = parseInt($('#shRate').value || 0);
  const bonus = parseInt($('#shBonus').value || 0);
  if(sheetKind !== 'work'){ $('#shSum').innerHTML = '<b>—</b><span>' + ({off:'выходной', vacation:'отпуск', sick:'больничный'}[sheetKind]||'—') + '</span>'; return; }
  const base = h * rate;
  const sl = SLOTS.find(x => x.id === sheetSlot);
  const nightAdd = sl && sl.night ? base * (S.profile.nightPct||0) / 100 : 0;
  const holAdd = isHoliday(sheetDate) ? base * (S.profile.holPct||0) / 100 : 0;
  const total = base + nightAdd + holAdd + bonus;
  const parts = [`${fmtHours(h)} × ${rate} ₽`];
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
    const cur = parseFloat($('#shHours').value || 0);
    const base = S.profile.hours || 12;
    if(want && !sheetShort && cur === base) renderHourChips(Math.max(1, base - 1));
    if(!want && sheetShort && cur === base - 1) renderHourChips(base);
    $('#shHours').value = parseFloat($('#shHours').value || 0);
    sheetShort = want ? 1 : 0;
    renderShortChips();
    updateSheetSum();
  });
  $('#shHours').oninput = () => {
    const v = parseFloat($('#shHours').value);
    $$('#hoursChips .chip').forEach(x => x.classList.toggle('on', parseFloat(x.dataset.h) === v));
    updateSheetSum();
  };
  $('#shRate').oninput = updateSheetSum;
  $('#shBonus').oninput = updateSheetSum;
  $('#shSave').onclick = () => {
    const h = parseFloat($('#shHours').value || S.profile.hours || 12);
    const rec = sheetKind === 'work'
      ? { kind:'work', hours:h, rate:parseInt($('#shRate').value||0), bonus:parseInt($('#shBonus').value||0),
          note:$('#shNote').value.trim(), slot:sheetSlot, shortApplied:!!sheetShort }
      : { kind:sheetKind, hours:0, rate:0, bonus:0, note:$('#shNote').value.trim() };
    if(window.__fxParts && window.__fxParts.length > 1){
      rec.parts = window.__fxParts.map(pt => ({ slot:pt.slot, hours:parseFloat(pt.hours) || 0 }));
      rec.hours = rec.parts.reduce((a,pt) => a + pt.hours, 0);
    }
    if(window.__fxMate){
      if(!S.mate.shifts) S.mate.shifts = {};
      S.mate.shifts[sheetDate] = rec;
    }else{
      S.shifts[sheetDate] = rec;
    }
    save(); $('#sheetWrap').classList.remove('on');
    renderAll(); celebrate(); sound('save'); toast('Сохранено');
  };
  $('#shDel').onclick = () => {
    const target = window.__fxMate ? getMateShift(sheetDate) : S.shifts[sheetDate];
    if(target){
      if(window.__fxMate) delete S.mate.shifts[sheetDate]; else delete S.shifts[sheetDate];
      save(); $('#sheetWrap').classList.remove('on'); renderAll(); toast('Удалено');
    }
    else $('#sheetWrap').classList.remove('on');
  };
}

/* ─────────────── ОТЧЁТ ТЕКСТОМ ─────────────── */
function makeReport(){
  const m = monthRange(monthKey(todayISO()));
  const s = rangeSum(m.from, m.to);
  const kinds = { off:'выходной', vacation:'отпуск' };
  const lines = Object.keys(S.shifts).filter(d => d >= m.from && d <= m.to).sort().map(d => {
    const sh = S.shifts[d];
    const dd = fromIso(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
    if(sh.kind === 'work'){
      const sl = SLOTS.find(x => x.id === (sh.slot || 'day'));
      return `• ${dd} — ${fmtHours(sh.hours)} (${sl ? sl.label : 'смена'}) — ${money(shiftMoney(sh, d))}`;
    }
    return `• ${dd} — ${kinds[sh.kind] || '—'}`;
  });
  const bo = bonusOf(monthKey(todayISO()));
  const head = `📋 Табель за ${fromIso(m.from).toLocaleDateString('ru-RU', { month:'long', year:'numeric' })}
Смен: ${s.shifts} · часов: ${s.hours} · итого: ${money(s.money + bo)}${bo ? '\nПремия: ' + money(bo) : ''}`;
  const pays = payPeriods();
  const tail = `Аванс ${pays.find(p=>p.kind==='advance').label.split(' ')[1]}: ${money(pays.find(p=>p.kind==='advance').total)}\n`
    + `Зарплата ${pays.find(p=>p.kind==='salary').label.split(' ')[1]}: ${money(pays.find(p=>p.kind==='salary').total)}\n\n`
    + `Команда Фарфор · ${S.profile.point || 'FARFOR'}`;
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
    m.querySelector('.sheet-bg').onclick = () => m.classList.remove('on');
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

/* ─────────────── ВЫПЛАТЫ: аванс 1-го, зарплата 15-го ─────────────── */
function payMode(){ return S.profile.payMode || 'half'; }
function advWindow(){ return Math.max(1, Math.min(28, parseInt(S.profile.advDays,10) || 20)); }
function advPercent(){ return Math.max(0, Math.min(100, parseInt(S.profile.advPct,10) || 0)); }

function payPeriods(){
  const now = today();
  const advDay = S.profile.advance || 1;
  const payDay = S.profile.payday || 15;
  const dim = (y,m) => new Date(y, m+1, 0).getDate();
  const mk = (y,m,d) => new Date(y, m, d);
  const mode = payMode();
  const aw = advWindow();
  const pct = advPercent();
  const mkPay = (kind, date) => {
    let from, to;
    if(mode === 'pct'){
      const py = date.getFullYear(), pm = date.getMonth() - 1;
      if(kind === 'salary'){                 // зарплата: [aw+1 прошлого .. payDay текущего]
        from = mk(py, pm, aw + 1);
        to   = mk(date.getFullYear(), date.getMonth(), Math.min(payDay, dim(date.getFullYear(), date.getMonth())));
      }else{                                 // аванс: [1..aw] прошлого месяца
        from = mk(py, pm, 1);
        to   = mk(py, pm, Math.min(aw, dim(py, pm)));
      }
    }else{
      if(kind === 'salary'){                 // зарплата = первая половина месяца
        from = mk(date.getFullYear(), date.getMonth(), 1);
        to   = mk(date.getFullYear(), date.getMonth(), Math.min(payDay, dim(date.getFullYear(), date.getMonth())));
      }else{                                 // аванс = вторая половина прошлого месяца
        const y = date.getFullYear(), m = date.getMonth() - 1;
        from = mk(y, m, 16);
        to   = mk(y, m, dim(y, m));
      }
    }
    return { kind, date, from: iso(from), to: iso(to) };
  };
  let adv = mk(now.getFullYear(), now.getMonth(), advDay);
  if(adv < now) adv = mk(now.getFullYear(), now.getMonth()+1, advDay);
  let sal = mk(now.getFullYear(), now.getMonth(), payDay);
  if(sal < now) sal = mk(now.getFullYear(), now.getMonth()+1, payDay);

  const list = [ mkPay('salary', sal), mkPay('advance', adv) ].sort((a,b) => a.date - b.date);
  const ti = todayISO();
  list.forEach(p => {
    p.days = Math.max(0, Math.round((p.date - now) / 86400000));
    p.label = p.kind === 'salary' ? `Зарплата ${p.date.getDate()}-го` : `Аванс ${p.date.getDate()}-го`;
    const rs = rangeSum(p.from, p.to);
    p.raw = rs.money;
    p.premium = 0;
    if(mode === 'pct' && p.kind === 'advance'){
      p.fact = rs.money * pct / 100;
      p.premium = rs.money - p.fact;
    }else{
      p.fact = rs.money;
    }
    const future = plannedShifts(p.from, p.to).filter(d => d >= ti);
    p.plan = future.length;
    const perShift = (S.profile.rate || 0) * (S.plan.hours || S.profile.hours || 13.75);
    p.planMoney = future.length * perShift;
    p.total = p.fact + (mode === 'pct' ? p.planMoney * pct / 100 : p.planMoney);
  });
  const advP = list.find(x => x.kind === 'advance');
  const salP = list.find(x => x.kind === 'salary');
  if(mode === 'pct' && advP && salP){
    salP.fact += advP.premium;              // удержанная премия уходит в зарплату
    salP.premium += advP.premium;
    salP.total += advP.premium;
  }
  if(salP){
    const bym = (mode === 'pct') ? monthKey(ti) : monthKey(salP.from);
    if(mode === 'pct' || monthKey(salP.from) === monthKey(ti)){
      const bo = bonusOf(bym);
      if(bo){ salP.fact += bo; salP.total += bo; salP.bonusYm = bym; }
      const ded = deductionOf(bym);
      if(ded){ salP.fact -= ded; salP.total -= ded; salP.deductionYm = bym; }
    }
  }
  return list;
}

function payBreakdown(){
  const ti = todayISO(), ym = monthKey(ti);
  const m = monthRange(ym);
  const aw = advWindow(), pct = advPercent();
  const dim = new Date(+ym.slice(0,4), +ym.slice(5,7), 0).getDate();
  const wTo = iso(new Date(+ym.slice(0,4), +ym.slice(5,7), Math.min(aw, dim)));
  const win = rangeSum(m.from, wTo);
  const rest = rangeSum(iso(addDays(fromIso(wTo), 1)), m.to);
  const items = bonusItems(ym);
  const bo = bonusOf(ym);
  let adv = 0, prem = bo;
  if(payMode() === 'pct'){
    adv = win.money * pct / 100;
    prem = win.money - adv + bo;
  }else{
    prem = win.money + bo;
  }
  return { mode: payMode(), pct, aw, win, rest, adv, prem, bonus: bo, items, ym };
}

/* ─────────────── ТАБЕЛЬ ─────────────── */
let tabOff = 0;
function currentTabYm(){
  if((S.ui.tabRange || 'month') === 'month'){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + tabOff);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  }
  return monthKey(todayISO());
}
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
      : `<div class="li-m" style="color:var(--mut2)">${{off:'отдых', vacation:'отпуск'}[sh.kind] || ''}</div>`;
    const mid = sh.kind === 'work'
      ? `<b>${sh.hours} ч${sh.bonus ? ' · +' + moneyShort(sh.bonus) : ''}</b><span>${sl ? sl.label : 'смена'}${sh.note ? ' · ' + sh.note : ''}${isHoliday(d) ? ' · 🎉' : ''}</span>`
      : `<b>${({off:'Выходной', vacation:'Отпуск'})[sh.kind] || '—'}</b><span>${sh.note || ''}</span>`;
    return `<div class="li"><div class="li-d"><b>${dt.getDate()}</b><span>${WEEK[dt.getDay()]}</span></div>
      <div class="li-t">${mid}</div>${right}</div>`;
  }).join('') : '<div class="empty">Пока пусто</div>';
  const ymNow = currentTabYm();
  const bo = bonusOf(ymNow);
  const bItems = bonusItems(ymNow);
  $('#bonusLine').innerHTML = bo ? `<div class="cal-sum" style="margin-bottom:12px"><span>Доплаты и премии: <b>${money(bo)}</b>${bItems.length ? ' · ' + bItems.length + ' поз.' : ''}</span><span></span></div>` : '';
  const ded = deductionOf(ymNow);
  const tot = s.money + bo - ded;
  $('#tabSum').innerHTML = `<span>Смен: <b>${s.shifts}</b> · <b>${s.hours} ч</b></span><span>Итого: <b>${money(tot)}</b>${ded ? ' · <span style="color:var(--red)">−' + money(ded) + '</span>' : ''}</span>`;
}
function initTab(){
  $$('#tabSeg button').forEach(b => b.onclick = () => { S.ui.tabRange = b.dataset.tr; tabOff = 0; save(); renderTab(); });
  $$('[data-act="add-bonus"]').forEach(b => b.onclick = () => {
    const ym = currentTabYm();
    const cur = S.bonuses[ym] || { amount:0, note:'' };
    const v = prompt('Премия / доплата за ' + ym + ', ₽', cur.amount || 0);
    if(v == null) return;
    const amt = parseInt(v||0);
    const nv = prompt('За что (необязательно)', cur.note || ''); const note = (nv === null || nv === undefined) ? cur.note : nv;
    if(amt) S.bonuses[ym] = { amount: amt, note: note || '' };
    else delete S.bonuses[ym];
    save(); renderAll(); toast(amt ? 'Премия добавлена' : 'Премия убрана');
  });
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
  const spd = Math.max(1, Math.min(3, parseInt(S.plan.shiftsPerDay,10) || 1));
  const per = parseFloat(S.plan.hours) || 12;
  let n = 0;
  days.forEach(d => {
    const ex = getShift(d);
    if(ex && (ex.kind === 'vacation' || ex.kind === 'sick')) return;
    const rec = { kind:'work', hours:per, rate:S.profile.rate, bonus:0, note:'', slot:'day' };
    if(spd > 1){
      const part = Math.round(per / spd * 100) / 100;
      rec.parts = [];
      for(let i = 0; i < spd; i++) rec.parts.push({ slot:'day', hours:part });
      rec.hours = Math.round(part * spd * 100) / 100;
    }
    S.shifts[d] = rec;
    n++;
  });
  const origin = S.plan.start ? fromIso(S.plan.start) : fromIso(from);
  let off = 0;
  for(let i = 0; i < 90; i++){
    const d = iso(addDays(fromIso(from), i));
    if(days.indexOf(d) >= 0) continue;
    const ex = getShift(d);
    if(ex && (ex.kind === 'vacation' || ex.kind === 'sick')) continue;
    if(!isWorkIdx(Math.floor((fromIso(d) - origin) / 86400000))){
      S.shifts[d] = { kind:'off', hours:0, rate:0, bonus:0, note:'' }; off++;
    }
  }
  save(); renderAll();
  toast(`График ${cycleLabel()}: ${n} ${plural(n,'смена','смены','смен')} на 3 месяца`);
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
      bars.push(map.get(k) + bonusOf(k));
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
  const kinds = { work:0, vacation:0, off:0 };
  Object.entries(S.shifts).forEach(([d, sh]) => {
    if(d < b.from || d > b.to) return;
    if(kinds[sh.kind] != null) kinds[sh.kind]++;
  });
  const tot = Object.values(kinds).reduce((a,c) => a+c, 0);
  const cols = { work:'#fe5000', vacation:'#4aa8ff', off:'#3a3f4b' };
  const names = { work:'Смены', vacation:'Отпуск', off:'Отдых' };
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
  $('#fPayday').value = String(S.profile.payday || 15);
  $('#fAdvance').value = String(S.profile.advance || 1);
  $('#fNight').value = (S.profile.nightPct === null || S.profile.nightPct === undefined) ? 0 : S.profile.nightPct;
  $('#fHol').value = (S.profile.holPct === null || S.profile.holPct === undefined) ? 0 : S.profile.holPct;
  $('#abRate').textContent = (S.profile.rate || 0) + ' ₽';
  const pp = $('#pinPill'); if(pp){ pp.textContent = S.pin ? 'включён' : 'выключен'; pp.classList.toggle('on', !!S.pin); }
  $$('#soundChips .chip').forEach(c => c.classList.toggle('on', parseInt(c.dataset.sound) === ((S.ui.sound === null || S.ui.sound === undefined) ? 1 : S.ui.sound)));
  $('#fShiftStart').value = S.profile.shiftStart || '10:00';
  $('#fShiftEnd').value = S.profile.shiftEnd || '23:45';
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
  bind('#fPoint','point'); bind('#fPayday','payday', v => parseInt(v||15));
  bind('#fAdvance','advance', v => parseInt(v||1));
  bind('#fNight','nightPct', v => parseInt(v||0)); bind('#fHol','holPct', v => parseInt(v||0));
  const syncTimes = () => {
    S.profile.shiftStart = $('#fShiftStart').value || '10:00';
    S.profile.shiftEnd = $('#fShiftEnd').value || '23:45';
    const h = shiftLen(S.profile.shiftStart, S.profile.shiftEnd);
    if(h){ S.profile.hours = h; S.plan.hours = h; $('#fHours').value = h; }
    save(); renderAll(); toast('Смена обновлена');
  };
  $('#fShiftStart').onchange = syncTimes;
  $('#fShiftEnd').onchange = syncTimes;
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
    if(a === 'set-pin') b.onclick = () => {
      S.pin = ''; save();
      lockState = 'pin';
      $('#lock').classList.add('on');
      $('#lockNameWrap').classList.remove('on');
      $('#lockTitle').textContent = APP_NAME;
      $('#lockText').textContent = 'Новый PIN: 4–6 цифр';
      $('#lockGo').textContent = 'Сохранить';
      $('#lockReset').style.display = 'none';
      $('#lockPin').value = ''; pinTmp = '';
      $('#lockPin').focus();
    };
    if(a === 'off-pin') b.onclick = () => {
      if(!S.pin){ toast('PIN и не установлен'); return; }
      if(confirm('Отключить вход по PIN?')){ S.pin = ''; save(); toast('PIN отключён'); renderSet(); }
    };
    if(a === 'open-bonus') b.onclick = () => {
      const d = todayISO(), sh = getShift(d);
      if(!sh || sh.kind !== 'work'){ toast('Сначала отметь смену на сегодня'); openSheet(d); return; }
      const v = prompt('Чаевые / премия, ₽', sh.bonus || 0);
      if(v != null){ sh.bonus = parseInt(v||0); save(); renderAll(); toast('Чаевые добавлены'); }
    };
  });
}


/* ═══════════════ ОНБОРДИНГ ═══════════════ */
const ONB = [
  { art:'assets/art/kitchen.png',  title:'Привет, повар',      text:'Здесь считаются твои смены, часы и деньги. Настроим за полминуты.' },
  { art:'assets/art/calendar.png',title:'Тапай по дню',        text:'Отметил смену — приложение само считает часы и сумму. Ушёл раньше? Впишешь фактические часы.' },
  { art:'assets/art/money.png',   title:'Аванс и зарплата',    text:'Аванс 1-го, зарплата 15-го. Приложение покажет, сколько получу до каждой выплаты.' }
];
let onbIdx = 0;
function initOnb(){
  const el = $('#onb');
  if(S.onboarded){ el.classList.remove('on'); return; }
  el.classList.add('on');
  renderOnb();
  $('#onbNext').onclick = () => {
    sound('tap');
    if(onbIdx < ONB.length - 1){ onbIdx++; renderOnb(); }
    else finishOnb();
  };
  $('#onbSkip').onclick = finishOnb;
}
function renderOnb(){
  const s = ONB[onbIdx];
  $('#onbArt').src = s.art;
  $('#onbTitle').textContent = s.title;
  $('#onbText').textContent = s.text;
  $$('.onb-dots i').forEach((d,i) => d.classList.toggle('on', i === onbIdx));
  $('#onbNext').textContent = onbIdx === ONB.length - 1 ? 'Начать' : 'Дальше';
}
function finishOnb(){
  S.onboarded = true; save();
  $('#onb').classList.remove('on');
  toast('Готово — считаем смены!');
}

/* ═══════════════ ПОДРАЗДЕЛЫ ═══════════════ */
let subFrom = 'view-set';
function openSub(id){
  const from = $('.view.on');
  if(from) subFrom = from.id;
  $$('.view').forEach(v => v.classList.remove('on'));
  const t = $('#view-' + id); if(t) t.classList.add('on');
  window.scrollTo(0,0);
  if(id === 'theme') renderWalls();
  if(id === 'calc') renderCalc();
  if(id === 'badges') renderBadges();
  if(id === 'profile') renderSet();
}
function closeSub(){
  $$('.view').forEach(v => v.classList.remove('on'));
  const t = $('#' + subFrom); if(t) t.classList.add('on');
  window.scrollTo(0,0);
}

/* ═══════════════ ОБОИ ═══════════════ */
const WALLS = ['w1','w2','w3','w4','w5','w6','w7','w8','w9','w10','w11','w12','w13','w14','w15','w16'];
function renderWalls(){
  $('#walls').innerHTML = WALLS.map(w =>
    `<button class="wall${(S.ui.wall||'')===w?' on':''}" data-wall="${w}" style="background-image:url(assets/wallpapers/${w}.jpg)"></button>`).join('');
  $$('#walls .wall').forEach(b => b.onclick = () => {
    S.ui.wall = (S.ui.wall === b.dataset.wall) ? '' : b.dataset.wall;
    save(); applyWall(); renderWalls(); sound('tap');
    toast(S.ui.wall ? 'Фон установлен' : 'Фон убран');
  });
}

/* ═══════════════ РАСЧЁТЫ ═══════════════ */
let calcMode = 'month';
function initCalc(){
  $$('#calcChips .chip').forEach(c => c.onclick = () => {
    $$('#calcChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); calcMode = c.dataset.calc; sound('tap');
    $('#calcVacField').style.display = calcMode === 'vac' ? '' : 'none';
    renderCalc();
  });
  $('#calcVacDays').oninput = renderCalc;
}
function renderCalc(){
  const rate = S.profile.rate || 0;
  const hrs  = S.plan.hours || S.profile.hours || 13.75;
  const per  = rate * hrs;
  const brk = [];
  let val = 0, label = '';
  if(calcMode === 'month'){
    const m = monthRange(monthKey(todayISO()));
    const planned = plannedShifts(m.from, m.to).length;
    const fact = rangeSum(m.from, m.to);
    val = planned * per + bonusOf(monthKey(todayISO()));
    label = `по графику ${planned} ${plural(planned,'смена','смены','смен')} за ${money(per)}`;
    brk.push(['Одна смена', money(per)]);
    brk.push(['Смен по графику', String(planned)]);
    brk.push(['Уже отработано', money(fact.money)]);
    brk.push(['Премия месяца', money(bonusOf(monthKey(todayISO())))]);
    brk.push(['Прогноз за месяц', money(val)]);
  }else if(calcMode === 'year'){
    const planned = plannedShifts(todayISO(), iso(addDays(today(), 364))).length;
    val = planned * per;
    label = `${planned} ${plural(planned,'смена','смены','смен')} за год`;
    brk.push(['Среднее в месяц', money(Math.round(val/12))]);
    brk.push(['Одна смена', money(per)]);
    brk.push(['Прогноз за год', money(val)]);
  }else if(calcMode === 'vac'){
    const days = parseInt($('#calcVacDays').value || 14);
    val = days * per;
    label = `отпуск ${days} ${plural(days,'день','дня','дней')} — столько не заработаешь`;
    brk.push(['Ставка в день (12 ч)', money(rate * 12)]);
    brk.push(['Ставка в день (13 ч 45 мин)', money(per)]);
    brk.push(['Потеря за отпуск', money(val)]);
  }else{
    val = Math.ceil(10000 / Math.max(1, rate));
    label = `часов на 10 000 ₽ по ставке ${rate} ₽`;
    brk.push(['Ставка', money(rate) + '/час']);
    brk.push(['Нужно отработать', val + ' ч']);
    brk.push(['Это смен', Math.ceil(val / hrs) + ' по ' + fmtHours(hrs)]);
  }
  $('#calcValue').textContent = money(val);
  $('#calcLabel').textContent = label;
  $('#calcBreak').innerHTML = brk.map(([k,v]) => `<div class="br"><span>${k}</span><b>${v}</b></div>`).join('');
  const m = monthRange(monthKey(todayISO()));
  const pats = PATTERNS.map(p => {
    const perMonth = 30 / (p.w + p.o) * p.w;
    return [p.id + ' · ' + p.desc, `${Math.round(perMonth)} смен · ${moneyShort(Math.round(perMonth*hrs*rate))}`];
  });
  $('#calcShifts').innerHTML = pats.map(([k,v]) => `<div class="br"><span>${k}</span><b>${v}</b></div>`).join('');
}

/* ═══════════════ НАГРАДЫ ═══════════════ */
const BADGE_DEFS = [
  { id:'first',   name:'Первая смена',  img:'first.png',   need:1,   unit:'смена' },
  { id:'ten',     name:'10 смен',       img:'ten.png',     need:10,  unit:'смен' },
  { id:'fifty',   name:'50 смен',       img:'fifty.png',   need:50,  unit:'смен' },
  { id:'hundred', name:'100 часов',     img:'hundred.png', need:100, unit:'часов' },
  { id:'thousand',name:'10 000 ₽',      img:'thousand.png',need:10000,unit:'₽' },
  { id:'streak',  name:'Серия 7 дней',  img:'streak.png',  need:7,   unit:'дней' },
  { id:'night',   name:'Ночная смена',  img:'night.png',   need:1,   unit:'ночная' },
  { id:'bonus',   name:'С премией',     img:'bonus.png',   need:1,   unit:'премия' }
];
function badgeStats(){
  const all = rangeSum('0000-01-01','9999-12-31');
  let streak = 0;
  const t = today();
  for(let i = 0; i < 400; i++){
    const s = getShift(iso(addDays(t,-i)));
    if(s && s.kind === 'work') streak++;
    else if(i === 0 && s && s.kind === 'off') continue;
    else break;
  }
  const night = Object.values(S.shifts).filter(s => {
    const sl = SLOTS.find(x => x.id === (s.slot||'day'));
    return s.kind === 'work' && sl && sl.night;
  }).length;
  const bonus = Object.values(S.bonuses || {}).filter(b => b.amount > 0).length;
  return { shifts: all.shifts, hours: all.hours, money: all.money, streak, night, bonus };
}
function renderBadges(){
  const st = badgeStats();
  const got = {
    first: st.shifts >= 1, ten: st.shifts >= 10, fifty: st.shifts >= 50,
    hundred: st.hours >= 100, thousand: st.money >= 10000, streak: st.streak >= 7,
    night: st.night >= 1, bonus: st.bonus >= 1
  };
  $('#badges').innerHTML = BADGE_DEFS.map(b =>
    `<div class="badge${got[b.id]?' got':''}"><img src="assets/badges/${b.img}" alt=""><b>${b.name}</b><span>${got[b.id]?'получено':b.need+' '+b.unit}</span></div>`).join('');
  $('#badgeProg').innerHTML = [
    ['Смен отработано', st.shifts], ['Часов отработано', st.hours],
    ['Заработано', money(st.money)], ['Лучшая серия', st.streak + ' ' + plural(st.streak,'смена','смены','смен')]
  ].map(([k,v]) => `<div class="br"><span>${k}</span><b>${v}</b></div>`).join('');
}


/* ═══════════════ ЭКРАН ВХОДА: имя + PIN ═══════════════ */
const APP_NAME = 'Смена';
let lockState = 'unlock', pinTmp = '', pinTmp2 = '';

async function hashPin(pin){
  try{
    if(window.crypto && window.crypto.subtle){
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode('farfor-smena:' + pin));
      return 's' + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){}
  let h = 5381;
  for(let i = 0; i < pin.length; i++) h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0;
  return 'f' + h.toString(16);
}
function initLock(){
  const el = $('#lock');
  const hasPin = !!(S.pin && S.pin.length);
  if(!hasPin && S.profile.name){        // PIN отключён, приложение уже настроено — пускаем сразу
    el.classList.remove('on');
    return false;
  }
  if(!hasPin){
    lockState = 'name';
    $('#lockTitle').textContent = APP_NAME;
    $('#lockText').textContent = 'Как тебя звать?';
    $('#lockNameWrap').classList.add('on');
    $('#lockGo').textContent = 'Дальше';
    $('#lockReset').style.display = 'none';
  }else{
    lockState = 'unlock';
    $('#lockTitle').textContent = APP_NAME;
    $('#lockText').textContent = 'Привет, ' + (S.profile.name || 'повар') + '! Введи код';
    $('#lockGo').textContent = 'Войти';
    $('#lockReset').style.display = '';
  }
  el.classList.add('on');
  const pin = $('#lockPin');
  pin.oninput = () => { pin.value = pin.value.replace(/\D/g,'').slice(0,6); $('#lockHint').textContent = ''; };
  pin.onkeydown = e => { if(e.key === 'Enter') lockGo(); };
  $('#lockGo').onclick = lockGo;
  $('#lockReset').onclick = () => {
    if(confirm('Сбросить PIN и имя? Смены и деньги останутся на месте.')){
      S.pin = ''; save();
      lockState = 'name'; pinTmp = ''; pinTmp2 = '';
      $('#lockNameWrap').classList.add('on');
      $('#lockName').value = S.profile.name || '';
      $('#lockText').textContent = S.profile.name ? ('Привет, ' + S.profile.name + '! Как зовут?') : 'Как тебя звать?';
      $('#lockGo').textContent = 'Дальше';
      $('#lockReset').style.display = 'none';
      $('#lockPin').value = '';
    }
  };
  setTimeout(() => { const f = lockState === 'name' ? $('#lockName') : $('#lockPin'); f.focus(); }, 350);
  return true;
}
async function lockGo(){
  const name = $('#lockName').value.trim();
  const pin = $('#lockPin').value.trim();
  $('#lockHint').textContent = '';
  if(lockState === 'name'){
    if(!name){ $('#lockHint').textContent = 'Введи имя'; return; }
    S.profile.name = name;
    lockState = 'pin'; pinTmp = '';
    $('#lockNameWrap').classList.remove('on');
    $('#lockText').textContent = 'Придумай PIN: 4–6 цифр';
    $('#lockGo').textContent = 'Дальше';
    $('#lockPin').value = '';
    $('#lockPin').focus();
    return;
  }
  if(lockState === 'pin'){
    if(!/^\d{4,6}$/.test(pin)){ $('#lockHint').textContent = 'Нужно 4–6 цифр'; return; }
    pinTmp = pin; lockState = 'pin2';
    $('#lockText').textContent = 'Повтори код';
    $('#lockPin').value = '';
    $('#lockPin').focus();
    return;
  }
  if(lockState === 'pin2'){
    if(pin !== pinTmp){ $('#lockHint').textContent = 'Коды не совпали, попробуй ещё'; lockState = 'pin'; pinTmp=''; $('#lockPin').value=''; return; }
    S.pin = await hashPin(pin);
    save();
    unlockApp();
    return;
  }
  // unlock
  const h = await hashPin(pin);
  if(h === S.pin){ unlockApp(); }
  else { $('#lockHint').textContent = 'Неверный код'; $('#lockPin').value = ''; $('#lockPin').focus(); }
}
function unlockApp(){
  $('#lock').classList.remove('on');
  $('#tbTitle').textContent = APP_NAME;
  renderAll();
  toast('Привет, ' + (S.profile.name || 'повар') + '!');
  setTimeout(initOnb, 400);            // обучение — только после входа
}

/* ─────────────── ЗАПУСК ─────────────── */
function renderAll(){
  renderHome(); renderCal(); renderSched(); renderStats(); renderSet();
  if(window.fxRenderAll) window.fxRenderAll();
  if($('#walls')) renderWalls();
  if($('#calcValue')) renderCalc();
  if($('#badges')) renderBadges();
}
function init(){
  initSplash();
  initTabs(); initCal(); initSheet(); initSched(); initStats(); initSet(); initActions(); initTab();
  initCalc(); applyTheme();
  if(window.fxInit) window.fxInit();
  const locked = initLock();
  if(!locked) setTimeout(initOnb, 350);
  $$('[data-go]').forEach(b => b.onclick = () => { sound('tap'); openSub(b.dataset.go); });
  $$('[data-back]').forEach(b => b.onclick = () => { sound('tap'); closeSub(); });
  $$('#fsChips .chip').forEach(c => c.onclick = () => {
    S.ui.fs = parseInt(c.dataset.fs); save(); applyFs(); sound('tap');
  });
  $$('#soundChips .chip').forEach(c => c.onclick = () => {
    S.ui.sound = parseInt(c.dataset.sound); save();
    $$('#soundChips .chip').forEach(x => x.classList.remove('on')); c.classList.add('on');
    if(S.ui.sound) sound('tap');
  });
  $$('#themeChips .chip').forEach(c => c.onclick = () => {
    S.ui.theme = c.dataset.theme; save(); applyTheme(); sound('tap');
  });
  $('#abVer').textContent = '1.4';
  renderAll();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded', init);

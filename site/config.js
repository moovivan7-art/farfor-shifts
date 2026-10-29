/* ═══════════════════════════════════════════════════════════════
   ОБЖИГ — конфиг сайта. Меняешь тут — меняется везде.
   ═══════════════════════════════════════════════════════════════ */
const SITE = {
  brand: 'Обжиг',
  tagline: 'смены, часы и деньги — считает само',
  version: '1.5',

  /* контакты автора */
  email: 'moovivan7@gmail.com',
  telegram: '',                 // ← впиши ник, если нужен (например @moovivan7)

  /* ссылки */
  repo: 'https://github.com/moovivan7-art/farfor-shifts',
  apk: 'farfor-shifts-1.5.apk',     // лежит рядом с index.html
  apkZip: 'farfor-shifts-1.5.apk.zip',
  siteUrl: '',                  // ← абсолютный URL сайта (заполни после деплоя)

  /* параметры расчёта по умолчанию */
  rate: 275,                    // ₽/час
  hours: 13.75,                 // смена 10:00–23:45 без перерыва
  shiftStart: '10:00',
  shiftEnd: '23:45',
  advanceDay: 1,
  payday: 15,
  advPct: 40,                   // % от первых 20 дней → в аванс
  advDays: 20,

  /* роли для личного кабинета */
  roles: [
    { id:'cook',    name:'Повар' },
    { id:'courier', name:'Курьер' },
    { id:'packer',  name:'Сборщик' },
    { id:'other',   name:'Другое' }
  ],

  /* коды приглашения: SHA-256 от "smena-invite:<КОД>" */
  inviteHashes: [
    '09f71f6e1a329bce8903f33993f5029db3426f365bba3cd0c7ff2f996a6d899c',
    'd22a41c3cf594d8e4cfd3240e11ddda36176cf16cd4a40bd70a4a1d0e9814e9a',
    '2002061457fb2786a8450fd224b4960b9167c13546cb81d5ed841a2e92640305',
    '2cf9aab7f90ae0f38efca18ef9654d54b4cb916227395bb7cfa14adb207a3617',
    '41edf4a788f16d5f087416f00d81ad35aa1d35437594a774208add116afcb2e0',
    '0ccb23a83745572273aee38f4dd0e891afc915188b058de9cfc9b4b46b88f9a7',
    'e14b3ad24470765b91d65ac3e723156b498eadb6d36967930c5f16103287f4f1',
    'd9673e3a924d33168b99b2f7ee9790d44f74c10549de34d2826a251ed63991b5',
    '7420a1fe21481f60a367b9c7948393bc5fc8c77c5a7178271bb653afe9fd9256',
    '3b753bda9c55ce2e65f7ec0a529adb33456a170c8b1d554e5aa411f2c604f554',
    'b9b0e0289d7bc17978d49ec3495624aa813c899b4be53a75e54ba9263d7cb144',
    'ce9e256d1691256530569e52700ebdc453de2455f7d66a0a1d063f99a0cdd7d1'
  ]
};

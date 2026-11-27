// Unudaraq öyrənmə: insan yaddaşı kimi.
//  - İşlə bağlı hər şey (tapşırıq, kampaniya, işdən danışılan söhbət) unudulmur və tam qalır.
//  - Gündəlik hadisələr Ebbinghaus əyrisi ilə solur: R = e^(-t/S). t — son dəfə yada düşəndən keçən vaxt,
//    S — xatirənin möhkəmliyi (gün).
//  - Hər dəfə yada düşəndə (axtarışda tapılanda) möhkəmlik artır: təkrar xatırlanan şey gec unudulur.
//  - Emosional hadisələr (işə götürülmək, kiminsə çıxarılması) gündəlik söhbətdən çox gec solur.
//  - Mərhələlər: aydın (tam mətn) → dumanlı (yalnız ümumi məzmun) → unudulub (artıq yada düşmür).

export const DAY = Number(process.env.MEMORY_DAY_MS) || 24 * 3600 * 1000;

// Söhbət işdən gedirsə, iş xatirəsidir.
const WORK_WORDS = /kampaniya|tapşırıq|müştəri|brend|büdcə|reklam|post|dizayn|loqo|slogan|sloqan|hesabat|təqdimat|strategi|plan|rəqib|satış|auditoriya|kontent|mətn|banner|video|çəkiliş|hədəf|kpi|romi|seo|qiymət|təklif|layihə|maket|deadline|son tarix|briff?|konsepsiya|kreativ/i;

// kind → sinif və ilkin möhkəmlik (gün). İş sinfi solmur.
const BASE = { gundelik: 3, rehber: 6, hadise: 45 };

export function classify(kind, text) {
  if (kind === 'is' || kind === 'kampaniya' || kind === 'tapşırıq') return 'is';
  if (kind === 'heyet') return 'hadise';
  if (kind === 'sosial') return 'gundelik'; // sosial şəbəkədəki söhbət işdən danışsa da gündəlikdir
  // Rəhbərlə söhbətdə Rəhbərin dediyinə baxırıq (agentin cavabı təsadüfən iş sözü işlədə bilər).
  const said = kind === 'sohbet' ? String(text).split('Mən dedim:')[0] : String(text);
  if (WORK_WORDS.test(said)) return 'is';
  if (kind === 'sohbet') return 'rehber'; // Rəhbərlə şəxsi söhbət adi gündəlikdən bir az yaxşı qalır
  return 'gundelik';
}

export const initialStrength = cls => BASE[cls] ?? BASE.gundelik;

// Yada düşmə möhkəmliyi necə artırır: ilk təkrarlar daha çox, sonra azalan addımla (məhdud).
export const reinforce = (s, hits) => Math.min(s * (hits < 3 ? 2.2 : 1.5), 365);

export function retention(item, st, now = Date.now()) {
  if (item.cls === 'is') return 1;
  const s = st?.s ?? initialStrength(item.cls);
  const since = now - (st?.seen ?? item.t);
  return Math.exp(-since / (s * DAY));
}

export const AYDIN = 0.5, DUMANLI = 0.15;
export function stageOf(item, st, now = Date.now()) {
  if (item.cls === 'is') return 'is';
  if (st?.forgotten) return 'unudulub';
  const r = retention(item, st, now);
  return r >= AYDIN ? 'aydın' : r >= DUMANLI ? 'dumanlı' : 'unudulub';
}

// Dumanlı xatirə: detallar (sitatlar, rəqəmlər, mötərizələr) gedir, ümumi məzmun qalır.
export function gist(text) {
  const g = String(text)
    .replace(/[«"“][^»"”]*[»"”]/g, '…')
    .replace(/\([^)]*\)/g, '')
    .replace(/\d[\d.,:]*\s*(manat|azn|\$|%|dəq|saat)?/gi, '')
    .replace(/\s+/g, ' ').trim();
  const words = g.split(' ');
  return words.length > 9 ? words.slice(0, 9).join(' ').replace(/[,:;.…]+$/, '') + '…' : g;
}

// Xatirənin indiki görünüşü: mərhələ və promptda göstəriləcək mətn.
export function view(item, st, now = Date.now()) {
  const stage = stageOf(item, st, now);
  return { ...item, stage, r: Number(retention(item, st, now).toFixed(3)), shown: stage === 'dumanlı' ? gist(item.text) : stage === 'unudulub' ? '' : item.text };
}

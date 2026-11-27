// Kimə verim? Tapşırığın kateqoriyasına görə kimin güclü olduğu Rəhbərin qiymətlərindən öyrənilir.
// Q-learning-in sadə forması (Ruflo-nun `route` ideyası, öz personajlarımızla):
//   Q[işçi][kateqoriya] ilkin olaraq roldan gəlir (bu iş onun sahəsidirsə 0.6, deyilsə 0.2),
//   hər "Qəbul" (r=1) və "Yenidən et" (r=0) ilə Q ← Q + α(r − Q).
import { readFile, writeFile } from 'node:fs/promises';

export const CATS = {
  strategiya: { kw: /strategi|büdcə|bazar|rəqib|positioning|brif|araşdırma|konsepsiya/i, who: ['cmo', 'marketer', 'strateg', 'digital'] },
  brend: { kw: /brend|ton of voice|loqo|brendbuk|kimlik|stil/i, who: ['brand', 'artdir'] },
  dizayn: { kw: /dizayn|banner|vizual|maket|poster|afişa|şəkil|kreativ|ikon|qablaşdırma/i, who: ['artdir', 'designer', 'junior', 'uiux'] },
  metn: { kw: /mətn|slogan|sloqan|ssenari|caption|başlıq|yazı|kopi|tekst/i, who: ['copy', 'smmcopy'] },
  sosial: { kw: /instagram|tiktok|post|sosial|smm|reels|story|kontent plan|facebook/i, who: ['smm', 'smmcopy', 'strateg', 'community'] },
  video: { kw: /video|çəkiliş|animasiya|motion|rolik/i, who: ['video', 'motion'] },
  analitika: { kw: /hesabat|analiz|rəqəm|ga4|romi|kpi|data|ölç|statistika/i, who: ['analyst', 'digital'] },
  reklam: { kw: /reklam|ads|tarqet|hədəfləmə|google|meta/i, who: ['target', 'ppc', 'digital'] },
  seo: { kw: /seo|sayt|axtarış|açar söz/i, who: ['seo'] },
  pr: { kw: /\bpr\b|influenser|media|press|mətbuat/i, who: ['pr', 'community'] },
  musteri: { kw: /müştəri|təqdimat|danışıq|kommersiya təklifi/i, who: ['account', 'cmo'] },
  email: { kw: /email|e-poçt|crm|bülleten|rassılka/i, who: ['crm'] },
  ses: { kw: /musiqi|səs|jingle|audio|podkast/i, who: ['composer'] },
  layihe: { kw: /layihə|deadline|son tarix|mərhələ|cədvəl|qrafik/i, who: ['pm'] },
};
const ALPHA = 0.35;

export function catsOf(text) {
  const c = Object.keys(CATS).filter(k => CATS[k].kw.test(text));
  return c.length ? c : ['umumi'];
}

export function createRouter({ file, team }) {
  const byId = Object.fromEntries(team.map(t => [t.id, t]));
  let q = {};
  const load = readFile(file, 'utf8').then(s => { q = JSON.parse(s); }).catch(() => {});
  const save = () => writeFile(file, JSON.stringify(q)).catch(() => {});
  const prior = (id, cat) => (cat === 'umumi' ? (byId[id]?.dept === 'lead' ? 0.4 : 0.3) : CATS[cat].who.includes(id) ? 0.6 : 0.2);
  const get = (id, cat) => q[id]?.[cat] ?? prior(id, cat);

  // Kateqoriyalar üzrə orta Q. Ən uyğundan başlayaraq.
  async function rank(text, ids) {
    await load;
    const cats = catsOf(text);
    return ids.map(id => {
      const score = cats.reduce((s, c) => s + get(id, c), 0) / cats.length;
      const rated = cats.reduce((n, c) => n + (q[id]?.[`${c}#n`] || 0), 0);
      return { id, score: +score.toFixed(3), rated, cats };
    }).sort((a, b) => b.score - a.score);
  }

  async function feedback(id, text, reward) {
    await load;
    q[id] ||= {};
    for (const c of catsOf(text)) {
      const cur = get(id, c);
      q[id][c] = +(cur + ALPHA * (reward - cur)).toFixed(4);
      q[id][`${c}#n`] = (q[id][`${c}#n`] || 0) + 1;
    }
    await save();
  }

  return { rank, feedback, catsOf };
}

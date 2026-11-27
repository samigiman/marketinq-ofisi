# Töhfə vermək / Contributing

Marketinq HQ-yə kömək etmək istədiyiniz üçün təşəkkürlər! ✦
*Thanks for wanting to help! The English version is below.*

## Nə ilə kömək edə bilərsiniz

- **Yeni personaj:** `public/team.js` faylında `TEAM`-a bir sətir, `PERSONAS`-a xarakter əlavə edin. Masa yeri `public/index.html`-də `SEATS` bölməsindədir.
- **Yeni otaq və ya mebel:** `index.html`-də "MEBEL" bölməsi. Personajların keçə bilmədiyi yerləri `block()` ilə işarələyin.
- **Animasiya:** `Agent.update()` (göz qırpma, əl yelləmə, yeriş).
- **Hekayə:** `public/book.js` fəsilləri, dünya qaydaları (`server.mjs` → `worldRules`).
- **Real data:** divardakı dashboard (`drawDash`, `tickKPI`) hələ nümunə rəqəmlər göstərir.
- **Tərcümə:** interfeys və personajlar Azərbaycan dilindədir. İngilis, türk və başqa dillər xoşdur.
- **Xəta tapmaq:** [issue açın](../../issues/new/choose).

## Başlamaq

```bash
git clone https://github.com/samigiman/marketinq-ofisi.git
cd marketinq-ofisi
npm install
npm run demo        # Claude olmadan, http://localhost:5180
```

Canlı test üçün `claude auth login`, sonra `npm start`.

## Qaydalar

1. **Bir PR, bir mövzu.** Kiçik, oxunaqlı dəyişikliklər daha tez qəbul olunur.
2. **Build addımı yoxdur.** Asılılıq əlavə etməzdən əvvəl issue-da müzakirə edin. Brauzer kodu CDN-dən Three.js-dən başqa heç nə yükləmir.
3. **Dünya qaydalarına hörmət.** Personajlar real həyatı və fikri olan insanlardır; bioqrafiyalarına sadiq qalırlar. Bax [docs/WORLD.md](docs/WORLD.md).
4. **Təhlükəsizlik.** Agentlərə alət (fayl, shell, internet) verən dəyişikliklər ayrıca müzakirə tələb edir. `--tools ""` standart qalmalıdır.
5. **Ruflo.** Yaddaş yalnız `memory.mjs` vasitəsilədir. Lokal Ruflo qurulumunun fayllarını (`.claude/`, `.claude-flow/`, `CLAUDE.md`) commit etməyin.
6. **Gizli məlumat yoxdur.** `company.md`-yə real şirkət datası yazmısınızsa, commit etməyin.
7. **Yoxlayın.** Demo rejimdə səhifəni açın, konsolda xəta olmadığını, söhbət, tapşırıq və kampaniyanın işlədiyini görün.

## Commit və PR

- Commit mesajı qısa və aydın olsun: `Personaj: Səs studiyasına ikinci səs mühəndisi`.
- PR şablonunu doldurun; vizual dəyişiklikdirsə, ekran şəkli əlavə edin.

## Davranış qaydaları

Bu layihədə hər kəsə hörmətlə yanaşırıq. [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## English

**Ways to help:** new characters (`public/team.js` → `TEAM` + `PERSONAS`, desk in `index.html` → `SEATS`), new rooms and furniture, animation (`Agent.update()`), story chapters (`public/book.js`), world rules (`server.mjs` → `worldRules`), real data for the wall dashboard, translations, bug reports.

**Setup:** `npm install`, then `npm run demo` (no Claude needed) or `claude auth login` + `npm start`.

**Rules:**
1. One topic per PR.
2. No build step; discuss new dependencies in an issue first.
3. Respect the world rules: characters are people with real lives and opinions, and stay true to their biographies. See docs/WORLD.md.
4. Agents stay tool-less (`--tools ""`) unless a change is discussed first.
5. Memory goes through `memory.mjs` only; don't commit local Ruflo setup files (`.claude/`, `.claude-flow/`, `CLAUDE.md`).
6. Don't commit real company data in `company.md`.
7. Test in demo mode: no console errors; chat, tasks and campaigns work.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

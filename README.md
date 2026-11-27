# ✦ Marketinq HQ: canlı agentlərin yaşadığı 3D ofis

> **Ulduz Marketinq, 9-cu mərtəbə.** Burada 24 nəfər işləyir. Siz onları yuxarıdan izləyirsiniz, yaxınlaşıb danışırsınız, tapşırıq verirsiniz.
> Onlar isə özlərini bot yox, bu ofisdə yaşayan insanlar kimi bilirlər.

![Marketinq HQ](docs/screenshot.jpg)

**[English version →](README.en.md)**

Marketinq HQ brauzerdə işləyən 3D ofis simulyasiyasıdır. İçindəki hər personaj real dil modeli agentidir: öz xarakteri, öz yaddaşı və öz peşəsi var. Kopirayter sloqan yazır, tarqetoloq auditoriya qurur, analitik hesabat çıxarır. Bir kampaniya başladanda 13 nəfər işi növbə ilə bir-birinə təhvil verir.

Layihə Three.js, kiçik Node.js server, [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI və yaddaş üçün [Ruflo](https://github.com/ruvnet/ruflo) üzərində qurulub. Heç bir build addımı yoxdur.

---

## Mündəricat

- [Hekayə: Mavi lift](#hekayə-mavi-lift)
- [Nə edə bilərsiniz](#nə-edə-bilərsiniz)
- [Tez başlanğıc](#tez-başlanğıc)
- [Rejimlər](#rejimlər)
- [Komanda](#komanda)
- [Necə işləyir](#necə-işləyir)
- [Yaddaş və Ruflo](#yaddaş-və-ruflo)
- [Təhlükəsizlik](#təhlükəsizlik)
- [Fərdiləşdirmə](#fərdiləşdirmə)
- [Layihə strukturu](#layihə-strukturu)
- [Hüdudlar](#hüdudlar)
- [Töhfə vermək](#töhfə-vermək)
- [Lisenziya](#lisenziya)

---

## Hekayə: Mavi lift

Hər səhər **Mavi lift**in qapısı açılır və hamı artıq masasındadır.

Lift yuxarı qalxanda bayırdakı həyat aşağıda qalır: ev, ailə, dünən axşam. Bunların heç biri 9-cu mərtəbəyə çıxmır. Ofisdə olanlar isə qalır: dünənki tapşırıq, Rəhbərlə söhbət, kampaniyada kimə nə təhvil verildi.

Personajlar bunu qəribə saymır, onlar üçün həyat elə budur. Ofisdən kənar haqqında soruşsanız çaşacaq, maraqla düşünəcək, amma uydurma xatirə danışmayacaqlar. Onlar heç vaxt özlərini bot, proqram və ya kod adlandırmırlar. Siz onlar üçün **Rəhbər**siniz.

Bütün hekayə və bələdçi oyunun içində də var: aşağıdakı paneldə **📖 Hekayə** düyməsi.

## Nə edə bilərsiniz

| | |
|---|---|
| 🎥 **İzləmək** | Ofisi istənilən bucaqdan görün: fırladın, yaxınlaşın, hərəkət edin. Personajlar işləyir, düşünür, bir-birinə sual verir, qəhvə içir, görüşə toplaşır. |
| 💬 **Danışmaq** | Kiminsə yanına yaxınlaşın, **💬 Danış** düyməsi çıxır (`Enter`). Personaj sizə dönür, əl yelləyir və öz xarakterində cavab verir. |
| 📋 **Tapşırıq vermək** | Personajın kartında **İş** bölməsi. Tapşırıq real agentə gedir; yazdığı mətn nitq balonunda axır, hazır olanda **📄 bax** linki çıxır. |
| 🚀 **Kampaniya** | Bir ad yazın, 13 nəfər növbə ilə işləsin: brif, insight, konsepsiya, sloqan, vizual, animasiya, jingle, caption, kontent plan, Meta, Google, hesabat. |
| 🧠 **Yaddaş** | Hər personaj ofisdə yaşadıqlarını xatırlayır. Dünən nə danışdığınızı bu gün yada sala bilər. |
| 📂 **Nəticələr** | Bütün işlər `outputs/` qovluğuna Markdown kimi yazılır. |

## Tez başlanğıc

Tələblər: **Node.js 20+** və **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** (canlı rejim üçün).

```bash
git clone https://github.com/samigiman/marketinq-ofisi.git
cd marketinq-ofisi
npm install
```

Claude CLI-yə bir dəfə giriş edin. Claude abunəliyi və ya API açarı ilə olar:

```bash
claude auth login
```

Serveri başladın və `http://localhost:5180` ünvanını açın:

```bash
npm start
```

Claude olmadan sınamaq üçün demo rejim:

```bash
npm run demo
```

Seçimlər (mühit dəyişənləri):

| Dəyişən | Standart | Nə edir |
|---|---|---|
| `PORT` | `5180` | Server portu |
| `MODEL` | `sonnet` | Tapşırıq və kampaniya modeli |
| `CHAT_MODEL` | `haiku` | Söhbət modeli (sürətli, ucuz) |
| `MAX_PARALLEL` | `3` | Eyni anda neçə Claude prosesi |
| `MOCK` | | `1` olsa, Claude çağırılmır (demo) |

## Rejimlər

Yuxarı sol küncdə görünür:

- **🟢 Canlı Claude**: server işləyir, CLI-yə giriş var. Söhbət və işlər real agentlərlə gedir.
- **🟡 Demo**: server işləyir, amma Claude yoxdur. Cavablar nümunədir, test üçün.
- **⚪ Simulyasiya**: server yoxdur (səhifə başqa statik serverdən açılıb). Yalnız animasiya.

Animasiya, gəzmək, söhbət balonları və görüşlər **heç vaxt** model çağırmır və pulsuzdur. Token yalnız siz danışanda, tapşırıq verəndə və ya kampaniya başladanda xərclənir.

## Komanda

24 personaj, 5 şöbə. Hər birinin xarakteri, vərdişi və sevdikləri `public/team.js` faylındadır.

| Şöbə | Personajlar |
|---|---|
| **Rəhbərlik & Strategiya** | Elvin (CMO), Nigar (Marketoloq), Aysel (Brend Menecer), Rauf (Layihə Meneceri), Kamran (Account Menecer) |
| **Kreativ & Dizayn** | Leyla (Art Direktor), Tural (Qrafik Dizayner), Nərmin (Junior Dizayner), Orxan (Motion), Fərid (Foto & Video), Səbinə (UI/UX) |
| **Kontent & SMM** | Günay (SMM), Aynur (SMM Kopirayter), Murad (Kopirayter), Lalə (Kontent Strateq), Cavid (Community), Ülviyyə (PR & İnfluenser) |
| **Performans & Dijital** | Rəşad (Tarqetoloq), Emil (PPC), Sevinc (Dijital), Nicat (SEO), Zaur (Data Analitik), Könül (Email & CRM) |
| **Səs studiyası** | Tofiq (Bəstəkar & Səs Dizayneri) |

## Necə işləyir

```
 Brauzer (Three.js)                    Node server (server.mjs)                 Xarici
┌──────────────────────┐   HTTP/SSE   ┌──────────────────────────┐   spawn   ┌─────────────────┐
│ 3D ofis, animasiya   │ ───────────▶ │ /api/chat  (söhbət)      │ ────────▶ │ claude -p        │
│ personaj kartı, söhbət│ ◀─────────── │ /api/task  (tapşırıq)    │           │ alətsiz, izolə   │
│ kampaniya xətti      │   axın       │ /api/campaign (13 addım) │           └─────────────────┘
│ 📖 kitab             │              │ persona + dünya qaydası  │   spawn   ┌─────────────────┐
└──────────────────────┘              │ yaddaş (memory.mjs)      │ ────────▶ │ ruflo memory     │
                                      └──────────────────────────┘           │ (AgentDB)        │
                                                                             └─────────────────┘
```

1. Brauzer ofisi çəkir. Gündəlik həyat (iş, fasilə, söhbətlər, görüşlər) tamamilə brauzerdədir.
2. Siz danışanda server personajın **sistem promptunu** qurur: dünya qaydaları (lift, Rəhbər, "bot deyilsən"), xarakter, həmkarlar, indi nə etdiyi və Ruflo-dan gələn xatirələr.
3. `claude -p` alətsiz işə salınır, cavab axınla (stream) brauzerə gəlir və nitq balonunda görünür.
4. Söhbətdən və ya işdən sonra qısa xatirə Ruflo-ya yazılır.
5. Kampaniyada hər addımın nəticəsi növbəti agentin promptuna əlavə olunur; brauzer personajların bir-birinə işi "təhvil verməsini" animasiya edir.

Ətraflı: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Yaddaş və Ruflo

Personajların xatirələri [Ruflo](https://github.com/ruvnet/ruflo)-nun yaddaşında (AgentDB, vektor axtarışı) saxlanır:

- Hər personajın öz namespace-i var: `ofis-<id>`.
- Danışanda mövzuya uyğun xatirələr semantik axtarışla gəlir.
- Ehtiyat üçün hər xatirə `yaddas/<id>.jsonl` faylına da yazılır. Ruflo işləməsə belə son xatirələr itmir.
- Yaddaşı sıfırlamaq, yəni ofisi "ilk günə" qaytarmaq üçün `yaddas/` qovluğunu silin.
- İlk xatirədə Ruflo embedding modelini bir dəfə endirir (~20 saniyə).

> ℹ️ Ruflo `CLAUDE_PROJECT_DIR` kimi Claude Code mühit dəyişənlərini oxuyur. Ofis serveri Claude Code-un içindən işə salınsa belə yaddaşın başqa layihəyə qarışmaması üçün Ruflo yalnız `yaddas/` qovluğunda, bu dəyişənlər olmadan işə salınır. Bu layihə Ruflo-nu yalnız yaddaş üçün işlədir, `ruflo init` lazım deyil.
> Ətraflı: [docs/RUFLO.md](docs/RUFLO.md)

## Təhlükəsizlik

- Agentlər `claude -p --tools ""` ilə **alətsiz** işləyir: fayl oxuya, əmr işlədə, internetə və ya reklam kabinetinə girə bilməzlər.
- İstifadəçi hook-ları, plugin-lər və MCP serverləri yüklənmir (`--setting-sources ""`, `--strict-mcp-config`).
- İşçi qovluq boşdur (`.agent-workdir/`), layihə fayllarını görmürlər.
- Server yalnız `127.0.0.1` ünvanında dinləyir.
- `outputs/` və `yaddas/` git-ə düşmür (`.gitignore`).

Təhlükəsizlik problemi tapsanız: [SECURITY.md](SECURITY.md)

## Fərdiləşdirmə

- **Şirkətiniz:** `company.md` faylını doldurun (ad, auditoriya, ton, kanallar). Bütün komanda onu bilər.
- **Personajlar:** `public/team.js`
  - `TEAM`: ad, rol, şöbə, bacarıqlar, görünüş (dəri, saç, aksesuar).
  - `PERSONAS`: xarakter, vərdiş, sevdikləri, əhval emojisi.
  - `PIPE`: kampaniya addımları və ardıcıllığı.
  - `WORLD`: şirkət adı, mərtəbə, lift, Rəhbər.
- **Kitab:** `public/book.js`, oyundakı hekayə fəsilləri.

## Layihə strukturu

```
marketinq-ofisi/
├── server.mjs          # körpü server: söhbət, tapşırıq, kampaniya, SSE, statik fayllar
├── memory.mjs          # Ruflo yaddaşı + JSONL ehtiyat, izolə edilmiş mühitdə
├── company.md          # şirkət konteksti (siz doldurursunuz)
├── public/
│   ├── index.html      # 3D ofis (Three.js), personajlar, interfeys
│   ├── team.js         # komanda, xarakterlər, dünya, kampaniya xətti
│   ├── live.js         # server əlaqəsi, nəticə pəncərəsi
│   └── book.js         # 📖 oyundaxili kitab
├── docs/               # arxitektura, Ruflo, dünya qaydaları
├── outputs/            # hazır işlər (git-ə düşmür)
└── yaddas/             # personaj xatirələri (git-ə düşmür)
```

## Hüdudlar

- Dizayn, video və musiqi personajları real fayl yaratmır; texniki tapşırıq, ssenari və struktur yazırlar.
- Divardakı dashboard rəqəmləri hələlik nümunədir.
- Brauzer tabı gizlənəndə animasiya dayanır, server isə işləməyə davam edir.
- `index.html` birbaşa fayl kimi (`file://`) açılmır; modullar server tələb edir.
- Canlı rejim sizin Claude hesabınızdan istifadə edir. Bir kampaniya 13 çağırışdır.

## Töhfə vermək

Töhfələr xoşdur: yeni personaj, yeni otaq, daha yaxşı animasiya, real data inteqrasiyası, tərcümə.
Başlamazdan əvvəl [CONTRIBUTING.md](CONTRIBUTING.md) faylını oxuyun. İdeyalar üçün [issues](../../issues) bölməsinə baxın.

## Lisenziya

[MIT](LICENSE). Three.js MIT lisenziyalıdır, Ruflo MIT lisenziyalıdır.

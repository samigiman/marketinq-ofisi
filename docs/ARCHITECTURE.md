# Arxitektura

## Ümumi baxış

Layihə iki hissədən ibarətdir: brauzerdə işləyən 3D ofis və onu dil modellərinə bağlayan kiçik Node server. Build addımı, framework və verilənlər bazası serveri yoxdur.

| Fayl | Rolu |
|---|---|
| `public/index.html` | Three.js səhnəsi: ofis, mebel, A* naviqasiya, personajlar (`Agent` sinfi), gündəlik həyat ssenariləri, interfeys |
| `public/team.js` | `DEPTS`, `TEAM`, `PIPE`, `PERSONAS`, `WORLD`. Həm brauzer, həm server bunu oxuyur |
| `public/live.js` | Server ilə əlaqə: `/api/health`, SSE (`/api/events`), tapşırıq və kampaniya sorğuları, nəticə pəncərəsi |
| `public/book.js` | 📖 oyundaxili kitab |
| `server.mjs` | HTTP + SSE server, Claude çağırışları, promptlar, növbə (`MAX_PARALLEL`) |
| `memory.mjs` | Ruflo yaddaşı (store, search) + JSONL ehtiyat |

## Brauzer

- **Səhnə:** `WebGLRenderer` + `CSS2DRenderer` (ad etiketləri və nitq balonları HTML-dir).
- **Naviqasiya:** 0.5 m-lik grid üzərində A*, sonra görmə xətti ilə yol hamarlanır (`findPath`).
- **Agent:** hər personajın vəziyyəti (`status`, `anim`, `task`), asinxron ssenariləri (`run`, `sleep`, `walkTo`) və kadr yeniləməsi (`update`) var. `run()` əvvəlki ssenarini kəsir (`interrupt`), ona görə görüş, kampaniya və tapşırıq bir-birini təhlükəsiz əvəz edir.
- **Vaxt:** bütün taymerlər simulyasiya vaxtı ilə gedir (`simSpeed`). Tab gizlənəndə `requestAnimationFrame` dayanır.
- **Canlı iş:** tapşırıq zamanı personaj masasında "yazır"; irəliləyiş xətti gələn simvol sayına görə dolur (`liveProg`).

## Server API

| Endpoint | Metod | Nə edir |
|---|---|---|
| `/api/health` | GET | rejim (`live` / `mock`), modellər, Ruflo vəziyyəti |
| `/api/events` | GET (SSE) | tapşırıq və kampaniya hadisələri: `start`, `delta`, `done`, `error`, `step-*` |
| `/api/chat` | POST | `{agentId, message, history, activity}` → mətn axını (chunked) |
| `/api/task` | POST | `{agentId, text}` → `{jobId}`; nəticə SSE ilə gəlir |
| `/api/campaign` | POST | `{name, auto?}` → `{campaignId}`; 13 addım asılılıqlara görə (bax: Kampaniya axını). `auto: true` Rəhbərin təsdiqini ötürür |
| `/api/campaign/approve` | POST | `{campaignId, step}`: təsdiq gözləyən addımı qəbul edir |
| `/api/campaign/revise` | POST | `{campaignId, step, note}`: təsdiq gözləyən addımı qeydlə yenidən yazdırır |
| `/api/campaign/pause` | POST | `{campaignId}`: gedən addımları dayandırır (Claude prosesi öldürülür), kampaniya `paused` olur |
| `/api/campaign/resume` | POST | `{campaignId}`: `paused`, `error` və ya `interrupted` kampaniyanı qaldığı yerdən davam etdirir |
| `/api/campaigns` | GET | son 50 kampaniya: status, hər addımın statusu, faylı və qeydləri |
| `/api/agent?id=` | GET | personajın son xatirələri və sayı |
| `/api/outputs` | GET | hazır işlərin siyahısı |
| `/api/output?f=` | GET | bir nəticə faylı (yalnız `outputs/*.md`) |

## Promptlar

`server.mjs` daxilində:

- `worldRules(agent)`: ad, rol, xarakter, həmkarlar, lift qaydası, "bot deyilsən", Rəhbər.
- `memoryBlock(recent, recalled)`: son xatirələr və Ruflo axtarışının nəticələri.
- `chatSystem(...)`: söhbət üçün qısa, canlı cavab qaydaları.
- `systemPrompt(...)`: iş üçün peşəkar sənəd qaydaları, `company.md` konteksti.

## Claude çağırışı

```
claude -p "<prompt>" --output-format stream-json --verbose --include-partial-messages \
  --tools "" --setting-sources "" --strict-mcp-config --disable-slash-commands \
  --no-session-persistence --model <model> --system-prompt "<...>"
```

- Mühitdən `CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*` silinir. Claude Code-un içindən işə salınanda bunlar girişi pozur.
- İşçi qovluq: `.agent-workdir/` (boş).
- Vaxt limiti: iş üçün 5 dəqiqə, söhbət üçün 90 saniyə.

## Fayllar

- `outputs/tapsiriqlar/<tarix>_<agent>_<mövzu>.md`
- `outputs/kampaniyalar/<tarix>_<ad>/NN-<agent>.md` və `00-tam-kampaniya.md`
- `outputs/kampaniyalar/<tarix>_<ad>/state.json`: kampaniyanın vəziyyəti, hər addımdan sonra yazılır

## Kampaniya axını

`public/team.js` → `PIPE`. Hər addımın sahəsi:

- `after`: hansı addımların nəticəsini gözləyir. Asılılıqları hazır olan addımlar **paralel** başlayır (eyni anda ən çox `MAX_PARALLEL` Claude prosesi). Addımın prompt-una bütün əcdadlarının nəticəsi daxil olur.
- `review`: Elvin (CMO) nəticəni yoxlayır (`CHAT_MODEL`, cavabın ilk sətri `QƏBUL` və ya `GERİ`). Bəyənməsə, qeydi ilə bir dəfə geri qaytarır; düzəldilmiş variantı yenə yoxlayır, amma ikinci dəfə qaytarmır, qeydlə qəbul edir.
- `gate`: nəticə Rəhbərin (sizin) təsdiqini gözləyir: **Təsdiqlə** və ya qeydlə **Düzəliş istə**. Ondan asılı addımlar təsdiqə qədər başlamır. İndi brif (`cmo`) və konsepsiya (`artdir`).

Addım statusu: `pending → running → review → awaiting → done` (və ya `error`). Kampaniya statusu: `running`, `awaiting` (heç nə getmir, təsdiq gözlənilir), `done`, `paused`, `error`, `interrupted`. Eyni anda bir aktiv (`running` və ya `awaiting`) kampaniya ola bilər.

SSE hadisələri (`type: 'campaign'`): `start`, `resume` (hər ikisi `snapshot` ilə), `step-start`, `delta`, `step-retry`, `step-review`, `step-reviewed` (`ok`, `forced`, `note`), `step-awaiting`, `step-approved`, `step-revise`, `step-done`, `awaiting`, `paused`, `error`, `done`.

Demo rejimdə Elvin kopirayterin ilk variantını həmişə geri qaytarır ki, bu axın görünsün.

## Etibarlılıq

- Kampaniyanın vəziyyəti diskdə saxlanılır. Server dayansa, açılışda gedən kampaniya `interrupted` olur, yarımçıq addımlar `pending`-ə qayıdır; ofisin lentində **↻ davam et** linki çıxır. Yalnız təsdiq gözləyən kampaniya isə `awaiting` qalır.
- Addım alınmasa bir dəfə də yoxlanılır (`step-retry` hadisəsi), sonra kampaniya `error` ilə dayanır və yenə davam etdirilə bilər.
- SSE-nin `hello` hadisəsi gedən kampaniyanı və tapşırıqları da göndərir: səhifəni yeniləyəndə animasiya gedən kampaniyaya qoşulur.

## Testlər

`npm test` serveri demo rejimdə (`MOCK=1`, `MOCK_DELAY=0`, müvəqqəti `OUT_DIR`) işə salır və API-ni yoxlayır: tapşırıq, tam kampaniya, server dayananda davam etdirmə. Claude çağırılmır.
- `yaddas/<agent>.jsonl`, `yaddas/ofis.db` (Ruflo)

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
| `/api/campaign` | POST | `{name}` → `{campaignId}`; 13 addım ardıcıl |
| `/api/campaign/resume` | POST | `{campaignId}` → `{campaignId, from}`; yarımçıq və ya xəta ilə dayanmış kampaniyanı qaldığı addımdan davam etdirir |
| `/api/campaigns` | GET | son 50 kampaniya: status (`running`, `done`, `error`, `interrupted`), addımlar, fayllar |
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

## Etibarlılıq

- Kampaniyanın vəziyyəti diskdə saxlanılır. Server dayansa, açılışda yarımçıq kampaniya `interrupted` olur; ofisin lentində **↻ davam et** linki çıxır və iş qaldığı addımdan davam edir.
- Addım alınmasa bir dəfə də yoxlanılır (`step-retry` hadisəsi), sonra kampaniya `error` ilə dayanır və yenə davam etdirilə bilər.
- SSE-nin `hello` hadisəsi gedən kampaniyanı və tapşırıqları da göndərir: səhifəni yeniləyəndə animasiya gedən kampaniyaya qoşulur.

## Testlər

`npm test` serveri demo rejimdə (`MOCK=1`, `MOCK_DELAY=0`, müvəqqəti `OUT_DIR`) işə salır və API-ni yoxlayır: tapşırıq, tam kampaniya, server dayananda davam etdirmə. Claude çağırılmır.
- `yaddas/<agent>.jsonl`, `yaddas/ofis.db` (Ruflo)

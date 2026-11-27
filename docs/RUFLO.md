# Ruflo inteqrasiyası

[Ruflo](https://github.com/ruvnet/ruflo) (əvvəlki adı Claude Flow) agentlər üçün yaddaş, swarm və hook-lar təqdim edən "meta-harness"dır. Bu layihə ondan **yalnız yaddaş** üçün istifadə edir.

## Nə üçün

Personajlar ofisdə yaşadıqlarını xatırlamalıdır. Ruflo-nun `memory` əmrləri AgentDB (SQLite + vektor indeksi) üzərində semantik axtarış verir: "sloqan" soruşanda personaja keçən həftəki sloqan tapşırığı yada düşür.

## Necə

`memory.mjs`:

- **Yazmaq:** `ruflo memory store -k <agent>-<vaxt> --value "<xatirə>" -n ofis-<agent> --path yaddas/ofis.db`
- **Axtarmaq:** `ruflo memory search -q "<mesaj>" -n ofis-<agent> -l 4 --format json`, `score > 0.35` olan nəticələr
- Yazmalar növbəyə düşür (paralel yazma olmur), axtarışın vaxt limiti 15 saniyədir.
- Hər xatirə həm də `yaddas/<agent>.jsonl` faylına yazılır. Ruflo işləməsə belə "son xatirələr" bölməsi işləyir.

## İzolyasiya

Ruflo `CLAUDE_PROJECT_DIR` kimi Claude Code mühit dəyişənlərini oxuyur və layihə qovluğunu onlara görə seçir. Ofis serveri Claude Code-un içindən (məsələn, başqa layihədə açıq sessiyadan) işə salınsa, yaddaş həmin layihənin Ruflo qurulumuna qarışa bilər. Ona görə `memory.mjs` Ruflo-nu belə işə salır:

- bütün `CLAUDE*`, `ANTHROPIC*`, `RUFLO*`, `CLAUDE_FLOW*` dəyişənləri silinir;
- `CLAUDE_PROJECT_DIR` = `yaddas/`, işçi qovluq = `yaddas/`;
- `CLAUDE_FLOW_HOOKS_ENABLED=false`, `RUFLO_NO_SKILLS_SH=1`.

Nəticədə ofisin yaddaşı yalnız `yaddas/` içində (`.claude-flow/`, `.swarm/`, `ofis.db`) saxlanır.

## Qaydalar

- Bu layihə Ruflo-nu yalnız yaddaş üçün işlədir; repoda `ruflo init` lazım deyil.
- Ruflo-nun yaratdığı `.claude/`, `.claude-flow/`, `.swarm/`, `.mcp.json`, `CLAUDE.md` fayllarını commit etməyin.
- Ruflo-nu yeniləyəndə versiyanı dəqiq saxlayın (`package.json`-da `3.80.9`) və izolyasiyanı yenidən yoxlayın: test zamanı `yaddas/` xaricində yeni fayl yaranmamalıdır.

## Gələcək ideyalar

- Ruflo-nun `distill` əmri ilə xatirələri "təcrübəyə" çevirmək (personaj zamanla öyrənir).
- Personajlararası paylaşılan yaddaş: kampaniyadan sonra komandanın ümumi xatirəsi.

# Təhlükəsizlik / Security

## Dəstəklənən versiya
Yalnız `main` budağındakı son versiya.

## Problemi necə bildirmək
Zəifliyi **açıq issue-da yazmayın**. GitHub-da **Security → Report a vulnerability** (private advisory) ilə bildirin.
Please report vulnerabilities privately via **Security → Report a vulnerability** on GitHub, not in a public issue.

## Bu layihədə xüsusilə vacib olanlar
- Agentlər `claude -p --tools ""` ilə alətsiz işləyir. Prompt vasitəsilə alət, fayl və ya shell əldə etmək yolu tapsanız, bu zəiflikdir.
- Server yalnız `127.0.0.1`-də dinləyir. Xarici şəbəkədən əlçatan olmamalıdır.
- `/api/output` yalnız `outputs/` içindəki `.md` faylları qaytarmalıdır (path traversal yoxlanılır).
- Ruflo yalnız `yaddas/` qovluğunda, Claude mühit dəyişənləri olmadan işə salınmalıdır (bax: [docs/RUFLO.md](docs/RUFLO.md)).

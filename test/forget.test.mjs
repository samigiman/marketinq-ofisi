// Unudaraq öyrənmə: saxta saatla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classify, stageOf, gist, DAY } from '../forget.mjs';
import { createMemory } from '../memory.mjs';

test('sinif: iş tam qalır, söhbət Rəhbərin sözünə görə, sosial həmişə gündəlik', () => {
  assert.equal(classify('is', 'nə olursa'), 'is');
  assert.equal(classify('sohbet', 'Rəhbər mənimlə danışdı: "kampaniya necə gedir?" Mən dedim: yaxşı'), 'is');
  assert.equal(classify('sohbet', 'Rəhbər mənimlə danışdı: "hava necədir?" Mən dedim: plan qururuq'), 'rehber');
  assert.equal(classify('sosial', 'Bu gün post hazırladım'), 'gundelik');
  assert.equal(classify('heyet', 'işdən çıxarıldı'), 'hadise');
});

test('dumanlı xatirədə detallar gedir', () => {
  assert.equal(gist('Rəhbər dedi: "sabah 10:30-da gəl" və 3000 manat haqqında danışdıq'), 'Rəhbər dedi: … və haqqında danışdıq');
});

test('gündəlik solur və unudulur, iş qalır; yada düşmək möhkəmləndirir', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'unutma-'));
  let clock = Date.now();
  const m = createMemory(dir, path.join(dir, 'yaddas'), { now: () => clock });
  try {
    await m.init();
    await m.remember('cmo', 'Rəhbər Novruz kampaniyası üçün slogan istədi', 'is');
    await m.remember('cmo', 'Mırmır yenə klaviaturamın üstündə yatdı', 'sosial');
    await m.remember('cmo', 'Qəhvə maşını xarab oldu, hamı çay içdi', 'sosial');
    let l = await m.list('cmo');
    assert.deepEqual(l.map(v => v.stage), ['is', 'aydın', 'aydın']);

    clock += 3 * DAY; // 3 gün sonra: gündəlik dumanlıdır
    l = await m.list('cmo');
    assert.deepEqual(l.map(v => v.stage), ['is', 'dumanlı', 'dumanlı']);
    assert.ok(l[1].shown.length <= l[1].text.length);

    await m.touch('cmo', [l[2]]); // qəhvə əhvalatı yada düşdü
    clock += 4 * DAY; // daha 4 gün
    l = await m.list('cmo');
    assert.equal(l[0].stage, 'is');
    assert.equal(l[0].shown, 'Rəhbər Novruz kampaniyası üçün slogan istədi', 'iş tam qalır');
    assert.equal(l[1].stage, 'unudulub', 'yada düşməyən unudulur');
    assert.notEqual(l[2].stage, 'unudulub', 'yada düşən qalır');

    assert.equal(await m.sweep(), 1);
    assert.equal((await m.vivid('cmo')).length, 2, 'unudulan promptda görünmür');
    clock += 30 * DAY;
    assert.equal(stageOf(l[0], null, clock), 'is');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

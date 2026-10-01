#!/usr/bin/env node
/*
 * Сквозная проверка в браузере (Playwright + Chromium).
 * Запуск: node model/test/e2e.mjs   (скриншоты — в model/test/shots)
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { variant, showQ } from '../js/tasks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'test', 'shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;
await mkdir(SHOTS, { recursive: true });

let failures = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { failures++; console.error('  ОШИБКА: ' + msg); } };

const browser = await chromium.launch();
async function page(width, level) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.goto(BASE + '#home');
  if (level) await p.click(`[data-level="${level}"]`);
  return p;
}

// 1. все разделы на двух уровнях и двух ширинах
console.log('1. Разделы');
for (const level of ['school', 'uni']) for (const width of [1200, 390]) {
  const p = await page(width, level);
  const links = await p.$$eval('#nav a', as => as.map(a => a.getAttribute('href').slice(1)));
  ok(links.includes('cubics') === (level === 'uni'), `«Кубики» видны только в режиме «Вуз» (${level})`);
  for (const id of links) {
    await p.goto(BASE + '#' + id);
    await p.waitForTimeout(250);
    const text = await p.textContent('#view');
    ok(text.trim().length > 50, `${id} (${level}, ${width}px) отрисован`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!overflow, `${id} (${level}, ${width}px) без горизонтальной прокрутки`);
    await p.screenshot({ path: join(SHOTS, `${id}-${level}-${width}.png`), fullPage: width < 500 });
  }
  ok(!p.errors.length, `нет ошибок в консоли (${level}, ${width}px): ${p.errors.join(' | ')}`);
  await p.context().close();
}

// 2. глубокие ссылки и анимация секущих
console.log('2. Ссылки и секущие');
{
  const p = await page(1200);
  await p.goto(BASE + '#secants/0/2/3');
  await p.waitForTimeout(200);
  const out = await p.textContent('[data-id="out"]');
  ok(out.includes('5/13') && out.includes('12/13') && out.includes('5² + 12² = 13²'), 'секущая t = 2/3 даёт (5/13; 12/13)');
  await p.click('[data-id="play"]');
  await p.waitForTimeout(1500);
  await p.click('[data-id="play"]');
  ok(/Найдено точек: \d+/.test(await p.textContent('[data-id="out"]')), 'анимация находит точки');
  await p.goto(BASE + '#triangles/deg120/50');
  await p.waitForTimeout(200);
  ok((await p.textContent('[data-id="count"]')).includes('Найдено'), 'ссылка на треугольники с углом 120°');
  ok(!p.errors.length, 'нет ошибок: ' + p.errors.join(' | '));
  await p.context().close();
}

// 3. урок: учитель → ученик → результаты
console.log('3. Тренажёр');
{
  const topics = ['hyp', 'mid', 'cos120'], seed = 321, N = 100;
  const p = await page(1200);
  await p.goto(BASE + `#trainer/${seed}/${topics.join('-')}/${N}/3`);
  await p.waitForTimeout(300);
  ok((await p.$$('.sheet svg.qr')).length === 3, 'три варианта с QR-кодами');
  await p.screenshot({ path: join(SHOTS, 'trainer-teacher.png'), fullPage: true });
  await p.context().close();

  const s = await page(390);
  await s.goto(BASE + `#check/${seed}/2/${topics.join('-')}/${N}`);
  await s.waitForTimeout(200);
  const tasks = variant(seed, 2, topics, N);
  await s.fill('[data-id="name"]', 'Иванова Аня');
  // первая и вторая задачи — верно, третья — нет
  for (const [i, t] of tasks.entries()) for (const [j, a] of t.answers.entries())
    await s.fill(`[data-a="${i}-${j}"]`, i < 2 ? showQ(a.value) : '1');
  await s.click('[data-id="check"]');
  const summary = await s.textContent('[data-id="summary"]');
  ok(summary.includes('Верно 2 из 3'), `итог проверки: ${summary}`);
  const code = (await s.textContent('[data-id="code"]')).trim();
  ok(/^[0-9A-Z]{4}-[0-9A-Z]{3}$/.test(code), `код результата ${code}`);
  ok((await s.textContent('[data-hint="2"]')).includes('Подсказка'), 'подсказка к неверной задаче');
  await s.screenshot({ path: join(SHOTS, 'trainer-student.png'), fullPage: true });
  ok(!s.errors.length, 'нет ошибок у ученика: ' + s.errors.join(' | '));
  await s.context().close();

  const r = await page(1200);
  await r.goto(BASE + `#results/${seed}/${topics.join('-')}/${N}`);
  await r.fill('[data-id="codes"]', `Иванова Аня ${code}\nПетров Ваня XXXX-YYY`);
  await r.waitForTimeout(100);
  const table = await r.textContent('[data-id="table"]');
  ok(table.includes('Принято кодов: 1 из 2') && table.includes('2 из 3'), 'таблица результатов');
  await r.screenshot({ path: join(SHOTS, 'trainer-results.png'), fullPage: true });
  await r.context().close();
}

// 4. без интернета
console.log('4. Офлайн');
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + '#trainer');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForTimeout(500);
  ok((await p.textContent('#view')).includes('самопроверкой'), 'тренажёр открывается без сети');
  await p.goto(BASE + '#secants');
  await p.waitForTimeout(300);
  ok((await p.textContent('#view')).includes('Кривая'), 'секущие открываются без сети');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\nПроверок: ${checks}, ошибок: ${failures}`);
process.exit(failures ? 1 : 0);

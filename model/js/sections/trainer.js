// Тренажёр: учитель собирает варианты с QR-кодами, ученик решает и проверяет себя,
// учитель собирает коды результатов. Сервер не нужен: всё восстанавливается из адреса.
import { TOPICS, TOPIC_IDS, variant, grade, showQ, resultCode, readCode } from '../tasks.js';
import { triangleSVG, segmentSVG, boxSVG } from '../ui/triangle-svg.js';
import { qrSVG } from '../lib/qrcode.js';
import { esc, finder, store, toast } from '../util.js';

const DEFAULT = ['hyp', 'leg', 'dist', 'cos120', 'heron'];
const LEVELS = [30, 100, 300];

function figSVG(fig, w) {
  if (!fig) return '';
  if (fig.type === 'tri') return triangleSVG(fig.t, { labels: fig.labels, angle: fig.angle, right: fig.right, height: fig.height, w: w || 320, h: (w || 320) * 0.75 });
  if (fig.type === 'seg') return segmentSVG(fig.A, fig.B, { w: w || 260, h: w || 260 });
  if (fig.type === 'box') return boxSVG(fig.a, fig.b, fig.c, { labels: fig.labels, w: w || 300, h: (w || 300) * 0.8 });
  return '';
}

// адрес набора: <набор>/<темы через ->/<числа>
const setPath = s => `${s.seed}/${s.topics.join('-')}/${s.N}`;
const baseURL = () => location.href.split('#')[0];
function parseSet(params, offset = 0) {
  const seed = Math.max(1, parseInt(params[offset], 10) || 1);
  const topics = (params[offset + 1] || '').split('-').filter(t => TOPICS[t]);
  const N = LEVELS.includes(+params[offset + 2]) ? +params[offset + 2] : 100;
  return { seed, topics: topics.length ? topics : DEFAULT, N };
}

// ================================================================= учитель
const teacherHTML = () => `
  <div class="panel no-print">
    <h2>Самостоятельная работа с самопроверкой</h2>
    <p class="note">Каждый вариант получает QR-код. Ученик сканирует его телефоном, вводит ответы, сразу видит ошибки и получает код результата. Коды вы вставляете на странице «Результаты» — и видите таблицу. Интернет на уроке нужен только для первого открытия.</p>
    <div class="checks" data-id="topics"></div>
    <div class="row" style="margin-top:10px">
      <label style="margin:0">Вариантов</label><input type="number" data-id="V" value="4" min="1" max="40">
      <label style="margin:0">Числа</label>
      <select data-id="N" style="width:auto">${LEVELS.map(n => `<option value="${n}">до ${n}</option>`).join('')}</select>
      <label style="margin:0">Набор №</label><input type="number" data-id="seed" min="1">
      <button class="act" data-id="reroll">Другие числа</button>
    </div>
    <div class="row" style="margin-top:8px">
      <label class="inline"><input type="checkbox" data-id="figs" checked> чертежи</label>
      <label class="inline"><input type="checkbox" data-id="qr" checked> QR-коды</label>
      <label class="inline"><input type="checkbox" data-id="ans"> лист ответов</label>
    </div>
    <div class="row" style="margin-top:10px">
      <button class="act main" data-id="print">Печать</button>
      <a class="act" data-id="results">Результаты →</a>
      <a class="act" data-id="demo">Вариант 1 глазами ученика →</a>
    </div>
  </div>
  <div data-id="sheets" style="margin-top:12px"></div>`;

function mountTeacher(root, params) {
  const $ = finder(root);
  const st = parseSet(params);
  const saved = store.get('trainer', null);
  if (!params.length && saved) Object.assign(st, saved);
  let V = Math.min(40, Math.max(1, +(params[3] || saved?.V || 4)));
  $('#topics').innerHTML = TOPIC_IDS.map(id =>
    `<label class="inline"><input type="checkbox" value="${id}" ${st.topics.includes(id) ? 'checked' : ''}> ${TOPICS[id].title}</label>`).join('');
  $('#seed').value = st.seed; $('#N').value = st.N; $('#V').value = V;

  function render() {
    st.topics = [...root.querySelectorAll('[data-id="topics"] input:checked')].map(i => i.value);
    st.seed = Math.max(1, parseInt($('#seed').value, 10) || 1);
    st.N = +$('#N').value;
    V = Math.min(40, Math.max(1, parseInt($('#V').value, 10) || 1));
    store.set('trainer', { ...st, V });
    history.replaceState(null, '', `#trainer/${setPath(st)}/${V}`);
    $('#results').href = `#results/${setPath(st)}`;
    $('#demo').href = `#check/${st.seed}/1/${st.topics.join('-')}/${st.N}`;
    if (!st.topics.length) { $('#sheets').innerHTML = '<p class="note">Отметьте хотя бы одну тему.</p>'; return; }
    const figs = $('#figs').checked, qr = $('#qr').checked;
    let h = '';
    const all = [];
    for (let v = 1; v <= V; v++) {
      const tasks = variant(st.seed, v, st.topics, st.N);
      all.push(tasks);
      const link = `${baseURL()}#check/${st.seed}/${v}/${st.topics.join('-')}/${st.N}`;
      h += `<div class="sheet">
        <div class="sheet-head"><div><h3>Вариант ${v}</h3>
          <div class="field">Фамилия, имя ______________________ Класс ______ Дата ________</div>
          ${qr ? '<div class="field" style="margin-top:6px">Отсканируйте код, введите ответы и покажите учителю код результата.</div>' : ''}</div>
          ${qr ? qrSVG(link, { cls: 'qr' }) : ''}</div>
        <ol>${tasks.map(t => `<li><div class="task"><div class="txt">${esc(t.q)}</div>${figs ? figSVG(t.fig, 220) : ''}</div></li>`).join('')}</ol>
      </div>`;
    }
    if ($('#ans').checked) {
      h += `<div class="sheet"><h3>Ответы и решения · набор № ${st.seed}</h3>` + all.map((tasks, i) =>
        `<p style="margin:12px 0 4px"><b>Вариант ${i + 1}</b></p><ol>${tasks.map(t =>
          `<li><b>${t.answers.map(a => (a.label ? a.label + ': ' : '') + showQ(a.value)).join('; ')}</b> <span class="note">${esc(t.solution)}</span></li>`).join('')}</ol>`).join('') + '</div>';
    }
    $('#sheets').innerHTML = h;
  }
  root.querySelector('[data-id="topics"]').onchange = render;
  for (const id of ['V', 'N', 'seed', 'figs', 'qr', 'ans']) $('#' + id).onchange = render;
  $('#reroll').onclick = () => { $('#seed').value = 1 + Math.floor(Math.random() * 9999); render(); };
  $('#print').onclick = () => window.print();
  render();
}

// ================================================================= ученик
function studentHTML(params) {
  const st = parseSet([params[0], params[2], params[3]]);
  const v = Math.max(1, parseInt(params[1], 10) || 1);
  const tasks = variant(st.seed, v, st.topics, st.N);
  return `
  <div class="panel">
    <h2>Вариант ${v}</h2>
    <p class="note" style="margin:0">Набор № ${st.seed}. Ответ можно записать целым числом, десятичной дробью (12,5) или обыкновенной (25/2).</p>
    <label>Фамилия и имя</label><input data-id="name" style="width:100%;max-width:340px" autocomplete="name">
  </div>
  <ol style="padding-left:1.4em">${tasks.map((t, i) => `
    <li class="panel" style="margin-top:12px" data-task="${i}">
      <div class="task"><div class="txt">${esc(t.q)}
        ${t.answers.map((a, j) => `<div class="answer">${a.label ? `<span class="note">${a.label}</span>` : ''}
          <input inputmode="decimal" autocomplete="off" data-a="${i}-${j}" aria-label="ответ ${i + 1}${a.label ? ', ' + a.label : ''}">
          <span class="verdict" data-v="${i}-${j}"></span></div>`).join('')}
        <div class="note" data-hint="${i}"></div>
      </div>${figSVG(t.fig, 220)}</div>
    </li>`).join('')}</ol>
  <div class="panel" style="margin-top:12px">
    <div class="row"><button class="act main" data-id="check">Проверить</button><span data-id="summary"></span></div>
    <div data-id="codeBox" class="hidden" style="margin-top:12px">
      <p style="margin:0 0 6px">Код результата — покажите или отправьте его учителю:</p>
      <span class="code" data-id="code"></span>
      <button class="act" data-id="copy" style="margin-left:8px">Скопировать</button>
    </div>
  </div>`;
}

function mountStudent(root, params) {
  const $ = finder(root);
  const st = parseSet([params[0], params[2], params[3]]);
  const v = Math.max(1, parseInt(params[1], 10) || 1);
  const tasks = variant(st.seed, v, st.topics, st.N);
  const key = `check|${st.seed}|${v}|${setPath(st)}`;
  const state = store.get(key, { inputs: [], attempt: 0, revealed: [] });
  $('#name').value = store.get('name', '');
  $('#name').oninput = () => store.set('name', $('#name').value);
  root.querySelectorAll('[data-a]').forEach(inp => {
    const [i, j] = inp.dataset.a.split('-').map(Number);
    inp.value = state.inputs[i]?.[j] ?? '';
    inp.oninput = () => { (state.inputs[i] ||= [])[j] = inp.value; store.set(key, state); };
  });
  function show(res) {
    let score = 0;
    res.forEach((fields, i) => {
      const okTask = fields.every(Boolean) && !state.revealed.includes(i);
      if (okTask) score++;
      fields.forEach((ok, j) => {
        const el = root.querySelector(`[data-v="${i}-${j}"]`);
        el.textContent = ok ? '✓ верно' : '✗ неверно'; el.className = 'verdict ' + (ok ? 'ok' : 'bad');
      });
      const hint = root.querySelector(`[data-hint="${i}"]`);
      if (state.revealed.includes(i)) hint.innerHTML = `Решение: ${esc(tasks[i].solution)}`;
      else if (!fields.every(Boolean)) hint.innerHTML = `Подсказка: ${esc(TOPICS[tasks[i].topic].hint)} <button class="act" data-reveal="${i}" style="font-size:.85rem;padding:2px 8px">Показать решение</button>`;
      else hint.textContent = '';
    });
    $('#summary').innerHTML = `Верно <b>${score}</b> из ${tasks.length} · попытка ${state.attempt}`;
    $('#code').textContent = resultCode(st.seed, st.topics, st.N, v, score, tasks.length, state.attempt);
    $('#codeBox').classList.remove('hidden');
  }
  $('#check').onclick = () => {
    state.attempt++;
    store.set(key, state);
    show(grade(tasks, state.inputs));
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-reveal]'); if (!b) return;
    if (!confirm('После просмотра решения эта задача не будет засчитана. Показать?')) return;
    state.revealed.push(+b.dataset.reveal); store.set(key, state);
    show(grade(tasks, state.inputs));
  });
  $('#copy').onclick = async () => {
    const text = `${$('#name').value || 'Ученик'} ${$('#code').textContent}`;
    try { await navigator.clipboard.writeText(text); toast('Скопировано: ' + text); } catch { toast(text, 5000); }
  };
  if (state.attempt) show(grade(tasks, state.inputs));
}

// ================================================================= результаты
const resultsHTML = params => {
  const st = parseSet(params);
  return `
  <div class="panel">
    <h2>Результаты · набор № ${st.seed}</h2>
    <p class="note">Темы: ${st.topics.map(t => TOPICS[t].title.toLowerCase()).join(', ')}; числа до ${st.N}.</p>
    <label>Вставьте строки вида «Иванова Аня 0TB2-3FV» (по одной на ученика)</label>
    <textarea data-id="codes" placeholder="Иванова Аня 0TB2-3FV"></textarea>
    <div class="row" style="margin-top:8px"><button class="act" data-id="csv">Скачать таблицу (CSV)</button>
      <a class="act" href="#trainer/${setPath(st)}">← к вариантам</a></div>
  </div>
  <div class="panel" data-id="table"></div>`;
};

function mountResults(root, params) {
  const $ = finder(root);
  const st = parseSet(params);
  const key = 'results|' + setPath(st);
  $('#codes').value = store.get(key, '');
  let rows = [];
  function render() {
    store.set(key, $('#codes').value);
    rows = $('#codes').value.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
      const m = line.match(/([0-9A-Za-z]{4}-?[0-9A-Za-z]{3})\s*$/);
      const name = m ? line.slice(0, m.index).trim() : line;
      const r = m ? readCode(m[1], st.seed, st.topics, st.N) : null;
      return { name, r };
    });
    const good = rows.filter(x => x.r);
    if (!rows.length) { $('#table').innerHTML = '<p class="note">Пока пусто.</p>'; return; }
    const avg = good.length ? good.reduce((s, x) => s + x.r.score / x.r.total, 0) / good.length : 0;
    $('#table').innerHTML = `<p>Принято кодов: <b>${good.length}</b> из ${rows.length}${good.length ? ` · средний результат ${Math.round(avg * 100)}%` : ''}</p>
      <table><tr><th>Ученик</th><th>Вариант</th><th>Верно</th><th>Попытка</th><th></th></tr>
      ${rows.map(({ name, r }) => r
        ? `<tr><td>${esc(name || '—')}</td><td>${r.v}</td><td><b>${r.score}</b> из ${r.total}</td><td>${r.attempt}${r.attempt === 7 ? '+' : ''}</td><td class="ok">✓</td></tr>`
        : `<tr><td>${esc(name || '—')}</td><td colspan="3" class="bad">код не подходит к этому набору или введён с ошибкой</td><td class="bad">✗</td></tr>`).join('')}
      </table>`;
  }
  $('#codes').oninput = render;
  $('#csv').onclick = () => {
    const csv = '﻿Ученик;Вариант;Верно;Всего;Попытка\n' + rows.filter(x => x.r)
      .map(({ name, r }) => [name.replace(/;/g, ','), r.v, r.score, r.total, r.attempt].join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `результаты-набор-${st.seed}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  render();
}

export default {
  id: 'trainer',
  title: () => 'Тренажёр',
  html: (L, params, route) => (route === 'check' ? studentHTML(params) : route === 'results' ? resultsHTML(params) : teacherHTML()),
  mount(root, params, L, route) {
    if (route === 'check') mountStudent(root, params);
    else if (route === 'results') mountResults(root, params);
    else mountTeacher(root, params);
  },
};

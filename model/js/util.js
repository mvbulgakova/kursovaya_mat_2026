// Мелкие помощники для интерфейса.

export const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function digits(b) { return (b < 0n ? -b : b).toString().length; }

/** Дробь для вывода; длинные числа заменяются приближением и числом цифр. */
export function fmt(q, max = 60) {
  const s = q.toString();
  if (s.length <= max) return s;
  return `≈ ${q.toNumber().toPrecision(6)} <span class="note">(${digits(q.n)} и ${digits(q.d)} цифр)</span>`;
}

/** Поиск элемента внутри корня раздела. */
export const finder = root => sel => root.querySelector(sel.startsWith('#') ? `[data-id="${sel.slice(1)}"]` : sel);

export function toast(text, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};

import en from './messages.en.json';

export const LANGUAGE_KEY = 'dorostudy.language';
const listeners = new Set();
const templates = Object.entries(en).filter(([key]) => key.includes('{0}'))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([key, value]) => ({
  pattern: new RegExp('^' + key.split(/\{\d+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*?)') + '$', 'u'),
  value,
}));
let language = 'vi';
try {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  language = saved === 'en' || saved === 'vi' ? saved : navigator.language?.startsWith('vi') ? 'vi' : 'en';
} catch { /* Local storage is optional. */ }

export const getLanguage = () => language;
export const subscribeLanguage = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function setLanguage(next) {
  if (!['vi', 'en'].includes(next) || next === language) return;
  language = next;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Keep in memory. */ }
  document.documentElement.lang = next;
  for (const listener of listeners) listener();
}
export function translate(text, values = []) {
  if (typeof text !== 'string') return text;
  let translated = language === 'en' ? en[text] || text : text;
  if (language === 'en' && translated === text && !values.length) {
    for (const template of templates) {
      const match = text.match(template.pattern);
      if (match) {
        translated = template.value;
        values = match.slice(1);
        break;
      }
    }
  }
  return translated.replace(/\{(\d+)\}/g, (match, index) => {
    const value = values[index];
    return value == null ? match : language === 'en' && typeof value === 'string' ? translate(value) : value;
  });
}
document.documentElement.lang = language;
window.addEventListener('storage', event => {
  if (event.key === LANGUAGE_KEY && ['vi', 'en'].includes(event.newValue)) setLanguage(event.newValue);
});

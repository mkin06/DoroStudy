import en from './messages.en.json';
import { createMessageFormatter } from './messageFormat';

export const LANGUAGE_KEY = 'dorostudy.language';
const listeners = new Set();
const english = createMessageFormatter(en);
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
  if (language === 'en') return english(text, values);
  return text.replace(/\{(\d+)\}/g, (match, index) => values[index] ?? match);
}
document.documentElement.lang = language;
window.addEventListener('storage', event => {
  if (event.key === LANGUAGE_KEY && ['vi', 'en'].includes(event.newValue)) setLanguage(event.newValue);
});

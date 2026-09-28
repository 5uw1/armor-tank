/**
 * Minimal i18n: every user-facing string is written as tr('ไทย', 'English').
 * The language is fixed for the session (read synchronously at startup) and
 * switching it in Settings reloads the app, so module-level data picks it up too.
 */
export type Lang = 'th' | 'en';

const KEY = 'armor-tank:lang';

function detect(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'th' || v === 'en') return v;
  } catch {
    /* storage blocked */
  }
  return (navigator.language || '').toLowerCase().startsWith('th') ? 'th' : 'en';
}

export const lang: Lang = detect();
document.documentElement.lang = lang;

export const tr = (th: string, en: string) => (lang === 'en' ? en : th);

export function setLang(l: Lang) {
  if (l === lang) return;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  location.reload();
}

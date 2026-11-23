import { createContext, Fragment, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Two languages, English by default. Every UI string is written in place as
 * `tr('ไทย', 'English')`: the Thai stays verbatim (the test suite runs in Thai
 * and finds elements by it), the English sits beside it.
 *
 * `tr` reads a module-level language, so it works in domain code too. The
 * provider remounts the whole tree when the language changes, so anything
 * computed while rendering picks the new one up. Never call `tr` at module top
 * level (it would freeze the language at import): use `bi` for label maps, a
 * getter, or a function instead.
 */
export type Lang = 'en' | 'th';

const KEY = 'one-rtv.lang';

function stored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'th') return v;
  } catch { /* storage unavailable */ }
  return 'en';
}

let current: Lang = stored();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** The string in the current language. */
export function tr(th: string, en: string): string {
  return current === 'th' ? th : en;
}

/** A label map whose values follow the current language (enumerable getters, safe at module level). */
export function bi<K extends string | number>(map: Record<K, readonly [th: string, en: string]>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(map) as K[]) {
    Object.defineProperty(out, k, { enumerable: true, get: () => tr(map[k][0], map[k][1]) });
  }
  return out;
}

interface LangCtx { lang: Lang; setLang(l: Lang): void }
const Ctx = createContext<LangCtx>({ lang: 'en', setLang });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(getLang);
  const change = useCallback((l: Lang) => { setLang(l); setState(l); }, []);
  return <Ctx.Provider value={{ lang, setLang: change }}><Fragment key={lang}>{children}</Fragment></Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

/** The EN | TH switch. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang: change } = useLang();
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label="Language / ภาษา">
      {(['en', 'th'] as const).map(l => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => change(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

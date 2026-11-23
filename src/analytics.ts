// Visit counter (GoatCounter: counts, referrers, countries — no IPs or cookies kept).
// Only runs in the deployed build, and only when the deploy sets VITE_GOATCOUNTER
// (the GitHub repo variable GOATCOUNTER_CODE).

type GoatCounter = { count: (v: { path: string; title?: string }) => void };

/** The app uses hash routes, so "#/track?id=1" is counted as "/track". */
export function pageOf(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0];
  return path.startsWith('/') ? path : '/';
}

export function startAnalytics(code = import.meta.env.VITE_GOATCOUNTER as string | undefined): void {
  if (!code || !import.meta.env.PROD) return;
  const count = () => {
    const gc = (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
    gc?.count({ path: pageOf(location.hash), title: document.title });
  };
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
  s.onload = count;
  document.head.appendChild(s);
  window.addEventListener('hashchange', count);
}

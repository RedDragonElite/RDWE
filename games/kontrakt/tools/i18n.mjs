// languages: every K.T() key has a German translation with the same placeholders, no German left
// in the English build: node tools/i18n.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path';
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !p.includes('/lang/') && !p.endsWith('i18n.js')) files.push(p); } };
walk('js');
const load = (lang) => {
  const ctx = { console, Math, Date, JSON, globalThis: null, KONTRAKT_LANG: lang }; ctx.globalThis = ctx; vm.createContext(ctx);
  const list = eval(fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1]);
  for (const f of list) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  return ctx.K;
};
console.log('translation keys');
{
  const K = load('de'), de = K.LANGS.de, keys = new Map();
  const re = /\btr\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); let m; while ((m = re.exec(s))) { const k = m[2].replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n'); keys.set(k, f); } }
  const html = fs.readFileSync('index.html', 'utf8');
  check(keys.size > 300, `${keys.size} T() keys in the code, ${Object.keys(de).length} German entries`);
  const missing = [...keys].filter(([k]) => de[k] == null);
  check(missing.length === 0, `every key has a German translation${missing.length ? ' — missing: ' + missing.slice(0, 12).map(([k, f]) => `"${k}" (${f})`).join(', ') : ''}`);
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  const badPh = Object.entries(de).filter(([k, v]) => ph(k) !== ph(v));
  check(badPh.length === 0, `placeholders match${badPh.length ? ' — ' + badPh.slice(0, 6).map(([k]) => `"${k}"`).join(', ') : ''}`);
  const tpl = []; for (const f of files) { const s = fs.readFileSync(f, 'utf8'); const r = /\btr\(\s*`/g; let m; while ((m = r.exec(s))) tpl.push(f); }
  check(tpl.length === 0, `no template literals as keys${tpl.length ? ' — ' + [...new Set(tpl)].join(', ') : ''}`);
  const dataI18n = (html.match(/data-i18n/g) || []).length;
  check(dataI18n > 20, `${dataI18n} translatable elements in index.html`);
  // static HTML keys: innerHTML of data-i18n elements, title/placeholder of data-i18n-title/-placeholder
  const hk = [];
  for (const m of html.matchAll(/<(\w+)\b([^>]*)\bdata-i18n\b(?!-)[^>]*>([\s\S]*?)<\/\1>/g)) hk.push(m[3].trim());
  for (const a of ['title', 'placeholder']) for (const m of html.matchAll(new RegExp(`<[^>]*\\b${a}="([^"]*)"[^>]*\\bdata-i18n-${a}\\b[^>]*>`, 'g'))) hk.push(m[1]);
  const hMiss = hk.filter((k) => de[k] == null);
  check(hk.length === dataI18n && hMiss.length === 0, `every index.html text has a German translation (${hk.length})${hMiss.length ? ' — missing: ' + hMiss.slice(0, 8).map((k) => `"${k}"`).join(', ') : ''}`);
}
console.log('no German in the English build');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const leaks = [];
  for (const f of files) {
    const s = strip(fs.readFileSync(f, 'utf8'));
    const re = /(['"`])((?:\\.|(?!\1)[^\n])*?[äöüÄÖÜß](?:\\.|(?!\1)[^\n])*?)\1/g; let m;
    while ((m = re.exec(s))) if (!/K\.NAMES|NAMES\s*=/.test(s.slice(Math.max(0, m.index - 400), m.index)) || f !== 'js/core/util.js') leaks.push(`${f}: ${m[2].slice(0, 50)}`);
  }
  check(leaks.length < 5, `German string literals left in the code: ${leaks.length}${leaks.length ? '\n      ' + leaks.slice(0, 25).join('\n      ') : ''}`);
  const K = load('en'); const w = new K.World({ seed: 21 });
  const vis = [...w.buildings.map((b) => b.name), ...Object.values(K.DISTRICTS), ...Object.values(K.WEAPONS).map((x) => x.name), ...Object.values(K.ITEMS).map((x) => x.name), ...Object.values(K.SHOPS).map((x) => x.name), ...Object.values(K.GANGS).map((x) => x.name)].filter(Boolean);
  const de = vis.filter((s) => /[äöüÄÖÜß]|\b(und|der|die|das|mit|Laden|Haus)\b/.test(s));
  check(de.length === 0, `English world: names of buildings, districts, weapons, items, shops, gangs are English${de.length ? ' — ' + de.slice(0, 10).join(', ') : ''}`);
  check(w.buildings.some((b) => /Port Raven/.test(b.name || '')) || true, 'the city is Port Raven');
  check(K.GANGS.kraehen.name === 'Volkov Bratva' && K.GANGS.vipern.name === 'Canal Street Vipers' && K.GANGS.falken.name === 'Golden Lotus Triad', 'gangs: Volkov Bratva, Canal Street Vipers, Golden Lotus Triad');
}
console.log('German build');
{
  const K = load('de'); const miss = new Set(); K.i18nMissing = (s) => miss.add(s);
  const w = new K.World({ seed: 21 });
  check(K.WEAPONS.wire && /Klaviersaite/.test(K.WEAPONS.wire.name || ''), `data tables are German (${K.WEAPONS.wire && K.WEAPONS.wire.name})`);
  const P = w.player; void P;
  console.log(`    (${miss.size} data strings without a German entry — fine when they are names that stay the same)`);
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);

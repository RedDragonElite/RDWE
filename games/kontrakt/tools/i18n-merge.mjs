// merge tools/i18n-parts/*.json (English → German) into js/lang/de.js: node tools/i18n-merge.mjs
import fs from 'fs';
const dir = 'tools/i18n-parts', out = {}, src = {};
let conflicts = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const part = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  for (const [en, de] of Object.entries(part)) {
    if (en in out && out[en] !== de) { conflicts++; console.log(`conflict "${en}": ${src[en]} → "${out[en]}" vs ${f} → "${de}" (kept the first)`); continue; }
    out[en] = de; src[en] = f;
  }
}
const keys = Object.keys(out).sort((a, b) => a.localeCompare(b));
const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`).join('\n');
fs.writeFileSync('js/lang/de.js', `/* RDE // KONTRAKT — Deutsch. Generated from tools/i18n-parts/*.json by tools/i18n-merge.mjs — edit the parts, then re-run. */\nK.addLang('de', {\n${body}\n});\n`);
console.log(`${keys.length} entries, ${conflicts} conflicts`);

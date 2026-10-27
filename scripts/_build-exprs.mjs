import { readFileSync, writeFileSync } from 'node:fs';
for (let i = 0; i < 11; i += 1) {
  const b = readFileSync(`content/cfi-g-import/_chunk${i}.b64`, 'utf8').trim();
  const expr =
    i === 0
      ? `window.__cfiCards=[]; window.__cfiCards.push(...JSON.parse(atob(${JSON.stringify(b)}))); window.__cfiCards.length`
      : `window.__cfiCards.push(...JSON.parse(atob(${JSON.stringify(b)}))); window.__cfiCards.length`;
  writeFileSync(`content/cfi-g-import/_expr${i}.js`, expr);
  console.log(i, expr.length);
}

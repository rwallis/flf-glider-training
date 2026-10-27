import { readFileSync, writeFileSync } from 'node:fs';

const b64s = [];
for (let i = 0; i < 11; i += 1) {
  b64s.push(readFileSync(`content/cfi-g-import/_chunk${i}.b64`, 'utf8').trim());
}
const lines = ['window.__cfiCards = [];'];
for (const b of b64s) {
  lines.push(`window.__cfiCards.push(...JSON.parse(atob(${JSON.stringify(b)})));`);
}
lines.push('window.__cfiCards.length');
writeFileSync('content/cfi-g-import/_inject.js', lines.join('\n'));
console.log('inject js bytes', Buffer.byteLength(lines.join('\n')));

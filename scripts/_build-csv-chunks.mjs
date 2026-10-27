import { readFileSync, writeFileSync } from 'node:fs';

const csvPath = process.argv[2];
const b64 = Buffer.from(readFileSync(csvPath), 'utf8').toString('base64');
const SIZE = 12000;
const chunks = [];
for (let i = 0; i < b64.length; i += SIZE) chunks.push(b64.slice(i, i + SIZE));
chunks.forEach((c, i) => writeFileSync(`content/cfi-g-import/_csv${i}.b64`, c));
console.log(JSON.stringify({ chunks: chunks.length, b64Len: b64.length }));

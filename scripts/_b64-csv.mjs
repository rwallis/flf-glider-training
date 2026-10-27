import { readFileSync, writeFileSync } from 'node:fs';
const csvPath = process.argv[2];
const outPath = process.argv[3];
const csv = readFileSync(csvPath, 'utf8');
writeFileSync(outPath, Buffer.from(csv, 'utf8').toString('base64'));
console.log({ csvLen: csv.length, b64Len: Buffer.from(csv, 'utf8').toString('base64').length });

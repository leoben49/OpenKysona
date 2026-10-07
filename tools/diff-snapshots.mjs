// Prints byte-level differences between consecutive flash snapshots in .devlog/log.jsonl.
// Usage: node tools/diff-snapshots.mjs [lastN]
import { readFileSync } from 'node:fs';

const lastN = Number(process.argv[2] ?? Infinity);
const snaps = readFileSync('.devlog/log.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((e) => (e.step === 'snapshot' || e.step === 'flash') && e.value)
  .map((e) => ({ label: e.label ?? '(probe)', bytes: e.value.split(' ').map((h) => parseInt(h, 16)) }));

const hex = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');

for (const [i, cur] of snaps.entries()) {
  if (i === 0 || snaps.length - i > lastN) continue;
  const prev = snaps[i - 1];
  const changed = cur.bytes.flatMap((b, a) => (b === prev.bytes[a] ? [] : [a]));
  console.log(`\n#${i} "${cur.label}" — ${changed.length} byte(s) changed`);
  for (const a of changed) console.log(`  0x${hex(a, 4)}: ${hex(prev.bytes[a])} -> ${hex(cur.bytes[a])}`);
}

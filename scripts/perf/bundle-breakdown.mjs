// Which packages and source folders fill each JS chunk, from a source-map build.
// Usage: node scripts/perf/bundle-breakdown.mjs <dir with assets/*.js and .map files>
// Bytes are minified output bytes attributed through the source map (gzip is not split per source).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGIT = Object.fromEntries([...B64].map((c, i) => [c, i]));

/** Decodes one VLQ segment ("AAgBC") into numbers. */
function decodeSegment(segment) {
  const values = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = DIGIT[char];
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
      continue;
    }
    values.push(value & 1 ? -(value >> 1) : value >> 1);
    value = 0;
    shift = 0;
  }
  return values;
}

/** Package name for node_modules paths, else the first two folders under src/. */
function groupOf(source) {
  const nm = source.lastIndexOf('node_modules/');
  if (nm >= 0) {
    const parts = source.slice(nm + 'node_modules/'.length).split('/');
    return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  const src = source.indexOf('src/');
  return src >= 0 ? source.slice(src).split('/').slice(0, 3).join('/') : source;
}

function breakdown(jsPath) {
  const code = readFileSync(jsPath, 'utf8');
  const map = JSON.parse(readFileSync(`${jsPath}.map`, 'utf8'));
  const lines = code.split('\n');
  const totals = new Map();
  let sourceIndex = 0;
  map.mappings.split(';').forEach((line, lineNo) => {
    const lineLength = lines[lineNo]?.length ?? 0;
    let column = 0;
    const segments = line ? line.split(',').map(decodeSegment) : [];
    segments.forEach((fields, i) => {
      column += fields[0];
      if (fields.length > 1) sourceIndex += fields[1];
      const next = i + 1 < segments.length ? column + segments[i + 1][0] : lineLength;
      const group = fields.length > 1 ? groupOf(map.sources[sourceIndex]) : '(unmapped)';
      totals.set(group, (totals.get(group) ?? 0) + Math.max(0, next - column));
      // The next segment's column is relative to this one; keep `column` as this segment's start.
    });
  });
  return { bytes: code.length, totals: [...totals].sort((a, b) => b[1] - a[1]) };
}

const dir = process.argv[2];
if (!dir) throw new Error('Pass the build output folder');
for (const file of readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js'))) {
  const { bytes, totals } = breakdown(join(dir, 'assets', file));
  if (bytes < 5000) continue;
  console.log(`\n${file}  ${(bytes / 1024).toFixed(1)} KB`);
  for (const [group, size] of totals.slice(0, 12)) {
    console.log(`  ${(size / 1024).toFixed(1).padStart(7)} KB  ${group}`);
  }
}

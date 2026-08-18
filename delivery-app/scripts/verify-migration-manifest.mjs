import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

const root = new URL('..', import.meta.url);
const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);
const manifestUrl = new URL('../supabase/verification/migration-checksums.sha256', import.meta.url);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

const manifest = new Map();
const manifestContents = await readFile(manifestUrl, 'utf8');

for (const line of manifestContents.split('\n')) {
  if (!line.trim()) continue;
  const match = line.match(/^([a-f0-9]{64})  (supabase\/migrations\/.+\.sql)$/);
  if (!match) throw new Error(`Malformed migration manifest entry: ${line}`);
  manifest.set(match[2], match[1]);
}

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort();

const expectedPaths = new Set(migrationFiles.map((file) => `supabase/migrations/${file}`));

for (const path of expectedPaths) {
  if (!manifest.has(path)) {
    throw new Error(`Migration is not recorded in the immutable manifest: ${path}`);
  }
}

for (const path of manifest.keys()) {
  if (!expectedPaths.has(path)) {
    throw new Error(`Manifest references a missing migration: ${path}`);
  }
}

for (const path of [...manifest.keys()].sort()) {
  const contents = await readFile(join(root.pathname, path));
  const actual = sha256(contents);
  const expected = manifest.get(path);
  if (actual !== expected) {
    throw new Error(`Migration checksum changed: ${path}`);
  }
}

console.log(`Verified ${manifest.size} immutable migration artifacts.`);

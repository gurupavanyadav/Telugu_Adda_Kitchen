import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteEntrypoint = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const testOutDir = path.join(root, '.supabase-config-test-dist');
const validConfig = {
  VITE_SUPABASE_URL: 'https://launch-readiness-test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_launch_readiness_test_key',
};

function runProductionBuild(overrides = {}) {
  rmSync(testOutDir, { recursive: true, force: true });
  const env = { ...process.env, ...validConfig, ...overrides };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }

  return spawnSync(process.execPath, [viteEntrypoint, 'build', '--outDir', testOutDir], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}

after(() => rmSync(testOutDir, { recursive: true, force: true }));

test('does not retain a hard-coded hosted project URL or anonymous key fallback', () => {
  const source = readFileSync(path.join(root, 'src', 'lib', 'supabase.ts'), 'utf8');

  assert.doesNotMatch(source, /0ec90b57d6e95fcbda19832f\.supabase\.co/);
  assert.doesNotMatch(source, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJm/);
  assert.match(source, /getRequiredPublicEnv\('VITE_SUPABASE_URL'\)/);
  assert.match(source, /getRequiredPublicEnv\('VITE_SUPABASE_ANON_KEY'\)/);
});

test('blocks a production build when public Supabase configuration is absent', () => {
  const result = runProductionBuild({
    VITE_SUPABASE_URL: undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Production build blocked: missing required public Supabase configuration/);
});

test('blocks malformed or placeholder public Supabase configuration', () => {
  const malformed = runProductionBuild({ VITE_SUPABASE_URL: 'http://not-https.example.test' });
  assert.notEqual(malformed.status, 0);
  assert.match(`${malformed.stdout}\n${malformed.stderr}`, /VITE_SUPABASE_URL must be a valid absolute HTTPS URL/);

  const placeholder = runProductionBuild({ VITE_SUPABASE_ANON_KEY: 'sb_publishable_REPLACE_WITH_PUBLIC_KEY' });
  assert.notEqual(placeholder.status, 0);
  assert.match(`${placeholder.stdout}\n${placeholder.stderr}`, /contains a placeholder value/);
});

test('accepts explicit valid public Supabase configuration for a production build', () => {
  const result = runProductionBuild();

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.ok(existsSync(path.join(testOutDir, 'index.html')));
});

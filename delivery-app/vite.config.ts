import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function assertProductionSupabaseConfig(env: Record<string, string>): void {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !anonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Production build blocked: missing required public Supabase configuration (${missing.join(', ')}).`);
  }

  if (/(^|_)(your|replace|change_me)(_|$)|^</i.test(url!) || /(^|_)(your|replace|change_me)(_|$)|^</i.test(anonKey!)) {
    throw new Error('Production build blocked: public Supabase configuration contains a placeholder value.');
  }

  try {
    const parsedUrl = new URL(url!);
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
      throw new Error('invalid protocol or host');
    }
  } catch {
    throw new Error('Production build blocked: VITE_SUPABASE_URL must be a valid absolute HTTPS URL.');
  }

  if (!/^(eyJ|sb_publishable_)/.test(anonKey!)) {
    throw new Error('Production build blocked: VITE_SUPABASE_ANON_KEY must be a Supabase anon or publishable key.');
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (mode === 'production') {
    assertProductionSupabaseConfig(env);
  }

  return {
    base: '/delivery-app/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});

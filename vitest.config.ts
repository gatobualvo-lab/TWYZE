import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Edge functions import this Deno-only specifier; tests get a stub.
      'jsr:@supabase/supabase-js@2': new URL('./src/test/stubs/supabaseJsStub.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Several modules create the Supabase client on import and throw if these
    // are missing. Fixed placeholders keep tests independent of anyone's .env
    // (CI has none) and guarantee tests never reach a real project.
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder',
    },
  },
});

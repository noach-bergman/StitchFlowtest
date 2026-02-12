
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Load variables from .env files
  const env = loadEnv(mode, process.cwd(), '');

  const readEnv = (...keys: string[]) => {
    for (const key of keys) {
      const value = env[key] || process.env[key];
      if (value) return value;
    }
    return '';
  };

  // Support both legacy and Vite-style env keys for backward compatibility.
  const supabaseUrl = readEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const supabaseKey = readEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const apiKey = readEnv('VITE_API_KEY', 'API_KEY', 'VITE_GEMINI_API_KEY', 'GEMINI_API_KEY');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true
    },
    define: {
      // These strings will be replaced literally in the source code during build
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey)
    }
  };
});

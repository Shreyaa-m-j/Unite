import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { GAME_CONFIG } from './src/config.js';

// Link-preview crawlers need an absolute og:image URL. Set VITE_SITE_URL, or on Vercel
// the production domain is picked up automatically.
function siteUrl(env) {
  if (env.VITE_SITE_URL) return env.VITE_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return '';
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'site-url',
      transformIndexHtml: (html) => html
          .replaceAll('__SITE_URL__', siteUrl(loadEnv(mode, process.cwd(), '')))
          .replaceAll('__START_GAP__', String(GAME_CONFIG.startGap)),
    },
  ],
  // Two servers in dev: `npm run dev` (this) and `npm run dev:api` (vercel dev on :3000).
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}));

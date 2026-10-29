import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/components/..." instead of "../../components/..."
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // In dev, /api calls are forwarded to the Express server, so the browser
  // sees one origin and we don't need CORS.
  server: { proxy: { '/api': 'http://localhost:3001' } },
});

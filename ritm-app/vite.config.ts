import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Две сборки:
//   обычная (`vite build`)              → dist/        PWA с service worker
//   однофайловая (`vite build --mode single`) → dist-single/ один HTML без service worker
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    define: { __SINGLE_FILE__: JSON.stringify(single) },
    plugins: [
      react(),
      tailwindcss(),
      single
        ? viteSingleFile({ removeViteModuleLoader: true })
        : VitePWA({
            injectRegister: null, // регистрируем сами в src/lib/sw.ts
            registerType: 'autoUpdate',
            includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
            manifest: {
              name: 'Ритм — задачи и неделя',
              short_name: 'Ритм',
              description: 'Планировщик задач и недели. Работает без интернета.',
              lang: 'ru',
              start_url: './',
              scope: './',
              display: 'standalone',
              background_color: '#f6f5f2',
              theme_color: '#0f766e',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              navigateFallback: 'index.html',
              // однофайловую версию с сайта отдаём как есть, чтобы её можно было скачать
              navigateFallbackDenylist: [/ritm-offline\.html$/],
              cleanupOutdatedCaches: true,
            },
          }),
    ],
    build: single ? { outDir: 'dist-single', emptyOutDir: true } : { outDir: 'dist', emptyOutDir: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})

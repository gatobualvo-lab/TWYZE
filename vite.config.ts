import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.ELECTRON === 'true' ? './' : '/',
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: '/trackwyze',
        name: 'Trackwyze - Track Smart. Profit Wise.',
        short_name: 'Trackwyze',
        description: 'Complete business tracking platform for smart entrepreneurs. Track sales, manage suppliers, monitor ad expenses, and maximize profits with intelligent insights.',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait-primary',
        scope: '/',
        lang: 'en',
        dir: 'ltr',
        categories: ['business', 'finance', 'productivity'],
        launch_handler: {
          client_mode: 'auto'
        },
        scope_extensions: ['https://trackwyze.com/'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: 'Add Sale',
            short_name: 'Add Sale',
            description: 'Quickly add a new sale',
            url: '/?tab=add-sale',
            icons: [
              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }
            ]
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'View business dashboard',
            url: '/?tab=dashboard',
            icons: [
              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }
            ]
          }
        ],
        screenshots: [
          {
            src: '/screenshots/dashboard-hero.png',
            sizes: '1752x879',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Trackwyze dashboard'
          }
        ],
        prefer_related_applications: false,
        related_applications: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Parts of the PDF library that Trackwyze never uses (HTML-to-canvas and
        // an HTML sanitiser) — no point making every install download them.
        globIgnores: ['**/html2canvas*.js', '**/purify*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/functions\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-static-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      }
    }
  },
});
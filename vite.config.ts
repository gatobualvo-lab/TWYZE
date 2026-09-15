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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
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
          {
            src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Add Sale',
            short_name: 'Add Sale',
            description: 'Quickly add a new sale',
            url: '/?tab=add-sale',
            icons: [
              {
                src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'View business dashboard',
            url: '/?tab=dashboard',
            icons: [
              {
                src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
                sizes: '96x96'
              }
            ]
          }
        ],
        screenshots: [
          {
            src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Trackwyze Dashboard'
          },
          {
            src: '/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Trackwyze Mobile View'
          }
        ],
        prefer_related_applications: false,
        related_applications: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
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
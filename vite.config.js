import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  preview: {
    port: 5173,
    host: '0.0.0.0'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'MUTUALIS DAKAR — Portail CMU',
        short_name: 'Mutualis',
        description: 'Plateforme régionale de la Couverture Santé Universelle (CMU) de Dakar — adhésion, cotisation, soins et prise en charge.',
        lang: 'fr',
        dir: 'ltr',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['health', 'medical', 'finance', 'productivity'],
        // Raccourcis d'actions rapides (app installée)
        shortcuts: [
          {
            name: 'Nouvelle adhésion',
            short_name: 'Adhésion',
            description: 'Adhérer à une mutuelle de santé',
            url: '/#/services',
            icons: [{ src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', sizes: '96x96' }]
          },
          {
            name: 'Paiement cotisation',
            short_name: 'Payer',
            description: 'Payer votre cotisation via Orange Money / Wave',
            url: '/#/payments',
            icons: [{ src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', sizes: '96x96' }]
          },
          {
            name: 'Vérifier une carte CMU',
            short_name: 'Vérifier',
            description: 'Vérifier la validité d\'une carte d\'assuré',
            url: '/#/verify',
            icons: [{ src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', sizes: '96x96' }]
          }
        ],
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Les nouvelles versions du service worker s'activent immédiatement
        // (au lieu d'attendre la fermeture de tous les onglets) et les vieux
        // precaches sont purgés automatiquement.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,jpg,jpeg,woff,woff2}'],
        // Stratégies de cache avancées pour le mode hors-ligne
        runtimeCaching: [
          {
            // API backend : NetworkFirst (privilégie le réseau, fallback cache)
            urlPattern: /^http:\/\/localhost:5000\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5
            }
          },
          {
            // Images et assets statiques : StaleWhileRevalidate (mise à jour en tâche de fond)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 604800 }
            }
          },
          {
            // Polices : CacheFirst longue durée
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 31536000 }
            }
          }
        ]
      },
      devOptions: {
        // ⚠️ Service worker désactivé en développement : il servait une copie
        // périmée des assets (les corrections semblaient « ne rien changer »).
        // Le SW reste actif uniquement dans les builds de production.
        enabled: false
      }
    })
  ],
})

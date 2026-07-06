import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANT: change 'impi-jobcards' below to match your actual
// GitHub repository name if it's different — this must match the
// URL path GitHub Pages will serve the app from.
export default defineConfig({
  base: '/impi-jobcards/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo-header.png'],
      manifest: {
        name: 'IMPI Job Cards',
        short_name: 'IMPI Job Cards',
        description: 'IMPI daily job card sign-in / sign-out system',
        theme_color: '#DE1819',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/impi-jobcards/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})

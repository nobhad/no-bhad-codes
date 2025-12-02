import { defineConfig } from 'vite';
import { resolve } from 'path';
import { ViteEjsPlugin } from 'vite-plugin-ejs';

export default defineConfig({
  // Root directory
  root: './',

  // Public directory for static assets
  publicDir: 'public',

  // Build configuration
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false, // Disable source maps in production for code protection

    // Build client-side JavaScript from src/main.ts
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.ts')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },

    // Optimize chunk splitting
    chunkSizeWarningLimit: 600,
    minify: 'terser'
  },

  // Development server configuration
  server: {
    port: 4000,
    host: true,
    strictPort: false,
    open: false,
    cors: true,

    // Proxy API requests to backend server
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      }
    }
  },

  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
    strictPort: false,
    open: false
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@core': resolve(__dirname, 'src/core'),
      '@features': resolve(__dirname, 'src/features'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@config': resolve(__dirname, 'src/config'),
      '@styles': resolve(__dirname, 'src/styles')
    },
    extensions: ['.ts', '.js', '.json']
  },

  // Plugin configuration
  plugins: [
    ViteEjsPlugin({
      // EJS template configuration
      ejs: {
        views: [resolve(__dirname, 'templates/pages'), resolve(__dirname, 'templates/partials')],
        options: {
          // EJS compile options
          compileDebug: process.env.NODE_ENV !== 'production',
          client: false,
          delimiter: '%',
          openDelimiter: '<',
          closeDelimiter: '>',
          cache: process.env.NODE_ENV === 'production',
          rmWhitespace: process.env.NODE_ENV === 'production'
        }
      },

      // Data available to all EJS templates
      data: {
        title: 'No Bhad Codes',
        description: 'Professional portfolio and client management system',
        author: 'Noelle Bhaduri',
        siteName: 'No Bhad Codes',
        siteUrl: process.env.WEBSITE_URL || 'https://nobhadcodes.com',
        year: new Date().getFullYear(),
        nodeEnv: process.env.NODE_ENV || 'development',
        isDev: process.env.NODE_ENV !== 'production'
      }
    })
  ],

  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      // Add any CSS preprocessor options here if needed
    }
  },

  // Optimization configuration
  optimizeDeps: {
    include: ['gsap', 'gsap/all'],
    exclude: []
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  // ESBuild configuration
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    logOverride: {
      'this-is-undefined-in-esm': 'silent'
    }
  }
});

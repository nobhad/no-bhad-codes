import { defineConfig, type Terser } from 'vite';
import { resolve } from 'path';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import { createObfuscationPlugin } from './src/utils/obfuscation-plugin';

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

    // Build all HTML entry points
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      // Silence "use client" RSC-directive warnings from Radix/react-router.
      // These directives are no-ops in a Vite SPA but Rollup warns on every build.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) {
          return;
        }
        warn(warning);
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Split heavy vendor deps into separate chunks so the portal entry
        // chunk stays small and vendor code is cached independently of app
        // code. Each id is matched as a substring of the resolved module path.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react-router') || id.includes('/@remix-run/router')) return 'vendor-router';
          if (id.includes('/react-dom/')) return 'vendor-react-dom';
          if (id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/zustand/')) return 'vendor-zustand';
          if (id.includes('/lucide-react/')) return 'vendor-lucide';
          if (id.includes('/gsap/')) return 'vendor-gsap';
          return undefined;
        }
      }
    },

    // Optimize chunk splitting
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        // Drop console.log, console.info, console.debug in production
        // Keep console.warn and console.error for important messages
        drop_console: false, // Don't drop all console
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      format: {
        comments: false // Remove comments in production
      }
    } as Terser.MinifyOptions
  },

  // Multi-page application mode
  appType: 'mpa',

  // Development server configuration
  server: {
    port: 4000,
    host: true,
    strictPort: false,
    open: false,
    cors: true,

    // Proxy API requests to backend server
    proxy: {
      // Portal routes - served by Express EJS
      '/portal': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[vite-proxy] /portal error:', (err as Error).message);
          });
        }
      },
      '/dashboard': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[vite-proxy] /dashboard error:', (err as Error).message);
          });
        }
      },
      '/admin': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[vite-proxy] /admin error:', (err as Error).message);
          });
        }
      },
      '/client': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[vite-proxy] /client error:', (err as Error).message);
          });
        }
      },
      // Auth pages - served by Express EJS
      '/set-password': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      },
      '/forgot-password': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      },
      '/reset-password': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      },
      '/intake': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      },
      // API routes
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        ws: true,
        // rewrite cookie domain for dev
        cookieDomainRewrite: '',
        // Suppress proxy errors when backend isn't ready yet (race condition on startup)
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[vite-proxy] /api error:', (err as Error).message);
            if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
              const response = res as import('http').ServerResponse;
              if (!response.headersSent) {
                response.writeHead(503, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Backend server starting up, please retry' }));
              }
            }
          });
        }
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[vite-proxy] /uploads error:', (err as Error).message);
          });
        }
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
      '@react': resolve(__dirname, 'src/react'),
      '@factories': resolve(__dirname, 'src/factories'),
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
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
  },

  // Plugin configuration
  plugins: [
    // NOTE: Not using @vitejs/plugin-react or @vitejs/plugin-react-swc
    // because their Fast Refresh preamble detection fails with island architecture
    // (mounting React components into vanilla TS pages via dynamic imports).
    // Instead, we use esbuild's built-in JSX transformation configured below.

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
        siteUrl: process.env.WEBSITE_URL || 'https://nobhad.codes',
        year: new Date().getFullYear(),
        nodeEnv: process.env.NODE_ENV || 'development',
        isDev: process.env.NODE_ENV !== 'production'
      }
    }),

    // Code obfuscation for production builds (uses javascript-obfuscator)
    // NOTE: encryptStrings disabled - breaks Rollup dynamic import placeholders
    createObfuscationPlugin({
      enabled: process.env.NODE_ENV === 'production',
      level: 'standard', // Options: basic, standard, advanced, maximum
      encryptionKey: process.env.OBFUSCATION_KEY,
      features: {
        minifyHTML: false, // DISABLED: was corrupting inline scripts
        obfuscateJS: true,
        obfuscateCSS: false,
        encryptStrings: false, // DISABLED: breaks dynamic imports (visitor-tracking-!~{00f}~.js)
        antiDebugTraps: false, // Enable for anti-debugging protection
        fakeSourceMaps: false,
        polymorphicCode: false
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
    include: ['gsap', 'gsap/all', 'react', 'react-dom', 'zustand'],
    exclude: []
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  // ESBuild configuration
  // Using esbuild for JSX transformation instead of React plugin
  // to avoid Fast Refresh preamble detection issues with island architecture
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    jsx: 'automatic',
    jsxImportSource: 'react',
    logOverride: {
      'this-is-undefined-in-esm': 'silent'
    }
  }
});

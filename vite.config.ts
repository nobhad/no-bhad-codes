import { defineConfig, Plugin, type Terser } from 'vite';
import { resolve } from 'path';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import { createObfuscationPlugin } from './src/utils/obfuscation-plugin';

/**
 * Custom plugin to handle MPA routing in development
 * Rewrites URLs like /admin to /admin/index.html
 */
function mpaRoutingPlugin(): Plugin {
  return {
    name: 'mpa-routing',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // Rewrite /admin to /admin/index.html
        if (url === '/admin' || url === '/admin/') {
          req.url = '/admin/index.html';
        }
        // Rewrite /client/portal to /client/portal.html
        else if (url === '/client/portal' || url === '/client/portal/') {
          req.url = '/client/portal.html';
        }
        // Rewrite /client/intake to /client/intake.html
        else if (url === '/client/intake' || url === '/client/intake/') {
          req.url = '/client/intake.html';
        }

        next();
      });
    },
  };
}

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
        main: resolve(__dirname, 'index.html'),
        'client-portal': resolve(__dirname, 'client/portal.html'),
        'client-intake': resolve(__dirname, 'client/intake.html'),
        'client-set-password': resolve(__dirname, 'client/set-password.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Optimize chunk splitting
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        // Drop console.log, console.info, console.debug in production
        // Keep console.warn and console.error for important messages
        drop_console: false, // Don't drop all console
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      format: {
        comments: false, // Remove comments in production
      },
    } as Terser.MinifyOptions,
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
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
    strictPort: false,
    open: false,
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
      '@styles': resolve(__dirname, 'src/styles'),
    },
    extensions: ['.ts', '.js', '.json'],
  },

  // Plugin configuration
  plugins: [
    // MPA routing for dev server
    mpaRoutingPlugin(),

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
          rmWhitespace: process.env.NODE_ENV === 'production',
        },
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
        isDev: process.env.NODE_ENV !== 'production',
      },
    }),

    // Code obfuscation for production builds (uses javascript-obfuscator)
    // NOTE: encryptStrings disabled - breaks Rollup dynamic import placeholders
    createObfuscationPlugin({
      enabled: process.env.NODE_ENV === 'production',
      level: 'standard', // Options: basic, standard, advanced, maximum
      encryptionKey: process.env.OBFUSCATION_KEY,
      features: {
        minifyHTML: true,
        obfuscateJS: true,
        obfuscateCSS: false,
        encryptStrings: false, // DISABLED: breaks dynamic imports (visitor-tracking-!~{00f}~.js)
        antiDebugTraps: false, // Enable for anti-debugging protection
        fakeSourceMaps: false,
        polymorphicCode: false,
      },
    }),
  ],

  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      // Add any CSS preprocessor options here if needed
    },
  },

  // Optimization configuration
  optimizeDeps: {
    include: ['gsap', 'gsap/all'],
    exclude: [],
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  // ESBuild configuration
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    logOverride: {
      'this-is-undefined-in-esm': 'silent',
    },
  },
});

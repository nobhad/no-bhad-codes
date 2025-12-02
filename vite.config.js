import { defineConfig } from 'vite';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the data file once and cache it
let templateData;
try {
  templateData = JSON.parse(readFileSync(resolve(__dirname, './templates/data.json'), 'utf-8'));
} catch (error) {
  console.error('Failed to read template data:', error);
  templateData = {
    site: { name: 'no bhad codes', title: 'No Bhad Codes' },
    navigation: { menuItems: [] },
    pages: { home: { title: 'No Bhad Codes', scriptSrc: '/src/main.ts' } }
  };
}

export default defineConfig({
  plugins: [
    ViteEjsPlugin(
      {
        ...templateData,
        // Make sure the data is available at the root level
        pageData: templateData.pages?.home || {
          title: 'No Bhad Codes',
          description: 'Professional web development services',
          scriptSrc: '/src/main.ts'
        }
      },
      {
        // Configure EJS options for better template resolution
        ejs: {
          views: [resolve(__dirname, 'templates'), resolve(__dirname, '.')],
          root: resolve(__dirname),
          cache: false,
          rmWhitespace: false,
          delimiter: '%',
          openDelimiter: '<',
          closeDelimiter: '>'
        }
      }
    )
  ],
  root: '.',
  publicDir: 'public',
  logLevel: 'warn', // Suppress verbose logging
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Enable code splitting
    rollupOptions: {
      input: {
        main: './build.html',
        // We'll create build-friendly versions without EJS includes
        projects: './build.html',
        admin: './build.html'
      },
      output: {
        // Advanced manual chunk splitting for optimal caching
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // GSAP gets its own chunk for better caching
            if (id.includes('gsap')) {
              return 'vendor-gsap';
            }
            // Other vendor dependencies
            return 'vendor-libs';
          }

          // Admin dashboard chunk (separate from main app)
          if (id.includes('src/admin/')) {
            return 'admin';
          }

          // Core application chunks
          if (id.includes('src/core/')) {
            return 'core';
          }

          // Component system chunk - split further for better caching
          if (id.includes('src/components/')) {
            // Performance dashboard in separate chunk (large)
            if (id.includes('performance-dashboard') || id.includes('analytics-dashboard')) {
              return 'dashboard-components';
            }
            return 'components';
          }

          // Services chunk - split heavy services
          if (id.includes('src/services/')) {
            // Large services get separate chunks
            if (id.includes('performance-service') || id.includes('visitor-tracking')) {
              return 'monitoring-services';
            }
            return 'services';
          }

          // Module chunks - split by feature for better lazy loading
          if (id.includes('src/modules/')) {
            const moduleMatch = id.match(/src\/modules\/(.+?)(\.ts|\/)/);
            if (moduleMatch) {
              // Group business card modules together
              if (moduleMatch[1].includes('business-card')) {
                return 'business-card-modules';
              }
              return `module-${moduleMatch[1]}`;
            }
            return 'modules';
          }

          // Design system chunk
          if (id.includes('src/design-system/') || id.includes('src/styles/')) {
            return 'design-system';
          }

          // Main chunk for entry points
          if (id.includes('src/main.ts') || id.includes('index.html')) {
            return 'main';
          }
        },
        // Use dynamic imports for venture-specific code
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().split('.')[0]
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        }
      }
    },
    // Optimize chunk size - increased limit to realistic value for TypeScript app
    chunkSizeWarningLimit: 500,
    // Enable minification for production
    minify: 'esbuild',
    target: 'es2020', // Updated target for better optimization
    // CSS code splitting
    cssCodeSplit: true,
    // Source maps for debugging
    sourcemap: false, // Disable in production for smaller builds
    // Compression
    reportCompressedSize: true
  },
  server: {
    port: 4000,
    open: true,
    hmr: {
      port: 4000,
      host: 'localhost'
    },
    watch: {
      // Ignore files that don't need to trigger reloads
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/data/**',
        '**/uploads/**',
        '**/.env'
      ],
      // Reduce polling frequency
      usePolling: false,
      // Use native file system events
      useFsEvents: true
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['gsap'],
    // Force optimization of certain dependencies
    force: false,
    // Exclude large dependencies that don't benefit from pre-bundling
    exclude: []
  },
  // Enable experimental features for better performance
  experimental: {
    buildAdvancedBaseOptions: {}
  },
  // Define global constants for dead code elimination
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    __PROD__: JSON.stringify(process.env.NODE_ENV === 'production')
  }
});

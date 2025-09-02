/**
 * ===============================================
 * VITE OBFUSCATION PLUGIN
 * ===============================================
 * @file src/build/obfuscation-plugin.ts
 *
 * Vite plugin for build-time code obfuscation and protection.
 */

import type { Plugin } from 'vite';
import { ObfuscationUtils } from '../utils/obfuscation-utils';
import * as fs from 'fs';
import * as path from 'path';

export interface ObfuscationPluginOptions {
  enabled: boolean;
  level: 'basic' | 'standard' | 'advanced' | 'maximum';
  preserveNames?: string[]; // Function/class names to preserve
  encryptionKey?: string;
  features: {
    minifyHTML: boolean;
    obfuscateJS: boolean;
    obfuscateCSS: boolean;
    encryptStrings: boolean;
    antiDebugTraps: boolean;
    fakeSourceMaps: boolean;
    polymorphicCode: boolean;
  };
}

export function createObfuscationPlugin(options: ObfuscationPluginOptions): Plugin {
  if (!options.enabled) {
    return {
      name: 'obfuscation-plugin',
      apply: 'build'
    };
  }

  const encryptionKey = options.encryptionKey || `nbw_protection_key_${  Date.now()}`;
  let classNameMap = new Map<string, string>();

  return {
    name: 'obfuscation-plugin',
    apply: 'build',

    generateBundle(opts, bundle) {
      Object.keys(bundle).forEach(fileName => {
        const chunk = bundle[fileName];

        if (chunk && chunk.type === 'chunk' && fileName.endsWith('.js')) {
          // Obfuscate JavaScript
          const jsChunk = chunk as any;
          if (jsChunk.code) {
            jsChunk.code = obfuscateJavaScript(jsChunk.code, options, encryptionKey);

            // Generate fake source maps if requested
            if (options.features.fakeSourceMaps) {
              jsChunk.map = generateFakeSourceMap(jsChunk.code);
            } else {
              // Remove real source maps for security
              delete jsChunk.map;
            }
          }
        }

        if (chunk && chunk.type === 'asset' && fileName.endsWith('.css')) {
          // Obfuscate CSS
          const cssChunk = chunk as any;
          if (cssChunk.source) {
            const cssResult = obfuscateCSS(cssChunk.source as string, options);
            cssChunk.source = cssResult.css;
            classNameMap = new Map([...classNameMap, ...cssResult.map]);
          }
        }

        if (chunk && chunk.type === 'asset' && fileName.endsWith('.html')) {
          // Obfuscate HTML
          const htmlChunk = chunk as any;
          if (htmlChunk.source) {
            htmlChunk.source = obfuscateHTML(htmlChunk.source as string, options, classNameMap);
          }
        }
      });
    },

    writeBundle(opts, bundle) {
      // Write obfuscation report
      if (options.level === 'advanced' || options.level === 'maximum') {
        const reportPath = path.join(opts.dir!, 'obfuscation-report.json');
        const report = {
          timestamp: new Date().toISOString(),
          level: options.level,
          features: options.features,
          stats: {
            totalFiles: Object.keys(bundle).length,
            jsFiles: Object.keys(bundle).filter(f => f.endsWith('.js')).length,
            cssFiles: Object.keys(bundle).filter(f => f.endsWith('.css')).length,
            classNamesObfuscated: classNameMap.size
          }
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      }

      // Remove source files from dist (security measure)
      if (options.level === 'maximum') {
        Object.keys(bundle).forEach(fileName => {
          if (fileName.endsWith('.js.map') || fileName.endsWith('.css.map')) {
            const filePath = path.join(opts.dir!, fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        });
      }
    }
  };
}

function obfuscateJavaScript(code: string, options: ObfuscationPluginOptions, key: string): string {
  let obfuscated = code;

  if (options.features.encryptStrings) {
    obfuscated = ObfuscationUtils.obfuscateSensitiveStrings(obfuscated, key);
  }

  if (options.features.obfuscateJS) {
    obfuscated = ObfuscationUtils.obfuscateFunctionNames(obfuscated);
  }

  if (options.features.antiDebugTraps) {
    obfuscated = ObfuscationUtils.insertAntiDebugTraps(obfuscated);
  }

  if (options.features.polymorphicCode && options.level === 'maximum') {
    obfuscated = ObfuscationUtils.generatePolymorphicCode(obfuscated);
  }

  // Add protection initialization
  if (options.level === 'advanced' || options.level === 'maximum') {
    obfuscated = addProtectionInit(obfuscated, options);
  }

  return obfuscated;
}

function obfuscateCSS(css: string, options: ObfuscationPluginOptions): { css: string; map: Map<string, string> } {
  if (!options.features.obfuscateCSS) {
    return { css, map: new Map() };
  }

  return ObfuscationUtils.obfuscateClassNames(css);
}

function obfuscateHTML(html: string, options: ObfuscationPluginOptions, classMap: Map<string, string>): string {
  if (!options.features.minifyHTML) {
    return html;
  }

  let obfuscated = ObfuscationUtils.obfuscateHTML(html, classMap);

  // Add integrity checks to HTML
  if (options.level === 'maximum') {
    obfuscated = addHTMLIntegrityChecks(obfuscated);
  }

  return obfuscated;
}

function addProtectionInit(code: string, options: ObfuscationPluginOptions): string {
  const protectionLevel = options.level;
  const features = JSON.stringify(options.features);

  const initCode = `
// Protection initialization
(function() {
  const config = {
    enabled: true,
    level: '${protectionLevel}',
    features: ${features}
  };
  
  if (typeof window !== 'undefined' && window.NBW_PROTECTION) {
    window.NBW_PROTECTION.updateConfig(config);
    window.NBW_PROTECTION.enable();
  }
})();

${code}
  `;

  return initCode;
}

function addHTMLIntegrityChecks(html: string): string {
  const integrityScript = `
<script>
(function() {
  // HTML integrity check
  const originalHTML = document.documentElement.outerHTML;
  const checksum = btoa(originalHTML.length.toString());
  
  setInterval(function() {
    if (document.documentElement.outerHTML.length !== originalHTML.length) {
      console.warn('HTML tampering detected');
      location.reload();
    }
  }, 5000);
  
  // Anti-tampering
  Object.defineProperty(document, 'body', {
    get: function() { return document.getElementsByTagName('body')[0]; },
    set: function() { throw new Error('Access denied'); }
  });
})();
</script>
  `;

  return html.replace('</head>', `${integrityScript  }</head>`);
}

function generateFakeSourceMap(code: string): any {
  // Generate a fake source map that leads to decoy files
  const fakeMap = {
    version: 3,
    sources: [
      'webpack:///src/security/auth.js',
      'webpack:///src/api/endpoints.js',
      'webpack:///src/utils/encryption.js'
    ],
    names: ['authenticate', 'encrypt', 'validate', 'process'],
    mappings: 'AAAA;AACA;AACA;AACA',
    file: 'app.js',
    sourceRoot: '',
    sourcesContent: [
      '// Authentication module\nfunction authenticate(user) { /* ... */ }',
      '// API endpoints\nconst endpoints = { /* ... */ };',
      '// Encryption utilities\nfunction encrypt(data) { /* ... */ }'
    ]
  };

  return fakeMap;
}

// Export utility function for manual obfuscation
export function obfuscateCode(code: string, options: Partial<ObfuscationPluginOptions> = {}): string {
  const defaultOptions: ObfuscationPluginOptions = {
    enabled: true,
    level: 'standard',
    features: {
      minifyHTML: true,
      obfuscateJS: true,
      obfuscateCSS: true,
      encryptStrings: true,
      antiDebugTraps: true,
      fakeSourceMaps: false,
      polymorphicCode: false
    }
  };

  const finalOptions = { ...defaultOptions, ...options };
  const key = finalOptions.encryptionKey || 'default_key';

  return obfuscateJavaScript(code, finalOptions, key);
}
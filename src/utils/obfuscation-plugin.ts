/**
 * ===============================================
 * VITE OBFUSCATION PLUGIN
 * ===============================================
 * @file src/utils/obfuscation-plugin.ts
 *
 * Vite plugin for build-time code obfuscation using javascript-obfuscator.
 * Compatible with Vite 5+ and modern JavaScript/TypeScript.
 */

import type { Plugin } from 'vite';
import type { OutputAsset } from 'rollup';
import JavaScriptObfuscator from 'javascript-obfuscator';

export interface ObfuscationPluginOptions {
  enabled: boolean;
  level: 'basic' | 'standard' | 'advanced' | 'maximum';
  preserveNames?: string[];
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

// Map our levels to javascript-obfuscator presets
function getObfuscatorOptions(
  level: ObfuscationPluginOptions['level'],
  features: ObfuscationPluginOptions['features']
): JavaScriptObfuscator.ObfuscatorOptions {
  const baseOptions: JavaScriptObfuscator.ObfuscatorOptions = {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: features.antiDebugTraps,
    debugProtectionInterval: features.antiDebugTraps ? 2000 : 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: features.encryptStrings,
    stringArrayCallsTransform: features.encryptStrings,
    stringArrayEncoding: features.encryptStrings ? ['base64'] : [],
    stringArrayIndexShift: features.encryptStrings,
    stringArrayRotate: features.encryptStrings,
    stringArrayShuffle: features.encryptStrings,
    stringArrayWrappersCount: features.encryptStrings ? 1 : 0,
    stringArrayWrappersChainedCalls: features.encryptStrings,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: features.encryptStrings ? 0.75 : 0,
    unicodeEscapeSequence: false,
    sourceMap: false
  };

  switch (level) {
  case 'basic':
    return {
      ...baseOptions,
      identifierNamesGenerator: 'mangled'
    };

  case 'standard':
    return {
      ...baseOptions,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      numbersToExpressions: true,
      splitStrings: true,
      splitStringsChunkLength: 10
    };

  case 'advanced':
    return {
      ...baseOptions,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.3,
      numbersToExpressions: true,
      selfDefending: true,
      splitStrings: true,
      splitStringsChunkLength: 5,
      transformObjectKeys: true
    };

  case 'maximum':
    return {
      ...baseOptions,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      identifierNamesGenerator: 'hexadecimal',
      numbersToExpressions: true,
      renameGlobals: false, // Keep false to avoid breaking imports
      selfDefending: true,
      splitStrings: true,
      splitStringsChunkLength: 3,
      transformObjectKeys: true,
      unicodeEscapeSequence: true
    };

  default:
    return baseOptions;
  }
}

export function createObfuscationPlugin(options: ObfuscationPluginOptions): Plugin {
  if (!options.enabled) {
    return {
      name: 'obfuscation-plugin',
      apply: 'build'
    };
  }

  let processedChunks = 0;

  return {
    name: 'obfuscation-plugin',
    apply: 'build',
    enforce: 'post',

    // Use renderChunk for JS obfuscation
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('.js') || !options.features.obfuscateJS) {
        return null;
      }

      try {
        const obfuscatorOptions = getObfuscatorOptions(options.level, options.features);
        const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);

        processedChunks++;

        return {
          code: result.getObfuscatedCode(),
          map: null // Remove source maps for security
        };
      } catch (error) {
        console.warn(`[obfuscation-plugin] Failed to obfuscate ${chunk.fileName}:`, error);
        return null; // Return original code on error
      }
    },

    // Handle HTML minification
    generateBundle(_outputOptions, bundle) {
      if (!options.features.minifyHTML) {
        return;
      }

      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];

        if (chunk.type === 'asset' && fileName.endsWith('.html')) {
          const htmlAsset = chunk as OutputAsset;
          if (typeof htmlAsset.source === 'string') {
            htmlAsset.source = minifyHTML(htmlAsset.source);
          }
        }
      }
    },

    // Log stats on build complete
    closeBundle() {
      if (processedChunks > 0) {
        console.log(
          `[obfuscation-plugin] Obfuscated ${processedChunks} JS chunks at "${options.level}" level`
        );
      }
    }
  };
}

function minifyHTML(html: string): string {
  return html
    // Remove HTML comments (but keep IE conditionals)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Remove whitespace between tags
    .replace(/>\s+</g, '><')
    // Trim
    .trim();
}

// Re-export for manual usage
export { JavaScriptObfuscator };

/**
 * ===============================================
 * OBFUSCATION UTILITIES
 * ===============================================
 * @file src/utils/obfuscation-utils.ts
 *
 * Utility functions for code and string obfuscation.
 */

export class ObfuscationUtils {
  private static readonly CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  /**
   * Simple XOR encryption for strings
   */
  static encrypt(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(result);
  }

  /**
   * Decrypt XOR encrypted strings
   */
  static decrypt(encrypted: string, key: string): string {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  }

  /**
   * Generate random variable names
   */
  static generateRandomName(length = 8): string {
    let result = '';
    // First character must be letter
    result += ObfuscationUtils.CHARSET.charAt(Math.floor(Math.random() * 52));

    for (let i = 1; i < length; i++) {
      result += ObfuscationUtils.CHARSET.charAt(
        Math.floor(Math.random() * ObfuscationUtils.CHARSET.length)
      );
    }
    return result;
  }

  /**
   * Obfuscate JavaScript function names
   */
  static obfuscateFunctionNames(code: string): string {
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    const nameMap = new Map<string, string>();

    // First pass: collect all function names
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const originalName = match[1];
      if (originalName && !nameMap.has(originalName)) {
        nameMap.set(originalName, ObfuscationUtils.generateRandomName());
      }
    }

    // Second pass: replace function names
    let obfuscatedCode = code;
    nameMap.forEach((obfuscated, original) => {
      const regex = new RegExp(`\\b${original}\\b`, 'g');
      obfuscatedCode = obfuscatedCode.replace(regex, obfuscated);
    });

    return obfuscatedCode;
  }

  /**
   * Obfuscate CSS class names
   */
  static obfuscateClassNames(css: string): { css: string; map: Map<string, string> } {
    const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
    const nameMap = new Map<string, string>();

    let match;
    while ((match = classRegex.exec(css)) !== null) {
      const originalClass = match[1];
      if (originalClass && !nameMap.has(originalClass)) {
        nameMap.set(originalClass, `c${  ObfuscationUtils.generateRandomName(6)}`);
      }
    }

    let obfuscatedCSS = css;
    nameMap.forEach((obfuscated, original) => {
      const regex = new RegExp(`\\.${original}\\b`, 'g');
      obfuscatedCSS = obfuscatedCSS.replace(regex, `.${obfuscated}`);
    });

    return { css: obfuscatedCSS, map: nameMap };
  }

  /**
   * Minify and obfuscate HTML
   */
  static obfuscateHTML(html: string, classMap?: Map<string, string>): string {
    let obfuscated = html
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      // Remove unnecessary attributes
      .replace(/\s+(title|alt)="[^"]*"/g, '');

    // Replace class names if map provided
    if (classMap) {
      classMap.forEach((obfuscatedClassName, original) => {
        const regex = new RegExp(`class=["']([^"']*\\s+)?${original}(\\s+[^"']*)?["']`, 'g');
        obfuscated = obfuscated.replace(regex, (match, before = '', after = '') => `class="${before}${obfuscatedClassName}${after}".trim()`);
      });
    }

    return obfuscated;
  }

  /**
   * Create fake source code to confuse inspectors
   */
  static generateFakeSource(realFunction: Function): string {
    const fakeNames = [
      'validateCredentials', 'encryptPayload', 'authenticateUser',
      'processPayment', 'sanitizeInput', 'hashPassword',
      'generateToken', 'verifySignature', 'decryptData'
    ];

    const fakeName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    const realName = realFunction.name || 'anonymous';

    return `
// ${fakeName} - Security function
function ${fakeName}(data) {
  // This is a decoy function to confuse reverse engineering attempts
  const key = "${ObfuscationUtils.generateRandomName(16)}";
  const encrypted = btoa(JSON.stringify(data));
  
  // Fake security checks
  if (!validateInput(data)) return null;
  if (!checkPermissions()) return null;
  
  // Actual function call is hidden
  return window["${realName}"].apply(this, arguments);
}

function validateInput(data) { return !!data; }
function checkPermissions() { return true; }
    `.trim();
  }

  /**
   * Obfuscate sensitive strings in source code
   */
  static obfuscateSensitiveStrings(code: string, key: string): string {
    // Common sensitive patterns
    const sensitivePatterns = [
      /(['"])(?=.*(?:password|secret|key|token|api)).*?\1/gi,
      /(['"])(?=.*(?:admin|root|user)).*?\1/gi,
      /(['"])(?=.*\.(?:com|net|org|io)).*?\1/gi, // URLs
      /(['"])[A-Za-z0-9+/]{20,}=*\1/g // Base64 patterns
    ];

    let obfuscatedCode = code;

    sensitivePatterns.forEach(pattern => {
      obfuscatedCode = obfuscatedCode.replace(pattern, (match) => {
        const quote = match[0];
        const content = match.slice(1, -1);
        const encrypted = ObfuscationUtils.encrypt(content, key);
        return `${quote}${encrypted}${quote}`;
      });
    });

    return obfuscatedCode;
  }

  /**
   * Create anti-debugging traps
   */
  static insertAntiDebugTraps(code: string): string {
    const traps = [
      'if(new Date()-window.__start<100)debugger;',
      'setInterval(()=>{debugger;},100);',
      'console.clear();',
      '(function(){var a=new Date();debugger;return new Date()-a>100;})()&&location.reload();'
    ];

    const lines = code.split('\n');
    const trapCount = Math.min(3, Math.floor(lines.length / 10));

    for (let i = 0; i < trapCount; i++) {
      const randomLine = Math.floor(Math.random() * lines.length);
      const randomTrap = traps[Math.floor(Math.random() * traps.length)];
      lines.splice(randomLine, 0, randomTrap || '');
    }

    return lines.join('\n');
  }

  /**
   * Generate polymorphic code (code that changes its structure)
   */
  static generatePolymorphicCode(originalFunction: string): string {
    const variations = [
      // Variable name variations
      (code: string) => code.replace(/\bvar\s+/g, 'let '),
      (code: string) => code.replace(/\blet\s+/g, 'const '),

      // Syntax variations
      (_code: string) => _code.replace(/function\s+(\w+)/g, 'const $1 = function'),
      (code: string) => code.replace(/(\w+)\s*\+=\s*(\w+)/g, '$1 = $1 + $2'),

      // Control flow variations
      (code: string) => code.replace(/if\s*\(([^)]+)\)\s*{([^}]+)}/g, '($1) && (() => { $2 })()')
    ];

    let result = originalFunction;
    const numVariations = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numVariations; i++) {
      const variation = variations[Math.floor(Math.random() * variations.length)];
      if (variation) {
        result = variation(result);
      }
    }

    return result;
  }
}

/**
 * Runtime string decryptor
 */
export class RuntimeDecryptor {
  private static cache = new Map<string, string>();
  private static key: string;

  static setKey(key: string): void {
    RuntimeDecryptor.key = key;
  }

  static decrypt(encrypted: string): string {
    if (!RuntimeDecryptor.key) {
      throw new Error('Decryption key not set');
    }

    if (RuntimeDecryptor.cache.has(encrypted)) {
      return RuntimeDecryptor.cache.get(encrypted)!;
    }

    const decrypted = ObfuscationUtils.decrypt(encrypted, RuntimeDecryptor.key);
    RuntimeDecryptor.cache.set(encrypted, decrypted);
    return decrypted;
  }

  static clearCache(): void {
    RuntimeDecryptor.cache.clear();
  }
}
# Code Protection System Guide

This comprehensive code protection system helps prevent reverse engineering, code inspection, and unauthorized access to your application's source code.

## 🚨 IMPORTANT: Protection is DISABLED by Default

The protection system is intentionally disabled to allow normal development. When you're ready to deploy or want to test protection, follow the activation steps below.

## 📋 Features

### Runtime Protection
- **DevTools Blocking**: Detects and blocks developer tools (F12, Ctrl+Shift+I, etc.)
- **Source Obfuscation**: Minifies and obfuscates HTML source code
- **Right-Click Blocking**: Disables context menu and text selection
- **Keyboard Shortcuts**: Blocks common inspection shortcuts
- **Console Disabling**: Overrides or disables console methods
- **DOM Protection**: Prevents suspicious DOM modifications
- **Anti-Debugging**: Multiple techniques to detect debugging attempts
- **Code Integrity**: Checks for tampering with critical functions

### Build-Time Protection
- **JavaScript Obfuscation**: Renames functions and variables
- **CSS Obfuscation**: Obfuscates class names
- **String Encryption**: Encrypts sensitive strings in code
- **Anti-Debug Traps**: Inserts debugging detection code
- **Source Map Removal**: Removes or replaces with fake source maps
- **Polymorphic Code**: Code that changes its structure

## 🔧 How to Enable Protection

### Step 1: Runtime Protection

Edit `/src/config/protection.config.ts`:

```typescript
export const PROTECTION_CONFIG: CodeProtectionConfig = {
  // Change this from false to true
  enabled: true,
  
  // Choose your level: 'basic' | 'standard' | 'advanced' | 'maximum'
  level: 'maximum',
  
  features: {
    devToolsBlocking: true,
    sourceObfuscation: true,
    rightClickDisable: true,
    keyboardShortcuts: true,
    consoleDisabling: true,
    domMutationProtection: true,
    antiDebugging: true,
    networkObfuscation: false,
    stringEncryption: true,
    codeIntegrityCheck: true,
  }
};
```

### Step 2: Build-Time Protection

Edit `vite.config.js` to enable the obfuscation plugin:

```javascript
import { createObfuscationPlugin } from './src/utils/obfuscation-plugin';
import { BUILD_OBFUSCATION_CONFIG } from './src/config/protection.config';

export default defineConfig({
  plugins: [
    // ... your existing plugins
    
    // Add this plugin
    createObfuscationPlugin({
      ...BUILD_OBFUSCATION_CONFIG,
      enabled: true, // Enable for production builds
    })
  ],
  
  build: {
    // Disable source maps in production for security
    sourcemap: false,
    
    // Minify aggressively
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        toplevel: true,
      }
    }
  }
});
```

## 🎛️ Protection Levels

### Basic
- Light protection with minimal performance impact
- Suitable for public demos or educational content
- Blocks basic inspection but allows debugging

### Standard (Recommended)
- Balanced protection with moderate security
- Good for most production applications
- Blocks common inspection methods

### Advanced
- Strong protection that may impact user experience
- Suitable for sensitive applications
- Aggressive blocking of development tools

### Maximum
- Extreme protection with the most security features
- May significantly impact performance and usability
- Only for highly sensitive applications

## 🎨 Preset Configurations

Use pre-configured settings for different environments:

```typescript
import { PROTECTION_PRESETS } from './src/config/protection.config';

// For development - minimal protection
const config = PROTECTION_PRESETS.development;

// For staging - moderate protection
const config = PROTECTION_PRESETS.staging;

// For production - full protection
const config = PROTECTION_PRESETS.production;

// For demo/portfolio - user-friendly protection
const config = PROTECTION_PRESETS.demo;
```

## 🔍 Runtime Control

You can control protection at runtime through the global debug object:

```javascript
// Check protection status
NBW_DEBUG.getProtectionStatus();

// Enable protection manually
NBW_DEBUG.enableProtection();

// Disable protection (for debugging)
NBW_DEBUG.disableProtection();

// View protection violations
NBW_DEBUG.getProtectionViolations();

// Update protection config
NBW_DEBUG.updateProtectionConfig({
  level: 'advanced',
  features: { devToolsBlocking: true }
});
```

## ⚠️ Important Considerations

### Accessibility
- Right-click and keyboard blocking may affect accessibility
- Consider disabling these features for public-facing sites
- Test with screen readers and accessibility tools

### User Experience
- Maximum protection level can be intrusive
- Consider using "demo" preset for portfolio sites
- Test thoroughly with your target audience

### Development
- Always disable protection during development
- Use environment-based configuration
- Keep a way to disable protection for debugging

### Legal and Ethical
- Code protection is not foolproof
- Determined attackers can still reverse engineer
- Consider this as deterrent, not absolute security

## 🛠️ Testing Protection

1. **Enable protection** in config file
2. **Build the application**: `npm run build`
3. **Serve the built files**: `npm run preview`
4. **Try these tests**:
   - Press F12 (should be blocked)
   - Right-click (should be disabled)
   - Try Ctrl+U to view source (should be blocked)
   - Open console (should be disabled or overridden)
   - Check source code (should be obfuscated)

## 🔧 Customization

### Add Custom Violation Handling

```typescript
export const PROTECTION_CONFIG: CodeProtectionConfig = {
  // ... other config
  
  onViolation: (type: string, details: any) => {
    // Custom logging
    console.warn(`Security violation: ${type}`);
    
    // Send to analytics
    gtag('event', 'security_violation', { violation_type: type });
    
    // Send to your backend
    fetch('/api/security-log', {
      method: 'POST',
      body: JSON.stringify({ type, details, timestamp: Date.now() })
    });
    
    // Show custom message
    if (type === 'devtools') {
      alert('Developer tools detected. Some features may be limited.');
    }
  }
};
```

### Whitelist Specific IPs or User Agents

```typescript
export const PROTECTION_CONFIG: CodeProtectionConfig = {
  // ... other config
  
  whitelist: {
    // Allow your development IP
    ips: ['192.168.1.100', '10.0.0.1'],
    
    // Allow specific user agents
    userAgents: ['MyTestBot/1.0'],
    
    // Allow specific domains
    domains: ['localhost', 'dev.mysite.com'],
  }
};
```

## 📊 Monitoring and Analytics

The protection system tracks violations and provides analytics:

```javascript
// Get violation statistics
const stats = codeProtectionService.getViolations();

// Clear violation history
codeProtectionService.clearViolations();

// Get current protection status
const status = codeProtectionService.getStatus();
```

## 🚀 Deployment Checklist

- [ ] Test protection in development mode (disabled)
- [ ] Enable protection in staging environment
- [ ] Test all functionality with protection enabled
- [ ] Verify protection doesn't break accessibility
- [ ] Enable build-time obfuscation for production
- [ ] Remove source maps from production build
- [ ] Test protection bypass attempts
- [ ] Set up violation monitoring
- [ ] Document any protection-related issues

## 🔒 Security Notes

1. **Client-side protection** can always be bypassed by determined attackers
2. **This is a deterrent**, not absolute security
3. **Sensitive operations** should always be validated server-side
4. **Source code obfuscation** makes reverse engineering harder but not impossible
5. **Regular updates** are important as bypass techniques evolve

## 📞 Support

If you encounter issues with the protection system:

1. Check browser console for protection-related errors
2. Try disabling specific protection features
3. Test with different protection levels
4. Verify configuration is correct
5. Check for conflicts with other scripts

Remember: The goal is to deter casual inspection while maintaining a good user experience for legitimate users.
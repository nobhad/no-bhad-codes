#!/usr/bin/env node

/**
 * Pre-build script to compile EJS templates into static HTML
 * This solves the vite-plugin-ejs include path resolution issues
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Template configurations
const templates = [
  {
    input: resolve(projectRoot, 'index.html'),
    output: resolve(projectRoot, 'dist-temp/index.html'),
    data: 'home'
  },
  {
    input: resolve(projectRoot, 'projects/index.html'),
    output: resolve(projectRoot, 'dist-temp/projects/index.html'), 
    data: 'projects'
  },
  {
    input: resolve(projectRoot, 'admin/index.html'),
    output: resolve(projectRoot, 'dist-temp/admin/index.html'),
    data: 'admin'
  },
  {
    input: resolve(projectRoot, 'client/landing.html'),
    output: resolve(projectRoot, 'dist-temp/client/landing.html'),
    data: 'clientLanding'
  },
  {
    input: resolve(projectRoot, 'client/intake.html'),
    output: resolve(projectRoot, 'dist-temp/client/intake.html'),
    data: 'clientIntake'
  },
  {
    input: resolve(projectRoot, 'client/portal.html'),
    output: resolve(projectRoot, 'dist-temp/client/portal.html'),
    data: 'clientPortal'
  },
  {
    input: resolve(projectRoot, 'client-portal/index.html'),
    output: resolve(projectRoot, 'dist-temp/client-portal/index.html'),
    data: 'clientPortal'
  }
];

// Load template data
let templateData;
try {
  templateData = JSON.parse(
    readFileSync(resolve(projectRoot, 'templates/data.json'), 'utf-8')
  );
} catch (error) {
  console.error('Failed to read template data:', error);
  process.exit(1);
}

// EJS options
const ejsOptions = {
  root: projectRoot,
  views: [resolve(projectRoot, 'templates'), projectRoot],
  filename: 'template',
  cache: false
};

console.log('🔧 Pre-compiling EJS templates...');

templates.forEach(template => {
  try {
    // Ensure output directory exists
    const outputDir = dirname(template.output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Read the template file
    const templateContent = readFileSync(template.input, 'utf-8');
    
    // Get page-specific data
    const pageData = templateData.pages?.[template.data] || {
      title: 'No Bhad Codes',
      description: 'Professional web development services'
    };

    // Render the template
    const rendered = ejs.render(templateContent, {
      ...templateData,
      pageData,
      pages: templateData.pages
    }, ejsOptions);

    // Write the compiled HTML
    writeFileSync(template.output, rendered, 'utf-8');
    console.log(`✅ Compiled: ${template.input} -> ${template.output}`);

  } catch (error) {
    console.error(`❌ Failed to compile ${template.input}:`, error.message);
    process.exit(1);
  }
});

console.log('🎉 Template compilation complete!');
#!/usr/bin/env node

/**
 * Coverage threshold checker script
 * Validates that test coverage meets minimum thresholds
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const COVERAGE_FILE = resolve('./coverage/.tmp/coverage-0.json');
const DEFAULT_THRESHOLDS = {
  lines: 70,
  functions: 70,
  branches: 70,
  statements: 70
};

// Custom thresholds for different modules
const MODULE_THRESHOLDS = {
  'src/core/': { lines: 85, functions: 85, branches: 85, statements: 85 },
  'src/services/': { lines: 80, functions: 80, branches: 80, statements: 80 },
  'server/services/': { lines: 80, functions: 80, branches: 80, statements: 80 }
};

function checkCoverage() {
  if (!existsSync(COVERAGE_FILE)) {
    console.error('❌ Coverage file not found. Run tests with coverage first.');
    process.exit(1);
  }

  const coverageData = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'));
  const { total } = coverageData;

  console.log('\n📊 Test Coverage Report\n');
  console.log('='.repeat(50));

  let failed = false;

  // Check global thresholds
  for (const [metric, threshold] of Object.entries(DEFAULT_THRESHOLDS)) {
    const coverage = total[metric].pct;
    const status = coverage >= threshold ? '✅' : '❌';
    const color = coverage >= threshold ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${status} ${metric.padEnd(12)} ${color}${coverage.toFixed(1)}%${reset} (threshold: ${threshold}%)`);
    
    if (coverage < threshold) {
      failed = true;
    }
  }

  console.log('\n📁 File Coverage Analysis\n');

  // Check individual files that don't meet thresholds
  const files = Object.entries(coverageData)
    .filter(([key]) => key !== 'total')
    .map(([file, data]) => ({ file, ...data }))
    .filter(file => 
      file.lines.pct < DEFAULT_THRESHOLDS.lines ||
      file.functions.pct < DEFAULT_THRESHOLDS.functions
    );

  if (files.length > 0) {
    console.log('⚠️  Files below coverage thresholds:');
    files.forEach(file => {
      console.log(`   📄 ${file.file}`);
      console.log(`      Lines: ${file.lines.pct}% | Functions: ${file.functions.pct}%`);
    });
  } else {
    console.log('✅ All files meet coverage thresholds');
  }

  // Coverage summary
  console.log('\n📈 Coverage Summary\n');
  console.log(`Total Lines Covered: ${total.lines.covered}/${total.lines.total}`);
  console.log(`Total Functions Covered: ${total.functions.covered}/${total.functions.total}`);
  console.log(`Total Branches Covered: ${total.branches.covered}/${total.branches.total}`);
  console.log(`Total Statements Covered: ${total.statements.covered}/${total.statements.total}`);

  if (failed) {
    console.log('\n❌ Coverage check failed. Some metrics are below thresholds.');
    console.log('💡 Run `npm run test:coverage:watch` to improve coverage interactively.');
    process.exit(1);
  } else {
    console.log('\n✅ All coverage thresholds met!');
    process.exit(0);
  }
}

// Generate coverage badge data
function generateBadgeData() {
  if (!existsSync(COVERAGE_FILE)) {
    return;
  }

  const coverageData = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'));
  const coverage = Math.round(coverageData.total.lines.pct);
  
  let color = 'red';
  if (coverage >= 80) color = 'brightgreen';
  else if (coverage >= 70) color = 'yellow';
  else if (coverage >= 50) color = 'orange';

  const badgeData = {
    schemaVersion: 1,
    label: 'coverage',
    message: `${coverage}%`,
    color: color
  };

  console.log('Coverage Badge Data:');
  console.log(JSON.stringify(badgeData, null, 2));
}

// Main execution
const command = process.argv[2];

if (command === 'badge') {
  generateBadgeData();
} else {
  checkCoverage();
}
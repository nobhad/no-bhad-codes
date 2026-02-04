#!/usr/bin/env node
const fs = require('fs');
const file = process.argv[2];
if (!file) {
  console.error('Usage: node fix-md-tables.cjs <markdown-file>');
  process.exit(2);
}
let src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');
let inFence = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^\s*```/.test(line)) {
    inFence = !inFence;
    continue;
  }
  if (inFence) continue;

  // detect table header (line followed by separator line like |---|---|)
  // Skip and remove solitary pipe lines which break table parsing
  if (/^\s*\|\s*$/.test(line)) {
    lines.splice(i, 1);
    i--;
    continue;
  }

  if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[:\-\s|]+\|?\s*$/.test(lines[i + 1])) {
    // process header and subsequent table rows
    let j = i;
    while (j < lines.length && lines[j].includes('|')) {
      // stop at blank line
      if (lines[j].trim() === '') break;
      // normalize spaces around pipes for this table row
      // keep leading/trailing pipe if present
      const hasLeading = /^\s*\|/.test(lines[j]);
      const hasTrailing = /\|\s*$/.test(lines[j]);
      // remove spaces around pipes
      let newLine = lines[j].replace(/\s*\|\s*/g, '|').trim();
      if (hasLeading && !newLine.startsWith('|')) newLine = '|' + newLine;
      if (hasTrailing && !newLine.endsWith('|')) newLine = newLine + '|';
      lines[j] = newLine;
      j++;
    }
    // jump past processed rows
    i = j;
  }
}
fs.writeFileSync(file, lines.join('\n'));
console.log('Normalized table spacing in', file);

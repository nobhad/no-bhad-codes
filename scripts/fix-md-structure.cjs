#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
if (!file) {
  console.error('Usage: node fix-md-structure.cjs <markdown-file>');
  process.exit(2);
}
let src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');
let out = [];
let inFence = false;
let fenceLang = null;
let olCounter = null;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // detect fence start/end
  if (/^\s*```/.test(line)) {
    if (!inFence) {
      // ensure blank line before fence
      if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
      // add language if missing
      if (/^\s*```\s*$/.test(line)) {
        line = '```text';
      }
      inFence = true;
      fenceLang = line;
      out.push(line);
      continue;
    } else {
      // closing fence
      out.push(line);
      // ensure blank line after fence (if not EOF)
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') out.push('');
      inFence = false;
      fenceLang = null;
      continue;
    }
  }

  if (inFence) {
    out.push(line);
    continue;
  }

  // replace bare emails with <email>
  line = line.replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '<$1>');
  // wrap bare http(s) urls in <>
  line = line.replace(/(^|\s)(https?:\/\/[^\s)]+)/g, (m, p1, url) => `${p1}<${url}>`);

  // headings: ensure blank line before and after
  if (/^\s{0,3}#{1,6}\s+/.test(line)) {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
    out.push(line);
    // ensure blank line after heading if next non-empty line isn't another heading
    if (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^\s{0,3}#{1,6}\s+/.test(lines[i + 1])) out.push('');
    // reset ordered list counter
    olCounter = null;
    continue;
  }

  // lists: ensure blank line before a list start and handle ordered list numbering
  const olMatch = line.match(/^(\s*)(\d+)\.(\s+)(.*)$/);
  const ulMatch = line.match(/^(\s*)([*+-])(\s+)(.*)$/);
  if (olMatch) {
    const indent = olMatch[1] || '';
    if (out.length > 0 && out[out.length - 1].trim() !== '' && !/^(\s*([*+-]|\d+\.)\s+)/.test(out[out.length - 1])) out.push('');
    if (olCounter === null) olCounter = 1;
    const content = olMatch[4] || '';
    out.push(`${indent}${olCounter}. ${content}`);
    olCounter++;
    continue;
  }
  if (ulMatch) {
    if (out.length > 0 && out[out.length - 1].trim() !== '' && !/^(\s*([*+-]|\d+\.)\s+)/.test(out[out.length - 1])) out.push('');
    out.push(line);
    olCounter = null;
    continue;
  }

  // ensure blank line after a list block ends
  if (out.length > 0 && /^(\s*([*+-]|\d+\.)\s+)/.test(out[out.length - 1]) && line.trim() !== '' && !/^(\s*([*+-]|\d+\.)\s+)/.test(line)) {
    out.push('');
  }

  out.push(line);
}

// ensure single trailing newline
while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
out.push('');

fs.writeFileSync(file, out.join('\n'));
console.log('Fixed structure for', path.relative(process.cwd(), file));

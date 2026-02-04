#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const target = path.resolve('docs/API_DOCUMENTATION.md')
let text = fs.readFileSync(target, 'utf8')
const lines = text.split(/\r?\n/)

let inFenced = false
const headings = new Map()
const out = []
for (let i = 0; i < lines.length; i++) {
  let line = lines[i]
  if (/^\s*```/.test(line)) {
    inFenced = !inFenced
    out.push(line)
    continue
  }
  if (inFenced) {
    out.push(line)
    continue
  }

  // Fix heading duplicates by appending a small suffix
  const h = line.match(/^(#{1,6})\s*(.+?)\s*$/)
  if (h) {
    const text = h[2]
    const key = text.toLowerCase()
    const count = headings.get(key) || 0
    if (count > 0) {
      const newText = `${h[1]} ${text} (duplicate ${count + 1})`
      out.push(newText)
      headings.set(key, count + 1)
      continue
    }
    headings.set(key, 1)
    out.push(line)
    continue
  }

  // Fix table pipes spacing for non-fenced lines
  if (line.includes('|')) {
    // Avoid changing YAML frontmatter or HTML tags
    if (/^\s*---\s*$/.test(line) || /^\s*<\/?[a-zA-Z]/.test(line)) {
      out.push(line)
      continue
    }
    // Replace any amount of space around pipes with single space on each side
    const fixed = line.replace(/\s*\|\s*/g, ' | ')
    out.push(fixed)
    continue
  }

  out.push(line)
}

fs.writeFileSync(target, out.join('\n'), 'utf8')
console.log('Processed', target)

#!/usr/bin/env node
/**
 * Reads all SVG files from assets/vectors/ and generates svgAssets.js
 * with window.VECTOR_SVGS = { "key": "<svg>...</svg>", ... }
 * Key = filename without .svg, hyphens replaced by underscores
 */

const fs = require('fs');
const path = require('path');

const VECTORS_DIR = path.join(__dirname, '..', 'assets', 'vectors');
const OUT_FILE = path.join(__dirname, '..', 'svgAssets.js');

function toKey(filename) {
  return filename.replace(/\.svg$/i, '').replace(/-/g, '_');
}

function main() {
  if (!fs.existsSync(VECTORS_DIR)) {
    console.error('Vectors directory not found:', VECTORS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(VECTORS_DIR).filter((f) => f.endsWith('.svg'));
  const vectorSvgs = {};

  for (const file of files.sort()) {
    const filePath = path.join(VECTORS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8').trim();
    const key = toKey(file);
    vectorSvgs[key] = content;
  }

  const lines = ['window.VECTOR_SVGS = {'];
  for (const [key, svgContent] of Object.entries(vectorSvgs)) {
    const escaped = JSON.stringify(svgContent);
    lines.push(`  "${key}": ${escaped},`);
  }
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1); // remove trailing comma
  }
  lines.push('};');

  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
  console.log(`Generated ${OUT_FILE} with ${Object.keys(vectorSvgs).length} vector SVGs.`);
}

main();

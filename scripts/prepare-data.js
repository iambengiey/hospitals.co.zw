#!/usr/bin/env node
/**
 * Generate the browser-ready hospital data module from the canonical JSON source.
 * Keeps a copy in src/data/ for direct downloads and writes an ES module for imports.
 */

const fs = require('fs');
const path = require('path');

const root = __dirname ? path.join(__dirname, '..') : '..';
const sourcePath = path.join(root, 'data', 'hospitals.json');
const downloadCopyPath = path.join(root, 'src', 'data', 'hospitals.json');
const modulePath = path.join(root, 'src', 'hospitalsData.js');

const main = () => {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const data = JSON.parse(raw);

  // Ensure src/data exists and mirror the JSON for people who want a direct file.
  fs.mkdirSync(path.dirname(downloadCopyPath), { recursive: true });
  fs.writeFileSync(downloadCopyPath, JSON.stringify(data, null, 2) + '\n');

  const moduleContents = `// Auto-generated hospital dataset.\n` +
    `// Refresh via: npm run prepare:data\n` +
    `export const hospitalsData = ${JSON.stringify(data, null, 2)};\n` +
    `export default hospitalsData;\n`;

  fs.writeFileSync(modulePath, moduleContents);
};

main();

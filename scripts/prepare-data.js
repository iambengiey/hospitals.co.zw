#!/usr/bin/env node
/**
 * Generate the browser-ready hospital data module from the canonical JSON source.
 * Keeps a copy in src/data/ for direct downloads and writes an ES module for imports.
 */

const fs = require('fs');
const path = require('path');

const root = __dirname ? path.join(__dirname, '..') : '..';
const sourcePath = path.join(root, 'data', 'hospitals.json');
const fullSourcePath = path.join(root, 'data', 'hospitals_full.json');
const downloadCopyPath = path.join(root, 'src', 'data', 'hospitals.json');
const modulePath = path.join(root, 'src', 'hospitalsData.js');
const sitemapPath = path.join(root, 'src', 'sitemap.xml');

const baseSiteUrl = (process.env.SITE_URL || 'https://hospitals.co.zw').replace(/\/+$/, '');

const toIsoDate = (filePath) => {
  try {
    return fs.statSync(filePath).mtime.toISOString().split('T')[0];
  } catch (err) {
    void err;
    return new Date().toISOString().split('T')[0];
  }
};

const buildSitemap = () => {
  const today = new Date().toISOString().split('T')[0];
  const urls = [
    { loc: `${baseSiteUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseSiteUrl}/data/hospitals.json`, lastmod: toIsoDate(sourcePath), changefreq: 'daily', priority: '0.9' },
  ];

  if (fs.existsSync(fullSourcePath)) {
    urls.push({
      loc: `${baseSiteUrl}/data/hospitals_full.json`,
      lastmod: toIsoDate(fullSourcePath),
      changefreq: 'daily',
      priority: '0.6',
    });
  }

  urls.push({ loc: `${baseSiteUrl}/robots.txt`, lastmod: today, changefreq: 'monthly', priority: '0.2' });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(({ loc, lastmod, changefreq, priority }) => {
        const parts = [
          `  <url>`,
          `    <loc>${loc}</loc>`,
          lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
          changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
          priority ? `    <priority>${priority}</priority>` : null,
          `  </url>`,
        ].filter(Boolean);
        return parts.join('\n');
      })
      .join('\n') +
    '\n</urlset>\n';

  fs.writeFileSync(sitemapPath, xml);
};

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

  buildSitemap();
};

main();

#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import hljs from 'highlight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TINQER_REPO = path.resolve(__dirname, '../../tinqer');
const BUILD_DIR = path.resolve(__dirname, '../build');
const TEMPLATE_PATH = path.resolve(__dirname, 'template.html');
const STYLES_PATH = path.resolve(__dirname, 'styles.css');

// Page definitions
const pages = [
  { src: path.join(TINQER_REPO, 'README.md'), dest: 'index.html', title: 'Getting Started', nav: 'Getting Started' },
  { src: path.join(TINQER_REPO, 'docs/guide.md'), dest: 'guide.html', title: 'Guide', nav: 'Guide' },
  { src: path.join(TINQER_REPO, 'docs/api-reference.md'), dest: 'api-reference.html', title: 'API Reference', nav: 'API Reference' },
  { src: path.join(TINQER_REPO, 'docs/adapters.md'), dest: 'adapters.html', title: 'Adapters', nav: 'Adapters' },
  { src: path.join(TINQER_REPO, 'docs/development.md'), dest: 'development.html', title: 'Development', nav: 'Development' },
  { src: path.join(TINQER_REPO, 'ARCHITECTURE.md'), dest: 'architecture.html', title: 'Architecture', nav: 'Architecture' },
];

// Slugify function - removes dots to match manual TOC links
function slugify(s) {
  return encodeURIComponent(String(s).trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '-'));
}

// Initialize markdown-it with plugins
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
}).use(markdownItAnchor, {
  slugify: slugify,
  permalink: markdownItAnchor.permalink.ariaHidden({
    placement: 'before',
    symbol: '#',
    class: 'anchor'
  })
});

// Generate navigation HTML
function generateNav(currentPage) {
  let nav = '<ul class="nav-list">\n';
  pages.forEach(page => {
    const isActive = page.dest === currentPage;
    const activeClass = isActive ? ' class="active"' : '';
    nav += `  <li${activeClass}><a href="${page.dest}">${page.nav}</a></li>\n`;
  });
  nav += '</ul>';
  return nav;
}

// Generate breadcrumb
function generateBreadcrumb(pageTitle) {
  if (pageTitle === 'Getting Started') {
    return '<div class="breadcrumb"><span>Home</span></div>';
  }
  return `<div class="breadcrumb"><a href="index.html">Home</a> / <span>${pageTitle}</span></div>`;
}

// Generate prev/next navigation
function generatePageNav(currentIndex) {
  const prev = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const next = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  let html = '<footer class="page-nav">\n';
  if (prev) {
    html += `  <a href="${prev.dest}" class="prev">← ${prev.nav}</a>\n`;
  } else {
    html += '  <span></span>\n';
  }
  if (next) {
    html += `  <a href="${next.dest}" class="next">${next.nav} →</a>\n`;
  } else {
    html += '  <span></span>\n';
  }
  html += '</footer>';
  return html;
}

// Extract headings for TOC
function extractHeadings(tokens) {
  const headings = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.substring(1));
      const content = tokens[i + 1].content;
      const id = slugify(content); // Use same slugify function as markdown-it-anchor
      if (level >= 2 && level <= 3) { // Only h2 and h3 for TOC
        headings.push({ level, content, id });
      }
    }
  }
  return headings;
}

// Generate TOC HTML
function generateTOC(headings) {
  if (headings.length === 0) return '';

  let toc = '<nav class="toc">\n<h2>On This Page</h2>\n<ul>\n';
  headings.forEach(h => {
    const indent = h.level === 3 ? ' class="toc-sub"' : '';
    toc += `  <li${indent}><a href="#${h.id}">${h.content}</a></li>\n`;
  });
  toc += '</ul>\n</nav>';
  return toc;
}

// Build a single page
function buildPage(page, index) {
  console.log(`Building ${page.dest}...`);

  // Read markdown source
  const markdown = fs.readFileSync(page.src, 'utf-8');

  // Parse markdown
  const tokens = md.parse(markdown, {});
  const content = md.renderer.render(tokens, md.options, {});

  // Extract headings for TOC
  const headings = extractHeadings(tokens);
  const toc = generateTOC(headings);

  // Read template
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // Replace placeholders
  html = html.replace('{{TITLE}}', page.title);
  html = html.replace('{{NAV}}', generateNav(page.dest));
  html = html.replace('{{BREADCRUMB}}', generateBreadcrumb(page.title));
  html = html.replace('{{TOC}}', toc);
  html = html.replace('{{CONTENT}}', content);
  html = html.replace('{{PAGE_NAV}}', generatePageNav(index));

  // Write output
  const outputPath = path.join(BUILD_DIR, page.dest);
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`  ✓ Created ${page.dest}`);
}

// Main build function
function build() {
  console.log('Building Tinqer documentation...\n');

  // Create build directory
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Copy styles
  console.log('Copying styles.css...');
  fs.copyFileSync(STYLES_PATH, path.join(BUILD_DIR, 'styles.css'));
  console.log('  ✓ Copied styles.css');

  // Copy logo
  console.log('Copying logo.svg...');
  const LOGO_PATH = path.resolve(__dirname, 'logo.svg');
  fs.copyFileSync(LOGO_PATH, path.join(BUILD_DIR, 'logo.svg'));
  console.log('  ✓ Copied logo.svg\n');

  // Build all pages
  pages.forEach((page, index) => {
    buildPage(page, index);
  });

  console.log('\n✓ Build complete! Output in build/');
}

// Run build
build();

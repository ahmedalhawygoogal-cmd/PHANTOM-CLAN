#!/usr/bin/env node
/**
 * PHANTOM HQ — static build for Vercel.
 *
 * Vercel runs this project as the "Other" framework preset: it executes the
 * `build` script from package.json and then expects an Output Directory named
 * `public`. Because the repo is a plain static site, nothing ever created that
 * directory, so the deployment failed with:
 *
 *   Error: No Output Directory named "public" found after the Build completed.
 *
 * This script copies the front-end assets into `public/` so the build always
 * produces a real, deployable output directory. It is intentionally
 * dependency-free and does not touch server.js (the Express backend is not
 * part of the static deployment).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');

/* Front-end entry points and PWA assets that must be served to the browser. */
const FILES = [
    'index.html',
    'style.css',
    'script.js',
    'data.js',
    'sw.js',
    'manifest.json',
    'metadata.json',
    'firebase-applet-config.json',
    '.nojekyll'
];

/* Optional asset directories (icons / images) copied when present. */
const DIRS = ['icons', 'assets', 'images'];

const IMAGE_RE = /\.(png|ico|svg|jpe?g|webp|gif)$/i;

function copyFile(relativePath) {
    const source = path.join(ROOT, relativePath);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return false;
    const destination = path.join(OUT, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    return true;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copied = [];

for (const file of FILES) {
    if (copyFile(file)) copied.push(file);
}

for (const dir of DIRS) {
    const source = path.join(ROOT, dir);
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) continue;
    fs.cpSync(source, path.join(OUT, dir), { recursive: true });
    copied.push(`${dir}/`);
}

// Any top-level images or favicons that happen to live in the repo root.
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isFile() || !IMAGE_RE.test(entry.name)) continue;
    if (copyFile(entry.name)) copied.push(entry.name);
}

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
    console.error('❌ build-static: index.html is missing — refusing to produce an empty deployment.');
    process.exit(1);
}

console.log(`✅ build-static: ${copied.length} entries written to ${path.relative(ROOT, OUT)}/`);
console.log(`   ${copied.join(', ')}`);

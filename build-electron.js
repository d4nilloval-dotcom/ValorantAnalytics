#!/usr/bin/env node
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const run = (cmd, opts = {}) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
};

console.log('═══════════════════════════════════════════════');
console.log('  ValoAnalytics Pro — Build Electron v2.0');
console.log('═══════════════════════════════════════════════\n');

// Assets
const assetsDir = path.join(__dirname, 'electron', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
const icoPath = path.join(assetsDir, 'icon.ico');
if (!fs.existsSync(icoPath)) {
  const minIco = Buffer.from('AAABAAEAAQEAAAEAGAAoAAAAFgAAACgAAAABAAAAAgAAAAEAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
  fs.writeFileSync(icoPath, minIco);
  console.log('✓ Icono placeholder creado (reemplaza con tu icon.ico real)');
}

// Workers dir
const workersDir = path.join(__dirname, 'electron', 'workers');
if (!fs.existsSync(workersDir)) fs.mkdirSync(workersDir, { recursive: true });

// Instalar dependencias
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const devDeps = pkg.devDependencies || {};
const deps    = pkg.dependencies    || {};

if (!devDeps.electron || !devDeps['electron-builder']) {
  console.log('\n📥 Instalando Electron y electron-builder...');
  run('npm install --save-dev electron electron-builder --legacy-peer-deps');
}
if (!deps['better-sqlite3']) {
  console.log('\n📥 Instalando better-sqlite3...');
  run('npm install better-sqlite3 --legacy-peer-deps');
}
if (!devDeps.concurrently || !devDeps['wait-on']) {
  run('npm install --save-dev concurrently wait-on --legacy-peer-deps');
}

// Build frontend
console.log('\n📦 Compilando frontend React...');
run('npm run build');

// Build Electron
console.log('\n🔨 Empaquetando con electron-builder...');
run('npx electron-builder --config electron-builder.json');

console.log('\n✅ BUILD COMPLETADO');
console.log('   Instalador: release/ValoAnalytics Pro Setup *.exe');
console.log('   Portable:   release/ValoAnalytics-Pro-Portable-*.exe');

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de PWA...\n');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    checks.passed.push(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    checks.failed.push(`❌ ${description}: ${filePath} no encontrado`);
    return false;
  }
}

function checkManifest() {
  const manifestPath = path.join(process.cwd(), 'public/manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      if (manifest.name) checks.passed.push('✅ Manifest: name definido');
      else checks.failed.push('❌ Manifest: falta name');
      
      if (manifest.short_name) checks.passed.push('✅ Manifest: short_name definido');
      else checks.warnings.push('⚠️  Manifest: falta short_name');
      
      if (manifest.start_url) checks.passed.push('✅ Manifest: start_url definido');
      else checks.failed.push('❌ Manifest: falta start_url');
      
      if (manifest.display) checks.passed.push('✅ Manifest: display definido');
      else checks.failed.push('❌ Manifest: falta display');
      
      if (manifest.theme_color) checks.passed.push('✅ Manifest: theme_color definido');
      else checks.warnings.push('⚠️  Manifest: falta theme_color');
      
      if (manifest.background_color) checks.passed.push('✅ Manifest: background_color definido');
      else checks.warnings.push('⚠️  Manifest: falta background_color');
      
      if (manifest.icons && manifest.icons.length > 0) {
        checks.passed.push(`✅ Manifest: ${manifest.icons.length} iconos definidos`);
        
        const has192 = manifest.icons.some(icon => icon.sizes === '192x192');
        const has512 = manifest.icons.some(icon => icon.sizes === '512x512');
        
        if (has192) checks.passed.push('✅ Manifest: icono 192x192 definido');
        else checks.failed.push('❌ Manifest: falta icono 192x192');
        
        if (has512) checks.passed.push('✅ Manifest: icono 512x512 definido');
        else checks.failed.push('❌ Manifest: falta icono 512x512');
      } else {
        checks.failed.push('❌ Manifest: no hay iconos definidos');
      }
      
    } catch (error) {
      checks.failed.push('❌ Manifest: error al parsear JSON');
    }
  } else {
    checks.failed.push('❌ Manifest: archivo no encontrado');
  }
}

checkFile('public/manifest.json', 'Manifest');
checkFile('public/sw.js', 'Service Worker');
checkFile('public/icon.svg', 'Icono SVG');
checkFile('public/offline.html', 'Página Offline');
checkFile('public/browserconfig.xml', 'Browser Config');
checkFile('components/PWAInstallPrompt.tsx', 'Componente de Instalación');

checkManifest();

const requiredIcons = [
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png',
  'apple-icon.png',
  'favicon-32x32.png',
  'favicon-16x16.png'
];

console.log('\n📱 Verificando iconos PNG:\n');
requiredIcons.forEach(icon => {
  const iconPath = path.join(process.cwd(), 'public', icon);
  if (fs.existsSync(iconPath)) {
    checks.passed.push(`✅ Icono: ${icon}`);
  } else {
    checks.warnings.push(`⚠️  Icono: ${icon} no encontrado (ejecuta npm run generate-icons)`);
  }
});

console.log('\n📊 Resultados:\n');

if (checks.passed.length > 0) {
  console.log('✅ PASADOS:\n');
  checks.passed.forEach(check => console.log(`  ${check}`));
  console.log('');
}

if (checks.warnings.length > 0) {
  console.log('⚠️  ADVERTENCIAS:\n');
  checks.warnings.forEach(check => console.log(`  ${check}`));
  console.log('');
}

if (checks.failed.length > 0) {
  console.log('❌ FALLIDOS:\n');
  checks.failed.forEach(check => console.log(`  ${check}`));
  console.log('');
}

const total = checks.passed.length + checks.warnings.length + checks.failed.length;
const score = Math.round((checks.passed.length / total) * 100);

console.log(`\n🎯 Score: ${score}%`);
console.log(`   Pasados: ${checks.passed.length}`);
console.log(`   Advertencias: ${checks.warnings.length}`);
console.log(`   Fallidos: ${checks.failed.length}`);

if (checks.warnings.length > 0 && checks.failed.length === 0) {
  console.log('\n💡 Sugerencia: Genera los iconos PNG para completar la configuración:');
  console.log('   npm run generate-icons');
  console.log('   O usa: https://www.pwabuilder.com/imageGenerator');
}

if (checks.failed.length > 0) {
  console.log('\n❌ Hay errores críticos que deben ser corregidos.');
  process.exit(1);
} else if (checks.warnings.length > 0) {
  console.log('\n✅ Configuración básica completa. Considera resolver las advertencias.');
  process.exit(0);
} else {
  console.log('\n🎉 ¡Configuración de PWA perfecta!');
  process.exit(0);
}

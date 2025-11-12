const fs = require('fs');
const path = require('path');

console.log('🔍 Checking PWA Configuration...\n');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

// Check manifest.json
const manifestPath = path.join(__dirname, '../public/manifest.json');
if (fs.existsSync(manifestPath)) {
  checks.passed.push('✅ manifest.json exists');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    if (manifest.name && manifest.short_name) {
      checks.passed.push('✅ Manifest has name and short_name');
    } else {
      checks.failed.push('❌ Manifest missing name or short_name');
    }
    
    if (manifest.icons && manifest.icons.length > 0) {
      checks.passed.push(`✅ Manifest has ${manifest.icons.length} icons`);
    } else {
      checks.failed.push('❌ Manifest has no icons');
    }
    
    if (manifest.start_url) {
      checks.passed.push('✅ Manifest has start_url');
    } else {
      checks.failed.push('❌ Manifest missing start_url');
    }
    
    if (manifest.display) {
      checks.passed.push(`✅ Manifest display mode: ${manifest.display}`);
    } else {
      checks.warnings.push('⚠️  Manifest missing display mode');
    }
  } catch (error) {
    checks.failed.push('❌ Invalid manifest.json format');
  }
} else {
  checks.failed.push('❌ manifest.json not found');
}

// Check service worker
const swPath = path.join(__dirname, '../public/sw.js');
if (fs.existsSync(swPath)) {
  checks.passed.push('✅ Service worker (sw.js) exists');
} else {
  checks.failed.push('❌ Service worker (sw.js) not found');
}

// Check offline page
const offlinePath = path.join(__dirname, '../public/offline.html');
if (fs.existsSync(offlinePath)) {
  checks.passed.push('✅ Offline page exists');
} else {
  checks.warnings.push('⚠️  Offline page not found');
}

// Check required icons
const requiredIcons = [
  'icon-192.png',
  'icon-512.png',
  'apple-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png'
];

requiredIcons.forEach(icon => {
  const iconPath = path.join(__dirname, '../public', icon);
  if (fs.existsSync(iconPath)) {
    const stats = fs.statSync(iconPath);
    if (stats.size > 0) {
      checks.passed.push(`✅ ${icon} exists (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      checks.failed.push(`❌ ${icon} is empty`);
    }
  } else {
    checks.failed.push(`❌ ${icon} not found`);
  }
});

// Check browserconfig.xml
const browserconfigPath = path.join(__dirname, '../public/browserconfig.xml');
if (fs.existsSync(browserconfigPath)) {
  checks.passed.push('✅ browserconfig.xml exists');
} else {
  checks.warnings.push('⚠️  browserconfig.xml not found');
}

// Print results
console.log('📊 Results:\n');

if (checks.passed.length > 0) {
  console.log('✅ Passed Checks:');
  checks.passed.forEach(check => console.log(`   ${check}`));
  console.log('');
}

if (checks.warnings.length > 0) {
  console.log('⚠️  Warnings:');
  checks.warnings.forEach(warning => console.log(`   ${warning}`));
  console.log('');
}

if (checks.failed.length > 0) {
  console.log('❌ Failed Checks:');
  checks.failed.forEach(fail => console.log(`   ${fail}`));
  console.log('');
}

// Summary
const total = checks.passed.length + checks.warnings.length + checks.failed.length;
const score = ((checks.passed.length / total) * 100).toFixed(0);

console.log(`\n📈 PWA Score: ${score}% (${checks.passed.length}/${total} checks passed)\n`);

if (checks.failed.length === 0) {
  console.log('🎉 All critical PWA requirements are met!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some critical PWA requirements are missing. Please fix them.\n');
  process.exit(1);
}

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_ICON = path.join(__dirname, '../public/icon-512.png');
const RESOURCES_DIR = path.join(__dirname, '../resources');

const ANDROID_SIZES = {
  'mipmap-ldpi': 36,
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const IOS_ICON_SIZES = [
  { size: 20, scales: [2, 3], idiom: 'iphone' },
  { size: 29, scales: [2, 3], idiom: 'iphone' },
  { size: 40, scales: [2, 3], idiom: 'iphone' },
  { size: 60, scales: [2, 3], idiom: 'iphone' },
  { size: 20, scales: [1, 2], idiom: 'ipad' },
  { size: 29, scales: [1, 2], idiom: 'ipad' },
  { size: 40, scales: [1, 2], idiom: 'ipad' },
  { size: 76, scales: [1, 2], idiom: 'ipad' },
  { size: 83.5, scales: [2], idiom: 'ipad' },
  { size: 1024, scales: [1], idiom: 'ios-marketing' },
];

const SPLASH_SIZES = {
  android: [
    { width: 320, height: 480, density: 'ldpi' },
    { width: 480, height: 800, density: 'mdpi' },
    { width: 800, height: 1280, density: 'hdpi' },
    { width: 1080, height: 1920, density: 'xhdpi' },
    { width: 1440, height: 2560, density: 'xxhdpi' },
    { width: 1920, height: 2560, density: 'xxxhdpi' },
  ],
  ios: [
    { width: 640, height: 1136, name: 'Default-568h@2x~iphone.png' },
    { width: 750, height: 1334, name: 'Default-667h.png' },
    { width: 1242, height: 2208, name: 'Default-736h.png' },
    { width: 1125, height: 2436, name: 'Default-2436h.png' },
    { width: 828, height: 1792, name: 'Default-1792h.png' },
    { width: 1242, height: 2688, name: 'Default-2688h.png' },
    { width: 1536, height: 2048, name: 'Default-Portrait@2x~ipad.png' },
    { width: 2048, height: 2732, name: 'Default-Portrait@2x~ipad-pro.png' },
  ],
};

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function generateAndroidIcons() {
  console.log('🤖 Generating Android icons...');
  
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const outputDir = path.join(RESOURCES_DIR, 'android', 'icon', folder);
    await ensureDir(outputDir);
    
    const outputPath = path.join(outputDir, 'ic_launcher.png');
    
    await sharp(SOURCE_ICON)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ Generated ${folder}/ic_launcher.png (${size}x${size})`);
  }
  
  const foregroundDir = path.join(RESOURCES_DIR, 'android', 'icon', 'mipmap-xxxhdpi');
  await ensureDir(foregroundDir);
  await sharp(SOURCE_ICON)
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(path.join(foregroundDir, 'ic_launcher_foreground.png'));
  
  console.log('  ✓ Generated adaptive icon foreground');
}

async function generateIOSIcons() {
  console.log('🍎 Generating iOS icons...');
  
  const outputDir = path.join(RESOURCES_DIR, 'ios', 'icon');
  await ensureDir(outputDir);
  
  const contentsJson = {
    images: [],
    info: {
      version: 1,
      author: 'capacitor-assets-generator'
    }
  };
  
  for (const config of IOS_ICON_SIZES) {
    for (const scale of config.scales) {
      const size = config.size * scale;
      const filename = `icon-${config.size}@${scale}x.png`;
      const outputPath = path.join(outputDir, filename);
      
      await sharp(SOURCE_ICON)
        .resize(Math.round(size), Math.round(size), {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      contentsJson.images.push({
        size: `${config.size}x${config.size}`,
        idiom: config.idiom,
        filename: filename,
        scale: `${scale}x`
      });
      
      console.log(`  ✓ Generated ${filename} (${Math.round(size)}x${Math.round(size)})`);
    }
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );
  
  console.log('  ✓ Generated Contents.json');
}

async function generateSplashScreens() {
  console.log('🎨 Generating splash screens...');
  
  const iconBuffer = await sharp(SOURCE_ICON)
    .resize(200, 200, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  for (const config of SPLASH_SIZES.android) {
    const outputDir = path.join(RESOURCES_DIR, 'android', 'splash', `drawable-${config.density}`);
    await ensureDir(outputDir);
    
    const outputPath = path.join(outputDir, 'splash.png');
    
    await sharp({
      create: {
        width: config.width,
        height: config.height,
        channels: 4,
        background: { r: 59, g: 130, b: 246, alpha: 1 }
      }
    })
      .composite([{
        input: iconBuffer,
        gravity: 'center'
      }])
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ Generated Android splash ${config.density} (${config.width}x${config.height})`);
  }
  
  const iosSplashDir = path.join(RESOURCES_DIR, 'ios', 'splash');
  await ensureDir(iosSplashDir);
  
  for (const config of SPLASH_SIZES.ios) {
    const outputPath = path.join(iosSplashDir, config.name);
    
    await sharp({
      create: {
        width: config.width,
        height: config.height,
        channels: 4,
        background: { r: 59, g: 130, b: 246, alpha: 1 }
      }
    })
      .composite([{
        input: iconBuffer,
        gravity: 'center'
      }])
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ Generated iOS splash ${config.name} (${config.width}x${config.height})`);
  }
  
  const contentsJson = {
    images: SPLASH_SIZES.ios.map(config => ({
      idiom: 'universal',
      filename: config.name,
      scale: '1x'
    })),
    info: {
      version: 1,
      author: 'capacitor-assets-generator'
    }
  };
  
  fs.writeFileSync(
    path.join(iosSplashDir, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );
  
  console.log('  ✓ Generated iOS splash Contents.json');
}

async function main() {
  console.log('📱 Capacitor Mobile Assets Generator\n');
  
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`❌ Source icon not found: ${SOURCE_ICON}`);
    console.error('Please ensure public/icon-512.png exists');
    process.exit(1);
  }
  
  try {
    await ensureDir(RESOURCES_DIR);
    
    await generateAndroidIcons();
    console.log('');
    
    await generateIOSIcons();
    console.log('');
    
    await generateSplashScreens();
    console.log('');
    
    console.log('✅ All mobile assets generated successfully!');
    console.log(`📁 Assets location: ${RESOURCES_DIR}`);
    console.log('\nNext steps:');
    console.log('1. Run: npm run cap:add:android');
    console.log('2. Run: npm run cap:add:ios');
    console.log('3. Assets will be automatically copied to native projects');
  } catch (error) {
    console.error('❌ Error generating assets:', error);
    process.exit(1);
  }
}

main();

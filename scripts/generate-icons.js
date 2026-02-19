const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-icon.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 192, name: 'icon-192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-512-maskable.png', maskable: true },
];

const svgPath = path.join(__dirname, '../public/icon.svg');
const outputDir = path.join(__dirname, '../public');

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  for (const { size, name, maskable } of sizes) {
    try {
      const svgBuffer = fs.readFileSync(svgPath);
      
      let pipeline = sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });

      // For maskable icons, add padding (safe zone)
      if (maskable) {
        const safeZoneSize = Math.round(size * 0.8);
        const padding = Math.round((size - safeZoneSize) / 2);
        pipeline = sharp(svgBuffer)
          .resize(safeZoneSize, safeZoneSize, {
            fit: 'contain',
            background: { r: 0, g: 102, b: 204, alpha: 1 } // #0066CC
          })
          .extend({
            top: padding,
            bottom: size - safeZoneSize - padding,
            left: padding,
            right: size - safeZoneSize - padding,
            background: { r: 0, g: 102, b: 204, alpha: 1 }
          });
      }

      await pipeline
        .png()
        .toFile(path.join(outputDir, name));

      console.log(`✅ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error generating ${name}:`, error.message);
    }
  }

  console.log('\n✨ All icons generated successfully!');
}

generateIcons().catch(console.error);

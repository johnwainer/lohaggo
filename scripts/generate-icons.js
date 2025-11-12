const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-icon.png' },
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
        const paddedSize = Math.round(size * 1.2);
        pipeline = sharp(svgBuffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 105, b: 0, alpha: 1 } // #FF6900
          })
          .extend({
            top: Math.round((paddedSize - size) / 2),
            bottom: Math.round((paddedSize - size) / 2),
            left: Math.round((paddedSize - size) / 2),
            right: Math.round((paddedSize - size) / 2),
            background: { r: 255, g: 105, b: 0, alpha: 1 }
          })
          .resize(size, size);
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

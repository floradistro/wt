const sharp = require('sharp');
const path = require('path');

async function createAppIcon() {
  const assetsDir = path.join(__dirname, 'assets');
  const logoPath = path.join(assetsDir, 'logo.png');
  const iconPath = path.join(assetsDir, 'icon.png');
  const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');

  const size = 1024;

  // Since the logo already has a black background with white whale and red eye,
  // we just need to resize it to the proper icon size
  await sharp(logoPath)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    })
    .png()
    .toFile(iconPath);

  // Copy to adaptive icon
  await sharp(iconPath).toFile(adaptiveIconPath);

  console.log('✅ Created app icons with whale logo:');
  console.log(`  - ${iconPath}`);
  console.log(`  - ${adaptiveIconPath}`);
}

createAppIcon().catch(console.error);

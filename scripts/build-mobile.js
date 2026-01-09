const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load .env.mobile file
const envMobilePath = path.join(__dirname, '../.env.mobile');
if (fs.existsSync(envMobilePath)) {
  const envContent = fs.readFileSync(envMobilePath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        process.env[key.trim()] = value.trim();
      }
    }
  });
  console.log('✅ Loaded .env.mobile');
}

const APP_DIR = path.join(__dirname, '../app');
const API_DIR = path.join(APP_DIR, 'api');
const API_BACKUP_DIR = path.join(__dirname, '../.api-backup');
const DYNAMIC_PAGES_BACKUP_DIR = path.join(__dirname, '../.dynamic-pages-backup');
const MAIN_PAGE_PATH = path.join(APP_DIR, 'page.tsx');
const MAIN_PAGE_BACKUP_PATH = path.join(__dirname, '../.main-page-backup.tsx');

const DYNAMIC_PAGES = [
  { src: path.join(APP_DIR, 'ciudad'), backup: 'ciudad' },
  { src: path.join(APP_DIR, 'partner'), backup: 'partner' },
  { src: path.join(APP_DIR, 'servicios', '[slug]'), backup: 'servicios-slug' },
  { src: path.join(APP_DIR, 'admin'), backup: 'admin' },
  { src: path.join(APP_DIR, 'dashboard'), backup: 'dashboard' }
];

function commentForceDynamic() {
  console.log('🔧 Commenting force-dynamic in main page...');
  if (fs.existsSync(MAIN_PAGE_PATH)) {
    const content = fs.readFileSync(MAIN_PAGE_PATH, 'utf8');
    fs.writeFileSync(MAIN_PAGE_BACKUP_PATH, content);

    const modifiedContent = content.replace(
      /export const dynamic = ['"]force-dynamic['"]/g,
      '// export const dynamic = \'force-dynamic\' // Commented for mobile build'
    );

    fs.writeFileSync(MAIN_PAGE_PATH, modifiedContent);
    console.log('  ✓ Commented force-dynamic');
  }
}

function restoreForceDynamic() {
  if (fs.existsSync(MAIN_PAGE_BACKUP_PATH)) {
    console.log('🔧 Restoring force-dynamic in main page...');
    fs.copyFileSync(MAIN_PAGE_BACKUP_PATH, MAIN_PAGE_PATH);
    fs.unlinkSync(MAIN_PAGE_BACKUP_PATH);
    console.log('  ✓ Restored force-dynamic');
  }
}

function createMobileFallbackPages() {
  console.log('📄 Creating mobile fallback pages...');

  const ciudadFallback = path.join(APP_DIR, 'ciudad');
  fs.mkdirSync(ciudadFallback, { recursive: true });
  fs.writeFileSync(
    path.join(ciudadFallback, 'page.tsx'),
    `export default function CiudadPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Coming Soon</h1>
        <p className="text-gray-600">This feature is available on the web version.</p>
      </div>
    </div>
  );
}
`
  );

  console.log('  ✓ Created fallback pages');
}

function removeFallbackPages() {
  console.log('🗑️  Removing fallback pages...');
  const ciudadFallback = path.join(APP_DIR, 'ciudad');

  if (fs.existsSync(ciudadFallback)) {
    fs.rmSync(ciudadFallback, { recursive: true, force: true });
  }
  console.log('  ✓ Removed fallback pages');
}

function moveDynamicPages() {
  console.log('📦 Moving dynamic pages temporarily...');
  if (fs.existsSync(DYNAMIC_PAGES_BACKUP_DIR)) {
    fs.rmSync(DYNAMIC_PAGES_BACKUP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DYNAMIC_PAGES_BACKUP_DIR, { recursive: true });

  DYNAMIC_PAGES.forEach(({ src, backup }) => {
    if (fs.existsSync(src)) {
      const backupPath = path.join(DYNAMIC_PAGES_BACKUP_DIR, backup);
      const backupDir = path.dirname(backupPath);
      fs.mkdirSync(backupDir, { recursive: true });
      fs.renameSync(src, backupPath);
      console.log(`  ✓ Moved ${backup}`);
    }
  });
}

function restoreDynamicPages() {
  if (fs.existsSync(DYNAMIC_PAGES_BACKUP_DIR)) {
    console.log('📦 Restoring dynamic pages...');
    
    DYNAMIC_PAGES.forEach(({ src, backup }) => {
      const backupPath = path.join(DYNAMIC_PAGES_BACKUP_DIR, backup);
      if (fs.existsSync(backupPath)) {
        const srcDir = path.dirname(src);
        fs.mkdirSync(srcDir, { recursive: true });
        
        if (fs.existsSync(src)) {
          fs.rmSync(src, { recursive: true, force: true });
        }
        fs.renameSync(backupPath, src);
        console.log(`  ✓ Restored ${backup}`);
      }
    });
    
    fs.rmSync(DYNAMIC_PAGES_BACKUP_DIR, { recursive: true, force: true });
  }
}

function moveApiRoutes() {
  if (fs.existsSync(API_DIR)) {
    console.log('📦 Moving API routes temporarily...');
    if (fs.existsSync(API_BACKUP_DIR)) {
      fs.rmSync(API_BACKUP_DIR, { recursive: true, force: true });
    }
    fs.renameSync(API_DIR, API_BACKUP_DIR);
    console.log('✅ API routes moved to .api-backup');
  }
}

function restoreApiRoutes() {
  if (fs.existsSync(API_BACKUP_DIR)) {
    console.log('📦 Restoring API routes...');
    if (fs.existsSync(API_DIR)) {
      fs.rmSync(API_DIR, { recursive: true, force: true });
    }
    fs.renameSync(API_BACKUP_DIR, API_DIR);
    console.log('✅ API routes restored');
  }
}

function build() {
  try {
    moveApiRoutes();
    moveDynamicPages();
    createMobileFallbackPages();
    commentForceDynamic();

    console.log('🏗️  Building mobile app...');
    execSync('NEXT_PUBLIC_PLATFORM=mobile next build --webpack', {
      stdio: 'inherit',
      env: { ...process.env, NEXT_PUBLIC_PLATFORM: 'mobile' }
    });

    console.log('✅ Mobile build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  } finally {
    restoreForceDynamic();
    removeFallbackPages();
    restoreApiRoutes();
    restoreDynamicPages();
  }
}

build();

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'app/api/payments/breakdown/route.ts',
  'app/api/payments/status/route.ts',
  'app/api/register/route.ts',
  'app/api/user/profile/route.ts',
  'app/api/partner/services/route.ts',
  'app/api/partner/profile/route.ts',
  'app/api/admin/documents/background/route.ts',
  'app/api/partner/service-requests/route.ts',
  'app/api/admin/partners/list/route.ts',
  'app/api/admin/payments/route.ts',
  'app/api/bookings/route.ts',
  'app/api/bookings/[id]/route.ts',
  'app/api/my-ratings/route.ts',
];

console.log('🔧 Updating remaining API files to use secure logging...\n');

let updatedCount = 0;
let errorCount = 0;

filesToUpdate.forEach((file) => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    errorCount++;
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    if (!content.includes("import { createLogger } from '@/lib/logger'")) {
      const importRegex = /^import .+ from .+$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
        
        content = 
          content.slice(0, lastImportIndex) +
          "\nimport { createLogger } from '@/lib/logger'" +
          content.slice(lastImportIndex);
        
        modified = true;
      }
    }

    if (!content.includes('const logger = createLogger(')) {
      const contextName = file
        .replace('app/api/', '')
        .replace('/route.ts', '')
        .replace(/\[|\]/g, '')
        .replace(/\//g, '-');
      
      const exportRegex = /export (async )?function/;
      const exportMatch = content.match(exportRegex);
      
      if (exportMatch) {
        const exportIndex = content.indexOf(exportMatch[0]);
        content = 
          content.slice(0, exportIndex) +
          `\nconst logger = createLogger('${contextName}')\n\n` +
          content.slice(exportIndex);
        
        modified = true;
      }
    }

    const originalContent = content;
    
    content = content.replace(
      /console\.(error|warn|log)\(['"]([^'"]+)['"],?\s*(error|err)?\)/g,
      (match, level, message, errorVar) => {
        if (errorVar) {
          return `logger.${level === 'log' ? 'info' : level}('${message}', ${errorVar})`;
        }
        return `logger.${level === 'log' ? 'info' : level}('${message}')`;
      }
    );

    if (content !== originalContent) {
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${file}`);
      updatedCount++;
    } else {
      console.log(`⏭️  Skipped (no changes needed): ${file}`);
    }
  } catch (error) {
    console.log(`❌ Error updating ${file}:`, error.message);
    errorCount++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Updated: ${updatedCount} files`);
console.log(`   Errors: ${errorCount} files`);
console.log(`   Total: ${filesToUpdate.length} files\n`);

if (updatedCount > 0) {
  console.log('✨ Logging migration completed!\n');
}

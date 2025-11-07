#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToUpdate = [
  'app/api/chats/route.ts',
  'app/api/categories/route.ts',
  'app/api/proposals/[id]/accept/route.ts',
  'app/api/payouts/process/route.ts',
  'app/api/payment-methods/[id]/route.ts',
  'app/api/payment-methods/route.ts',
  'app/api/payment-methods/[id]/set-default/route.ts',
  'app/api/notifications/route.ts',
  'app/api/services/route.ts',
  'app/api/reviews/route.ts',
  'app/api/payouts/list/route.ts',
  'app/api/proposals/route.ts',
  'app/api/services/[slug]/route.ts',
  'app/api/addresses/route.ts',
  'app/api/addresses/[id]/route.ts',
  'app/api/chats/[chatId]/messages/route.ts',
  'app/api/service-requests/active/route.ts',
  'app/api/notifications/subscribe/route.ts',
  'app/api/admin/analytics/route.ts',
  'app/api/admin/service-requests/route.ts',
  'app/api/partner/achievements/route.ts',
  'app/api/admin/stats/route.ts',
  'app/api/partner/proposals/route.ts',
  'app/api/upload-photos/route.ts',
  'app/api/admin/users/route.ts',
  'app/api/admin/documents/route.ts',
  'app/api/admin/delete-last-payment/route.ts',
  'app/api/admin/partners/route.ts',
  'app/api/service-requests/route.ts',
  'app/api/admin/documents/review/route.ts',
  'app/api/partner/documents/route.ts',
];

console.log('🔧 Updating API files to use secure logging...\n');

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

    // Check if logger is already imported
    if (!content.includes("import { createLogger } from '@/lib/logger'")) {
      // Find the last import statement
      const importRegex = /^import .+ from .+$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
        
        // Insert logger import after last import
        content = 
          content.slice(0, lastImportIndex) +
          "\nimport { createLogger } from '@/lib/logger'" +
          content.slice(lastImportIndex);
        
        modified = true;
      }
    }

    // Check if logger is already created
    if (!content.includes('const logger = createLogger(')) {
      // Extract context name from file path
      const contextName = file
        .replace('app/api/', '')
        .replace('/route.ts', '')
        .replace(/\[|\]/g, '')
        .replace(/\//g, '-');
      
      // Find position after imports
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

    // Replace console.error with logger.error
    const consoleErrorRegex = /console\.error\(['"]([^'"]+)['"],?\s*(error|err)?\)/g;
    if (consoleErrorRegex.test(content)) {
      content = content.replace(
        /console\.error\(['"]([^'"]+)['"],?\s*(error|err)?\)/g,
        "logger.error('$1', $2 || undefined)"
      );
      modified = true;
    }

    // Replace standalone console.error
    const standaloneErrorRegex = /console\.error\(([^)]+)\)/g;
    if (standaloneErrorRegex.test(content)) {
      content = content.replace(
        /console\.error\(([^)]+)\)/g,
        (match, p1) => {
          if (p1.includes('error') || p1.includes('err')) {
            return `logger.error('Error occurred', ${p1})`;
          }
          return `logger.error(${p1})`;
        }
      );
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

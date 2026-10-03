import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');

test('DS-07: BidiText and bidirectional text helpers exist and are exported', async () => {
  const file = resolve(packageRoot, 'src/components/patterns/bidi-text.tsx');
  assert.equal(existsSync(file), true, 'bidi-text.tsx missing');

  const content = readFileSync(file, 'utf8');
  assert(content.includes('unicode-bidi:isolate'), 'BidiText must enforce unicode-bidi:isolate');
  assert(content.includes('LatinIdentifier'), 'LatinIdentifier helper must be defined');
  assert(content.includes('PhoneNumberDisplay'), 'PhoneNumberDisplay helper must be defined');

  const indexContent = readFileSync(resolve(packageRoot, 'src/components/patterns/index.ts'), 'utf8');
  assert(indexContent.includes("export * from './bidi-text.js'"), 'bidi-text must be exported from patterns');
});

test('DS-07: Component library uses logical directional CSS properties', () => {
  const componentDirs = [
    resolve(packageRoot, 'src/components/ui'),
    resolve(packageRoot, 'src/components/patterns'),
    resolve(packageRoot, 'src/components/shell'),
  ];

  let scannedFiles = 0;
  for (const dir of componentDirs) {
    const files = readdirSync(dir).filter(f => f.endsWith('.tsx'));
    for (const file of files) {
      scannedFiles++;
      const fullPath = resolve(dir, file);
      const content = readFileSync(fullPath, 'utf8');

      // Verify that directional margin/padding uses logical tokens where applicable
      // Ensure no raw non-logical 'ml-' or 'mr-' or 'pl-' or 'pr-' in standard class names
      // (Unless accompanied by explicit ltr/rtl overrides)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('//') && !line.includes('className')) continue;
        
        // Assert we don't use raw physical margins like tw:ml- or ml- without logical
        const physicalMarginMatches = line.match(/\b(tw:)?(ml|mr|pl|pr)-[0-9]/g);
        if (physicalMarginMatches) {
          // If physical margins are present, check if they are intentional or should be logical
          assert.fail(`File ${file}:${i + 1} uses non-logical physical utility: ${physicalMarginMatches.join(', ')}. Use ms-/me-/ps-/pe- instead.`);
        }
      }
    }
  }

  assert(scannedFiles >= 35, `Scanned ${scannedFiles} files for logical CSS properties`);
});

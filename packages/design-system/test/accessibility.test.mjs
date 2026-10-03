import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');

test('DS-09: LiveRegion and screen reader announcement helpers exist and are exported', async () => {
  const file = resolve(packageRoot, 'src/components/patterns/live-region.tsx');
  assert.equal(existsSync(file), true, 'live-region.tsx missing');

  const content = readFileSync(file, 'utf8');
  assert(content.includes('aria-live'), 'LiveRegion must have aria-live');
  assert(content.includes('aria-atomic'), 'LiveRegion must have aria-atomic');
  assert(content.includes('AnnounceStatus'), 'AnnounceStatus must be exported');

  const indexContent = readFileSync(resolve(packageRoot, 'src/components/patterns/index.ts'), 'utf8');
  assert(indexContent.includes("export * from './live-region.js'"), 'live-region must be exported');
});

test('DS-09: Primitives and interactive elements have visible focus indicators and ARIA roles', () => {
  // Button focus visible ring
  const button = readFileSync(resolve(packageRoot, 'src/components/ui/button.tsx'), 'utf8');
  assert(button.includes('focus-visible:ring-2'), 'Button must have focus-visible:ring-2');

  // Input focus visible ring
  const input = readFileSync(resolve(packageRoot, 'src/components/ui/input.tsx'), 'utf8');
  assert(input.includes('focus-visible:ring-2'), 'Input must have focus-visible:ring-2');

  // Dialog accessible title & description
  const dialog = readFileSync(resolve(packageRoot, 'src/components/ui/dialog.tsx'), 'utf8');
  assert(dialog.includes('DialogTitle'), 'Dialog must have DialogTitle');
  assert(dialog.includes('DialogDescription'), 'Dialog must have DialogDescription');

  // Alert and ErrorState alert role
  const alert = readFileSync(resolve(packageRoot, 'src/components/ui/alert.tsx'), 'utf8');
  assert(alert.includes('role="alert"'), 'Alert must have role="alert"');

  const errorState = readFileSync(resolve(packageRoot, 'src/components/patterns/error-state.tsx'), 'utf8');
  assert(errorState.includes('role="alert"'), 'ErrorState must have role="alert"');
});

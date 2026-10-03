import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');

test('DS-08: Responsive system handles small viewports and table regions', () => {
  // Check PageContainer max width and responsive padding
  const pageContainer = readFileSync(resolve(packageRoot, 'src/components/shell/page-container.tsx'), 'utf8');
  assert(pageContainer.includes('sm:p-6'), 'PageContainer must support sm: breakpoint padding');
  assert(pageContainer.includes('lg:p-8'), 'PageContainer must support lg: breakpoint padding');

  // Check AppShell responsive layout and mobile drawer trigger
  const appShell = readFileSync(resolve(packageRoot, 'src/components/shell/app-shell.tsx'), 'utf8');
  assert(appShell.includes('md:flex'), 'AppShell desktop sidebar must hide on mobile (md:flex)');
  assert(appShell.includes('md:hidden'), 'AppShell hamburger trigger must only show on mobile (md:hidden)');
  assert(appShell.includes('Sheet'), 'AppShell must use Sheet for mobile drawer');

  // Check DataTable scroll region isolation
  const dataTable = readFileSync(resolve(packageRoot, 'src/components/patterns/data-table.tsx'), 'utf8');
  assert(dataTable.includes('overflow-x-auto'), 'DataTable must have overflow-x-auto container');
  assert(dataTable.includes('role="region"'), 'DataTable scroll container must be role="region"');
  assert(dataTable.includes('tabIndex={0}'), 'DataTable scroll container must be keyboard focusable');
});

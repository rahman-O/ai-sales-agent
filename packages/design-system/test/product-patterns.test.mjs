import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');

test('DS-05: all product patterns exist and are exported', async () => {
  const expectedPatterns = [
    'page-header',
    'section-header',
    'stat-card',
    'metric',
    'status-badge',
    'empty-state',
    'error-state',
    'permission-denied-state',
    'settings-section',
    'data-list',
    'audit-event-row',
    'search-field',
    'filter-bar',
    'data-table',
  ];

  for (const pattern of expectedPatterns) {
    const file = resolve(packageRoot, `src/components/patterns/${pattern}.tsx`);
    assert.equal(existsSync(file), true, `Pattern file missing: ${pattern}.tsx`);
  }

  const indexContent = readFileSync(resolve(packageRoot, 'src/components/patterns/index.ts'), 'utf8');
  for (const pattern of expectedPatterns) {
    assert.match(
      indexContent,
      new RegExp(`export \\* from '\\./${pattern}\\.js'`),
      `Missing export for ${pattern} in components/patterns/index.ts`,
    );
  }
});

test('DS-05: product patterns are domain-neutral and consume semantic tokens', () => {
  const statusBadge = readFileSync(resolve(packageRoot, 'src/components/patterns/status-badge.tsx'), 'utf8');
  // Check semantic category normalization (no hardcoded business enums)
  assert(statusBadge.includes('StatusCategory'), 'Must define StatusCategory type');
  assert(statusBadge.includes('success'), 'Must support success category');
  assert(statusBadge.includes('warning'), 'Must support warning category');
  assert(statusBadge.includes('danger'), 'Must support danger category');
  assert(statusBadge.includes('info'), 'Must support info category');
  assert(statusBadge.includes('neutral'), 'Must support neutral category');
  assert(statusBadge.includes('pending'), 'Must support pending category');
  assert(statusBadge.includes('paused'), 'Must support paused category');

  // Verify ErrorState role alert and retry
  const errorState = readFileSync(resolve(packageRoot, 'src/components/patterns/error-state.tsx'), 'utf8');
  assert(errorState.includes('role="alert"'), 'ErrorState must have role="alert"');

  // Verify EmptyState structure
  const emptyState = readFileSync(resolve(packageRoot, 'src/components/patterns/empty-state.tsx'), 'utf8');
  assert(emptyState.includes('data-slot="empty-state"'), 'EmptyState must have data-slot="empty-state"');

  // Verify DataTable generic structure
  const dataTable = readFileSync(resolve(packageRoot, 'src/components/patterns/data-table.tsx'), 'utf8');
  assert(dataTable.includes('ColumnDef<T>'), 'DataTable must be generically typed with ColumnDef<T>');
  assert(dataTable.includes('scope="col"'), 'DataTable header must have scope="col"');
});

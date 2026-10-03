import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');

test('DS-04: all Wave A-G component primitives exist and are exported', async () => {
  const expectedPrimitives = [
    // Wave A: Foundation Inputs
    'button',
    'input',
    'textarea',
    'label',
    'checkbox',
    'radio-group',
    'switch',
    // Wave B: Selection
    'select',
    'combobox',
    'command',
    // Wave C: Surfaces
    'card',
    'separator',
    'badge',
    'avatar',
    // Wave D: Overlays
    'dialog',
    'alert-dialog',
    'sheet',
    'popover',
    'tooltip',
    'dropdown-menu',
    // Wave E: Navigation
    'tabs',
    'breadcrumb',
    'pagination',
    // Wave F: Feedback
    'skeleton',
    'spinner',
    'progress',
    'alert',
    'toast',
    // Wave G: Date / Time
    'calendar',
    'date-picker',
  ];

  for (const primitive of expectedPrimitives) {
    const file = resolve(packageRoot, `src/components/ui/${primitive}.tsx`);
    assert.equal(existsSync(file), true, `Primitive file missing: ${primitive}.tsx`);
  }

  const indexContent = readFileSync(resolve(packageRoot, 'src/components/ui/index.ts'), 'utf8');
  for (const primitive of expectedPrimitives) {
    assert.match(
      indexContent,
      new RegExp(`export \\* from '\\./${primitive}\\.js'`),
      `Missing export for ${primitive} in components/ui/index.ts`,
    );
  }
});

test('DS-04: primitive components follow accessibility and token rules', () => {
  // Verify button uses aria-busy/disabled and spinner
  const buttonSource = readFileSync(resolve(packageRoot, 'src/components/ui/button.tsx'), 'utf8');
  assert(buttonSource.includes('aria-busy'), 'Button must support aria-busy');
  assert(buttonSource.includes('aria-disabled'), 'Button must support aria-disabled');
  assert(buttonSource.includes('buttonVariants'), 'Button must export buttonVariants');

  // Verify input uses aria-invalid
  const inputSource = readFileSync(resolve(packageRoot, 'src/components/ui/input.tsx'), 'utf8');
  assert(inputSource.includes('aria-invalid'), 'Input must support aria-invalid');

  // Verify dialog has role dialog / aria-modal
  const dialogSource = readFileSync(resolve(packageRoot, 'src/components/ui/dialog.tsx'), 'utf8');
  assert(dialogSource.includes('role="dialog"'), 'Dialog must have role="dialog"');
  assert(dialogSource.includes('aria-modal="true"'), 'Dialog must have aria-modal="true"');

  // Verify sheet supports logical sides (start, end)
  const sheetSource = readFileSync(resolve(packageRoot, 'src/components/ui/sheet.tsx'), 'utf8');
  assert(sheetSource.includes('start:'), 'Sheet must support logical start side');
  assert(sheetSource.includes('end:'), 'Sheet must support logical end side');

  // Verify alert uses semantic role and variants
  const alertSource = readFileSync(resolve(packageRoot, 'src/components/ui/alert.tsx'), 'utf8');
  assert(alertSource.includes('role="alert"'), 'Alert must have role="alert"');

  // Verify progress has accessible range attributes
  const progressSource = readFileSync(resolve(packageRoot, 'src/components/ui/progress.tsx'), 'utf8');
  assert(progressSource.includes('role="progressbar"'), 'Progress must have role="progressbar"');
  assert(progressSource.includes('aria-valuenow'), 'Progress must have aria-valuenow');

  // Verify pagination has navigation role and rotated RTL arrows
  const paginationSource = readFileSync(resolve(packageRoot, 'src/components/ui/pagination.tsx'), 'utf8');
  assert(paginationSource.includes('role="navigation"'), 'Pagination must have role="navigation"');
  assert(paginationSource.includes('rtl:tw:rotate-180'), 'Pagination arrows must mirror under RTL');
});

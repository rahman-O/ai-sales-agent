import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');
const evidenceDir = resolve(root, 'docs/ui-product-roadmap/01-design-system/evidence/ds10');

test('DS-10: Quality Gate - Component inventory and token inventory artifacts exist and match implementation', () => {
  const componentInventoryPath = resolve(evidenceDir, 'component-inventory.json');
  const tokenInventoryPath = resolve(evidenceDir, 'token-inventory.json');

  assert(existsSync(componentInventoryPath), 'component-inventory.json must exist in evidence/ds10');
  assert(existsSync(tokenInventoryPath), 'token-inventory.json must exist in evidence/ds10');

  const componentInventory = JSON.parse(readFileSync(componentInventoryPath, 'utf8'));
  const tokenInventory = JSON.parse(readFileSync(tokenInventoryPath, 'utf8'));

  assert.equal(componentInventory.summary.totalPrimitives, 30, 'Must record 30 verified primitives');
  assert.equal(tokenInventory.status, 'APPROVED', 'Token inventory must be approved');

  // Verify all files referenced in component inventory actually exist on disk
  for (const wave of Object.values(componentInventory.primitives)) {
    for (const comp of wave) {
      const p = resolve(packageRoot, comp.file);
      assert(existsSync(p), `Inventory component missing on disk: ${comp.file}`);
    }
  }

  for (const pattern of componentInventory.patterns) {
    const p = resolve(packageRoot, pattern.file);
    assert(existsSync(p), `Inventory pattern missing on disk: ${pattern.file}`);
  }

  for (const shell of componentInventory.shell) {
    const p = resolve(packageRoot, shell.file);
    assert(existsSync(p), `Inventory shell component missing on disk: ${shell.file}`);
  }
});

test('DS-10: Quality Gate - Package exports match all entrypoints', () => {
  const pkgJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  
  assert(pkgJson.exports['.'], 'Must export root');
  assert(pkgJson.exports['./styles.css'], 'Must export ./styles.css');
  assert(pkgJson.exports['./utils'], 'Must export ./utils');
  assert(pkgJson.exports['./components/ui'], 'Must export ./components/ui');
  assert(pkgJson.exports['./components/patterns'], 'Must export ./components/patterns');
  assert(pkgJson.exports['./components/shell'], 'Must export ./components/shell');
});

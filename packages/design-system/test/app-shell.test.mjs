import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');

test('DS-06: all shell primitives exist and are exported', async () => {
  const expectedShellPrimitives = [
    'skip-to-content',
    'sidebar',
    'topbar',
    'page-container',
    'org-switcher',
    'account-menu',
    'app-shell',
  ];

  for (const primitive of expectedShellPrimitives) {
    const file = resolve(packageRoot, `src/components/shell/${primitive}.tsx`);
    assert.equal(existsSync(file), true, `Shell primitive file missing: ${primitive}.tsx`);
  }

  const indexContent = readFileSync(resolve(packageRoot, 'src/components/shell/index.ts'), 'utf8');
  for (const primitive of expectedShellPrimitives) {
    assert.match(
      indexContent,
      new RegExp(`export \\* from '\\./${primitive}\\.js'`),
      `Missing export for ${primitive} in components/shell/index.ts`,
    );
  }
});

test('DS-06: shell primitives fulfill accessibility and RTL landmark requirements', () => {
  // Skip to content must target #main-content and have sr-only focusable pattern
  const skipToContent = readFileSync(resolve(packageRoot, 'src/components/shell/skip-to-content.tsx'), 'utf8');
  assert(skipToContent.includes('sr-only'), 'SkipToContent must have sr-only class');
  assert(skipToContent.includes('focus:not-sr-only'), 'SkipToContent must become visible on focus');
  assert(skipToContent.includes('main-content'), 'SkipToContent must default target main-content');

  // Sidebar must have accessible landmarks and logical directions
  const sidebar = readFileSync(resolve(packageRoot, 'src/components/shell/sidebar.tsx'), 'utf8');
  assert(sidebar.includes('<aside'), 'Sidebar must be an aside landmark');
  assert(sidebar.includes('<nav'), 'SidebarContent must be a nav landmark');
  assert(sidebar.includes('aria-current'), 'SidebarItem must support aria-current');
  assert(sidebar.includes('border-e'), 'Sidebar must use logical border-e');

  // Topbar must be a header landmark
  const topbar = readFileSync(resolve(packageRoot, 'src/components/shell/topbar.tsx'), 'utf8');
  assert(topbar.includes('<header'), 'Topbar must be a header landmark');

  // AppShell must contain main landmark and skip link
  const appShell = readFileSync(resolve(packageRoot, 'src/components/shell/app-shell.tsx'), 'utf8');
  assert(appShell.includes('<main'), 'AppShell must have main landmark');
  assert(appShell.includes('id="main-content"'), 'AppShell main landmark must have id="main-content"');
  assert(appShell.includes('SkipToContent'), 'AppShell must render SkipToContent');

  // OrgSwitcher must have combobox role
  const orgSwitcher = readFileSync(resolve(packageRoot, 'src/components/shell/org-switcher.tsx'), 'utf8');
  assert(orgSwitcher.includes('role="combobox"'), 'OrgSwitcher must have combobox role');
  assert(orgSwitcher.includes('DropdownMenuTrigger'), 'OrgSwitcher must render DropdownMenuTrigger');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = resolve(root, 'packages/design-system');
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(tsx?|css)$/.test(path) ? [path] : [];
  });
}
function imports(path) {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('.css')) return [...text.matchAll(/@(?:import|source)\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  const result = [];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) result.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) result.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
function target(path, specifier) {
  if (specifier.startsWith('.')) return resolve(dirname(path), specifier);
  if (specifier.startsWith('@/')) return resolve(root, 'apps/web/src', specifier.slice(2));
  return specifier;
}
function violations(dir, forbidden, packageOnly = false) {
  return files(resolve(root, dir)).flatMap(path => imports(path).flatMap(specifier => {
    const destination = target(path, specifier);
    const crosses = forbidden.some(prefix => destination.startsWith(resolve(root, prefix)) || destination.startsWith(prefix));
    const escapes = packageOnly && specifier.startsWith('.') && relative(packageRoot, destination).startsWith('..');
    return crosses || escapes ? [`${relative(root, path)} → ${specifier}`] : [];
  }));
}
test('Design System cannot import application, server or database implementation', () => {
  assert.deepEqual(violations('packages/design-system/src', ['apps/', '@ai-sales-agent/', '@prisma/', 'next', 'pg'], true), []);
  const manifest = json('packages/design-system/package.json');
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['class-variance-authority', 'clsx', 'lucide-react', 'tailwind-merge', 'tailwindcss']);
  assert.equal(manifest.peerDependencies.react, '^19.1.1');
});
test('Client cannot import Admin through aliases or relative paths', () => assert.deepEqual(violations('apps/web/src/client', ['apps/web/src/admin']), []));
test('Admin cannot import Client through aliases or relative paths', () => assert.deepEqual(violations('apps/web/src/admin', ['apps/web/src/client']), []));
test('boundary detector catches relative, alias and package violations', () => {
  assert.equal(target(resolve(root, 'apps/web/src/client/demo.ts'), '../admin/demo').startsWith(resolve(root, 'apps/web/src/admin')), true);
  assert.equal(target(resolve(root, 'apps/web/src/client/demo.ts'), '@/admin/demo').startsWith(resolve(root, 'apps/web/src/admin')), true);
});
test('generator and public exports resolve the authoritative primitive and utility owners', () => {
  const manifest = json('packages/design-system/package.json');
  const config = json('packages/design-system/components.json');
  const web = json('apps/web/components.json');
  assert.equal(config.aliases.ui, '#components/ui');
  assert.equal(config.aliases.utils, '#lib/utils');
  assert.equal(manifest.imports['#components/ui/*'].types, './src/components/ui/*.tsx');
  assert.equal(manifest.imports['#lib/*'].types, './src/lib/*.ts');
  assert.equal(web.aliases.ui, '@ai-sales-agent/design-system/components/ui');
  assert.equal(web.aliases.utils, '@ai-sales-agent/design-system/utils');
  assert.equal(manifest.exports['./components/ui/button'].import, './dist/components/ui/button.js');
  assert.equal(manifest.exports['./utils'].types, './src/lib/utils.ts');
  assert.equal(manifest.exports['./components/ui'].types, './src/components/ui/index.ts');
  assert.equal(manifest.exports['./utils'].import, './dist/lib/utils.js');
  assert.equal(manifest.exports['./styles.css'], './src/styles/index.css');
});

test('foundation token and source boundaries remain controlled without global Preflight', () => {
  const tokens = readFileSync(resolve(packageRoot, 'src/styles/tokens.css'), 'utf8');
  const tailwind = readFileSync(resolve(packageRoot, 'src/styles/tailwind.css'), 'utf8');
  const entry = readFileSync(resolve(packageRoot, 'src/styles/index.css'), 'utf8');
  for (const name of ['background','foreground','card','card-foreground','popover','popover-foreground','primary','primary-foreground','secondary','secondary-foreground','muted','muted-foreground','accent','accent-foreground','destructive','destructive-foreground','border','input','ring','sidebar','sidebar-foreground','sidebar-primary','sidebar-primary-foreground','sidebar-accent','sidebar-accent-foreground','sidebar-border','sidebar-ring','success','warning','info','danger']) assert(tokens.includes('--'+name+':'), 'missing '+name);
  assert(tokens.includes('prefers-reduced-motion: reduce'));
  assert.match(tailwind, /prefix\(tw\).*source\(none\)/);
  assert.deepEqual(imports(resolve(packageRoot, 'src/styles/tailwind.css')), ['tailwindcss/theme.css','tailwindcss/utilities.css','../components']);
  assert(!entry.includes('preflight'));
  assert(!tailwind.includes("@import 'tailwindcss';"));
});
test('React is peer-owned and development versions match the web consumer', () => {
  const manifest = json('packages/design-system/package.json');
  const web = json('apps/web/package.json');
  assert.equal(manifest.dependencies.react, undefined);
  assert.equal(manifest.devDependencies.react, web.dependencies.react);
  assert.equal(manifest.devDependencies['@types/react'], web.devDependencies['@types/react']);
});

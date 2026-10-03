import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8');
const tokens = read('tokens.css');
const typography = read('typography.css');
function value(name) { return tokens.match(new RegExp(`--ds-${name}:\\s*([^;]+);`))?.[1]; }
test('typography offers a compact rem scale with readable body/helper sizes and restrained weights', () => {
  const sizes=[...tokens.matchAll(/--ds-text-[\w]+:\s*([\d.]+)rem;/g)].map(m=>+m[1]);
  assert(sizes.length>=5 && sizes.length<=8);
  assert(sizes.every((n,i)=>!i||n>sizes[i-1]));
  assert.equal(value('text-base'),'1rem');
  assert(parseFloat(value('text-sm'))>=0.875);
  const weights=[...tokens.matchAll(/--ds-weight-\w+:\s*(\d+);/g)].map(m=>+m[1]);
  assert(weights.length<=3 && weights.every(n=>n>=400&&n<=600));
  assert(parseFloat(value('leading-body'))>=1.5);
  assert(parseFloat(value('leading-long'))>=parseFloat(value('leading-body')));
});
test('typography is opt-in, logical and has a single canonical spacing basis', () => {
  const rules=[...typography.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for(const [,selector] of rules) {
    let depth=0,start=0;const topLevel=[];
    for(let i=0;i<selector.length;i++){if(selector[i]==='(')depth++;if(selector[i]===')')depth--;if(selector[i]===','&&depth===0){topLevel.push(selector.slice(start,i));start=i+1;}}
    topLevel.push(selector.slice(start));
    assert(topLevel.every(s=>s.trim().startsWith("[data-ui='ds']")),selector);
  }
  assert(!/(?:margin|padding)-(?:left|right)\s*:|(?:^|[;{])\s*(?:left|right)\s*:/m.test(typography));
  assert.equal(value('space-unit'),'0.25rem');
  assert.match(read('tailwind.css'),/--spacing:\s*var\(--ds-space-unit\)/);
  assert(typography.includes('padding-inline: var(--ds-page-gutter)'));
  assert(typography.includes('font-variant-numeric: tabular-nums'));
  assert(typography.includes('letter-spacing: normal'));
});
test('font loading stays app-owned while semantic typography and spacing share the public CSS entry', () => {
  assert(!/next\/font|url\(|@font-face/.test(typography+tokens));
  assert.match(tokens,/--ds-font-arabic:\s*var\(--app-font-arabic/);
  assert(read('index.css').includes("@import './typography.css'"));
  assert(!tokens.match(/--ds-space-unit:/g)||tokens.match(/--ds-space-unit:/g).length===1);
});

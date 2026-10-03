// Run with an existing Playwright installation via PLAYWRIGHT_MODULE; no browser dependency added to the product.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DS_BASE_URL || 'http://127.0.0.1:3102';
const evidence = resolve(process.env.DS_EVIDENCE_DIR || 'docs/ui-product-roadmap/01-design-system/evidence/ds02');
const baselineEvidence = resolve(process.env.DS_BASELINE_DIR || evidence);
const baseline = process.argv.includes('--baseline');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' });
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (url.pathname.startsWith('/api/backend/')) return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'unauthenticated'})});
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('401 (Unauthorized)')) errors.push(m.text()); });
const results = {};
for (const name of ['login','dashboard','policies','orders','test-assistant']) {
  await page.goto(`${base}/${name}`); await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => [...document.querySelectorAll('body,main,h1,h2,input,button,table,header')].map(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return {tag:el.tagName,text:(()=>{const c=el.cloneNode(true);c.querySelectorAll('script,style').forEach(n=>n.remove());return c.textContent?.slice(0,100)})(),x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,font:s.fontFamily,size:s.fontSize,margin:s.margin,padding:s.padding,border:s.border,display:s.display};
  }));
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  if (baseline) {
    await writeFile(`${evidence}/legacy-${name}-before.png`,png);
    await writeFile(`${evidence}/legacy-${name}-before.json`,JSON.stringify(metrics,null,2));
  } else {
    assert.deepEqual(metrics,JSON.parse(await readFile(`${baselineEvidence}/legacy-${name}-before.json`,'utf8')),`${name} computed styles/layout changed`);
    assert(png.equals(await readFile(`${baselineEvidence}/legacy-${name}-before.png`)),`${name} screenshot changed`);
    results[name]='pixel-identical';
  }
}
if (!baseline) {
  await page.goto(`${base}/internal/design-system`); await page.waitForSelector('[data-foundation-ready="true"]');
  const surface=page.locator('[data-ui="ds"]');
  for (const theme of ['light','dark']) for (const dir of ['ltr','rtl']) {
    await page.getByLabel('Theme / المظهر').selectOption(theme);
    await page.getByLabel('Direction / الاتجاه').selectOption(dir);
    await page.waitForFunction(t => document.documentElement.getAttribute('data-theme')===t,theme);
    await page.waitForTimeout(100);
    assert.equal(await surface.getAttribute('dir'),dir);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    const bg=await surface.evaluate(e=>getComputedStyle(e).backgroundColor); assert.match(bg,/oklch/);
    const languages = await surface.evaluate(e => ({arabic:/[\u0600-\u06ff]/.test(e.textContent),english:/[A-Za-z]/.test(e.textContent),language:e.lang,overflow:e.scrollWidth>e.clientWidth}));
    assert(languages.arabic && languages.english, 'bilingual fixture text missing');
    assert.equal(languages.language, dir === 'rtl' ? 'ar' : 'en');
    assert.equal(languages.overflow, false, 'foundation text/controls overflow');
    const contrast = await surface.evaluate(e => {
      const s=getComputedStyle(e), canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      function luminance(token) {
        ctx.fillStyle=s.getPropertyValue('--'+token).trim();ctx.fillRect(0,0,1,1);
        const c=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});
        return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
      }
      const pairs=['background','card','popover','primary','secondary','muted','destructive','accent','sidebar','sidebar-primary','sidebar-accent'].map(b=>[b,b==='muted'?'muted-foreground':b==='background'?'foreground':b+'-foreground']);
      for (const state of ['success','warning','danger','info']) pairs.push([state+'-background',state]);
      pairs.push(['background','ring'],['card','ring'],['card','input']);
      return pairs.map(([b,f])=>{const x=luminance(b),y=luminance(f);return {background:b,foreground:f,ratio:(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05),minimum:['ring','input'].includes(f)?3:4.5};});
    });
    for(const pair of contrast) assert(pair.ratio>=pair.minimum, `${theme} ${pair.background}/${pair.foreground}: ${pair.ratio}`);
    await writeFile(`${evidence}/contrast-${theme}.json`,JSON.stringify(contrast,null,2));
    await page.locator('button[data-slot="button"]').first().focus();
    assert.equal(await page.locator('button[data-slot="button"]').first().evaluate(e=>getComputedStyle(e).outlineWidth),'2px');
    await page.keyboard.press('Tab');
    assert(await page.locator('button[data-slot="button"]').nth(1).evaluate(e=>e===document.activeElement),'native button tab order');
    await page.keyboard.press('Shift+Tab');
    assert(await page.locator('button[data-slot="button"]').first().evaluate(e=>e===document.activeElement),'native button reverse tab order');
    await page.screenshot({path:`${evidence}/foundation-${theme}-${dir}-desktop.png`,fullPage:true});
  }
  console.log('CHECK: reduced motion');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.match((await surface.evaluate(e=>getComputedStyle(e).getPropertyValue('--motion-fast'))).trim(),/^0(?:ms|s)$/);
  assert.match((await surface.evaluate(e=>getComputedStyle(e).getPropertyValue('--motion-standard'))).trim(),/^0(?:ms|s)$/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  console.log('CHECK: system preference');
  await page.getByLabel('Theme / المظهر').selectOption('system');
  for (const colorScheme of ['light','dark']) { await page.emulateMedia({colorScheme}); await page.waitForFunction(t=>document.documentElement.getAttribute('data-theme')===t,colorScheme); }
  console.log('CHECK: reload persistence');
  await page.reload(); await page.waitForSelector('[data-foundation-ready="true"]');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  console.log('CHECK: dark-to-legacy navigation');
  // A fresh context keeps the OS rendering profile identical to the pre-change baseline.
  // Chromium changes native datetime shadow fonts after media emulation, even without DS CSS.
  const darkLegacy = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'light',storageState:{cookies:[],origins:[{origin:base,localStorage:[{name:'ai-sales-ui-theme',value:'dark'}]}]}});
  await darkLegacy.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin!==new URL(base).origin)return r.abort();
    if(u.pathname.startsWith('/api/backend/'))return r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'unauthenticated'})});
    return r.continue();
  });
  const legacyPage=await darkLegacy.newPage();
  for (const name of Object.keys(results)) {
    await legacyPage.goto(`${base}/${name}`);await legacyPage.waitForTimeout(500);
    assert.equal(await legacyPage.locator('html').getAttribute('data-theme'),'dark');
    const afterDark=await legacyPage.screenshot({fullPage:true,animations:'disabled'});
    assert(afterDark.equals(await readFile(`${baselineEvidence}/legacy-${name}-before.png`)),`${name} changed with saved dark theme`);
  }
  await darkLegacy.close();
  await page.goto(`${base}/internal/design-system`);await page.waitForSelector('[data-foundation-ready="true"]');
  console.log('CHECK: mobile');
  await page.getByLabel('Direction / الاتجاه').selectOption('rtl');
  await page.setViewportSize({width:375,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile overflow');
  await page.screenshot({path:`${evidence}/foundation-dark-rtl-mobile.png`,fullPage:true});
  assert.deepEqual(errors,[],`browser errors: ${errors.join('; ')}`);
  await writeFile(`${evidence}/browser-results.json`,JSON.stringify({legacy:results,light:'PASS',dark:'PASS',system:'PASS',rtl:'PASS',ltr:'PASS',hydrationErrors:errors,network:'external blocked; backend fixture 401; no live agent calls'},null,2));
}
if (!baseline && process.env.DS_TYPOGRAPHY_CHECK === 'true') {
  const { verifyTypography } = await import('./typography-browser.mjs');
  await verifyTypography({browser,base,evidence});
}
await browser.close();console.log(baseline?'BASELINE_CAPTURED':'FOUNDATION_AND_LEGACY_REGRESSION: PASS');

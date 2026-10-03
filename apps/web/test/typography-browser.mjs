import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
async function prepare(context, base, blockFonts = false) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin || (blockFonts && /\.woff2?(?:\?|$)/.test(url.pathname))) return route.abort();
    if (url.pathname.startsWith('/api/backend/')) return route.fulfill({status:401,contentType:'application/json',body:'{"error":"unauthenticated"}'});
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(`${base}/internal/design-system`);
  await page.waitForSelector('[data-foundation-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function measurements(page) {
  return page.evaluate(() => {
    const root=document.querySelector('[data-ui="ds"]'),style=getComputedStyle(root);
    const get=(selector)=>{const e=root.querySelector(selector),s=getComputedStyle(e);return {font:s.fontFamily,size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),weight:+s.fontWeight,gap:parseFloat(s.gap),padding:parseFloat(s.paddingInlineStart),height:e.getBoundingClientRect().height,tracking:s.letterSpacing,numeric:s.fontVariantNumeric};};
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const arabic=[...root.querySelectorAll('[data-arabic-sample]')].map(e=>{const s=getComputedStyle(e);ctx.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;const m=ctx.measureText(e.textContent);return {text:e.textContent,size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),ink:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,tracking:s.letterSpacing,font:s.fontFamily,overflow:e.scrollWidth>e.clientWidth&&getComputedStyle(e).display!=='inline'};});
    return {width:innerWidth,pageWidth:root.getBoundingClientRect().width,maxWidth:parseFloat(style.maxInlineSize),icon:get('.ds-icon-control'),gutter:parseFloat(style.paddingInlineStart),gutterEnd:parseFloat(style.paddingInlineEnd),overflow:document.documentElement.scrollWidth>innerWidth,fontFamily:style.getPropertyValue('--app-font-arabic').trim(),faces:[...document.fonts].map(f=>({family:f.family,status:f.status})),body:get('.ds-text-body'),helper:get('.ds-text-helper'),caption:get('.ds-text-caption'),title:get('[data-typography-fixture] .ds-text-page-title'),metric:get('.ds-text-metric-lg'),standard:get('[data-density="standard"]'),compact:get('[data-density="compact"]'),standardForm:get('[data-form-density="standard"]'),compactForm:get('[data-form-density="compact"]'),control:get('[data-form-density="standard"] .ds-control'),smallControl:get('.ds-control-small'),sections:get('[data-typography-fixture]'),bridge:get('[data-tailwind-typography]'),arabic};
  });
}
function validate(m, {gutter,zoom=1,fontLoaded=true,touch=false} = {}) {
  assert.equal(m.overflow,false,'typography horizontal overflow');
  if(gutter!==undefined)assert.equal(m.gutter,gutter*zoom,'semantic page gutter');
  assert.equal(m.gutter,m.gutterEnd,'symmetric logical gutter');
  assert(m.pageWidth<=m.maxWidth,'canonical page width bound');
  assert.equal(m.icon.height,20*zoom,'control icon rem size');
  assert.equal(m.body.size,16*zoom,'body rem scale');
  assert.equal(m.helper.size,14*zoom,'helper remains readable');
  assert.equal(m.caption.size,12*zoom,'caption scale');
  assert(m.body.line>=m.body.size*1.5,'body leading');
  assert.equal(m.metric.numeric,'tabular-nums');
  assert.equal(m.metric.weight,600);
  assert(m.metric.size<=32*zoom,'restrained metrics');
  assert(m.standard.padding>m.compact.padding,'standard/compact card spacing');
  assert(m.standardForm.gap>m.compactForm.gap,'standard/compact form rhythm');
  assert.equal(m.sections.gap,32*zoom,'section rhythm');
  assert(m.control.height>=44*zoom,'default control target');
  if(touch)assert(m.smallControl.height>=44*zoom,'touch compact control target');
  assert.equal(m.bridge.size,14*zoom,'Tailwind text token bridge');
  assert.equal(m.bridge.weight,500,'Tailwind weight token bridge');
  assert.equal(m.bridge.padding,16*zoom,'Tailwind logical spacing bridge');
  for(const a of m.arabic){assert(a.ink<=a.line+1,`Arabic ink exceeds line: ${a.text} (${a.ink}/${a.line})`);assert.equal(a.overflow,false,'Arabic block overflow');assert(['normal','0px'].includes(a.tracking),'Arabic tracking');}
  const loaded=m.faces.some(f=>f.status==='loaded'&&m.fontFamily.includes(f.family.replaceAll('"','')));
  assert.equal(loaded,fontLoaded,'self-hosted Arabic font availability');
}
export async function verifyTypography({browser,base,evidence}) {
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const page=await prepare(context,base);const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
  for(const width of [1440,375])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl']) {
    await page.setViewportSize({width,height:1100});
    await page.getByLabel('Theme / المظهر').selectOption(theme);await page.getByLabel('Direction / الاتجاه').selectOption(dir);
    await page.waitForFunction(t=>document.documentElement.getAttribute('data-theme')===t,theme);
    const m=await measurements(page);validate(m,{gutter:width>=1024?32:16});
    results.push({width,theme,dir,measurements:m});
    await page.screenshot({path:`${evidence}/typography-${theme}-${dir}-${width}.png`,fullPage:true});
  }
  const responsive=[];
  for(const [width,gutter] of [[768,24],[1280,32],[1920,32]]) {await page.setViewportSize({width,height:1100});const m=await measurements(page);validate(m,{gutter});responsive.push({width,gutter:m.gutter});}
  await page.setViewportSize({width:375,height:1100});
  await page.addStyleTag({content:'html { font-size: 200%; }'});
  const zoom=await measurements(page);validate(zoom,{gutter:16,zoom:2});
  await page.screenshot({path:`${evidence}/typography-text-zoom-200.png`,fullPage:true});
  assert.deepEqual(errors,[],'typography page errors');await context.close();
  const touchContext=await browser.newContext({viewport:{width:375,height:900},isMobile:true,hasTouch:true});
  const touchPage=await prepare(touchContext,base);const touch=await measurements(touchPage);validate(touch,{gutter:16,touch:true});await touchContext.close();
  const fallbackContext=await browser.newContext({viewport:{width:375,height:900}});
  const fallbackPage=await prepare(fallbackContext,base,true);await fallbackPage.getByLabel('Direction / الاتجاه').selectOption('rtl');
  const fallback=await measurements(fallbackPage);validate(fallback,{gutter:16,fontLoaded:false});
  await fallbackPage.screenshot({path:`${evidence}/typography-font-fallback.png`,fullPage:true});await fallbackContext.close();
  await writeFile(`${evidence}/typography-results.json`,JSON.stringify({matrix:results,responsiveMeasurements:responsive,zoomMeasurements:zoom,touchMeasurements:touch,fallbackMeasurements:fallback,responsiveGutters:'PASS',textZoom200:'PASS',touchTargets:'PASS',fontFallback:'PASS',arabicInk:'PASS',errors},null,2));
  console.log('TYPOGRAPHY_SPACING_BROWSER: PASS');
}

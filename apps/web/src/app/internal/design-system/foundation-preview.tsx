'use client';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@ai-sales-agent/design-system';
import { arabicFont } from '@/styles/fonts';
import { TypographyPreview } from './typography-preview';
import { ComponentsPreview } from './components-preview';
import { PatternsPreview } from './patterns-preview';
import { ShellPreview } from './shell-preview';
export function FoundationPreview() {
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  useEffect(() => setReady(true), []);
  return <main data-ui="ds" data-foundation-ready={ready} dir={direction} lang={direction === 'rtl' ? 'ar' : 'en'} className={`${arabicFont.variable} ds-page tw:rounded-lg`}>
    <h1 className="ds-text-page-title">Token foundation / <span lang="ar">أساس المظهر</span></h1>
    <p>Internal verification only. No business data or agent execution.</p>
    <div className="tw:flex tw:flex-wrap tw:gap-4">
      <label>Theme / المظهر <select aria-label="Theme / المظهر" disabled={!ready} value={ready ? theme : 'system'} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>
      <label>Direction / الاتجاه <select aria-label="Direction / الاتجاه" value={direction} onChange={e=>setDirection(e.target.value as 'ltr'|'rtl')}><option value="ltr">LTR</option><option value="rtl">RTL</option></select></label>
    </div>
    <section aria-label="Semantic surfaces" className="tw:grid tw:gap-4 tw:mt-4 tw:md:grid-cols-3">
      <div className="ds-sample tw:bg-background tw:text-foreground">Background / النص الأساسي</div>
      <div className="ds-sample tw:bg-card tw:text-card-foreground">Card surface</div>
      <div className="ds-sample tw:bg-muted tw:text-muted-foreground">Muted supporting text</div>
      <div className="ds-sample tw:bg-primary tw:text-primary-foreground">Primary action</div>
      <div className="ds-sample tw:bg-secondary tw:text-secondary-foreground">Secondary surface</div>
      <div className="ds-sample tw:bg-destructive tw:text-destructive-foreground">Destructive action</div>
      {(['success','warning','danger','info'] as const).map(state=><div className="ds-sample ds-state" data-state={state} key={state}>{state} — نص توضيحي</div>)}
    </section>
    <p className="tw:flex tw:flex-wrap tw:gap-4">
      <Button><Sun className="ds-icon-control" aria-hidden="true"/>Primary / إجراء</Button><Button variant="secondary"><Moon className="ds-icon-control" aria-hidden="true"/>Secondary</Button><Button variant="destructive">Destructive</Button><Button disabled>Disabled</Button>
    </p>
    <TypographyPreview />
    <ComponentsPreview />
    <PatternsPreview />
    <ShellPreview />
    <label>Sample input / حقل تجريبي <input className="tw:bg-card tw:text-card-foreground tw:rounded-md tw:p-2" style={{border:'1px solid var(--input)',maxWidth:'100%'}} placeholder="Name / الاسم" /></label>
  </main>;
}


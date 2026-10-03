import * as React from 'react';
import { cn } from '../../lib/utils.js';
import { SkipToContent } from './skip-to-content.js';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet.js';
import { Button } from '../ui/button.js';
import { Menu } from 'lucide-react';

export interface AppShellProps {
  sidebar?: React.ReactNode;
  mobileSidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  skipLabel?: string;
  mobileNavTitle?: string;
  className?: string;
}

export function AppShell({
  sidebar,
  mobileSidebar,
  topbar,
  footer,
  children,
  skipLabel = 'Skip to main content',
  mobileNavTitle = 'Navigation Menu',
  className,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className={cn('relative min-h-screen bg-background text-foreground flex flex-col', className)}>
      <SkipToContent label={skipLabel} />

      {/* Mobile Drawer */}
      {(sidebar || mobileSidebar) && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="start" className="p-0 w-72 sm:w-80">
            <SheetTitle className="sr-only">{mobileNavTitle}</SheetTitle>
            <div className="h-full w-full overflow-y-auto" onClick={() => setMobileOpen(false)}>
              {mobileSidebar || sidebar}
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        {sidebar && (
          <div className="hidden md:flex shrink-0">
            {sidebar}
          </div>
        )}

        {/* Content Column */}
        <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
          {/* Topbar slot with mobile hamburger injection if topbar present */}
          {topbar && (
            <div className="sticky top-0 z-20 flex items-center">
              {(sidebar || mobileSidebar) && (
                <div className="md:hidden ps-3 py-2 flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation menu"
                    className="h-9 w-9"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </div>
              )}
              <div className="flex-1 min-w-0">{topbar}</div>
            </div>
          )}

          {/* Main Content Landmark */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 outline-none"
            role="main"
          >
            {children}
          </main>

          {/* Footer Landmark */}
          {footer && (
            <footer className="border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground mt-auto">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

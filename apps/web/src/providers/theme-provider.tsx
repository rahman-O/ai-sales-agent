'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <NextThemesProvider attribute="data-theme" storageKey="ai-sales-ui-theme" defaultTheme="system" enableSystem enableColorScheme={false}>{children}</NextThemesProvider>;
}

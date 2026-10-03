import type { ReactNode } from 'react';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: 'system-ui', margin: 0, padding: 24 }}><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}

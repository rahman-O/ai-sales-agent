import localFont from 'next/font/local';

// Apply the variable only at adopted DS boundaries; never at the legacy root.
export const arabicFont = localFont({
  src: './fonts/NotoSansArabic.woff2',
  variable: '--app-font-arabic',
  weight: '400 600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

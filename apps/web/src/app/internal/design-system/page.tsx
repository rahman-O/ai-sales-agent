import { notFound } from 'next/navigation';
import { FoundationPreview } from './foundation-preview';
export const dynamic = 'force-dynamic';
export default function DesignSystemVerification() {
  // Not exposed by default in production; never linked in business navigation.
  if (process.env.NODE_ENV === 'production' && process.env.DS_FOUNDATION_PREVIEW !== 'true') notFound();
  return <FoundationPreview />;
}

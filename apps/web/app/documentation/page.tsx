import type { Metadata } from 'next';
import { DocsContent } from '@/components/docs/DocsContent';
import './docs.css';

export const metadata: Metadata = { title: 'DarkNotes: Documentation' };

export default function DocumentationPage() {
  return <DocsContent />;
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'V1CTOR AI Assistant | ICT Mahidol Portfolio',
  description: 'Personal AI Agent with Voice and Supabase Integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

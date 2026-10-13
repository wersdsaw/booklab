import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Корпоративний Бункер | Психологічна рольова гра',
  description: 'Психологічна бізнес-симуляція про довіру, рішення та виживання команди.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Browser extensions can add attributes to <html> before React hydrates.
    // Limit suppression to this element; keep application mismatch checks active.
    <html lang="uk" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0a0510" />
      </head>
      <body className="bg-[#0a0510] text-gray-100 min-h-screen selection:bg-red-500/30 selection:text-red-200">
        {children}
      </body>
    </html>
  );
}

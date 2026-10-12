import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Корпоративний Бункер | Психологічна рольова гра',
  description: 'Психологічна бізнес-симуляція на 12+ гравців за мотивами Патріка Ленсіоні "5 вад команди".',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className="dark">
      <head>
        <meta name="theme-color" content="#0a0510" />
      </head>
      <body className="bg-[#0a0510] text-gray-100 min-h-screen selection:bg-red-500/30 selection:text-red-200">
        {children}
      </body>
    </html>
  );
}

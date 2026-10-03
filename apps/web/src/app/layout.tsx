import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tableau Blanc Collaboratif',
  description: 'Espace de travail visuel collaboratif en temps réel avec assistance IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full antialiased text-slate-800 bg-slate-50 overflow-hidden">
        {children}
      </body>
    </html>
  );
}

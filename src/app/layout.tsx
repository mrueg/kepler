import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kepler – Kubernetes Enhancement Proposals Browser',
  description: 'Browse and discover Kubernetes Enhancement Proposals (KEPs)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <header className="app-header">
            <Link href="/" className="header-brand">
              <span className="header-logo">⎈</span>
              <span className="header-title">Kepler</span>
            </Link>
            <p className="header-tagline">
              Browse Kubernetes Enhancement Proposals
            </p>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <p>
              KEP data from{' '}
              <a
                href="https://github.com/kubernetes/enhancements"
                target="_blank"
                rel="noopener noreferrer"
              >
                kubernetes/enhancements
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

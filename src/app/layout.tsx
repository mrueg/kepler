import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kepler – Kubernetes Enhancement Proposal Explorer',
  description: 'Explore Kubernetes Enhancement Proposals (KEPs) and Gateway API Enhancement Proposals (GEPs)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('kepler_theme');var p=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(p?'dark':'light'));}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <div className="app">
          <header className="app-header">
            <Link href="/" className="header-brand">
              <span className="header-logo">⎈</span>
              <span className="header-title">Kepler</span>
            </Link>
            <span className="header-tagline">Kubernetes Enhancement Proposal Explorer</span>
            <nav className="header-nav">
              <Link href="/" className="header-nav-link">
                KEPs
              </Link>
              <Link href="/gep" className="header-nav-link">
                GEPs
              </Link>
              <Link href="/stats" className="header-nav-link">
                Stats
              </Link>
            </nav>
            <ThemeToggle />
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
              {' · '}
              GEP data from{' '}
              <a
                href="https://github.com/kubernetes-sigs/gateway-api"
                target="_blank"
                rel="noopener noreferrer"
              >
                kubernetes-sigs/gateway-api
              </a>
              {' · '}
              <a
                href="https://github.com/mrueg/kepler"
                target="_blank"
                rel="noopener noreferrer"
              >
                mrueg/kepler
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

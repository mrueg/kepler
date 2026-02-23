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
              Code available at{' '}
              <a
                href="https://github.com/mrueg/kepler"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="currentColor"
                  style={{ verticalAlign: 'text-bottom', marginRight: '4px' }}
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                mrueg/kepler
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

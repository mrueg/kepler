import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { KepListPage } from './pages/KepListPage';
import { KepDetailPage } from './pages/KepDetailPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <Link to="/" className="header-brand">
            <span className="header-logo">⎈</span>
            <span className="header-title">Kepler</span>
          </Link>
          <p className="header-tagline">
            Browse Kubernetes Enhancement Proposals
          </p>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<KepListPage />} />
            <Route path="/kep/:number" element={<KepDetailPage />} />
          </Routes>
        </main>
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
    </BrowserRouter>
  );
}

export default App;

import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark small" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
          </span>
          <div>
            <p className="footer-title">ShopEase</p>
            <p className="muted small">Everyday essentials, delivered with ease.</p>
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/products">Products</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </nav>
        <p className="footer-note muted small">
          Built as a microservices demo: React, Node.js, MongoDB and AWS.
        </p>
      </div>
    </footer>
  );
}

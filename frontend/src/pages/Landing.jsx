import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ProductCard from '../components/ProductCard';
import { CategoryIcon } from '../components/ProductVisual';

const HERO_ITEMS = [
  { name: 'Wireless Mouse', category: 'Electronics', price: 19.99, tone: 'tone-blue' },
  { name: 'Mechanical Keyboard', category: 'Electronics', price: 89.99, tone: 'tone-violet' },
  { name: 'Espresso Machine', category: 'Home & Kitchen', price: 199.99, tone: 'tone-amber' }
];

const TONES = {
  Electronics: 'tone-blue',
  Books: 'tone-violet',
  Sports: 'tone-green',
  'Home & Kitchen': 'tone-amber'
};

const FEATURES = [
  {
    title: 'Curated catalog',
    body: 'A focused collection across electronics, books, sports and home essentials.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16M4 12h16M4 19h10" />
      </svg>
    )
  },
  {
    title: 'Secure by design',
    body: 'Every account and order is protected by JWT authentication at the gateway and again in the services.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    )
  },
  {
    title: 'Orders you can follow',
    body: 'Checkout in seconds, then revisit your complete order history any time.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
        <path d="M9.5 13h5" />
      </svg>
    )
  }
];

export default function Landing() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .listProducts()
      .then((data) => active && setProducts(data.products))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const categories = [...new Set(products.map((p) => p.category))].sort();
  const counts = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});
  const featured = products.slice(0, 4);
  const productCount = products.length || 12;
  const categoryCount = categories.length || 4;

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Everyday essentials, thoughtfully picked</span>
          <h1>
            Everything you need,
            <br />
            delivered with ease.
          </h1>
          <p className="lead">
            Shop a focused catalog of electronics, books, sports gear and home essentials.
            Secure accounts, transparent pricing and a checkout that takes seconds.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="button-link btn-lg">
              Browse products
            </Link>
            {user ? (
              <Link to="/orders" className="button-link secondary btn-lg">
                View my orders
              </Link>
            ) : (
              <Link to="/register" className="button-link secondary btn-lg">
                Create free account
              </Link>
            )}
          </div>
          <dl className="hero-stats">
            <div className="stat">
              <dt>Products</dt>
              <dd>{productCount}+</dd>
            </div>
            <div className="stat">
              <dt>Categories</dt>
              <dd>{categoryCount}</dd>
            </div>
            <div className="stat">
              <dt>Checkout</dt>
              <dd>JWT secured</dd>
            </div>
            <div className="stat">
              <dt>Pricing</dt>
              <dd>Server verified</dd>
            </div>
          </dl>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-glow" />
          <div className="hero-card">
            <div className="hero-card-head">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            {HERO_ITEMS.map((item) => (
              <div className="hero-card-body" key={item.name}>
                <span className={`mini-visual ${item.tone}`}>
                  <CategoryIcon category={item.category} />
                </span>
                <span className="mini-title">
                  {item.name}
                  <span className="muted small">{item.category}</span>
                </span>
                <span className="mini-price">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <span className="hero-badge hero-badge-1">Secure checkout</span>
          <span className="hero-badge hero-badge-2">{productCount}+ products</span>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Shop by category</span>
            <h2>Find your next favorite</h2>
          </div>
          <Link to="/products" className="text-link">
            Browse all products
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link
              key={category}
              to={`/products?category=${encodeURIComponent(category)}`}
              className="card category-card"
            >
              <span className={`category-icon ${TONES[category] || 'tone-slate'}`}>
                <CategoryIcon category={category} />
              </span>
              <span className="category-meta">
                <strong>{category}</strong>
                <span className="muted small">
                  {counts[category]} {counts[category] === 1 ? 'product' : 'products'}
                </span>
              </span>
              <span className="category-arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          ))}
          {!loading && !error && categories.length === 0 && (
            <p className="muted">No categories available yet.</p>
          )}
          {loading && <p className="muted">Loading categories&hellip;</p>}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Featured</span>
            <h2>Popular right now</h2>
          </div>
          <Link to="/products" className="text-link">
            See everything
          </Link>
        </div>
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Loading products&hellip;</p>}
        {!loading && !error && featured.length === 0 && (
          <p className="muted">Products will appear here once the catalog is seeded.</p>
        )}
        <div className="grid featured-grid">
          {featured.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Why ShopEase</span>
            <h2>Simple, secure, dependable</h2>
          </div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <div className="card feature-card" key={feature.title}>
              <span className="feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p className="muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>Ready when you are</h2>
          <p>Create an account to check out and keep track of every order.</p>
        </div>
        <div className="cta-actions">
          <Link to={user ? '/products' : '/register'} className="button-link btn-lg">
            {user ? 'Continue shopping' : 'Get started'}
          </Link>
          {!user && (
            <Link to="/login" className="button-link secondary btn-lg">
              I already have an account
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

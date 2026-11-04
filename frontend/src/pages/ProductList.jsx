import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';

export default function ProductList() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const search = params.get('q') || '';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(search);
  }, [search]);

  useEffect(() => {
    let active = true;
    api
      .listProducts()
      .then((data) => {
        if (active) setCategories([...new Set(data.products.map((p) => p.category))].sort());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const call = search ? api.searchProducts(search) : api.listProducts(category);
    call
      .then((data) => active && setProducts(data.products))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, search]);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    setParams(q ? { q } : {});
  }

  function selectCategory(next) {
    setQuery('');
    setParams(next ? { category: next } : {});
  }

  function clearAll() {
    setQuery('');
    setParams({});
  }

  const heading = search ? `Results for "${search}"` : category || 'All products';

  return (
    <div className="product-list">
      <div className="page-head">
        <div>
          <span className="eyebrow">Catalog</span>
          <h2>{heading}</h2>
          <p className="muted small">
            {loading ? 'Loading products…' : `${products.length} ${products.length === 1 ? 'product' : 'products'} available`}
          </p>
        </div>
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            aria-label="Search products"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
          {(search || category) && (
            <button type="button" className="secondary" onClick={clearAll}>
              Clear
            </button>
          )}
        </form>
      </div>

      {categories.length > 0 && (
        <div className="filters">
          <button
            type="button"
            className={category === '' && !search ? 'chip active' : 'chip'}
            onClick={() => selectCategory('')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c && !search ? 'chip active' : 'chip'}
              onClick={() => selectCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <div className="empty-state">
          <h3>No products found</h3>
          <p className="muted">Try a different search or browse the full catalog.</p>
          <button type="button" className="secondary" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      )}

      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </div>
  );
}

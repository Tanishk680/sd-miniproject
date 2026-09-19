import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const call = search ? api.searchProducts(search) : api.listProducts(category);
    call
      .then((data) => {
        if (!active) return;
        setProducts(data.products);
        if (!search && !category) {
          setCategories([...new Set(data.products.map((p) => p.category))].sort());
        }
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, search]);

  function handleSearch(e) {
    e.preventDefault();
    setCategory('');
    setSearch(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setSearch('');
  }

  return (
    <div>
      <div className="page-head">
        <h2>Products</h2>
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
          {search && (
            <button type="button" className="secondary" onClick={clearSearch}>
              Clear
            </button>
          )}
        </form>
      </div>

      {!search && categories.length > 0 && (
        <div className="filters">
          <button
            type="button"
            className={category === '' ? 'chip active' : 'chip'}
            onClick={() => setCategory('')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? 'chip active' : 'chip'}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="muted">Loading products…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && products.length === 0 && <p className="muted">No products found.</p>}

      <div className="grid">
        {products.map((p) => (
          <Link key={p._id} to={`/products/${p._id}`} className="card product-card">
            <h3>{p.name}</h3>
            <p className="muted">{p.category}</p>
            <p className="price">${p.price.toFixed(2)}</p>
            <p className="muted small">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
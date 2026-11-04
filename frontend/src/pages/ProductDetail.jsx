import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ProductVisual from '../components/ProductVisual';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getProduct(id)
      .then((data) => active && setProduct(data.product))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  function handleBuy() {
    navigate('/checkout', { state: { product, quantity } });
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!product) return <p className="muted">Product not found.</p>;

  return (
    <div className="card detail-card">
      <button type="button" className="secondary back" onClick={() => navigate(-1)}>
        &larr; Back
      </button>

      <div className="detail-grid">
        <ProductVisual product={product} className="detail-visual" />

        <div className="detail-info">
          <span className="pill">{product.category}</span>
          <h2>{product.name}</h2>
          <p className="muted">{product.description}</p>

          <div className="price-row">
            <span className="price big">${product.price.toFixed(2)}</span>
            <span className={`stock ${product.stock > 0 ? 'in' : 'out'}`}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>

          <div className="buy-row">
            <label>
              Quantity
              <input
                type="number"
                min={1}
                max={Math.max(product.stock, 1)}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <button type="button" onClick={handleBuy} disabled={product.stock <= 0}>
              Buy now
            </button>
          </div>

          <p className="muted small">Secure checkout · Pricing verified by the order service</p>
        </div>
      </div>
    </div>
  );
}

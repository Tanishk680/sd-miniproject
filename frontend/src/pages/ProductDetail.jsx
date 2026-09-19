import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

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
        ← Back
      </button>
      <h2>{product.name}</h2>
      <p className="muted">{product.category}</p>
      <p>{product.description}</p>
      <p className="price big">${product.price.toFixed(2)}</p>
      <p className="muted small">{product.stock} in stock</p>

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
    </div>
  );
}
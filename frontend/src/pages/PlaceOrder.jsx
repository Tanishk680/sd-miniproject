import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function PlaceOrder() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const state = location.state;
  if (!state || !state.product) {
    return <Navigate to="/" replace />;
  }

  const { product, quantity } = state;
  const total = product.price * quantity;

  async function handlePlaceOrder() {
    setError('');
    setSubmitting(true);
    try {
      await api.createOrder([
        {
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity
        }
      ]);
      navigate('/orders', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card detail-card">
      <h2>Checkout</h2>
      {error && <p className="error">{error}</p>}
      <div className="summary-row">
        <span>{product.name}</span>
        <span>
          {quantity} × ${product.price.toFixed(2)}
        </span>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
      <div className="buy-row">
        <button type="button" className="secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button type="button" onClick={handlePlaceOrder} disabled={submitting}>
          {submitting ? 'Placing order…' : 'Place order'}
        </button>
      </div>
    </div>
  );
}
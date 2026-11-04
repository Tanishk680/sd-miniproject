import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ProductVisual from '../components/ProductVisual';

export default function PlaceOrder() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const state = location.state;
  if (!state || !state.product) {
    return <Navigate to="/products" replace />;
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
    <div className="card detail-card checkout-card">
      <div className="auth-head">
        <span className="eyebrow">Almost there</span>
        <h2>Checkout</h2>
        <p className="muted">Review your item before placing the order.</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="checkout-item">
        <ProductVisual product={product} className="checkout-visual" />
        <div className="checkout-item-info">
          <span className="pill">{product.category}</span>
          <strong>{product.name}</strong>
          <span className="muted small">
            {quantity} × ${product.price.toFixed(2)}
          </span>
        </div>
        <span className="price">${(product.price * quantity).toFixed(2)}</span>
      </div>

      <div className="summary-row">
        <span className="muted">Subtotal</span>
        <span>${total.toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span className="muted">Delivery</span>
        <span>Free</span>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>

      <div className="buy-row checkout-actions">
        <button type="button" className="secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button type="button" onClick={handlePlaceOrder} disabled={submitting}>
          {submitting ? 'Placing order…' : 'Place order'}
        </button>
      </div>
      <p className="muted small">Final pricing is verified server-side before the order is saved.</p>
    </div>
  );
}

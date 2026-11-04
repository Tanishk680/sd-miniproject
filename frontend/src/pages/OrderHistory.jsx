import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .listOrders()
      .then((data) => active && setOrders(data.orders))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p className="muted">Loading orders…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow">Your account</span>
          <h2>My Orders</h2>
          <p className="muted small">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} placed
          </p>
        </div>
        <Link to="/products" className="button-link secondary">
          Continue shopping
        </Link>
      </div>

      {orders.length === 0 && (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
          </span>
          <h3>No orders yet</h3>
          <p className="muted">When you place your first order, it will show up here.</p>
          <Link to="/products" className="button-link">
            Browse products
          </Link>
        </div>
      )}

      {orders.map((order) => (
        <div key={order._id} className="card order-card">
          <div className="order-head">
            <div>
              <span className="order-id">Order #{order._id.slice(-6)}</span>
              <p className="muted small">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span>
          </div>
          <ul className="order-items">
            {order.items.map((item, idx) => (
              <li key={idx} className="summary-row">
                <span>
                  {item.name} <span className="muted">× {item.quantity}</span>
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row total">
            <span>Total</span>
            <span>${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

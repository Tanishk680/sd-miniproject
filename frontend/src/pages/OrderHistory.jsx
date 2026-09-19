import { useEffect, useState } from 'react';
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
        <h2>My Orders</h2>
      </div>
      {orders.length === 0 && <p className="muted">You have not placed any orders yet.</p>}
      {orders.map((order) => (
        <div key={order._id} className="card order-card">
          <div className="order-head">
            <span className="order-id">#{order._id.slice(-6)}</span>
            <span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span>
          </div>
          <ul className="order-items">
            {order.items.map((item, idx) => (
              <li key={idx} className="summary-row">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row total">
            <span>Total</span>
            <span>${order.totalAmount.toFixed(2)}</span>
          </div>
          <p className="muted small">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
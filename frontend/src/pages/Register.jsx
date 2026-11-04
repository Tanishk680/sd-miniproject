import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthAside from '../components/AuthAside';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/products', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <AuthAside
        title="Create your account"
        text="One account for checkout, order history and a faster way to shop."
        points={['Free to create', 'Secure JWT sessions', 'Orders saved to your profile']}
      />

      <div className="card auth-card">
        <div className="auth-head">
          <h2>Create account</h2>
          <p className="muted">It only takes a moment.</p>
        </div>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
              minLength={3}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p className="muted auth-alt">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

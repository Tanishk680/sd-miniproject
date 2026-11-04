import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" aria-label="ShopEase home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
          </span>
          <span>ShopEase</span>
        </Link>

        <div className="nav-links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/products">Products</NavLink>
          {user && <NavLink to="/orders">My Orders</NavLink>}
          {!user && <NavLink to="/login">Login</NavLink>}
          {!user && (
            <NavLink to="/register" className="nav-cta">
              Get started
            </NavLink>
          )}
          {user && <span className="nav-user">Hi, {user.username}</span>}
          {user && (
            <button type="button" className="link-btn" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

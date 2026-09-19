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
      <Link to="/" className="brand">ShopEase</Link>
      <div className="nav-links">
        <NavLink to="/">Products</NavLink>
        {user && <NavLink to="/orders">My Orders</NavLink>}
        {!user && <NavLink to="/login">Login</NavLink>}
        {!user && <NavLink to="/register">Register</NavLink>}
        {user && <span className="nav-user">Hi, {user.username}</span>}
        {user && (
          <button type="button" className="link-btn" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
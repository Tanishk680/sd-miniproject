import { Link } from 'react-router-dom';
import ProductVisual from './ProductVisual';

export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product._id}`} className="card product-card">
      <ProductVisual product={product} />
      <div className="product-card-body">
        <span className="pill">{product.category}</span>
        <h3>{product.name}</h3>
        <p className="muted small clamp-2">{product.description}</p>
        <div className="product-card-foot">
          <span className="price">${product.price.toFixed(2)}</span>
          <span className={`stock ${product.stock > 0 ? 'in' : 'out'}`}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </span>
        </div>
      </div>
    </Link>
  );
}

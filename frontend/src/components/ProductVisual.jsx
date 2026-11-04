const ICONS = {
  Electronics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  Books: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  ),
  Sports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.8 2.4 4.2 5.4 4.2 9s-1.4 6.6-4.2 9c-2.8-2.4-4.2-5.4-4.2-9S9.2 5.4 12 3z" />
      <path d="M3.5 9h17M3.5 15h17" />
    </svg>
  ),
  'Home & Kitchen': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5z" />
      <path d="M3 8.5 12 14l9-5.5M12 14v7" />
    </svg>
  )
};

const TONES = {
  Electronics: 'tone-blue',
  Books: 'tone-violet',
  Sports: 'tone-green',
  'Home & Kitchen': 'tone-amber'
};

export function CategoryIcon({ category }) {
  return ICONS[category] || ICONS.default;
}

export default function ProductVisual({ product, className = '' }) {
  if (product?.imageUrl) {
    return (
      <img
        className={`product-visual ${className}`}
        src={product.imageUrl}
        alt={product.name}
        loading="lazy"
      />
    );
  }

  const tone = TONES[product?.category] || 'tone-slate';
  return (
    <div
      className={`product-visual ${tone} ${className}`}
      role="img"
      aria-label={`${product?.category || 'Product'} placeholder`}
    >
      <span className="product-visual-icon">
        <CategoryIcon category={product?.category} />
      </span>
    </div>
  );
}

export default function AuthAside({ title, text, points }) {
  return (
    <aside className="auth-aside">
      <span className="eyebrow">ShopEase account</span>
      <h1>{title}</h1>
      <p className="lead">{text}</p>
      <ul className="check-list">
        {points.map((point) => (
          <li key={point}>
            <span className="check-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 4.5 4.5L19 7" />
              </svg>
            </span>
            {point}
          </li>
        ))}
      </ul>
    </aside>
  );
}

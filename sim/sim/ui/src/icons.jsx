const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

export function IconActivity(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
    </svg>
  );
}

export function IconPlay(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

export function IconStop(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function IconPause(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

export function IconBolt(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

export function IconServer(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  );
}

export function IconDatabase(props) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </svg>
  );
}

export function IconGlobe(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

export function IconAlert(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

export function IconRefresh(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11a8 8 0 0 0-14.7-4.6L3 9" />
      <path d="M3 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.7 4.6L21 15" />
      <path d="M21 20v-5h-5" />
    </svg>
  );
}

export function IconDownload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function IconCpu(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </svg>
  );
}

export function IconArrowLeft(props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

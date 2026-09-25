// Inline Material-style icons (24-unit viewBox). No icon library: five icons do not justify one.

type P = { className?: string };
const base = (p: P) => ({ width: 24, height: 24, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, className: p.className });

export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
  </svg>
);
export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);
export const IconHeart = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 15-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z" />
  </svg>
);
export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5h0l1 3h-2l1-3zm0 20-1-3h2l-1 3zM2 12l3-1v2l-3-1zm20 0-3 1v-2l3 1zM4.93 4.93l2.83 1.41-1.41 1.41-1.42-2.82zm14.14 14.14-2.83-1.41 1.41-1.41 1.42 2.82zM4.93 19.07l1.42-2.82 1.41 1.41-2.83 1.41zM19.07 4.93l-1.42 2.82-1.41-1.41 2.83-1.41z" />
  </svg>
);
export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12.3 2a9.9 9.9 0 0 0 0 20 9.9 9.9 0 0 0 8.6-5 8 8 0 0 1-8.6-15z" />
  </svg>
);
export const IconTranslate = (p: P) => (
  <svg {...base(p)}>
    <path d="m12.87 15.07-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
  </svg>
);

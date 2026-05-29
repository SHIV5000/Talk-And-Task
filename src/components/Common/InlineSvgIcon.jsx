import React from 'react';

const paths = {
  search: <path d="M10.5 18a7.5 7.5 0 1 1 5.31-12.8A7.5 7.5 0 0 1 10.5 18Zm5.3-2.2L21 21" />,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5a7.8 7.8 0 0 0-.12-1.35l2.02-1.57-2-3.46-2.38.96a8.2 8.2 0 0 0-2.34-1.35L15.32 2h-4l-.36 3.23a8.2 8.2 0 0 0-2.34 1.35l-2.38-.96-2 3.46 2.02 1.57A7.8 7.8 0 0 0 6.14 12c0 .46.04.91.12 1.35L4.24 14.92l2 3.46 2.38-.96a8.2 8.2 0 0 0 2.34 1.35l.36 3.23h4l.36-3.23a8.2 8.2 0 0 0 2.34-1.35l2.38.96 2-3.46-2.02-1.57c.08-.44.12-.89.12-1.35Z" />,
  logout: <path d="M15 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3M10 12h11m0 0-3-3m3 3-3 3" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  users: <path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2a4 4 0 1 0 0-8m-1 10H5a4 4 0 0 0-4 4v1h14v-1a4 4 0 0 0-4-4Zm8 5v-1a4 4 0 0 0-3-3.87" />,
  calendar: <path d="M7 3v4M17 3v4M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 7h3m3 0h3m-9 4h3m3 0h3" />,
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  task: <path d="M9 5h6m-7 4h8M8 13h5M8 17h4M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />,
  send: <path d="M22 2 11 13m11-11-7 20-4-9-9-4 20-7Z" />,
  attach: <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  smile: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 10h.01M15.5 10h.01M8 14a5 5 0 0 0 8 0" />,
  shield: <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3.5-10 2.2 2.2 4.8-4.8" />,
  reply: <path d="M10 8 5 13l5 5M5 13h9a5 5 0 0 1 5 5v1" />,
  external: <path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />,
  check: <path d="M20 6 9 17l-5-5" />,
  lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />,
  dot: <path d="M12 12h.01" />,
  file: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h6" />,
  pin: <path d="m15 4 5 5-4 1-4 4v5l-2 2-3.5-6.5L0 11l2-2h5l4-4 1-4 3 3Z" />,
  more: <path d="M12 8h.01M12 12h.01M12 16h.01" />,
  arrowDown: <path d="M12 5v14m0 0-6-6m6 6 6-6" />,
  arrowUp: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
};

export default function InlineSvgIcon({ name, className = '', title }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={`inline-svg-icon ${className}`}
    >
      {title ? <title>{title}</title> : null}
      {paths[name] || paths.dot}
    </svg>
  );
}

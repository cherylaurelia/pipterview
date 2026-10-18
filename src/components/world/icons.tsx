// Small line icons for the world's controls (in place of emoji): 18px, drawn with the current text colour.

import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6.5 10v9h11v-9" />
  </Icon>
);

export const IslandIcon = () => (
  <Icon>
    <path d="M3 15c3-2 15-2 18 0" />
    <path d="M6 15l2 4h8l2-4" />
    <path d="M12 14V7" />
    <path d="M12 7c-2.5-2-5-1.5-6 0 2-.5 4 0 6 0Zm0 0c2.5-2 5-1.5 6 0-2-.5-4 0-6 0Z" />
  </Icon>
);

export const BookIcon = () => (
  <Icon>
    <path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3Z" />
    <path d="M5 17a3 3 0 0 1 3-3h9" />
  </Icon>
);

export const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" />
    <path d="M12 16.8h.01" />
  </Icon>
);

export const SpeakerIcon = ({ off = false }: { off?: boolean }) => (
  <Icon>
    <path d="M4 10v4h3.5L12 18V6L7.5 10Z" />
    {off ? <path d="m16 10 4 4m0-4-4 4" /> : <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7.5a7 7 0 0 1 0 9" />}
  </Icon>
);

export const ChatIcon = () => (
  <Icon size={16}>
    <path d="M5 6.5h14v9H10l-4 3v-3H5Z" />
  </Icon>
);

export const CodeIcon = () => (
  <Icon size={16}>
    <path d="m9 8-4 4 4 4m6-8 4 4-4 4" />
  </Icon>
);

// Iconos SVG de trazo (24×24), heredan el color del texto con currentColor.
type P = { className?: string; title?: string };

function Svg({ className = "h-4 w-4", title, children, fill = false }: P & { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const PlayIcon = (p: P) => <Svg {...p} fill><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></Svg>;
export const ArrowRightIcon = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const ArrowLeftIcon = (p: P) => <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>;
export const SparklesIcon = (p: P) => <Svg {...p}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /><path d="M5 2.5l.6 1.4L7 4.5l-1.4.6L5 6.5l-.6-1.4L3 4.5l1.4-.6Z" /></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></Svg>;
export const VideoIcon = (p: P) => <Svg {...p}><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="M15.5 10.5 21 7.5v9l-5.5-3" /></Svg>;
export const HeadphonesIcon = (p: P) => <Svg {...p}><path d="M4 18v-5a8 8 0 0 1 16 0v5" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></Svg>;
export const ImageIcon = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></Svg>;
export const FilmIcon = (p: P) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18" /></Svg>;
export const AlertIcon = (p: P) => <Svg {...p}><path d="M10.3 3.9 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Svg>;
export const CaptionsIcon = (p: P) => <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M10 10.2a2 2 0 1 0 0 3.6M17 10.2a2 2 0 1 0 0 3.6" /></Svg>;
export const CaptionsOffIcon = (p: P) => <Svg {...p}><path d="M8 5h11a2.5 2.5 0 0 1 2.5 2.5V16M18.5 19h-14A2.5 2.5 0 0 1 2 16.5v-9A2.5 2.5 0 0 1 3.5 5.2" /><path d="M3 3l18 18" /></Svg>;
export const LiveDot = ({ className = "h-2 w-2" }: { className?: string }) => (
  <span className={`relative inline-flex ${className}`} aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
    <span className="relative inline-flex h-full w-full rounded-full bg-red-500" />
  </span>
);

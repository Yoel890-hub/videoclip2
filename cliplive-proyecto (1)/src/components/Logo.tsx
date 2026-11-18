// Logo de ClipLive: icono (public/logo.png) + nombre. `name={false}` muestra solo el icono.
export default function Logo({ size = 36, name = true, className = "" }: { size?: number; name?: boolean | "sm" ; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold ${className}`}>
      <img src="/logo.png" alt={name ? "" : "ClipLive"} width={size} height={size} className="shrink-0 rounded-xl" style={{ width: size, height: size }} />
      {name && <span className={name === "sm" ? "hidden sm:inline" : ""}>Clip<span className="text-accent">Live</span></span>}
    </span>
  );
}

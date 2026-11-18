// Cada cambio de página entra con una animación suave (fundido + pequeño desplazamiento).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}

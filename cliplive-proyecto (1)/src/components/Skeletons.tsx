// Esqueletos de carga: bloques grises con un brillo que pasa, con la misma forma que el contenido real.
const S = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} aria-hidden />;

export function ClipCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      <S className={`rounded-none ${tall ? "aspect-[9/12]" : "aspect-video"}`} />
      <div className="space-y-3 p-4">
        <div className="flex gap-1.5"><S className="h-5 w-16 rounded-full" /><S className="h-5 w-14 rounded-full" /><S className="h-5 w-10 rounded-full" /></div>
        <S className="h-4 w-4/5" />
        <S className="h-11 w-full" />
      </div>
    </div>
  );
}

export function ClipGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => <ClipCardSkeleton key={i} tall={i % 3 === 0} />)}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Cargando">
      <div className="space-y-4 rounded-3xl border border-line bg-card p-5 sm:p-8">
        <S className="h-3 w-24" />
        <S className="h-9 w-11/12 sm:h-12" />
        <S className="h-9 w-2/3 sm:h-12" />
        <S className="h-4 w-1/2" />
        <div className="flex flex-col gap-2 pt-2 sm:flex-row"><S className="h-12 flex-1" /><S className="h-12 w-full sm:w-36" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="space-y-2 rounded-2xl border border-line bg-card p-3 sm:p-4"><S className="h-3 w-16" /><S className="h-7 w-12" /></div>)}
      </div>
      <div className="space-y-4"><S className="h-6 w-36" /><ClipGridSkeleton count={3} /></div>
    </div>
  );
}

export function ClipsPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando clips">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2"><S className="h-9 w-44" /><S className="h-4 w-28" /></div>
        <S className="h-12 w-36" />
      </div>
      <ClipGridSkeleton />
    </div>
  );
}

export function PlansSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Cargando planes">
      <div className="space-y-2"><S className="h-9 w-56" /><S className="h-4 w-64" /></div>
      <div className="grid gap-5 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-4 rounded-3xl border border-line bg-card p-6">
            <S className="h-6 w-24" /><S className="h-4 w-40" /><S className="h-12 w-28" /><S className="h-16 w-full rounded-2xl" />
            {[0, 1, 2, 3, 4].map((j) => <S key={j} className="h-4 w-full" />)}
            <S className="h-12 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewClipSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]" role="status" aria-label="Cargando">
      <div className="space-y-4">
        <S className="h-16 w-full rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-line bg-card p-4">
            <S className="h-4 w-24" />
            <div className="flex flex-wrap gap-2">{[0, 1, 2, 3].map((j) => <S key={j} className="h-10 w-24" />)}</div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <S className="aspect-video rounded-none" />
        <div className="space-y-3 p-4"><S className="h-4 w-3/4" /><S className="h-4 w-1/2" /><S className="h-12 w-full" /></div>
      </div>
    </div>
  );
}

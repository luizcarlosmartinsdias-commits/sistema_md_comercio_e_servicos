import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority: _priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <div role="img" aria-label={mdBrand.name} className={`inline-flex items-center gap-3 ${className}`}>
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 shadow-sm">
        <span className="text-[25px] font-black leading-none tracking-tight text-white">M</span>
        <span className="text-[25px] font-black leading-none tracking-tight text-sky-400">D</span>
        <span className="absolute -left-2 top-1/2 h-1 w-3 -translate-y-1/2 rounded-full bg-sky-400" />
        <span className="absolute -right-2 top-4 h-1 w-3 rounded-full bg-sky-400" />
        <span className="absolute -right-2 bottom-4 h-1 w-3 rounded-full bg-sky-400" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="whitespace-nowrap text-2xl font-black tracking-tight text-slate-900">
          <span className="text-mdblue">MD</span> Comércio e Serviços
        </div>
        <div className="mt-1 whitespace-nowrap text-sm font-medium text-slate-500">Assistência técnica B2B para eletrônicos</div>
      </div>
    </div>
  );
}

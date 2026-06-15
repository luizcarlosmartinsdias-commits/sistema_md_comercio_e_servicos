import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority: _priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <div role="img" aria-label={mdBrand.name} className={`inline-flex items-center gap-5 ${className}`}>
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white text-5xl font-black tracking-tight text-mdblue">
        MD
      </div>
      <div className="whitespace-nowrap text-4xl font-black tracking-tight text-slate-800">
        <span className="text-mdblue">MD</span> Comércio e Serviços
      </div>
    </div>
  );
}

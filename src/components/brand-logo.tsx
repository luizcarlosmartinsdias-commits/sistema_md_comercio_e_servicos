import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority: _priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-md-horizontal.svg?v=11"
      alt={mdBrand.name}
      className={`block object-contain ${className}`}
      decoding="async"
      loading={_priority ? 'eager' : 'lazy'}
    />
  );
}

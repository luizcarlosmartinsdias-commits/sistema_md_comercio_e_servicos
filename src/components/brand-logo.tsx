import Image from 'next/image';
import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <Image
      src={mdBrand.logoDataUrl}
      alt={mdBrand.name}
      width={192}
      height={144}
      priority={priority}
      unoptimized
      className={className}
    />
  );
}

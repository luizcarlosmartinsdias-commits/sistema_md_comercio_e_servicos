import Image from 'next/image';
import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <Image
      src="/logo-md-horizontal.svg"
      alt={mdBrand.name}
      width={974}
      height={180}
      priority={priority}
      className={`block object-contain ${className}`}
    />
  );
}

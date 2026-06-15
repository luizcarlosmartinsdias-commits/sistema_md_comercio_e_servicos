import Image from 'next/image';
import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <Image
      src="/publiclogo-md-horizontal.png?v=1"
      alt={mdBrand.name}
      width={1366}
      height={768}
      priority={priority}
      className={`block object-contain ${className}`}
    />
  );
}

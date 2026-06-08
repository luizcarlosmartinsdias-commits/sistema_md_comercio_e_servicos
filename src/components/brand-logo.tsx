import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority: _priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={mdBrand.name}
      viewBox="0 0 640 170"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mdBlueClean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b7fd3" />
          <stop offset="1" stopColor="#0b2f75" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="628" height="158" rx="26" fill="#ffffff" />

      <g transform="translate(36 24)">
        <text x="0" y="78" fontFamily="Arial, Helvetica, sans-serif" fontSize="82" fontWeight="900" fill="url(#mdBlueClean)">M</text>
        <text x="142" y="78" fontFamily="Arial, Helvetica, sans-serif" fontSize="82" fontWeight="900" fill="#2f3946">D</text>

        <g stroke="#0b7fd3" strokeLinecap="round" fill="none">
          <path d="M120 14 V95" strokeWidth="7" />
          <path d="M136 30 V95" strokeWidth="5" />
          <path d="M152 46 V95" strokeWidth="5" />
          <circle cx="120" cy="12" r="10" fill="#ffffff" strokeWidth="6" />
          <circle cx="152" cy="46" r="8" fill="#ffffff" strokeWidth="5" />
          <circle cx="120" cy="98" r="10" fill="#ffffff" strokeWidth="6" />
        </g>

        <text x="0" y="126" fontFamily="Arial, Helvetica, sans-serif" fontSize="28" fontWeight="900" fill="#0b4fa7">MD</text>
        <text x="62" y="126" fontFamily="Arial, Helvetica, sans-serif" fontSize="28" fontWeight="700" fill="#2f3946">Comércio e Serviços</text>
        <line x1="0" y1="146" x2="190" y2="146" stroke="#0b63bd" strokeWidth="4" />
        <line x1="294" y1="146" x2="520" y2="146" stroke="#0b63bd" strokeWidth="4" />
        <path d="M210 146 H235 L250 155 L265 146 H280" stroke="#2f3946" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="250" cy="146" r="7" fill="#ffffff" stroke="#0b63bd" strokeWidth="5" />
      </g>
    </svg>
  );
}

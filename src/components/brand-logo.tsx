import { mdBrand } from '@/lib/brand';

export function BrandLogo({ priority: _priority = false, className = 'h-12 w-auto' }: { priority?: boolean; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={mdBrand.name}
      viewBox="0 0 520 170"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mdLogoBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0377d6" />
          <stop offset="1" stopColor="#0b2f75" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="512" height="162" rx="24" fill="#ffffff" />
      <g transform="translate(28 24)">
        <text x="0" y="76" fontFamily="Arial, Helvetica, sans-serif" fontSize="82" fontWeight="900" fill="url(#mdLogoBlue)">M</text>
        <text x="178" y="76" fontFamily="Arial, Helvetica, sans-serif" fontSize="82" fontWeight="900" fill="#2f3946">D</text>
        <path d="M142 12 L142 92" stroke="#0874c9" strokeWidth="9" strokeLinecap="round" />
        <path d="M156 26 L156 92" stroke="#0874c9" strokeWidth="5" strokeLinecap="round" />
        <path d="M170 42 L170 92" stroke="#0874c9" strokeWidth="5" strokeLinecap="round" />
        <circle cx="142" cy="10" r="12" fill="#fff" stroke="#0874c9" strokeWidth="7" />
        <circle cx="170" cy="43" r="9" fill="#fff" stroke="#0874c9" strokeWidth="6" />
        <circle cx="142" cy="94" r="11" fill="#fff" stroke="#0874c9" strokeWidth="7" />
        <text x="0" y="132" fontFamily="Arial, Helvetica, sans-serif" fontSize="35" fontWeight="900" fill="#0b4fa7">MD</text>
        <text x="72" y="132" fontFamily="Arial, Helvetica, sans-serif" fontSize="35" fontWeight="700" fill="#2f3946">Comércio e Serviços</text>
        <line x1="0" y1="148" x2="170" y2="148" stroke="#0b63bd" strokeWidth="5" />
        <line x1="308" y1="148" x2="462" y2="148" stroke="#0b63bd" strokeWidth="5" />
        <path d="M190 148 H222 L238 158 L254 148 H288" fill="none" stroke="#2f3946" strokeWidth="5" strokeLinecap="round" />
        <circle cx="238" cy="148" r="9" fill="#fff" stroke="#0b63bd" strokeWidth="6" />
      </g>
    </svg>
  );
}

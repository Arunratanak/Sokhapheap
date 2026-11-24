/** Brand mark (same drawing as src/app/icon.svg) + product name. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className="shrink-0 drop-shadow-sm">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset=".55" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#f5b301" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-g)" />
      <path d="M32 50S14 39 14 26a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill="#fff" />
      <path d="M20 30h7l3-6 4 11 3-5h7" fill="none" stroke="#c2410c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href, name }: { href: string; name: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight text-foreground">
      <LogoMark />
      <span>{name}</span>
    </a>
  );
}

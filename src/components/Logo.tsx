export function Logo({ size = 44 }: { size?: number }) {
  const lensR = 9;
  const hubR = lensR * 0.22;
  const spokeInner = lensR * 0.28;
  const spokeOuter = lensR * 0.82;
  const dotR = lensR * 0.11;
  const dotDist = lensR * 0.91;
  const outerRingR = lensR * 0.93;

  // Mirrored K8s spokes: x negated so left-right flip reflects through the lens
  const spokes = Array.from({ length: 7 }, (_, i) => {
    const theta = ((i * 360) / 7 - 90) * (Math.PI / 180);
    return {
      x1: +(-Math.cos(theta) * spokeInner).toFixed(2),
      y1: +(Math.sin(theta) * spokeInner).toFixed(2),
      x2: +(-Math.cos(theta) * spokeOuter).toFixed(2),
      y2: +(Math.sin(theta) * spokeOuter).toFixed(2),
      dx: +(-Math.cos(theta) * dotDist).toFixed(2),
      dy: +(Math.sin(theta) * dotDist).toFixed(2),
    };
  });

  return (
    // Wide viewBox so the nearly-horizontal telescope has room
    <svg
      width={size * 1.375}
      height={size}
      viewBox="0 0 110 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Kepler telescope logo"
    >
      <defs>
        {/* Cylinder gradient: light top → dark bottom (perpendicular to tube axis) */}
        <linearGradient id="kepler-tube-grad" x1="0" y1="-8" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6699ff" />
          <stop offset="35%" stopColor="#2451b7" />
          <stop offset="100%" stopColor="#0a1540" />
        </linearGradient>
        <linearGradient id="kepler-ring-grad" x1="0" y1="-9" x2="0" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7aadff" />
          <stop offset="100%" stopColor="#122070" />
        </linearGradient>
        {/* Lens rim gradient */}
        <linearGradient id="kepler-rim-grad" x1="0" y1="-14" x2="0" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5580cc" />
          <stop offset="100%" stopColor="#080f2e" />
        </linearGradient>
        {/* Clip to inner lens ellipse – coordinates in telescope-local space */}
        <clipPath id="kepler-lens-clip">
          <ellipse cx="32" cy="0" rx="10" ry="12" />
        </clipPath>
      </defs>

      {/* Tripod legs – anchored at mount point (50,53) */}
      <line x1="50" y1="53" x2="24" y2="78" stroke="#1a56a0" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="53" x2="76" y2="78" stroke="#1a56a0" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="53" x2="50" y2="77" stroke="#1a56a0" strokeWidth="2.5" strokeLinecap="round" />
      {/* Cross-brace */}
      <line x1="30" y1="68" x2="70" y2="68" stroke="#1a56a0" strokeWidth="2" strokeLinecap="round" />

      {/* Telescope – nearly horizontal, objective lens pointing right */}
      <g transform="translate(50,53) rotate(-10)">
        {/* Tube body */}
        <rect x="-32" y="-8" width="64" height="16" rx="3" fill="url(#kepler-tube-grad)" />
        {/* Cylindrical highlight strip */}
        <rect x="-30" y="-8" width="60" height="3.5" rx="1.5" fill="rgba(255,255,255,0.12)" />

        {/* Decorative rings */}
        <rect x="-22" y="-9" width="5" height="18" rx="2" fill="url(#kepler-ring-grad)" />
        <rect x="-11" y="-9" width="5" height="18" rx="2" fill="url(#kepler-ring-grad)" />
        <rect x="0"   y="-9" width="5" height="18" rx="2" fill="url(#kepler-ring-grad)" />

        {/* Focus knob on top */}
        <rect x="-2" y="-13" width="6" height="5" rx="1.5" fill="url(#kepler-ring-grad)" />

        {/* Eyepiece – left end */}
        <rect x="-42" y="-5.5" width="12" height="11" rx="2" fill="url(#kepler-ring-grad)" />
        {/* Eyepiece end-cap ellipse (3D closing face) */}
        <ellipse cx="-42" cy="0" rx="2.5" ry="5.5" fill="#0d2060" />

        {/* Objective lens outer rim */}
        <ellipse cx="32" cy="0" rx="12" ry="14" fill="url(#kepler-rim-grad)" />
        {/* Lens inner face */}
        <ellipse cx="32" cy="0" rx="10" ry="12" fill="#050d28" />

        {/* K8s wheel – proper circle (lensR=9 fits fully within rx=10, ry=12) */}
        <g clipPath="url(#kepler-lens-clip)">
          <g transform="translate(32,0)">
            <circle r={outerRingR} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
            <circle r={hubR} fill="rgba(255,255,255,0.95)" />
            {spokes.map((s, i) => (
              <g key={i}>
                <line
                  x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx={s.dx} cy={s.dy} r={dotR} fill="rgba(255,255,255,0.95)" />
              </g>
            ))}
          </g>
        </g>

        {/* Lens rim stroke */}
        <ellipse cx="32" cy="0" rx="10" ry="12" fill="none" stroke="#4477cc" strokeWidth="1.5" />
        {/* Lens glint */}
        <ellipse cx="25" cy="-7" rx="3" ry="1.3" fill="rgba(255,255,255,0.28)" transform="rotate(-20,25,-7)" />
      </g>

      {/* Mount pivot */}
      <circle cx="50" cy="53" r="5" fill="#326ce5" />
    </svg>
  );
}

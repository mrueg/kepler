export function Logo({ size = 44 }: { size?: number }) {
  const lensR = 10;
  const hubR = lensR * 0.22;
  const spokeInner = lensR * 0.28;
  const spokeOuter = lensR * 0.82;
  const dotR = lensR * 0.11;
  const dotDist = lensR * 0.91;
  const outerRingR = lensR * 0.93;

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
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Kepler telescope logo"
    >
      <defs>
        {/* Cylinder gradient: lighter on top, darker on bottom */}
        <linearGradient id="kepler-tube-grad" x1="0" y1="-7" x2="0" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5a8de8" />
          <stop offset="40%" stopColor="#2451b7" />
          <stop offset="100%" stopColor="#0d1f5c" />
        </linearGradient>
        {/* Ring gradient */}
        <linearGradient id="kepler-ring-grad" x1="0" y1="-8" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6699ff" />
          <stop offset="100%" stopColor="#1a3a8a" />
        </linearGradient>
        {/* Lens rim gradient */}
        <linearGradient id="kepler-rim-grad" x1="0" y1="-13" x2="0" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a7fd4" />
          <stop offset="100%" stopColor="#0a1540" />
        </linearGradient>
        {/* Clip to the inner lens ellipse – perspective-compressed in x */}
        <clipPath id="kepler-lens-clip">
          <ellipse cx="26" cy="0" rx="7" ry="11" />
        </clipPath>
      </defs>

      {/* Tripod legs */}
      <line x1="40" y1="46" x2="18" y2="74" stroke="#1a56a0" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="46" x2="62" y2="74" stroke="#1a56a0" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="46" x2="40" y2="72" stroke="#1a56a0" strokeWidth="2.5" strokeLinecap="round" />
      {/* Brace between front legs */}
      <line x1="24" y1="63" x2="56" y2="63" stroke="#1a56a0" strokeWidth="2" strokeLinecap="round" />

      {/* Telescope group – rotated so objective end points upper-right */}
      <g transform="translate(40,46) rotate(-25)">
        {/* Main tube body with cylinder gradient */}
        <rect x="-26" y="-7" width="48" height="14" rx="3" fill="url(#kepler-tube-grad)" />
        {/* Top highlight strip for cylindrical sheen */}
        <rect x="-24" y="-7" width="44" height="3" rx="1.5" fill="rgba(255,255,255,0.1)" />

        {/* Decorative rings with gradient */}
        <rect x="-17" y="-8" width="4" height="16" rx="1.5" fill="url(#kepler-ring-grad)" />
        <rect x="-7"  y="-8" width="4" height="16" rx="1.5" fill="url(#kepler-ring-grad)" />
        <rect x="3"   y="-8" width="4" height="16" rx="1.5" fill="url(#kepler-ring-grad)" />

        {/* Focus knob */}
        <rect x="0" y="-11" width="5" height="4" rx="1" fill="url(#kepler-ring-grad)" />

        {/* Eyepiece (left end) – rect body + elliptical end-cap for 3D */}
        <rect x="-33" y="-4.5" width="8" height="9" rx="2" fill="url(#kepler-ring-grad)" />
        <ellipse cx="-33" cy="0" rx="2" ry="4.5" fill="#1a3a8a" />

        {/* Objective lens outer rim – ellipse (perspective-compressed) */}
        <ellipse cx="26" cy="0" rx="9" ry="13" fill="url(#kepler-rim-grad)" />
        {/* Lens face inner */}
        <ellipse cx="26" cy="0" rx="7" ry="11" fill="#0d1a3a" />

        {/* Mirrored Kubernetes wheel – scaled to fit the ellipse */}
        <g clipPath="url(#kepler-lens-clip)">
          <g transform="translate(26,0) scale(0.7,1)">
            <circle r={outerRingR} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
            <circle r={hubR} fill="rgba(255,255,255,0.9)" />
            {spokes.map((s, i) => (
              <g key={i}>
                <line
                  x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx={s.dx} cy={s.dy} r={dotR} fill="rgba(255,255,255,0.9)" />
              </g>
            ))}
          </g>
        </g>

        {/* Lens rim edge */}
        <ellipse cx="26" cy="0" rx="7" ry="11" fill="none" stroke="#326ce5" strokeWidth="1.5" />
        {/* Lens glint */}
        <ellipse cx="20" cy="-6" rx="2.5" ry="1.2" fill="rgba(255,255,255,0.3)" transform="rotate(-30,20,-6)" />
      </g>

      {/* Mount pivot */}
      <circle cx="40" cy="46" r="4.5" fill="#326ce5" />
    </svg>
  );
}

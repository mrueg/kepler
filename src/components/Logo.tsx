export function Logo({ size = 64 }: { size?: number }) {
  const lensR = 10;
  const hubR = lensR * 0.22;
  const spokeInner = lensR * 0.28;
  const spokeOuter = lensR * 0.82;
  const dotR = lensR * 0.11;
  const dotDist = lensR * 0.91;
  const outerRingR = lensR * 0.93;

  // Kubernetes logo: 7 spokes mirrored horizontally (x = −cosθ·r)
  // so the wheel appears as a reflection through the objective lens
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
    // ViewBox 130×100 – wider than tall so the horizontal telescope fits
    <svg
      width={Math.round(size * 1.3)}
      height={size}
      viewBox="0 0 130 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Kepler telescope logo"
    >
      <defs>
        {/* Cylinder gradient perpendicular to the tube axis */}
        <linearGradient id="kg-tube" x1="0" y1="-10" x2="0" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#7ab0ff" />
          <stop offset="40%"  stopColor="#2755c8" />
          <stop offset="100%" stopColor="#091845" />
        </linearGradient>
        <linearGradient id="kg-ring" x1="0" y1="-11" x2="0" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#90bfff" />
          <stop offset="100%" stopColor="#0f1e6a" />
        </linearGradient>
        <linearGradient id="kg-lens-rim" x1="0" y1="-17" x2="0" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3e6cc0" />
          <stop offset="100%" stopColor="#04091e" />
        </linearGradient>
        {/* Clip to the lens inner face – lensR=10 fits fully inside:
            all spoke dots satisfy (dx/11)²+(dy/14)²<1, no clipping */}
        <clipPath id="kg-lens-clip">
          <ellipse cx="44" cy="0" rx="11" ry="14" />
        </clipPath>
      </defs>

      {/* ── Tripod ── warm brown legs fanning from the mount point */}
      <line x1="62" y1="56" x2="28" y2="95" stroke="#7a4e28" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="62" y1="56" x2="96" y2="95" stroke="#7a4e28" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="62" y1="56" x2="62" y2="94" stroke="#7a4e28" strokeWidth="3"   strokeLinecap="round" />
      {/* Cross-brace */}
      <line x1="36" y1="79" x2="88" y2="79" stroke="#7a4e28" strokeWidth="2.5" strokeLinecap="round" />
      {/* Rubber feet */}
      <circle cx="28" cy="95" r="2.5" fill="#4a2e10" />
      <circle cx="96" cy="95" r="2.5" fill="#4a2e10" />
      <circle cx="62" cy="94" r="2"   fill="#4a2e10" />

      {/* ── Telescope ── nearly horizontal, objective lens on the right */}
      <g transform="translate(62,56) rotate(-12)">

        {/* Main tube body */}
        <rect x="-42" y="-10" width="86" height="20" rx="4" fill="url(#kg-tube)" />
        {/* Specular highlight strip (3-D cylinder illusion) */}
        <rect x="-40" y="-10" width="82" height="4" rx="2" fill="rgba(255,255,255,0.14)" />

        {/* Barrel rings */}
        <rect x="-30" y="-11" width="6" height="22" rx="2.5" fill="url(#kg-ring)" />
        <rect x="-16" y="-11" width="6" height="22" rx="2.5" fill="url(#kg-ring)" />
        <rect x="-2"  y="-11" width="6" height="22" rx="2.5" fill="url(#kg-ring)" />
        {/* Focus knob on top */}
        <rect x="-5" y="-16" width="8" height="6" rx="2" fill="url(#kg-ring)" />

        {/* Eyepiece – left end */}
        <rect x="-53" y="-7" width="13" height="14" rx="3" fill="url(#kg-ring)" />
        {/* Elliptical end-cap closes the eyepiece in 3-D */}
        <ellipse cx="-53" cy="0" rx="3" ry="7" fill="#0a1e5e" />

        {/* Objective lens housing */}
        <ellipse cx="44" cy="0" rx="13" ry="16" fill="url(#kg-lens-rim)" />
        {/* Lens face (dark base for the K8s wheel) */}
        <ellipse cx="44" cy="0" rx="11" ry="14" fill="#030c22" />

        {/* ── Kubernetes wheel (mirrored reflection in the lens) ── */}
        <g clipPath="url(#kg-lens-clip)">
          <g transform="translate(44,0)">
            {/* Outer ring */}
            <circle r={outerRingR} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" />
            {/* Central hub */}
            <circle r={hubR} fill="white" />
            {/* 7 spokes + endpoint dots */}
            {spokes.map((s, i) => (
              <g key={i}>
                <line
                  x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx={s.dx} cy={s.dy} r={dotR} fill="white" />
              </g>
            ))}
          </g>
        </g>

        {/* Lens rim stroke */}
        <ellipse cx="44" cy="0" rx="11" ry="14" fill="none" stroke="#4a80dd" strokeWidth="1.5" />
        {/* Glass glint */}
        <ellipse cx="37" cy="-8" rx="3.5" ry="1.5" fill="rgba(255,255,255,0.32)" transform="rotate(-20,37,-8)" />
      </g>

      {/* Mount pivot hub */}
      <circle cx="62" cy="56" r="5.5" fill="#326ce5" />
      <circle cx="62" cy="56" r="3"   fill="#6699ff" />
    </svg>
  );
}

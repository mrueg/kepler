export function Logo({ size = 80 }: { size?: number }) {
  // K8s wheel geometry — lensR=25 fits fully inside clip circle r=28
  const lensR = 25;
  const hubR = lensR * 0.22;       // 5.5
  const spokeInner = lensR * 0.28; // 7
  const spokeOuter = lensR * 0.82; // 20.5
  const dotR = lensR * 0.11;       // 2.75
  const dotDist = lensR * 0.91;    // 22.75
  const outerRingR = lensR * 0.93; // 23.25

  // 7 spokes mirrored horizontally (x = −cosθ · r) for lens reflection
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
    // Square viewBox — telescope sits in the upper portion, tripod fills the lower
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Kepler telescope logo"
    >
      <defs>
        {/* Transparent background — no rect fill */}

        {/* Tube body: grey-beige, light on top, darker on bottom */}
        <linearGradient id="lg-tube" x1="0" y1="-18" x2="0" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#d4cfc8" />
          <stop offset="50%"  stopColor="#b0a99e" />
          <stop offset="100%" stopColor="#7a7168" />
        </linearGradient>
        {/* Wooden ring: warm orange-brown */}
        <linearGradient id="lg-ring" x1="0" y1="-20" x2="0" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#e8a050" />
          <stop offset="45%"  stopColor="#c26a18" />
          <stop offset="100%" stopColor="#7a3a06" />
        </linearGradient>
        {/* Objective lens rim: dark blue-grey */}
        <linearGradient id="lg-lens-rim" x1="0" y1="-34" x2="0" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#5a6e94" />
          <stop offset="100%" stopColor="#1a2240" />
        </linearGradient>
        {/* Lens face: very dark navy */}
        <radialGradient id="lg-lens-face" cx="40%" cy="35%" r="70%">
          <stop offset="0%"   stopColor="#1a2660" />
          <stop offset="100%" stopColor="#050b20" />
        </radialGradient>
        {/* Wooden tripod legs */}
        <linearGradient id="lg-leg" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#c26a18" />
          <stop offset="50%"  stopColor="#e8a050" />
          <stop offset="100%" stopColor="#9a4a10" />
        </linearGradient>

        {/* Clip path: circle matching lens inner face, in telescope-local space */}
        <clipPath id="kg-lens-clip">
          <circle cx="56" cy="0" r="28" />
        </clipPath>
      </defs>

      {/* ━━━ Tripod ━━━ warm brown wooden legs */}
      {/* Left front leg */}
      <line x1="100" y1="108" x2="44"  y2="188" stroke="#c26a18" strokeWidth="7" strokeLinecap="round" />
      {/* Right front leg */}
      <line x1="100" y1="108" x2="156" y2="188" stroke="#c26a18" strokeWidth="7" strokeLinecap="round" />
      {/* Center back leg */}
      <line x1="100" y1="108" x2="100" y2="186" stroke="#9a4a10" strokeWidth="6"   strokeLinecap="round" />
      {/* Cross-brace */}
      <line x1="56"  y1="160" x2="144" y2="160" stroke="#7a3a06" strokeWidth="4"   strokeLinecap="round" />
      {/* Rubber feet */}
      <ellipse cx="44"  cy="188" rx="5" ry="3" fill="#3a1c04" />
      <ellipse cx="156" cy="188" rx="5" ry="3" fill="#3a1c04" />
      <ellipse cx="100" cy="186" rx="4" ry="2.5" fill="#3a1c04" />

      {/* Mount head (alt-az head where tube meets tripod) */}
      <circle cx="100" cy="108" r="9" fill="#c26a18" />
      <circle cx="100" cy="108" r="5" fill="#e8b060" />

      {/* ━━━ Telescope tube group ━━━ angled ~30° upper-right */}
      <g transform="translate(100,108) rotate(-30)">

        {/* Main tube body */}
        <rect x="-65" y="-18" width="120" height="36" rx="10" fill="url(#lg-tube)" />

        {/* Wooden barrel rings */}
        <rect x="-50" y="-20" width="14" height="40" rx="4" fill="url(#lg-ring)" />
        <rect x="-28" y="-20" width="14" height="40" rx="4" fill="url(#lg-ring)" />
        <rect x="-6"  y="-20" width="14" height="40" rx="4" fill="url(#lg-ring)" />
        <rect x="16"  y="-20" width="14" height="40" rx="4" fill="url(#lg-ring)" />

        {/* Eyepiece end (left) */}
        <rect x="-78" y="-10" width="16" height="20" rx="5" fill="url(#lg-ring)" />
        {/* End-cap */}
        <ellipse cx="-78" cy="0" rx="4" ry="10" fill="#5a3010" />

        {/* ── Objective lens (right) ── */}
        {/* Outer housing rim */}
        <circle cx="56" cy="0" r="33" fill="url(#lg-lens-rim)" />
        {/* Thick wooden ring around lens */}
        <circle cx="56" cy="0" r="31" fill="none" stroke="url(#lg-ring)" strokeWidth="5" />
        {/* Lens face */}
        <circle cx="56" cy="0" r="28" fill="url(#lg-lens-face)" />

        {/* ── Kubernetes wheel on the lens face ── */}
        <g clipPath="url(#kg-lens-clip)">
          <g transform="translate(56,0)">
            {/* Outer ring */}
            <circle r={outerRingR} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
            {/* Hub */}
            <circle r={hubR} fill="white" />
            {/* 7 spokes + dots */}
            {spokes.map((s, i) => (
              <g key={i}>
                <line
                  x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx={s.dx} cy={s.dy} r={dotR} fill="white" />
              </g>
            ))}
          </g>
        </g>

        {/* Lens rim border */}
        <circle cx="56" cy="0" r="28" fill="none" stroke="rgba(100,140,220,0.6)" strokeWidth="2" />
        {/* Glass glint */}
        <ellipse cx="44" cy="-14" rx="7" ry="3" fill="rgba(255,255,255,0.35)" transform="rotate(-20,44,-14)" />
        <circle  cx="68" cy="-18" r="2.5" fill="rgba(255,255,255,0.25)" />
      </g>
    </svg>
  );
}

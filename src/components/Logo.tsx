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
        {/* Clip to the inner lens face; coordinates are in telescope-local space */}
        <clipPath id="kepler-lens-clip">
          <circle cx="26" cy="0" r={lensR} />
        </clipPath>
      </defs>

      {/* Tripod legs */}
      <line x1="40" y1="50" x2="18" y2="76" stroke="#1a56a0" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="50" x2="62" y2="76" stroke="#1a56a0" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="50" x2="40" y2="74" stroke="#1a56a0" strokeWidth="2.5" strokeLinecap="round" />
      {/* Brace between front legs */}
      <line x1="24" y1="66" x2="56" y2="66" stroke="#1a56a0" strokeWidth="2" strokeLinecap="round" />

      {/* Telescope group – rotated so objective end points upper-right */}
      <g transform="translate(40,50) rotate(-15)">
        {/* Main tube body */}
        <rect x="-26" y="-7" width="48" height="14" rx="3" fill="#1e3a8a" />
        {/* Decorative rings */}
        <rect x="-17" y="-8" width="4" height="16" rx="1.5" fill="#326ce5" />
        <rect x="-7"  y="-8" width="4" height="16" rx="1.5" fill="#326ce5" />
        <rect x="3"   y="-8" width="4" height="16" rx="1.5" fill="#326ce5" />
        {/* Focus knob */}
        <rect x="0" y="-11" width="5" height="4" rx="1" fill="#326ce5" />
        {/* Eyepiece (left end) */}
        <rect x="-33" y="-4.5" width="8" height="9" rx="2" fill="#326ce5" />

        {/* Objective lens housing (right end) */}
        <circle cx="26" cy="0" r="13" fill="#0f172a" />
        <circle cx="26" cy="0" r="11" fill="#1e3a8a" />

        {/* Mirrored Kubernetes wheel inside the lens */}
        <g clipPath="url(#kepler-lens-clip)">
          <g transform="translate(26,0)">
            <circle r={outerRingR} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
            <circle r={hubR} fill="rgba(255,255,255,0.9)" />
            {spokes.map((s, i) => (
              <g key={i}>
                <line
                  x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <circle cx={s.dx} cy={s.dy} r={dotR} fill="rgba(255,255,255,0.9)" />
              </g>
            ))}
          </g>
        </g>

        {/* Lens rim overlay */}
        <circle cx="26" cy="0" r="11" fill="none" stroke="#326ce5" strokeWidth="1.5" />
        {/* Glint */}
        <ellipse cx="20" cy="-5" rx="2.5" ry="1.2" fill="rgba(255,255,255,0.25)" transform="rotate(-30,20,-5)" />
      </g>

      {/* Mount pivot – sits where telescope meets tripod */}
      <circle cx="40" cy="50" r="4.5" fill="#326ce5" />
    </svg>
  );
}

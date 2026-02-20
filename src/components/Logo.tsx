export function Logo({ height = 40 }: { height?: number }) {
  const numSpokes = 7;
  const lensR = 17;
  const hubR = lensR * 0.22;
  const spokeInner = lensR * 0.28;
  const spokeOuter = lensR * 0.82;
  const dotR = lensR * 0.11;
  const dotDist = lensR * 0.91;
  const outerRingR = lensR * 0.95;

  const spokes = Array.from({ length: numSpokes }, (_, i) => {
    const theta = ((i * 360) / numSpokes - 90) * (Math.PI / 180);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    // Mirror horizontally by negating the x component
    return {
      x1: -cosT * spokeInner,
      y1: sinT * spokeInner,
      x2: -cosT * spokeOuter,
      y2: sinT * spokeOuter,
      dotX: -cosT * dotDist,
      dotY: sinT * dotDist,
    };
  });

  return (
    <svg
      width={height * 2}
      height={height}
      viewBox="0 0 160 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Kepler telescope logo"
    >
      <defs>
        <clipPath id="kepler-lens-clip">
          <circle cx="28" cy="40" r={lensR} />
        </clipPath>
      </defs>

      {/* Main telescope tube – tapered from objective to eyepiece */}
      <polygon points="28,30 118,33 118,47 28,50" fill="#326ce5" />

      {/* Focus ring */}
      <rect x="66" y="27" width="10" height="26" rx="4" fill="#1d4ed8" />

      {/* Objective lens outer rim */}
      <circle cx="28" cy="40" r="21" fill="#1d4ed8" />
      <circle cx="28" cy="40" r="19" fill="#326ce5" />

      {/* Mirrored Kubernetes wheel inside the lens */}
      <g clipPath="url(#kepler-lens-clip)">
        <g transform="translate(28,40)">
          {/* Outer ring */}
          <circle
            r={outerRingR}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.2"
          />
          {/* Hub */}
          <circle r={hubR} fill="rgba(255,255,255,0.9)" />
          {/* 7 spokes (mirrored: x negated) */}
          {spokes.map((s, i) => (
            <g key={i}>
              <line
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle
                cx={s.dotX}
                cy={s.dotY}
                r={dotR}
                fill="rgba(255,255,255,0.9)"
              />
            </g>
          ))}
        </g>
      </g>

      {/* Lens rim overlay */}
      <circle cx="28" cy="40" r="19" fill="none" stroke="#1d4ed8" strokeWidth="2" />

      {/* Lens glint */}
      <ellipse cx="21" cy="33" rx="5" ry="2.5" fill="rgba(255,255,255,0.18)" transform="rotate(-30,21,33)" />

      {/* Eyepiece housing */}
      <polygon points="118,34 136,36 136,44 118,46" fill="#1d4ed8" />

      {/* Eyecup */}
      <rect x="136" y="37" width="8" height="7" rx="2" fill="#0d1117" />
    </svg>
  );
}

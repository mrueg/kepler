import type { KepFeatureGate } from '../types/kep';

/** "Yes" / "No" / null for whether a feature can be disabled after enabling it. */
export function disableSupportedLabel(value: boolean | undefined): string | null {
  if (value === undefined) return null;
  return value ? 'Yes' : 'No';
}

export function FeatureGateList({
  gates,
  disableSupported,
}: {
  gates: KepFeatureGate[];
  disableSupported?: boolean;
}) {
  const canDisable = disableSupportedLabel(disableSupported);
  return (
    <>
      <ul className="feature-gate-list">
        {gates.map((gate) => (
          <li key={gate.name}>
            <code className="feature-gate-name">{gate.name}</code>
            {gate.components && (
              <span className="feature-gate-components">{gate.components.join(', ')}</span>
            )}
          </li>
        ))}
      </ul>
      {canDisable && <p className="feature-gate-disable">Can be disabled after enabling: {canDisable}</p>}
    </>
  );
}

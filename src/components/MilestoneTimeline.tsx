import type { KepMilestone, KepStage } from '../types/kep';

const STAGES: { key: keyof KepMilestone; label: string }[] = [
  { key: 'alpha', label: 'Alpha' },
  { key: 'beta', label: 'Beta' },
  { key: 'stable', label: 'Stable' },
];

const STAGE_ORDER: Record<string, number> = {
  alpha: 0,
  beta: 1,
  stable: 2,
};

interface MilestoneTimelineProps {
  milestone: KepMilestone;
  stage?: KepStage;
}

export function MilestoneTimeline({ milestone, stage }: MilestoneTimelineProps) {
  // Only apply progress-based styling when stage is one of the tracked milestone stages.
  const currentIndex =
    stage !== undefined && stage in STAGE_ORDER ? STAGE_ORDER[stage] : -1;
  const hasTrackedStage = currentIndex >= 0;

  return (
    <div className="milestone-timeline" role="list" aria-label="Milestone progression">
      {STAGES.map(({ key, label }, i) => {
        const version = milestone[key];
        const stageIndex = STAGE_ORDER[key];
        const isDone = hasTrackedStage && currentIndex > stageIndex;
        const isCurrent = stage === key;
        const isFuture = hasTrackedStage && !isDone && !isCurrent;

        const isFirst = i === 0;
        const isLast = i === STAGES.length - 1;

        const nodeClass = [
          'milestone-node',
          isDone ? 'milestone-node--done' : '',
          isCurrent ? 'milestone-node--current' : '',
          isFuture ? 'milestone-node--future' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const leftConnectorClass = [
          'milestone-connector',
          isFirst ? 'milestone-connector--hidden' : '',
          (isDone || isCurrent) ? 'milestone-connector--active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const rightConnectorClass = [
          'milestone-connector',
          isLast ? 'milestone-connector--hidden' : '',
          isDone ? 'milestone-connector--active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={key} className="milestone-step" role="listitem">
            <div className="milestone-step-track" aria-hidden="true">
              <div className={leftConnectorClass} />
              <div className={nodeClass}>
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className={rightConnectorClass} />
            </div>
            <div className="milestone-label">{label}</div>
            {version ? (
              <div className={`milestone-version${isCurrent ? ' milestone-version--current' : ''}`}>
                {version}
              </div>
            ) : (
              <div className="milestone-version milestone-version--empty">—</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

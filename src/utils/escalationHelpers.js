export const ESCALATION_LABELS = {
  0: 'Normal',
  1: 'Ack Pending',
  2: 'Overdue',
  3: 'Critical'
};

export const ESCALATION_COLORS = {
  0: '#22c55e',
  1: '#eab308',
  2: '#f97316',
  3: '#ef4444'
};

export function getEscalationInfo(level) {
  return {
    label: ESCALATION_LABELS[level] || 'Unknown',
    color: ESCALATION_COLORS[level] || '#6b7280'
  };
}

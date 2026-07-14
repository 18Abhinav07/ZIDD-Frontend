"use client";

import {
  JourneyMap,
  type JourneyNode,
  type JourneyNodeStatus,
} from '@/components/learning/JourneyMap';

export type SchoolJourneyNodeStatus = Exclude<JourneyNodeStatus, 'ready'>;

export interface SchoolJourneyNode {
  id: string;
  step: string;
  title: string;
  description: string;
  status: SchoolJourneyNodeStatus;
  actionLabel?: string;
  action?: () => void;
  disabled?: boolean;
}

export interface SchoolJourneyMapProps {
  nodes: SchoolJourneyNode[];
  startLabel?: string;
  destinationTitle?: string;
  destinationLabel?: string;
  compact?: boolean;
}

export function SchoolJourneyMap({
  nodes,
  startLabel = 'Your journey begins',
  destinationTitle = 'Class confidence',
  destinationLabel = 'Built one skill at a time',
  compact = false,
}: SchoolJourneyMapProps) {
  const sharedNodes: JourneyNode[] = nodes.map((node) => ({
    id: node.id,
    label: node.step,
    title: node.title,
    description: node.description,
    status: node.status,
    actionLabel: node.actionLabel,
    action: node.action,
    disabled: node.disabled,
  }));

  return (
    <JourneyMap
      nodes={sharedNodes}
      labels={{
        start: startLabel,
        destinationTitle,
        destinationDescription: destinationLabel,
        statusLabels: {
          active: 'You are here',
          support: 'Focused support',
        },
      }}
      compact={compact}
      className="school-journey-map"
      testId="school-journey-map"
    />
  );
}

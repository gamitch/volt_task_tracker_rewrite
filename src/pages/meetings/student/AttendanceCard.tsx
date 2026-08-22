import type { ReactNode } from 'react';
import { Card, Heading, HStack, ProgressBar, StatusDot, Text, VStack } from '@astryxdesign/core';
import type {
  AttendanceStatus,
  StudentMeetingHistoryRow,
  StudentParticipationMetric,
} from '../../../lib/meetings/types';

export interface AttendanceCardProps {
  participation: StudentParticipationMetric | null;
  history: readonly StudentMeetingHistoryRow[];
}

const STATUS: Record<
  AttendanceStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'error' }
> = {
  present: { label: 'Present', variant: 'success' },
  late: { label: 'Late', variant: 'warning' },
  excused: { label: 'Excused', variant: 'neutral' },
  absent: { label: 'Absent', variant: 'error' },
};

export function AttendanceCard({ participation, history }: AttendanceCardProps): ReactNode {
  const recentMarks = history
    .filter((row) => row.status === 'completed' && row.myAttendanceStatus !== null)
    .slice()
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 5);
  const percentage = participation?.participationPct ?? null;
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Heading level={2}>Attendance summary</Heading>
        {recentMarks.length === 0 ? (
          <Text color="secondary">No completed attendance marks yet.</Text>
        ) : (
          <HStack gap={2} aria-label="Recent attendance">
            {recentMarks.map((row) => {
              const status = STATUS[row.myAttendanceStatus!];
              return (
                <StatusDot
                  key={row.sessionId}
                  variant={status.variant}
                  label={`${status.label}: ${row.title}`}
                  tooltip={status.label}
                />
              );
            })}
          </HStack>
        )}
        <HStack gap={2} aria-label="Attendance legend">
          {Object.values(STATUS).map((status) => (
            <HStack key={status.label} gap={0.5} vAlign="center">
              <StatusDot variant={status.variant} label={status.label} />
              <Text type="supporting">{status.label}</Text>
            </HStack>
          ))}
        </HStack>
        <VStack gap={1}>
          <Text type="supporting" weight="bold">
            Participation: {percentage === null ? '—' : `${percentage}%`}
          </Text>
          {percentage === null ? null : (
            <ProgressBar value={percentage} label="Participation" hasValueLabel />
          )}
        </VStack>
      </VStack>
    </Card>
  );
}

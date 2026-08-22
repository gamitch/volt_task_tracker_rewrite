import type { ReactNode } from 'react';
import { Badge, Collapsible, List, ListItem, Text, VStack } from '@astryxdesign/core';
import { formatTimeRangeWithDuration, formatWeekdayDate } from '../../../lib/meetings/format';
import type { AttendanceStatus, StudentMeetingHistoryRow } from '../../../lib/meetings/types';

export interface PastListProps {
  rows: readonly StudentMeetingHistoryRow[];
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

export function PastList({ rows }: PastListProps): ReactNode {
  return (
    <Collapsible defaultIsOpen={false} trigger={`Show past meetings (${rows.length})`}>
      {rows.length === 0 ? (
        <Text color="secondary">No past meetings yet.</Text>
      ) : (
        <List hasDividers>
          {rows.map((row) => (
            <ListItem
              key={row.sessionId}
              label={row.title}
              description={
                <VStack gap={0}>
                  <Text type="supporting">
                    {formatWeekdayDate(row.sessionDate)} ·{' '}
                    {formatTimeRangeWithDuration(row.startsAt, row.endsAt)}
                  </Text>
                  <Text type="supporting" color="secondary">
                    {row.locationName || 'Location to be confirmed'}
                  </Text>
                </VStack>
              }
              endContent={
                row.myAttendanceStatus === null ? (
                  <Text type="supporting" color="secondary">
                    Not yet held
                  </Text>
                ) : (
                  <Badge
                    variant={STATUS[row.myAttendanceStatus].variant}
                    label={STATUS[row.myAttendanceStatus].label}
                  />
                )
              }
            />
          ))}
        </List>
      )}
    </Collapsible>
  );
}

import type { ReactNode } from 'react';
import { Heading, List, ListItem, Text, VStack } from '@astryxdesign/core';
import { formatTimeRangeWithDuration, formatWeekdayDate } from '../../../lib/meetings/format';
import type { StudentMeetingHistoryRow } from '../../../lib/meetings/types';

export interface UpcomingListProps {
  rows: readonly StudentMeetingHistoryRow[];
}

export function UpcomingList({ rows }: UpcomingListProps): ReactNode {
  const remaining = rows.slice(0, 3);
  if (remaining.length === 0) return null;
  return (
    <VStack gap={2}>
      <Heading level={2}>Coming up after that</Heading>
      <List hasDividers>
        {remaining.map((row) => (
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
          />
        ))}
      </List>
    </VStack>
  );
}

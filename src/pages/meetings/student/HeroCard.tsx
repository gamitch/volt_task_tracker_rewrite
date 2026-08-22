import type { ReactNode } from 'react';
import { Badge, Card, Heading, HStack, Text, VStack } from '@astryxdesign/core';
import {
  formatDateSquare,
  formatRelativeChicagoDay,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
} from '../../../lib/meetings/format';
import type { StudentMeetingHistoryRow } from '../../../lib/meetings/types';

export interface HeroCardProps {
  nextSession: StudentMeetingHistoryRow | null;
}

/** The next scheduled session only; callers exclude completed and canceled rows. */
export function HeroCard({ nextSession }: HeroCardProps): ReactNode {
  if (nextSession === null) {
    return (
      <Card padding={4}>
        <VStack gap={1}>
          <Heading level={2}>Your next meeting</Heading>
          <Text color="secondary">No meetings are scheduled yet.</Text>
        </VStack>
      </Card>
    );
  }
  const dateSquare = formatDateSquare(nextSession.sessionDate);
  const relativeDay = formatRelativeChicagoDay(nextSession.sessionDate, new Date());
  return (
    <Card padding={4}>
      <HStack gap={3} vAlign="start">
        <VStack gap={0} aria-label={formatWeekdayDate(nextSession.sessionDate)}>
          <Text type="supporting" weight="bold">
            {dateSquare.month}
          </Text>
          <Heading level={3}>{dateSquare.day}</Heading>
        </VStack>
        <VStack gap={1} width="100%">
          <HStack hAlign="between" gap={2} vAlign="center">
            <Text type="supporting" weight="bold">
              Your next meeting
            </Text>
            {relativeDay === null ? null : <Badge variant="neutral" label={relativeDay} />}
          </HStack>
          <Heading level={2}>{nextSession.title}</Heading>
          <Text>
            {formatWeekdayDate(nextSession.sessionDate)} ·{' '}
            {formatTimeRangeWithDuration(nextSession.startsAt, nextSession.endsAt)}
          </Text>
          <Text type="supporting" color="secondary">
            {nextSession.locationName || 'Location to be confirmed'}
          </Text>
        </VStack>
      </HStack>
    </Card>
  );
}

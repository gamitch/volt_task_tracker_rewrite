import { useEffect, useState, type ReactNode } from 'react';
import { Banner, Button, EmptyState, Heading, Skeleton, Text, VStack } from '@astryxdesign/core';
import type { ResolveStudentIsActiveFn } from '../../../lib/supabase/loaders/students';
import { loadLinkedStudents } from '../../../lib/supabase/loaders/checkin';
import {
  type CurrentViewerIdentity,
  type LoadStudentMeetingsDataFn,
  type ResolveCurrentStudentIdFn,
} from '../../../lib/meetings/types';
import type { LinkedStudentSummary, LoadLinkedStudentsFn } from '../StudentMeetingView';
import { partitionByStatus } from '../../../lib/meetings/studentModel';
import { AttendanceCard } from './AttendanceCard';
import { ChildSwitcher, type ChildSwitcherOption } from './ChildSwitcher';
import { HeroCard } from './HeroCard';
import { PastList } from './PastList';
import { UpcomingList } from './UpcomingList';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);
  useEffect(() => {
    let mounted = true;
    setState({ status: 'loading' });
    load().then(
      (data) => mounted && setState({ status: 'success', data }),
      (error: unknown) =>
        mounted &&
        setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) }),
    );
    return () => {
      mounted = false;
    };
    // The supplied dependencies define the real loader identity; retry is internal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retryToken]);
  return state;
}

function firstNameLastInitial(name: string): string {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  if (pieces.length === 0) return 'Linked student';
  return pieces.length === 1 ? pieces[0] : `${pieces[0]} ${pieces[pieces.length - 1][0]}.`;
}

export interface StudentMeetingsViewProps {
  studentId: string;
  loadData: LoadStudentMeetingsDataFn;
  resolveStudentIsActive: ResolveStudentIsActiveFn;
}

function StudentMeetingContent({
  studentId,
  loadData,
  resolveStudentIsActive,
}: StudentMeetingsViewProps): ReactNode {
  const state = useLoadState(
    () => Promise.all([loadData(studentId), resolveStudentIsActive(studentId)]),
    [loadData, resolveStudentIsActive, studentId],
  );
  if (state.status === 'loading')
    return (
      <VStack gap={3} aria-busy="true">
        <Text role="status">Loading your meetings…</Text>
        <Skeleton width={100} height={20} index={0} />
        <Skeleton width={220} height={16} index={1} />
      </VStack>
    );
  if (state.status === 'error')
    return (
      <Banner
        status="error"
        title="Couldn't load your meeting history"
        description="Something went wrong loading your meeting history. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={state.retry} />}
      />
    );
  const [{ history, participation }, isActive] = state.data;
  const { upcoming, past } = partitionByStatus(history);
  if (isActive === false)
    return (
      <VStack gap={6} data-selected-student={studentId}>
        <HeroCard nextSession={upcoming[0] ?? null} />
        <UpcomingList rows={upcoming.slice(1)} />
        <PastList rows={past} />
        <EmptyState
          headingLevel={2}
          title="Your student account is inactive"
          description="Your student account has been deactivated. If you think this is a mistake, contact your coach or team admin. Participation isn't tracked while your account is inactive."
        />
      </VStack>
    );
  if (history.length === 0 && participation === null)
    return (
      <EmptyState
        headingLevel={2}
        title="No meeting history yet"
        description="Your meeting attendance and participation will show up here once meetings for your team have been scheduled and recorded."
      />
    );
  return (
    <VStack gap={6} data-selected-student={studentId}>
      <HeroCard nextSession={upcoming[0] ?? null} />
      <UpcomingList rows={upcoming.slice(1)} />
      <AttendanceCard participation={participation} history={history} />
      <PastList rows={past} />
    </VStack>
  );
}

interface ParentStudentMeetingsViewProps extends StudentMeetingsViewProps {
  loadChildren: LoadLinkedStudentsFn;
}

function ParentStudentMeetingsView({
  studentId,
  loadData,
  resolveStudentIsActive,
  loadChildren,
}: ParentStudentMeetingsViewProps): ReactNode {
  const childrenState = useLoadState(loadChildren, [loadChildren]);
  const [selectedStudentId, setSelectedStudentId] = useState(studentId);
  useEffect(() => {
    if (
      childrenState.status === 'success' &&
      childrenState.data.length > 0 &&
      !childrenState.data.some((child) => child.studentId === selectedStudentId)
    )
      setSelectedStudentId(childrenState.data[0].studentId);
  }, [childrenState, selectedStudentId]);
  if (childrenState.status === 'loading')
    return (
      <VStack gap={3} aria-busy="true">
        <Text role="status">Loading linked students…</Text>
        <Skeleton width={220} height={20} index={0} />
      </VStack>
    );
  if (childrenState.status === 'error')
    return (
      <Banner
        status="error"
        title="Couldn't load linked students"
        description="Something went wrong loading your linked students. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={childrenState.retry} />}
      />
    );
  const options: ChildSwitcherOption[] = childrenState.data.map((child: LinkedStudentSummary) => ({
    id: child.studentId,
    displayName: firstNameLastInitial(child.displayName),
  }));
  return (
    <VStack gap={4}>
      {options.length > 1 ? (
        <ChildSwitcher
          students={options}
          selectedStudentId={selectedStudentId}
          onSelect={setSelectedStudentId}
        />
      ) : null}
      <StudentMeetingContent
        studentId={selectedStudentId}
        loadData={loadData}
        resolveStudentIsActive={resolveStudentIsActive}
      />
    </VStack>
  );
}

export function StudentMeetingsView({
  studentId,
  loadData,
  resolveStudentIsActive,
}: StudentMeetingsViewProps): ReactNode {
  return (
    <StudentMeetingContent
      studentId={studentId}
      loadData={loadData}
      resolveStudentIsActive={resolveStudentIsActive}
    />
  );
}

interface ResolvedStudentMeetingsViewProps {
  viewer: CurrentViewerIdentity;
  resolveStudentId: ResolveCurrentStudentIdFn;
  resolveStudentIsActive: ResolveStudentIsActiveFn;
  loadData: LoadStudentMeetingsDataFn;
  loadChildren?: LoadLinkedStudentsFn;
}

function ResolvedStudentMeetingsView({
  viewer,
  resolveStudentId,
  resolveStudentIsActive,
  loadData,
  loadChildren = loadLinkedStudents,
}: ResolvedStudentMeetingsViewProps): ReactNode {
  const state = useLoadState(
    () => resolveStudentId(viewer),
    [resolveStudentId, viewer.id, viewer.role],
  );
  if (state.status === 'loading')
    return (
      <VStack gap={3} aria-busy="true">
        <Text role="status">Finding your student record…</Text>
        <Skeleton width={220} height={16} index={0} />
      </VStack>
    );
  if (state.status === 'error')
    return (
      <Banner
        status="error"
        title="Couldn't find your student record"
        description="Something went wrong looking up which student this is for you. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={state.retry} />}
      />
    );
  if (state.data === null)
    return (
      <EmptyState
        headingLevel={1}
        title="No student account linked yet"
        description="We couldn't find a student record linked to your account yet. Once one is linked, your meetings will show up here."
      />
    );
  const props = { studentId: state.data, loadData, resolveStudentIsActive };
  return viewer.role === 'parent' ? (
    <ParentStudentMeetingsView {...props} loadChildren={loadChildren} />
  ) : (
    <StudentMeetingsView {...props} />
  );
}

const NOOP_RESOLVE_STUDENT_IS_ACTIVE: ResolveStudentIsActiveFn = () => Promise.resolve(null);

interface StudentMeetingsViewContainerProps {
  viewer: CurrentViewerIdentity;
  explicitStudentId: string | undefined;
  resolveStudentId: ResolveCurrentStudentIdFn;
  resolveStudentIsActive: ResolveStudentIsActiveFn;
  loadData: LoadStudentMeetingsDataFn;
  /** Optional test seam; production defaults to the existing real loader. */
  loadLinkedStudents?: LoadLinkedStudentsFn;
}

export function StudentMeetingsViewContainer({
  viewer,
  explicitStudentId,
  resolveStudentId,
  resolveStudentIsActive,
  loadData,
  loadLinkedStudents,
}: StudentMeetingsViewContainerProps): ReactNode {
  return (
    <VStack gap={6}>
      <Heading level={1}>Meetings</Heading>
      {explicitStudentId !== undefined ? (
        <StudentMeetingsView
          studentId={explicitStudentId}
          loadData={loadData}
          resolveStudentIsActive={NOOP_RESOLVE_STUDENT_IS_ACTIVE}
        />
      ) : (
        <ResolvedStudentMeetingsView
          viewer={viewer}
          resolveStudentId={resolveStudentId}
          resolveStudentIsActive={resolveStudentIsActive}
          loadData={loadData}
          loadChildren={loadLinkedStudents}
        />
      )}
    </VStack>
  );
}

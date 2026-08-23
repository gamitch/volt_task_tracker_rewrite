import type { ReactNode } from 'react';
import { RadioList, RadioListItem } from '@astryxdesign/core';

export interface ChildSwitcherOption {
  id: string;
  displayName: string;
}
export interface ChildSwitcherProps {
  students: readonly ChildSwitcherOption[];
  selectedStudentId: string;
  onSelect: (studentId: string) => void;
}

export function ChildSwitcher({
  students,
  selectedStudentId,
  onSelect,
}: ChildSwitcherProps): ReactNode {
  return (
    <RadioList
      label="Viewing meetings for"
      value={selectedStudentId}
      onChange={onSelect}
      orientation="horizontal"
    >
      {students.map((student) => (
        <RadioListItem key={student.id} label={student.displayName} value={student.id} />
      ))}
    </RadioList>
  );
}

export type Status = 'todo' | 'doing' | 'done';
export type Priority = 'Cao' | 'Trung bình' | 'Thấp';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type Tag = 'Công việc' | 'Học tập' | 'Cá nhân' | 'Sức khỏe';
export type Mode = 'week' | 'month' | 'quarter';
export type Tab = 'work' | 'finance';
export type StatusFilter = 'all' | Status | 'late';

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  priority: Priority;
  status: Status;
  tag: Tag;
  repeat: Repeat;
  goalId: string | null;
  subtasks: Subtask[];
  note: string;
}

export interface Goal {
  id: string;
  /** e.g. "week:2026-11-09", "month:2026-11", "quarter:2026-4" */
  periodKey: string;
  title: string;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  goals: Goal[];
  dark: boolean;
}

export type NewTask = Pick<Task, 'title' | 'date' | 'priority' | 'tag' | 'repeat'>;
export type TaskPatch = Partial<Omit<Task, 'id'>>;

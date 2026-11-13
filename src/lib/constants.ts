import type { Priority, Repeat, Status, Tag } from './types';

export const STATUS_LABEL: Record<Status, string> = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Đã xong' };
export const NEXT_STATUS: Record<Status, Status> = { todo: 'doing', doing: 'done', done: 'todo' };
export const STATUSES: Status[] = ['todo', 'doing', 'done'];

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: 'Không',
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
};
export const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];

export const PRIORITIES: Priority[] = ['Cao', 'Trung bình', 'Thấp'];
// Tạm thời chỉ dùng nhãn "Công việc". Danh sách đầy đủ: ['Công việc', 'Học tập', 'Cá nhân', 'Sức khỏe'].
export const TAGS: Tag[] = ['Công việc'];

export const TAG_COLOR: Record<Tag, string> = {
  'Công việc': '#3B82F6',
  'Học tập': '#F59E0B',
  'Cá nhân': '#A855F7',
  'Sức khỏe': '#10B981',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  Cao: '#EA580C',
  'Trung bình': '#6366F1',
  Thấp: '#94A3B8',
};

export const PRIORITY_CHIP: Record<Priority, string> = {
  Cao: 'bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
  'Trung bình': 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-200',
  Thấp: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export const STATUS_CHIP: Record<Status, { chip: string; dot: string }> = {
  todo: { chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
  doing: { chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', dot: 'bg-blue-600' },
  done: { chip: 'bg-green-100 text-green-800 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-green-600' },
};

export const CARD =
  'rounded-[18px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.04)] dark:border dark:border-[#232B45] dark:bg-[#151B2E] dark:shadow-none';

export const FIELD =
  'h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#2A3350] dark:bg-[#0F1527] dark:text-slate-100';

export const LABEL = 'flex flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400';

export const MUTED = 'text-slate-600 dark:text-slate-400';
export const FAINT = 'text-slate-500 dark:text-slate-400';
export const TRACK = 'bg-slate-100 dark:bg-[#232B44]';
export const ROW = 'bg-slate-50 dark:bg-[#1B2238]';
export const ROW_LATE = 'bg-red-50 dark:bg-[#3A1D24]';
export const SOFT = 'bg-indigo-50 text-indigo-800 dark:bg-[#2B2F63] dark:text-indigo-200';

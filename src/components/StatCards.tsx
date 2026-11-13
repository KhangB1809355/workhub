import { CARD, FAINT, MUTED, SOFT } from '@/lib/constants';
import type { DashboardView } from '@/lib/selectors';
import { Icon, type IconName } from './Icon';

function diff(n: number, prevShort: string) {
  if (n === 0) return `Bằng ${prevShort}`;
  return `${n > 0 ? '+' : '−'}${Math.abs(n)} việc so với ${prevShort}`;
}

export function StatCards({ stats, prevShort }: { stats: DashboardView['stats']; prevShort: string }) {
  const cards: { label: string; value: number; sub: string; icon: IconName; box: string; subClass?: string }[] = [
    { label: 'Tổng công việc', value: stats.total, sub: diff(stats.total - stats.prevTotal, prevShort), icon: 'list', box: SOFT },
    {
      label: 'Đã hoàn thành',
      value: stats.done,
      sub: diff(stats.done - stats.prevDone, prevShort),
      icon: 'checkCircle',
      box: 'bg-green-100 text-green-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      label: 'Đang làm',
      value: stats.doing,
      sub: `${stats.todo} việc chưa bắt đầu`,
      icon: 'clock',
      box: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      label: 'Quá hạn',
      value: stats.late,
      sub: stats.late ? 'Cần xử lý sớm' : 'Không có việc trễ',
      icon: 'alert',
      box: 'bg-red-50 text-red-700 dark:bg-[#3A1D24] dark:text-red-300',
      subClass: stats.late ? 'font-semibold text-red-700 dark:text-red-300' : undefined,
    },
  ];

  return (
    <section aria-label="Số liệu trong kỳ" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`${CARD} flex items-center gap-3.5 p-4.5`}>
          <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${c.box}`}>
            <Icon name={c.icon} className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={`text-[13px] font-medium ${MUTED}`}>{c.label}</span>
            <span className="text-[26px] font-extrabold leading-tight">{c.value}</span>
            <span className={`text-xs ${c.subClass ?? FAINT}`}>{c.sub}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

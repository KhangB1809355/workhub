const PATHS = {
  check: 'M5 12l5 5L20 7',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  subtasks: 'M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  checkCircle: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  empty: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8 12h8',
  menu: 'M4 6h16M4 12h16M4 18h16',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  calendarWeek: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M7 14h10',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  wallet: 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2M3 6v13a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.7',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  maximize: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  minimize: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-4 w-4', strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

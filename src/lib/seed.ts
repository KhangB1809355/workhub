import { addDays, periodKey } from './date';
import type { Goal, Priority, Repeat, Status, Tag, Task } from './types';

type Row = [offset: number, title: string, priority: Priority, status: Status, tag: Tag, repeat?: Repeat, goal?: string, subs?: [string, boolean][]];

/** Sample data placed relative to today so the dashboard always looks alive on first run. */
export function makeSample(today: string): { tasks: Task[]; goals: Goal[] } {
  const goals: Goal[] = [
    { id: 'g-q1', periodKey: periodKey('quarter', today), title: 'Hoàn thiện app WorkHub bản 1.0' },
    { id: 'g-q2', periodKey: periodKey('quarter', today), title: 'Ra mắt sản phẩm trong quý' },
    { id: 'g-q3', periodKey: periodKey('quarter', today), title: 'Học xong TypeScript nâng cao' },
    { id: 'g-m1', periodKey: periodKey('month', today), title: 'Đọc xong 2 cuốn sách' },
    { id: 'g-m2', periodKey: periodKey('month', today), title: 'Không còn việc quá hạn vào cuối tháng' },
    { id: 'g-w1', periodKey: periodKey('week', today), title: 'Xử lý hết hóa đơn tồn' },
  ];

  const rows: Row[] = [
    [-53, 'Lập kế hoạch quý', 'Cao', 'done', 'Công việc'],
    [-45, 'Tổng kết quý trước', 'Trung bình', 'done', 'Công việc'],
    [-42, 'Họp khởi động dự án mới', 'Cao', 'done', 'Công việc', 'none', 'g-q2'],
    [-39, 'Viết đặc tả tính năng đăng nhập', 'Trung bình', 'done', 'Công việc', 'none', 'g-q1'],
    [-36, 'Đọc sách Clean Code chương 1–3', 'Thấp', 'done', 'Học tập', 'none', 'g-m1'],
    [-31, 'Thiết kế giao diện trang chủ', 'Cao', 'done', 'Công việc', 'none', 'g-q1'],
    [-24, 'Hoàn thành module thanh toán', 'Cao', 'done', 'Công việc', 'none', 'g-q1'],
    [-22, 'Học TypeScript nâng cao – phần 1', 'Trung bình', 'todo', 'Học tập', 'none', 'g-q3'],
    [-17, 'Review code cho đồng nghiệp', 'Trung bình', 'done', 'Công việc'],
    [-14, 'Báo cáo tháng', 'Cao', 'done', 'Công việc'],
    [-10, 'Sửa lỗi hiển thị trên điện thoại', 'Cao', 'done', 'Công việc', 'none', 'g-q1'],
    [-8, 'Chuẩn bị tài liệu họp khách hàng', 'Trung bình', 'done', 'Công việc'],
    [-7, 'Đặt lịch khám răng', 'Thấp', 'todo', 'Sức khỏe'],
    [-4, 'Viết tài liệu API', 'Trung bình', 'done', 'Công việc', 'none', 'g-q1'],
    [-1, 'Gửi hóa đơn cho khách hàng', 'Cao', 'todo', 'Công việc', 'none', 'g-w1'],
    [0, 'Hoàn thiện báo cáo tuần', 'Cao', 'doing', 'Công việc', 'none', 'g-q1', [['Thu thập số liệu', true], ['Vẽ biểu đồ', true], ['Viết nhận xét', false], ['Gửi quản lý duyệt', false]]],
    [0, 'Ôn tập chương 4 – TypeScript', 'Trung bình', 'todo', 'Học tập', 'none', 'g-q3'],
    [1, 'Đọc sách Atomic Habits – 50 trang', 'Thấp', 'todo', 'Học tập', 'none', 'g-m1'],
    [2, 'Đóng tiền điện nước', 'Thấp', 'todo', 'Cá nhân', 'monthly'],
    [3, 'Chạy bộ 5 km', 'Thấp', 'todo', 'Sức khỏe', 'weekly'],
    [4, 'Chuẩn bị slide thuyết trình', 'Cao', 'doing', 'Công việc', 'none', 'g-q2', [['Lên dàn ý', true], ['Thiết kế slide', false], ['Tập nói', false]]],
    [6, 'Kiểm thử tính năng mới', 'Trung bình', 'todo', 'Công việc', 'none', 'g-q1'],
    [11, 'Lên ngân sách tháng sau', 'Trung bình', 'todo', 'Cá nhân'],
    [14, 'Báo cáo tháng gửi quản lý', 'Cao', 'todo', 'Công việc'],
    [19, 'Cập nhật hồ sơ năng lực', 'Thấp', 'todo', 'Cá nhân'],
    [25, 'Phát hành phiên bản 1.0', 'Cao', 'todo', 'Công việc', 'none', 'g-q2'],
    [32, 'Mua quà cho gia đình', 'Thấp', 'todo', 'Cá nhân'],
    [39, 'Tổng kết quý', 'Cao', 'todo', 'Công việc'],
  ];

  const tasks: Task[] = rows.map(([offset, title, priority, status, tag, repeat = 'none', goal, subs = []], i) => ({
    id: `s-${i + 1}`,
    title,
    date: addDays(today, offset),
    priority,
    status,
    tag,
    repeat,
    goalId: goal ?? null,
    subtasks: subs.map(([text, done], j) => ({ id: `s-${i + 1}-${j + 1}`, text, done })),
    note: '',
  }));

  return { tasks, goals };
}

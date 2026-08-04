/**
 * 店员提醒气泡（店员互动提升 模块三 3.1）
 * 店员头像（30×30 圆形）+ 宣纸色气泡（三角尖指向头像）+ 内容区（店员话 + 加粗建议）
 * + 「照办」（竹青主色）/「知道了」（灰色）按钮。
 * 高优先级=朱砂红边框 / 中=描金 / 低=竹青；滑出+淡入动画 300ms。
 * 纯展示组件：不持有 store，由 StaffReminderHost 传入数据与回调。
 */
'use client';
import { ANCIENT } from '@/theme/tokens';
import type { ReminderPriority, StaffReminder } from '@/types/tang-reminders';

/** 店员默认头像（按 staffId/类型） */
export function staffAvatar(staffId: string): string {
  switch (staffId) {
    case 'a_zhao':
      return '👦';
    case 'accountant':
      return '🧮';
    case 'chef':
      return '🍳';
    case 'tailor':
      return '🪡';
    case 'pharmacist':
      return '🌿';
    case 'guard':
      return '🛡️';
    default:
      return '🧑';
  }
}

/** 优先级边框色：high=朱砂 / medium=描金 / low=竹青 */
export function reminderBorder(priority: ReminderPriority): string {
  if (priority === 'high') return ANCIENT.accent;
  if (priority === 'medium') return ANCIENT.gold;
  return ANCIENT.primary;
}

export function StaffReminderBubble({
  reminder,
  onAdopt,
  onDismiss,
}: {
  reminder: StaffReminder;
  onAdopt: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  const border = reminderBorder(reminder.priority);
  return (
    <div
      className="flex items-start gap-2 rounded-xl p-2"
      style={{
        backgroundColor: ANCIENT.card,
        border: `2px solid ${border}`,
        animation: 'staff-reminder-in 0.3s ease-out',
        boxShadow: `0 4px 16px rgba(60,40,20,0.15)`,
      }}
    >
      {/* 头像（30×30 圆形） */}
      <div
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}
        aria-hidden
      >
        {staffAvatar(reminder.staffId)}
      </div>
      {/* 气泡（三角尖指向头像） */}
      <div className="relative min-w-0 flex-1">
        <span
          className="absolute -left-1 top-3 h-2 w-2 rotate-45"
          style={{ backgroundColor: ANCIENT.card, borderLeft: `2px solid ${border}`, borderBottom: `2px solid ${border}` }}
        />
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background }}>
          <div className="text-[11px] font-bold tracking-widest" style={{ color: border }}>
            {reminder.staffName} · {reminder.condition}
          </div>
          <p className="mt-1 text-xs leading-5" style={{ color: ANCIENT.text }}>{reminder.content}</p>
          <p className="mt-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>
            建议：{reminder.suggestion}
          </p>
        </div>
        <div className="mt-1.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAdopt}
            className="rounded px-3 py-1 text-xs font-bold tracking-widest transition-transform active:scale-[0.97]"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            照办
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-3 py-1 text-xs tracking-widest"
            style={{ backgroundColor: 'transparent', color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

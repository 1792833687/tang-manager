/**
 * 店员提醒宿主（店员互动提升 模块三 3.2 / 模块四 展示）
 * 渲染当前活跃提醒（最多 2 条，不同店员可同时显示）+ 每日清晨问候 / 打烊报告横幅。
 * 展示位置：挂载在主内容区顶部（清晨/打烊/面板阶段），接待阶段位于对话区上方。
 * 全部 ANCIENT 令牌；采纳/忽略/关闭走 store action。
 */
'use client';
import { useEffect, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { generateAiReminderText } from '@/systems/tang-ai-generator';
import { StaffReminderBubble, staffAvatar } from './staff-reminder-bubble';
import type { StaffReminder } from '@/types/tang-reminders';

/** AI 润色提醒气泡（v1.1 模块五 5.1：AI 优先，模板兜底；best-effort 不阻塞） */
function AiReminderBubble({
  reminder,
  onAdopt,
  onDismiss,
}: {
  reminder: StaffReminder;
  onAdopt: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  const [text, setText] = useState<string>(reminder.content);
  useEffect(() => {
    let cancelled = false;
    generateAiReminderText(reminder.staffName, reminder.content, reminder.suggestion)
      .then((res) => {
        if (!cancelled && res.source === 'ai' && res.text) setText(res.text);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder.id]);
  return <StaffReminderBubble reminder={{ ...reminder, content: text }} onAdopt={onAdopt} onDismiss={onDismiss} />;
}
export function StaffReminderHost(): React.ReactElement | null {
  const reminders = useTangManagerStore((s) => s.staffReminders ?? []);
  const greeting = useTangManagerStore((s) => s.dailyStaffGreeting);
  const report = useTangManagerStore((s) => s.dailyStaffReport);
  const applyReminder = useTangManagerStore((s) => s.applyReminder);
  const dismissReminder = useTangManagerStore((s) => s.dismissReminder);
  const clearReminders = useTangManagerStore((s) => s.clearReminders);
  const dismissGreeting = useTangManagerStore((s) => s.setDailyStaffGreeting);
  const dismissReport = useTangManagerStore((s) => s.setDailyStaffReport);

  if (reminders.length === 0 && !greeting && !report) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* 员工主动问候（模块四 4.1：每日清晨开篇画面） */}
      {greeting && (
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, animation: 'staff-reminder-in 0.3s ease-out' }}>
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-base" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }} aria-hidden>
            {staffAvatar(greeting.staffId)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-widest" style={{ color: ANCIENT.gold }}>{greeting.staffName} · 晨安</div>
            <p className="mt-1 text-xs leading-5" style={{ color: ANCIENT.text }}>{greeting.content}</p>
          </div>
          <button type="button" onClick={() => dismissGreeting(null)} className="shrink-0 rounded px-2 py-1 text-xs" style={{ color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            知道了
          </button>
        </div>
      )}
      {/* 打烊员工报告（模块四 4.2） */}
      {report && (
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${report.band === 'positive' ? ANCIENT.primary : report.band === 'negative' ? ANCIENT.accent : ANCIENT.border}`, animation: 'staff-reminder-in 0.3s ease-out' }}>
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-base" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }} aria-hidden>
            {staffAvatar(report.staffId)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>{report.staffName} · 打烊禀报</div>
            <p className="mt-1 text-xs leading-5" style={{ color: ANCIENT.text }}>{report.content}</p>
          </div>
          <button type="button" onClick={() => dismissReport(null)} className="shrink-0 rounded px-2 py-1 text-xs" style={{ color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            知道了
          </button>
        </div>
      )}
      {/* 活跃店员提醒（最多 2 条） */}
      {reminders.slice(0, 2).map((r) => (
        <AiReminderBubble
          key={r.id}
          reminder={r}
          onAdopt={() => applyReminder(r.id, true)}
          onDismiss={() => dismissReminder(r.id)}
        />
      ))}
      {reminders.length > 0 && (
        <button type="button" onClick={clearReminders} className="self-end rounded px-2 py-0.5 text-[11px]" style={{ color: ANCIENT.secondary }}>
          暂不理会（清空提醒）
        </button>
      )}
      <style>{`@keyframes staff-reminder-in { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </div>
  );
}

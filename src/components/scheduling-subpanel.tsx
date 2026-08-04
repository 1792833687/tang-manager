/**
 * 排班子面板（TANG-SOC-001 模块四；scheduling-subpanel）
 * 「轮值：唐代店铺已分早市晚市，伙计分班轮值，早班辰时到岗，晚班酉时方归。」
 * 选员工 → 7 日视图四选项切换（早/晚/全/休）→ 过劳红警 → 自动排班 → 确认轮值。
 * 全部 ANCIENT 令牌，古风风格；≤150 行。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { EmployeeShift } from '@/types/tang-manager';
import { SHIFT_LABEL, OVERWORK_DAYS, getShiftCoverage } from '@/systems/tang-scheduling';
import { pushActionFeedback } from './action-feedback';
import { ModalContainer } from './modal-container';

/** 排班档位配色 */
const SHIFT_COLOR: Record<EmployeeShift, string> = {
  morning: '#4A7C59',
  evening: '#3B6FB6',
  full: '#8B6F47',
  rest: '#D4A843',
};

export function SchedulingSubpanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const employees = useTangManagerStore((s) => s.employees);
  const day = useTangManagerStore((s) => s.day);
  const assignShift = useTangManagerStore((s) => s.assignShift);
  const autoSchedule = useTangManagerStore((s) => s.autoSchedule);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingShift, setPendingShift] = useState<EmployeeShift>('morning');
  const [notice, setNotice] = useState('');

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const coverage = getShiftCoverage(employees, day);
  const overworked = employees.filter((e) => (e.consecutiveWorkDays ?? 0) >= OVERWORK_DAYS && e.shift === 'full');

  const confirm = (): void => {
    if (!selected) return setNotice('先选一位伙计');
    const res = assignShift(selected.id, pendingShift);
    setNotice(res ? `已为${selected.name}安排${SHIFT_LABEL[pendingShift]}。` : `${selected.name}学艺中，不可排班（只能休沐）`);
    if (res) pushActionFeedback('排班已更新', 'success');
  };

  return (
    <ModalContainer title="安排轮值" onClose={onClose}>
      <div className="flex flex-col gap-2">
      {/* 7 日排班日历（横滑） */}
      <div className="flex gap-1 overflow-x-auto py-1" style={{ scrollbarWidth: 'thin' }}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex w-9 shrink-0 flex-col items-center rounded border py-1" style={{ borderColor: ANCIENT.border, backgroundColor: ANCIENT.card }}>
            <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>第{(day + i - 1) % 30 + 1}日</span>
            <span className="text-[11px] font-bold" style={{ color: ANCIENT.text }}>{day + i}</span>
          </div>
        ))}
      </div>

      {/* 过劳红警 */}
      {overworked.length > 0 && (
        <p className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.accent}`, color: ANCIENT.accent }}>
          ⚠ 过劳预警：{overworked.map((e) => e.name).join('、')} 已连续全天多日，恐要崩溃。
        </p>
      )}
      {coverage.morningShortage && <p className="text-[11px]" style={{ color: ANCIENT.accent }}>⚠ 早班缺人：上午客人耐心下降加速。</p>}
      {coverage.eveningShortage && <p className="text-[11px]" style={{ color: ANCIENT.accent }}>⚠ 晚班缺人：下午接待效率 -20%。</p>}

      {/* 选员工 */}
      <select
        value={selectedId ?? ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full rounded border px-2 py-1 text-sm"
        style={{ borderColor: ANCIENT.border, backgroundColor: ANCIENT.card, color: ANCIENT.text }}
      >
        <option value="">—— 选一位伙计 ——</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.name}（{SHIFT_LABEL[e.shift ?? 'full']}）</option>
        ))}
      </select>

      {/* 四选项切换 */}
      <div className="grid grid-cols-4 gap-1">
        {(Object.keys(SHIFT_LABEL) as EmployeeShift[]).map((sh) => (
          <button
            key={sh}
            type="button"
            onClick={() => setPendingShift(sh)}
            className="rounded px-1 py-1.5 text-xs font-bold transition-opacity"
            style={{
              backgroundColor: pendingShift === sh ? SHIFT_COLOR[sh] : ANCIENT.card,
              color: pendingShift === sh ? '#FFF' : ANCIENT.text,
              border: `1px solid ${SHIFT_COLOR[sh]}`,
            }}
          >
            {SHIFT_LABEL[sh]}
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.secondary }}>
          {selected.name} · 连续工作 {selected.consecutiveWorkDays ?? 0} 日
          {((selected.trainingCompletionDay ?? 0) > day ? ` · 学艺中（至第${selected.trainingCompletionDay}日）` : '')}
          {selected.mentorId ? ' · 已有师门' : ''}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1">
        <button type="button" onClick={confirm} className="rounded px-2 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.primary }}>确认轮值</button>
        <button type="button" onClick={() => { autoSchedule(); setNotice('已按建议自动排班（满意度高者全天、技能高者覆盖高峰、每周至少休沐一日）。'); pushActionFeedback('排班已更新', 'success'); }} className="rounded px-2 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.secondary }}>自动排班</button>
      </div>

      {notice && (
        <p className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.accent }}>{notice}</p>
      )}
      </div>
    </ModalContainer>
  );
}

/** 排班概览（顶部条复用；导出供 staff-panel） */
export function ScheduleOverviewBar(): React.ReactElement {
  const employees = useTangManagerStore((s) => s.employees);
  const day = useTangManagerStore((s) => s.day);
  const coverage = getShiftCoverage(employees, day);
  const overworked = employees.filter((e) => (e.consecutiveWorkDays ?? 0) >= OVERWORK_DAYS && e.shift === 'full');
  return (
    <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
      {([
        ['早', SHIFT_COLOR.morning, coverage.morning],
        ['晚', SHIFT_COLOR.evening, coverage.evening],
        ['休', SHIFT_COLOR.rest, employees.filter((e) => e.shift === 'rest').length],
        ['过劳', overworked.length > 0 ? ANCIENT.accent : ANCIENT.secondary, overworked.length],
      ] as const).map(([label, color, value]) => (
        <div key={label} className="rounded px-1 py-1" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${overworked.length > 0 && label === '过劳' ? ANCIENT.accent : ANCIENT.border}` }}>
          <span style={{ color }}>{label}</span> <b style={{ color: ANCIENT.text }}>{value}</b>
        </div>
      ))}
    </div>
  );
}

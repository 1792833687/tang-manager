/**
 * 伙计面板 — 团队管理中枢（TANG-SOC-001 模块四重写）
 * 「轮值 / 交情 / 学艺」三合一：排班概览条 + 7 日排班日历 + 员工卡片 +
 * 简易人际关系图 + 底部三按钮（安排轮值 / 查看交情图 / 送伙计学艺）。
 * 阿昭顶部保留；员工卡片紧凑（头像+姓名+职位+状态标签+快捷操作）。
 * 子面板：scheduling-subpanel / relations-subpanel / training-subpanel（各自 ≤150 行）。
 * 全部 ANCIENT 令牌 + NpcPortrait，古风风格；≤200 行。
 */
'use client';
import { useState } from 'react';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { Employee, EmployeeSkillType } from '@/types/tang-manager';
import { SKILL_ICON_MAP } from '@/config/tang-skill-icons';
import { pushActionFeedback } from './action-feedback';
import { AncientCard } from './ancient-card';
import { NpcPortrait } from './npc-portrait';
import { DangerConfirm } from './danger-confirm';
import { ScheduleOverviewBar } from './scheduling-subpanel';
import { SchedulingSubpanel } from './scheduling-subpanel';
import { RelationsSubpanel } from './relations-subpanel';
import { TrainingSubpanel } from './training-subpanel';

/** 员工类型中文名 */
const EMPLOYEE_TYPE_LABEL: Record<Employee['type'], string> = {
  waiter: '小二',
  chef: '厨师',
  tailor: '裁缝',
  pharmacist: '药师',
  accountant: '账房',
  guard: '护卫',
};

/** 技能类别徽标 */
const SKILL_BADGE: Record<EmployeeSkillType, { text: string; color: string }> = {
  quality: { text: '品', color: '#4A7C59' },
  efficiency: { text: '效', color: '#8B6F47' },
  cost: { text: '本', color: '#8B5E3C' },
  special: { text: '特', color: '#D4A843' },
};

/** 排班标签 */
const SHIFT_TAG: Record<string, { text: string; color: string }> = {
  morning: { text: '早班', color: '#4A7C59' },
  evening: { text: '晚班', color: '#3B6FB6' },
  full: { text: '全天', color: '#8B6F47' },
  rest: { text: '休沐', color: '#D4A843' },
};

function shiftTag(shift: string | undefined): { text: string; color: string } {
  return SHIFT_TAG[shift ?? 'full'] ?? SHIFT_TAG.full!;
}

type SubPanel = 'none' | 'scheduling' | 'relations' | 'training';

/** 员工卡片（紧凑） */
function EmployeeCard({ emp, onAction }: { emp: Employee; onAction: (action: 'schedule' | 'train' | 'praise' | 'fire') => void }): React.ReactElement {
  const player = useTangManagerStore((s) => s.player);
  const shift = shiftTag(emp.shift);
  // 阿昭不在员工列表内（顶部独立卡）；此处防御：若混入则以阿昭名识别，绝不显示遣散
  const isAzhao = emp.id === 'a-zhao' || emp.name === '阿昭';
  const status = emp.restToday    ? { text: '休假中', color: ANCIENT.gold }
    : ((emp.trainingCompletionDay ?? 0) > 0
        ? { text: '学艺中', color: ANCIENT.accent }
        : { text: '在岗', color: ANCIENT.border });
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white" style={{ backgroundColor: ANCIENT.secondary }}>
          {EMPLOYEE_TYPE_LABEL[emp.type].charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold" style={{ color: ANCIENT.text }}>{emp.name}</span>
            <span className="shrink-0 rounded px-1 py-px text-[10px]" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>{EMPLOYEE_TYPE_LABEL[emp.type]}</span>
            <span className="shrink-0 rounded px-1 py-px text-[10px]" style={{ backgroundColor: shift.color, color: '#FFF' }}>{shift.text}</span>
            <span className="shrink-0 rounded px-1 py-px text-[10px]" style={{ backgroundColor: status.color, color: '#FFF' }}>{status.text}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: ANCIENT.secondary }}>
            {emp.skills.slice(0, 3).map((sk) => {
              const badge = SKILL_BADGE[sk.type];
              const iconFile = SKILL_ICON_MAP[sk.id];
              return (
                <span key={sk.id} title={sk.name} className="flex items-center gap-0.5 rounded px-1" style={{ backgroundColor: badge.color, color: '#FFF' }}>
                  {iconFile !== undefined && (
                    <img
                      src={withBase(`/images/icons/skills/${iconFile}.png`)}
                      alt=""
                      aria-hidden
                      className="h-3 w-3"
                    />
                  )}
                  <span>{badge.text}</span>
                </span>
              );
            })}
            <span className="ml-auto">月钱 {emp.salary} · 满意 {emp.satisfaction}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5 text-[10px]">
          <button type="button" onClick={() => onAction('schedule')} className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: ANCIENT.primary }}>排班</button>
          <button type="button" onClick={() => onAction('train')} className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: ANCIENT.gold }}>学艺</button>
          <button type="button" onClick={() => onAction('praise')} className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: ANCIENT.secondary }}>表彰</button>
          {/* 遣散（内容深化 TANG-CONT-B 模块一）：暗红朱砂 #C0392B；阿昭不显示 */}
          {!isAzhao && (
            <button type="button" onClick={() => onAction('fire')} className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: ANCIENT.accent }}>遣散</button>
          )}
        </div>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
        <div style={{ width: `${Math.min(100, Math.max(0, emp.satisfaction))}%`, height: '100%', backgroundColor: ANCIENT.primary }} />
      </div>
    </div>
  );
}

/** 伙计面板：阿昭顶部 + 排班概览 + 员工列表 + 三按钮 + 子面板 */
export function StaffPanel(): React.ReactElement {
  const player = useTangManagerStore((s) => s.player);
  const xiaoerFavor = useTangManagerStore((s) => s.xiaoerFavor);
  const xiaoerSatisfaction = useTangManagerStore((s) => s.xiaoerSatisfaction);
  const xiaoerGone = useTangManagerStore((s) => s.xiaoerGone);
  const employees = useTangManagerStore((s) => s.employees);
  const maxEmployees = useTangManagerStore((s) => s.maxEmployees);
  const praiseEmployee = useTangManagerStore((s) => s.praiseEmployee);
  const azhaoRaiseSalary = useTangManagerStore((s) => s.azhaoRaiseSalary);
  const fireEmployee = useTangManagerStore((s) => s.fireEmployee);
  const [sub, setSub] = useState<SubPanel>('none');
  const [fireTarget, setFireTarget] = useState<Employee | null>(null);

  const azhaoGender = player?.gender === 'female' ? '男' : '女';

  const quickAction = (empId: string, action: 'schedule' | 'train' | 'praise' | 'fire'): void => {
    if (action === 'praise') {
      praiseEmployee(empId);
      return;
    }
    if (action === 'fire') {
      const target = employees.find((e) => e.id === empId);
      if (target) setFireTarget(target);
      return;
    }
    setSub(action === 'schedule' ? 'scheduling' : 'training');
  };

  return (
    <div className="flex flex-col gap-2">
      <AncientCard title={xiaoerGone ? '伙计 · 阿昭（已离开）' : '伙计 · 阿昭'}>
        <div className="flex items-center gap-3">
          <NpcPortrait npc="a-zhao" playerGender={player?.gender ?? 'male'} className="h-10 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-bold" style={{ color: ANCIENT.text }}>阿昭</span>
              <span className="rounded px-1 py-px text-[10px]" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>小二</span>
              <span className="rounded px-1 py-px text-[10px]" style={{ backgroundColor: xiaoerGone ? ANCIENT.accent : ANCIENT.primary, color: '#FFF' }}>{xiaoerGone ? '已离开' : '在岗'}</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: ANCIENT.secondary }}>
              <span className="flex-1">满意 {xiaoerSatisfaction}%</span>
              <span className="flex-1">好感 {xiaoerFavor}%</span>
            </div>
            {!xiaoerGone && (
              <button
                type="button"
                onClick={() => {
                  const ok = azhaoRaiseSalary();
                  pushActionFeedback(ok ? '阿昭的月钱加了一份，笑逐颜开' : '手头拮据，暂且加不起月钱', ok ? 'success' : 'warning');
                }}
                className="mt-1.5 w-full rounded px-2 py-1 text-[11px] font-bold tracking-widest"
                style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
              >
                给阿昭加月钱（5两）
              </button>
            )}
          </div>
        </div>
      </AncientCard>

      {/* 排班概览条 */}
      <ScheduleOverviewBar />

      {/* 员工列表 */}
      <AncientCard title={`员工（${employees.length}/${maxEmployees}）`}>
        {employees.length === 0 ? (
          <p className="py-1 text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
            暂无员工。每日接待完客人后，可在「市井闲逛 · 市场招聘」里物色新伙计。
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {employees.map((emp) => (
              <EmployeeCard key={emp.id} emp={emp} onAction={(a) => quickAction(emp.id, a)} />
            ))}
          </div>
        )}
      </AncientCard>

      {/* 底部三按钮 */}
      <div className="grid grid-cols-3 gap-1">
        <button type="button" onClick={() => setSub('scheduling')} className="rounded px-1 py-2 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.primary }}>
          安排轮值
        </button>
        <button type="button" onClick={() => setSub('relations')} className="rounded px-1 py-2 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.secondary }}>
          查看交情图
        </button>
        <button type="button" onClick={() => setSub('training')} className="rounded px-1 py-2 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.gold }}>
          送伙计学艺
        </button>
      </div>

      {/* 二级弹窗：排班 / 交情图 / 学艺（v1.0 统一 modal-container；不替换主面板） */}
      {sub === 'scheduling' && <SchedulingSubpanel onClose={() => setSub('none')} />}
      {sub === 'relations' && <RelationsSubpanel onClose={() => setSub('none')} />}
      {sub === 'training' && <TrainingSubpanel onClose={() => setSub('none')} />}

      {/* 遣散员工二次确认（内容深化 TANG-CONT-B 模块一；朱砂红风险提示） */}
      {fireTarget !== null && (
        <DangerConfirm
          title={`遣散${fireTarget.name}`}
          risk="此人离店后将不复返，未付月钱照常结算。其他伙计见此亦会心寒（满意度-2）。"
          confirmLabel="确认遣散"
          onConfirm={() => {
            fireEmployee(fireTarget.id);
            setFireTarget(null);
            // 红色警示浮层（内容深化模块三）
            pushActionFeedback('已遣散', 'warning');
          }}
          onClose={() => setFireTarget(null)}
        />
      )}
    </div>
  );
}

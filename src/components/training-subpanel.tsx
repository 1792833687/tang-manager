/**
 * 学艺子面板（TANG-SOC-001 模块四；training-subpanel）
 * 「学艺：花费束脩请名师指点，可精进技艺或习得新技。」
 * 「授业：送伙计去师傅处学手艺，耗时数日，学成后技艺精进。」
 * 选员工 → 选技能 → 费用周期 → 拜师选项 → 送他去学艺。全部 ANCIENT 令牌；≤150 行。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { EmployeeSkillType } from '@/types/tang-manager';
import { skillsForType } from '@/config/tang-employee-skills';
import { TRAINING_BASE_COST, TRAINING_COST_PER_SKILL, findMaster } from '@/systems/tang-training';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { ModalContainer } from './modal-container';

const SKILL_TYPE_LABEL: Record<EmployeeSkillType, string> = {
  quality: '品质', efficiency: '效率', cost: '成本', special: '特殊',
};

export function TrainingSubpanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const employees = useTangManagerStore((s) => s.employees);
  const day = useTangManagerStore((s) => s.day);
  const sendForTraining = useTangManagerStore((s) => s.sendForTraining);
  const findMasterAction = useTangManagerStore((s) => s.findMaster);
  const unlockedLayers = useTangManagerStore((s) => s.unlockedLayers);
  const shopType = useTangManagerStore((s) => s.shopType);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [skillType, setSkillType] = useState<EmployeeSkillType>('quality');
  const [notice, setNotice] = useState('');

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const pool = skillsForType(selected?.type ?? 'waiter').filter((s) => s.type === skillType);
  const cost = selected ? TRAINING_BASE_COST + (selected.skills?.length ?? 0) * TRAINING_COST_PER_SKILL : 0;

  const confirm = (): void => {
    if (!selected) return setNotice('先选一位伙计');
    if (!selectedSkill) return setNotice('先选要学的技艺');
    const res = sendForTraining(selected.id, selectedSkill);
    setNotice(res ? res.content : '学艺失败');
    if (res) pushActionFeedback('学艺完成', 'success');
  };

  const goMaster = (): void => {
    const res = findMaster(skillType, unlockedLayers ?? [], shopType ?? 'jiulou', Math.random);
    if (!res.ok) return setNotice(res.reason ?? '拜师无门');
    const storeRes = findMasterAction(skillType);
    setNotice(storeRes ? storeRes.content : res.reason ?? '拜师失败');
  };

  return (
    <ModalContainer title="送伙计学艺" onClose={onClose}>
      <div className="flex flex-col gap-2">
      <div className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.secondary }}>
        束脩 = {formatMoney(TRAINING_BASE_COST)} + 每会一门技艺 {formatMoney(TRAINING_COST_PER_SKILL)}；学成效果×1.5 或解锁新技；5% 失败（满意度-10）。
      </div>

      <select
        value={selectedId ?? ''}
        onChange={(e) => { setSelectedId(e.target.value || null); setSelectedSkill(''); }}
        className="w-full rounded border px-2 py-1 text-sm"
        style={{ borderColor: ANCIENT.border, backgroundColor: ANCIENT.card, color: ANCIENT.text }}
      >
        <option value="">—— 选一位伙计 ——</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.name}（月钱 {formatMoney(e.salary)}）{((e.trainingCompletionDay ?? 0) > day ? ' · 学艺中' : '')}</option>
        ))}
      </select>

      {selected && (
        <div className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.secondary }}>
          会 {selected.skills.length} 门技艺 · 本次束脩约 {formatMoney(cost)}{selected.mentorId ? ' · 已有师门' : ''}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1">
        {(Object.keys(SKILL_TYPE_LABEL) as EmployeeSkillType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setSkillType(t); setSelectedSkill(''); }}
            className="rounded px-1 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: skillType === t ? ANCIENT.secondary : ANCIENT.card,
              color: skillType === t ? '#FFF' : ANCIENT.text,
              border: `1px solid ${ANCIENT.border}`,
            }}
          >
            {SKILL_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {pool.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedSkill(s.id)}
            className="rounded px-1.5 py-1 text-[11px]"
            style={{
              backgroundColor: selectedSkill === s.id ? ANCIENT.primary : ANCIENT.card,
              color: selectedSkill === s.id ? '#FFF' : ANCIENT.text,
              border: `1px solid ${ANCIENT.border}`,
            }}
          >
            {s.name}
          </button>
        ))}
        {pool.length === 0 && <span className="text-[11px]" style={{ color: ANCIENT.secondary }}>该类别暂无此店型适用技能</span>}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button type="button" onClick={confirm} className="rounded px-2 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.primary }}>送他去学艺</button>
        <button type="button" onClick={goMaster} className="rounded px-2 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.gold }}>拜师授业（200+ 两）</button>
      </div>

      {notice && (
        <p className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.accent }}>{notice}</p>
      )}
      </div>
    </ModalContainer>
  );
}

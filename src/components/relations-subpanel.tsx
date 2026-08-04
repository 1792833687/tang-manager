/**
 * 交情图子面板（TANG-SOC-001 模块四；relations-subpanel）
 * 「交情：伙计之间的私下情谊，有和睦亦有嫌隙，影响店内氛围。」
 * 简易人际关系图：节点列表 + 连线列表渲染（绿和睦/蓝竞争/红矛盾/金师徒）。
 * 全部 ANCIENT 令牌，古风风格；≤150 行。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { EmployeeRelationship, RelationshipType } from '@/types/tang-manager';
import { RELATION_COLOR, RELATION_LABEL } from '@/systems/tang-employee-relations';
import { ModalContainer } from './modal-container';

/** 关系中文名 + 色（导出供 staff-panel 顶部） */
export { RELATION_COLOR, RELATION_LABEL };

function RelLine({ rel, fromName, toName }: { rel: EmployeeRelationship; fromName: string; toName: string }): React.ReactElement {
  return (
    <li className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${RELATION_COLOR[rel.type]}` }}>
      <span className="font-bold" style={{ color: ANCIENT.text }}>{fromName}</span>
      <span className="rounded px-1 text-[10px] text-white" style={{ backgroundColor: RELATION_COLOR[rel.type] }}>{RELATION_LABEL[rel.type]} {rel.level}</span>
      <span className="font-bold" style={{ color: ANCIENT.text }}>{toName}</span>
      <span className="ml-auto truncate" style={{ color: ANCIENT.secondary }}>{rel.description}</span>
    </li>
  );
}

export function RelationsSubpanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const employees = useTangManagerStore((s) => s.employees);
  const evolveRelations = useTangManagerStore((s) => s.evolveRelations);
  const establishMentorship = useTangManagerStore((s) => s.establishMentorship);

  const nameOf = (id: string): string => {
    if (id === 'a-zhao') return '阿昭';
    return employees.find((e) => e.id === id)?.name ?? '未知';
  };

  // 连线列表：从员工视角渲染（from=该员工，to=目标），去重对称关系
  const seen = new Set<string>();
  const lines: { rel: EmployeeRelationship; from: string; to: string }[] = [];
  for (const emp of employees) {
    for (const rel of emp.relationships ?? []) {
      const symmetricKey = [emp.id, rel.targetId].sort().join('|');
      if (rel.type === 'mentor') {
        // 师徒保留方向：徒弟 → 师傅
        lines.push({ rel, from: emp.name, to: nameOf(rel.targetId) });
        continue;
      }
      if (seen.has(symmetricKey)) continue;
      seen.add(symmetricKey);
      lines.push({ rel, from: emp.name, to: nameOf(rel.targetId) });
    }
  }

  return (
    <ModalContainer title="查看交情图" onClose={onClose}>
      <div className="flex flex-col gap-2">
      <div className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.secondary }}>
        绿=和睦 · 蓝=竞争 · 红=矛盾 · 金=师徒。每日打烊自动演化。
      </div>

      {/* 节点列表 */}
      <div className="flex flex-wrap gap-1">
        {employees.map((e) => (
          <span key={e.id} className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: ANCIENT.secondary, color: '#FFF' }}>
            {e.name}
          </span>
        ))}
        <span className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}>
          阿昭
        </span>
      </div>

      {/* 连线列表 */}
      <ul className="flex flex-col gap-1">
        {lines.length === 0 && (
          <li className="text-[11px]" style={{ color: ANCIENT.secondary }}>店内暂无人际交情。</li>
        )}
        {lines.map((l, idx) => (
          <RelLine key={idx} rel={l.rel} fromName={l.from} toName={l.to} />
        ))}
      </ul>

      {/* 师徒结对（快捷） */}
      <div className="flex flex-wrap gap-1">
        {employees
          .filter((e) => (e.skills?.length ?? 0) >= 3)
          .flatMap((mentor) =>
            employees
              .filter((a) => a.id !== mentor.id && (a.skills?.length ?? 0) <= 2 && !a.mentorId)
              .map((appr) => (
                <button
                  key={`${mentor.id}-${appr.id}`}
                  type="button"
                  onClick={() => establishMentorship(mentor.id, appr.id)}
                  className="rounded px-1.5 py-1 text-[11px] text-white"
                  style={{ backgroundColor: ANCIENT.gold }}
                >
                  {mentor.name} 收 {appr.name} 为徒
                </button>
              ))
          )}
      </div>

      <div className="grid grid-cols-1 gap-1">
        <button type="button" onClick={() => evolveRelations()} className="rounded px-2 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.primary }}>
          演化交情
        </button>
      </div>
      </div>
    </ModalContainer>
  );
}

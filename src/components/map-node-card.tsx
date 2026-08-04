/**
 * 地图点位信息卡（Step 5b-2 模块二 map-node-card）
 * 古风卡：竹青边框 / 宣纸底；名称大字 / 类型标签（按 type 颜色）/
 * 描述 / 操作按钮（shop 查看详情拜访 / resource 查看物价采买 / npc 拜访互动 /
 * market 查看行情 / government 查看政令——按钮为占位 onClick，功能接入见模块八）。
 */
'use client';
import type { MapEvent, MapNode } from '@/types/tang-map';
import { ANCIENT } from '@/theme/tokens';

const TYPE_TAG: Record<MapNode['type'], { label: string; color: string }> = {
  shop: { label: '商铺', color: ANCIENT.gold },
  resource: { label: '物产', color: ANCIENT.primary },
  npc: { label: '人物', color: ANCIENT.accent },
  market: { label: '市集', color: ANCIENT.primary },
  government: { label: '官署', color: ANCIENT.border },
  residence: { label: '民居', color: ANCIENT.secondary },
};

const ACTION_LABEL: Record<MapNode['type'], string> = {
  shop: '查看详情 · 拜访',
  resource: '查看物价 · 采买',
  npc: '拜访互动',
  market: '查看行情',
  government: '查看政令',
  residence: '拜访闲谈',
};

interface MapNodeCardProps {
  node: MapNode;
  day: number;
  activeEvents: MapEvent[];
  onAction: (node: MapNode) => void;
}

export function MapNodeCard({ node, day, activeEvents, onAction }: MapNodeCardProps): React.ReactElement {
  const tag = TYPE_TAG[node.type];
  const events = activeEvents.filter((e) => e.nodeId === node.id);
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: ANCIENT.card, border: `2px solid ${ANCIENT.primary}`, boxShadow: `0 0 0 1px ${ANCIENT.gold} inset` }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold tracking-[0.2em]" style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}>
          {node.name}
        </h4>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] tracking-widest"
          style={{ backgroundColor: tag.color, color: '#FFF' }}
        >
          {tag.label}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
        {node.description}
      </p>
      {events.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 rounded px-2 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.accent}` }}>
          {events.map((e) => (
            <div key={e.id} style={{ color: e.type === 'threat' ? ANCIENT.accent : ANCIENT.primary }}>
              {e.type === 'threat' ? '⚠' : '◆'} {e.title}（余 {Math.max(0, e.expireDay - day)} 日）
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onAction(node)}
        className="mt-3 w-full rounded px-3 py-1.5 text-xs font-bold tracking-widest"
        style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}
      >
        {ACTION_LABEL[node.type]}
      </button>
    </div>
  );
}

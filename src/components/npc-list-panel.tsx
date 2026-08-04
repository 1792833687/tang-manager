/**
 * 长安故人 · 六位新 NPC 列表面板（TANG-MIST-002 模块三/四；npc-list-panel）
 * 门路面板「长安故人」子标签（与势力关系并列）：
 * - 已登场 NPC 卡片列表（立绘缩略图/姓名/身份/好感度进度条/关系状态/常驻地点）
 * - 点击弹 NPC 详情弹窗（完整立绘/基本信息/好感条/已揭示背景·心结·真实态度——
 *   未揭示显示 fog-card 迷雾遮罩+解锁条件/功能说明/「拜访」按钮/「在地图上查看」按钮）
 * - 未登场 NPC：灰色卡片 + 问号 + 登场条件；阿萤 available 态附「赎身/婉拒」操作。
 * 全部 ANCIENT 令牌，古风风格；不持有游戏状态（只读 store + 调用 action）。
 */
'use client';
import { useState } from 'react';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { TANG_NPCS, TANG_NPC_LOCATION_NODE } from '@/config/tang-npcs';
import {
  npcFavorVerdict,
  npcVisitCooldownOk,
  NPC_VISIT_COOLDOWN_DAYS,
  NPC_VISIT_ENERGY_COST,
  AYING_REDEEM_PRICE,
} from '@/systems/tang-npc-system';
import { NPC_BACKGROUND_THRESHOLD, NPC_HEART_THRESHOLD, NPC_TRUE_ATTITUDE_THRESHOLD } from '@/systems/tang-fog';
import { TangImage } from './tang-image';
import { FogCard } from './fog-card';
import { ModalContainer } from './modal-container';
import { pushActionFeedback } from './action-feedback';
import type { GameNPC } from '@/types/tang-manager';

/** 详情弹窗信息区（fog-card 揭示：背景 ≥40 / 心结 ≥60 / 真实态度 ≥80 / 隐藏故事=专属事件后） */
function RevealSection({
  title,
  revealed,
  condition,
  text,
}: {
  title: string;
  revealed: boolean;
  condition: string;
  text: string;
}): React.ReactElement {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>
        {title}
      </div>
      <FogCard revealed={revealed} condition={condition} hint={revealed ? undefined : '机缘未到，迷雾未散'}>
        <p className="rounded px-2 py-1.5 text-xs leading-relaxed" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text }}>
          {text}
        </p>
      </FogCard>
    </div>
  );
}

/** NPC 详情弹窗（完整立绘/基本信息/好感条+揭示区/功能/操作） */
function NpcDetailModal({ npc, onClose }: { npc: GameNPC; onClose: () => void }): React.ReactElement {
  const fogOfWar = useTangManagerStore((s) => s.fogOfWar);
  const day = useTangManagerStore((s) => s.day);
  const npcVisitCooldowns = useTangManagerStore((s) => s.npcVisitCooldowns ?? {});
  const afternoonActions = useTangManagerStore((s) => s.afternoonActions);
  const dailyActionsRemaining = useTangManagerStore((s) => s.dailyActionsRemaining);
  const energy = useTangManagerStore((s) => s.energy);
  const silver = useTangManagerStore((s) => s.silver);
  const visitNpc = useTangManagerStore((s) => s.visitNpc);
  const buyInformation = useTangManagerStore((s) => s.buyInformation);
  const redeemAying = useTangManagerStore((s) => s.redeemAying);
  const refuseAying = useTangManagerStore((s) => s.refuseAying);
  const setMapLocateNode = useTangManagerStore((s) => s.setMapLocateNode);

  const fog = fogOfWar.npcs[npc.id];
  const cooldownOk = npcVisitCooldownOk(day, npcVisitCooldowns[npc.id]);
  const visitedToday = afternoonActions.includes('visit_npc');
  const canVisit = npc.status === 'active' && cooldownOk && !visitedToday && dailyActionsRemaining > 0 && energy >= NPC_VISIT_ENERGY_COST;

  const onVisit = (): void => {
    const res = visitNpc(npc.id);
    if (res) {
      pushActionFeedback(`已拜访 ${npc.name}`, 'success');
      onClose();
    } else {
      pushActionFeedback('今日已拜访过故人，或行动次数/精力不足', 'warning');
    }
  };
  const onBuyIntel = (): void => {
    const res = buyInformation(npc.id);
    pushActionFeedback(res?.ok ? (res.narrative ?? '已买到情报') : (res?.reason ?? '买情报失败'), res?.ok ? 'success' : 'warning');
  };
  const onRedeem = (): void => {
    const res = redeemAying();
    pushActionFeedback(res?.ok ? (res.narrative ?? '已赎身') : (res?.reason ?? '赎身失败'), res?.ok ? 'success' : 'warning');
    if (res?.ok) onClose();
  };
  const onRefuse = (): void => {
    const res = refuseAying();
    pushActionFeedback(res?.ok ? (res.narrative ?? '已婉拒') : (res?.reason ?? '操作失败'), 'warning');
    if (res?.ok) onClose();
  };
  const onLocate = (): void => {
    const nodeId = TANG_NPC_LOCATION_NODE[npc.id];
    if (!nodeId) {
      pushActionFeedback(`${npc.name} 常驻${npc.location}，舆图上暂无可定位之处`, 'warning');
      return;
    }
    setMapLocateNode(nodeId);
    pushActionFeedback(`已记下 ${npc.name} 的地点，请至「长安舆图」查看`, 'success');
    onClose();
  };

  return (
    <ModalContainer title={`${npc.name} · ${npc.identity}`} onClose={onClose} showConfirm={false}>
      <div className="flex flex-col gap-3">
        {/* 完整立绘 + 基本信息 */}
        <div className="flex gap-3">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg" style={{ border: `1px solid ${ANCIENT.border}` }}>
            <TangImage
              src={withBase(npc.portrait)}
              fallbackSrc={withBase(npc.portrait)}
              alt={`${npc.name}立绘`}
              className="h-full w-full object-cover"
              fit="cover"
            />
          </div>
          <div className="min-w-0 flex-1 text-xs leading-relaxed" style={{ color: ANCIENT.text }}>
            <p><span style={{ color: ANCIENT.secondary }}>性别：</span>{npc.gender} · {npc.age}</p>
            <p><span style={{ color: ANCIENT.secondary }}>常驻：</span>{npc.location}</p>
            <p><span style={{ color: ANCIENT.secondary }}>性格：</span>{npc.personality}</p>
            <p><span style={{ color: ANCIENT.secondary }}>谈吐：</span>{npc.speakingStyle}</p>
          </div>
        </div>

        {/* 好感条 + 关系状态 */}
        <div className="rounded px-2.5 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span style={{ color: ANCIENT.secondary }}>好感</span>
            <span style={{ color: ANCIENT.gold }}>{npc.favor} / 100 · {npcFavorVerdict(npc.favor)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
            <div style={{ width: `${Math.min(100, Math.max(0, npc.favor))}%`, height: '100%', backgroundColor: ANCIENT.gold }} />
          </div>
        </div>

        {/* 揭示区（fog-card：未揭示遮罩 + 解锁条件） */}
        <div className="flex flex-col gap-2">
          <RevealSection title="背景" revealed={!!fog?.backgroundRevealed} condition={`好感 ≥ ${NPC_BACKGROUND_THRESHOLD} 可探知`} text={npc.background} />
          <RevealSection title="心结" revealed={!!fog?.heartRevealed} condition={`好感 ≥ ${NPC_HEART_THRESHOLD} 可探知`} text={npc.heartSecret} />
          <RevealSection title="真实态度" revealed={!!fog?.trueAttitudeRevealed} condition={`好感 ≥ ${NPC_TRUE_ATTITUDE_THRESHOLD} 可探知`} text={npc.trueAttitude} />
          <RevealSection title="隐藏故事" revealed={!!fog?.fullStoryRevealed} condition="专属事件后可探知" text={npc.hiddenStory} />
        </div>

        {/* 功能说明 */}
        <div className="rounded px-2.5 py-2 text-xs leading-relaxed" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
          <span style={{ color: ANCIENT.gold }}>门路：</span>
          <span style={{ color: ANCIENT.text }}>{npc.function}</span>
        </div>

        {/* 操作区 */}
        <div className="flex flex-wrap gap-1.5">
          {npc.status === 'active' && (
            <>
              <button
                type="button"
                disabled={!canVisit}
                onClick={onVisit}
                title={!cooldownOk ? `${NPC_VISIT_COOLDOWN_DAYS} 日内已拜访过` : undefined}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: ANCIENT.primary }}
              >
                拜访（-{NPC_VISIT_ENERGY_COST} 精力）
              </button>
              {npc.id === 'su_daniang' && (
                <button
                  type="button"
                  disabled={silver < 5 || energy < 5}
                  onClick={onBuyIntel}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold transition-transform active:scale-[0.97] disabled:opacity-40"
                  style={{ backgroundColor: ANCIENT.gold, color: '#2C2C2C' }}
                >
                  买情报（5 两 + 5 精力）
                </button>
              )}
            </>
          )}
          {npc.id === 'a_ying' && npc.status === 'available' && (
            <>
              <button
                type="button"
                disabled={silver < AYING_REDEEM_PRICE}
                onClick={onRedeem}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-40"
                style={{ backgroundColor: ANCIENT.accent }}
              >
                赎身（{AYING_REDEEM_PRICE} 两）
              </button>
              <button
                type="button"
                onClick={onRefuse}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-transform active:scale-[0.97]"
                style={{ backgroundColor: ANCIENT.border }}
              >
                婉拒
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onLocate}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.secondary }}
          >
            在地图上查看
          </button>
        </div>
      </div>
    </ModalContainer>
  );
}

/** 单张 NPC 卡片（未登场=灰色问号+登场条件；available=阿萤可赎；active=完整卡） */
function NpcCard({ npc, onOpen }: { npc: GameNPC; onOpen: (npc: GameNPC) => void }): React.ReactElement {
  const config = TANG_NPCS.find((c) => c.id === npc.id);
  if (npc.status === 'locked') {
    return (
      <button
        type="button"
        onClick={() => onOpen(npc)}
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left opacity-70 transition-opacity hover:opacity-90"
        style={{ backgroundColor: ANCIENT.card, border: `1px dashed ${ANCIENT.border}` }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary }}>
          ？
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold" style={{ color: ANCIENT.secondary }}>{npc.name}</div>
          <div className="truncate text-[10px]" style={{ color: ANCIENT.secondary }}>{config?.unlockHint ?? '尚未登场'}</div>
        </div>
      </button>
    );
  }
  if (npc.status === 'available') {
    return (
      <button
        type="button"
        onClick={() => onOpen(npc)}
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-opacity hover:opacity-90"
        style={{ backgroundColor: ANCIENT.card, border: `1px dashed ${ANCIENT.gold}` }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.gold }}>
          ？
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold" style={{ color: ANCIENT.text }}>{npc.name}</div>
          <div className="truncate text-[10px]" style={{ color: ANCIENT.accent }}>机缘已至，可与之会面（点击查看）</div>
        </div>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(npc)}
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-transform active:scale-[0.99]"
      style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}
    >
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md" style={{ border: `1px solid ${ANCIENT.border}` }}>
        <TangImage src={withBase(npc.portrait)} fallbackSrc={withBase(npc.portrait)} alt={`${npc.name}立绘`} className="h-full w-full object-cover" fit="cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold" style={{ color: ANCIENT.text }}>{npc.name}</span>
          <span className="rounded px-1 text-[10px]" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>{npcFavorVerdict(npc.favor)}</span>
        </div>
        <div className="truncate text-[10px]" style={{ color: ANCIENT.secondary }}>{npc.identity}</div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
          <div style={{ width: `${Math.min(100, Math.max(0, npc.favor))}%`, height: '100%', backgroundColor: ANCIENT.gold }} />
        </div>
      </div>
      <div className="shrink-0 text-right text-[10px]" style={{ color: ANCIENT.secondary }}>{npc.location}</div>
    </button>
  );
}

/** 长安故人子标签（门路面板内；与势力关系并列） */
export function NpcListPanel(): React.ReactElement {
  const gameNPCs = useTangManagerStore((s) => s.gameNPCs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? gameNPCs[selectedId] : undefined;
  const order = TANG_NPCS.map((c) => c.id);
  const list = order.map((id) => gameNPCs[id]).filter((n): n is GameNPC => !!n);

  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] tracking-widest" style={{ color: ANCIENT.secondary }}>
        长安城中，尚有几位故人未得深交。与其相熟，或可窥得门路、换得机缘。
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {list.map((npc) => (
          <NpcCard key={npc.id} npc={npc} onOpen={(n) => setSelectedId(n.id)} />
        ))}
      </div>
      {selected && <NpcDetailModal npc={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

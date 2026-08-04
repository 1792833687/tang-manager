/**
 * 《我在唐朝当掌柜》阶段推进系统（Step 5a 1.1）
 * 纯函数：checkStageUpgrade(state) 读取 STAGE_REQUIREMENTS 判定应达到的阶段；
 * store 在 settleDay 后调用，若高于当前 stage 则推进并记录 eventLog + 合成阶段事件（UI 复用事件面板）。
 */
import { STAGE_NAMES, STAGE_REQUIREMENTS } from '@/config/tang-stage-config';
import type { GameEvent, GameStage, TangGameState } from '@/types/tang-manager';

/** 判定当前应达到的阶段（1→4；返回满足的最高阶段） */
export function checkStageUpgrade(state: TangGameState): GameStage {
  let stage: GameStage = 1;
  if (meetsRequirement(state, STAGE_REQUIREMENTS[1])) {
    stage = 2;
  } else {
    return stage;
  }
  if (meetsRequirement(state, STAGE_REQUIREMENTS[2])) {
    stage = 3;
  } else {
    return stage;
  }
  if (meetsRequirement(state, STAGE_REQUIREMENTS[3])) {
    stage = 4;
  }
  return stage;
}

function meetsRequirement(state: TangGameState, req: (typeof STAGE_REQUIREMENTS)[1]): boolean {
  if ((state.silver ?? 0) < req.minGold) return false;
  if (state.score < req.minScore) return false;
  if (state.reputation < req.minReputation) return false;
  if (req.requiredEvent && !state.eventLog.includes(req.requiredEvent)) return false;
  if (req.minShopCount !== undefined && (state.shopCount ?? 1) < req.minShopCount) return false;
  if (req.minTotalNetProfit !== undefined && (state.totalNetProfit ?? 0) < req.minTotalNetProfit) return false;
  if (req.requireXieQiIdentityRevealed && !state.xieQiIdentityRevealed) return false;
  if (req.minEmployeesSatisfied !== undefined) {
    const threshold = req.employeeSatisfactionThreshold ?? 80;
    const satisfied = (state.employees ?? []).filter((e) => e.satisfaction >= threshold).length;
    if (satisfied < req.minEmployeesSatisfied) return false;
  }
  // 谢七灰色线完成：当前以 xieQiFavor≥50 近似（事件系统无独立完成标记，见 config 注释）
  // 3→4 为「沈听澜合作线 或 谢七灰色线完成」二选一（OR），非同时满足
  const requiresLine = req.requireShenPartner === true || req.minXieQiFavor !== undefined;
  if (requiresLine) {
    const partnerOk = req.requireShenPartner !== true || state.shenPartner;
    const favorOk = req.minXieQiFavor === undefined || (state.xieQiFavor ?? 0) >= req.minXieQiFavor;
    if (!partnerOk && !favorOk) return false;
  }
  if (req.requireSpecialEmployeeStory && !state.specialEmployeeStoryCompleted) return false;
  return true;
}

/** 合成阶段晋升事件（复用事件面板展示；id 含 day 保证唯一，防去重冲突） */
export function buildStageUpgradeEvent(nextStage: GameStage, day: number): GameEvent {
  const name = STAGE_NAMES[nextStage];
  const description =
    nextStage === 2
      ? '你的铺子渐渐在坊间有了名头，沈氏商号的人也对你另眼相看。你收起账本，觉得这生意终于摸着了门道。'
      : nextStage === 3
        ? '三间铺子在你名下立了起来，东市西市都有人唤你一声「东家」。你该想想，下一步该怎么走了。'
        : '长安城里，你的字号已是响当当的一块。锦衣玉食、高朋满座，可你心里明白，这还不是尽头。';
  return {
    type: 'random',
    id: `stage-${nextStage}-${day}`,
    title: `店铺晋升 · ${name}`,
    description,
    // 合成事件的触发条件不参与 checkAndTriggerEvents（trigger 字段为类型必需，置空区间即可）
    trigger: { type: 'day_range', minDay: 0, maxDay: 9999 },
    choices: [
      {
        id: 'ok',
        label: '知道了',
        consequence: `你合上账本，正式迈入「${name}」之境。`,
        effect: {},
      },
    ],
  };
}

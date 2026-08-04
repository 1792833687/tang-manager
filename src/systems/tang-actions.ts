/**
 * 《我在唐朝当掌柜》每日自由行动系统（Step 5a 1.2）
 * 纯函数（可测）：
 * - getAvailableActions(state)：返回今日可选行动（含精力/条件校验，不足灰显）。
 * - getVisitNpcOptions(state)：返回可拜访 NPC（沈听澜/谢七/债主按登场状态过滤）。
 * - executeAfternoonAction(state, actionId, npcId?, rng?)：执行并返回结果（精力/金钱/好感/文案）。
 * 时机：5 客（C 难度 6 客）接待完 → 打烊前；startNewDay 重置次数。
 * 结果文案为占位（用户允许），AI 叙事着色由 reception/其他叙事层完成。
 */
import { getDifficultyParams } from '@/config/tang-difficulty';
import { AFTERNOON_ACTION_DEFS, AFTERNOON_ACTION_MAP, actionToOption, type VisitNpcOption } from '@/config/tang-actions-config';
import { generateCandidates } from '@/systems/tang-recruitment';
import type { ActionOption, ActionResult, Difficulty, Employee, ShopType, TangGameState } from '@/types/tang-manager';

/** 自由行动所需的状态子集（便于测试与解耦） */
export interface AfternoonActionContext {
  energy: number;
  difficulty: Difficulty;
  employees: Employee[];
  maxEmployees: number;
  dailyActionsRemaining: number;
  /** 今日已执行行动 id（防重复） */
  afternoonActions: string[];
  xieQiFavor: number;
  shenTinglanFavor: number;
  /** 旧债（原 debt；5b 改名 legacyDebt） */
  legacyDebt: number;
  shopType: ShopType | null;
  day: number;
  eventLog: string[];
  xieQiIdentityRevealed: boolean;
}

/** 今日可选行动（1.2）：精力不足灰显；C 难度精力<30 时全部不可用 */
export function getAvailableActions(state: AfternoonActionContext): ActionOption[] {
  const taken = new Set(state.afternoonActions);
  const cLowEnergy = state.difficulty === 'C' && state.energy < 30;
  const options = AFTERNOON_ACTION_DEFS.map((def) => {
    const opt = actionToOption(def);
    if (taken.has(def.id)) {
      return { ...opt, disabled: true, disabledReason: '今日已用过' };
    }
    if (cLowEnergy) {
      return { ...opt, disabled: true, disabledReason: '精力不足 30，行动不便' };
    }
    if (def.energyCost > 0 && state.energy < def.energyCost) {
      return { ...opt, disabled: true, disabledReason: `精力不足（需 ${def.energyCost}）` };
    }
    if (def.id === 'market_recruit' && state.employees.length >= state.maxEmployees) {
      return { ...opt, disabled: true, disabledReason: '人手已满，无处安顿' };
    }
    if (def.id === 'visit_npc' && getVisitNpcOptions(state).every((n) => n.unavailableReason)) {
      return { ...opt, disabled: true, disabledReason: '尚无熟识的故人可访' };
    }
    return opt;
  });
  // 剩余次数为 0：全部灰显（UI 侧通常不再展示，防御）
  if (state.dailyActionsRemaining <= 0) {
    return options.map((o) => ({ ...o, disabled: true, disabledReason: o.disabledReason ?? '今日行动次数已用完' }));
  }
  return options;
}

/** 可拜访 NPC（1.2：按登场状态过滤；债主需负债>0） */
export function getVisitNpcOptions(state: AfternoonActionContext): VisitNpcOption[] {
  const shenAppeared = state.shenTinglanFavor > 0 || state.eventLog.includes('shen-tinglan');
  const xieAppeared = state.xieQiFavor > 0 || state.xieQiIdentityRevealed || state.eventLog.includes('xie-qi-debt');
  return [
    {
      npcId: 'shen-tinglan',
      name: '沈听澜',
      unavailableReason: shenAppeared ? undefined : '尚未登场',
    },
    {
      npcId: 'xie-qi',
      name: '谢七',
      unavailableReason: xieAppeared ? undefined : '尚未登场',
    },
    {
      npcId: 'zhao-yuanwai',
      name: '债主赵员外',
      unavailableReason: (state.legacyDebt ?? 0) > 0 ? undefined : '已无负债，无需周旋',
    },
  ];
}

/** 拜访 NPC 好感变动（2~5 随机） */
function npcFavorDelta(rng: () => number): number {
  return Math.floor(rng() * 4) + 2;
}

/**
 * 执行自由行动（1.2）。返回 null 表示不可执行（次数不足/已用过/精力不足）。
 * 结果文案为占位（用户允许「结果占位文案+注释」）。
 */
export function executeAfternoonAction(
  state: AfternoonActionContext,
  actionId: string,
  npcId?: string,
  rng: () => number = Math.random
): ActionResult | null {
  const def = AFTERNOON_ACTION_MAP[actionId];
  if (!def) return null;
  if (state.dailyActionsRemaining <= 0) return null;
  if (state.afternoonActions.includes(actionId)) return null;
  if (state.difficulty === 'C' && state.energy < 30) return null;
  if (def.energyCost > 0 && state.energy < def.energyCost) return null;

  const base = { actionId, label: def.label, energyDelta: def.energyCost };

  switch (actionId) {
    case 'afternoon_patrol': {
      // 发现店铺隐患（预警修缮/小偷——占位：70% 平安 +声望1，30% 修缮垫付 -2 两）
      const foundTrouble = rng() < 0.3;
      return {
        ...base,
        narrative: foundTrouble
          ? '你绕着铺子细细查看，发现后墙根有些松动，赶紧找了匠人垫了些砖瓦（修缮垫付 2 两——占位）。'
          : '你绕着铺子内外查看，梁柱门窗皆无异常，又敲打了几个可疑的角落，这才放心。',
        goldDelta: foundTrouble ? -2 : 0,
        reputationDelta: foundTrouble ? 0 : 1,
      };
    }
    case 'visit_npc': {
      // 选择已登场 NPC（沈听澜/谢七/债主）互动；好感+2~5 随机 + 叙事
      const npc = getVisitNpcOptions(state).find((n) => n.npcId === npcId);
      if (!npc || npc.unavailableReason) {
        return { ...base, narrative: '你本想去拜访故人，转念一想人家未必得空，只得作罢。' };
      }
      const delta = npcFavorDelta(rng);
      if (npc.npcId === 'shen-tinglan') {
        return {
          ...base,
          narrative: `你备了茶点去拜访沈听澜，聊起东市的行情。他抚掌而笑，临别时好感又添了几分（好感 +${delta}）。`,
          shenTinglanFavorDelta: delta,
        };
      }
      if (npc.npcId === 'xie-qi') {
        return {
          ...base,
          narrative: `你在赌场外寻到谢七，他咧嘴一笑，跟你聊了些坊间门道（好感 +${delta}）。`,
          xieQiFavorDelta: delta,
        };
      }
      // 债主：奉茶说和，无实际数值（占位叙事）
      return {
        ...base,
        narrative: '你亲自给债主赵员外奉上茶，好话说尽，总算把利钱的事缓了缓（占位：无实际数值变动）。',
      };
    }
    case 'market_recruit': {
      // 调 tang-recruitment 生成 2-3 候选，进入雇佣流程（模块二）
      const candidates = generateCandidates(rng() < 0.5 ? 2 : 3, rng, state.shopType ?? undefined);
      return {
        ...base,
        narrative: `你在集市口张了张榜，不一会便聚来几个想寻活计的汉子。你打量着，挑中了 ${candidates.length} 人（可在下方雇佣）。`,
        candidates,
      };
    }
    case 'nap': {
      // 恢复精力 +20；30% 概率错过突发事件（占位：-声望1 体现错过损失）
      const missed = rng() < 0.3;
      return {
        ...base,
        narrative: missed
          ? '你打了个盹，迷迷糊糊间觉得错过了什么动静。醒来问阿昭，她只说「没什么要紧的」——可你总觉得心里不踏实。'
          : '你靠着柜台的躺椅小憩片刻，再睁眼时精神好了不少，店里也安稳无事。',
        reputationDelta: missed ? -1 : 0,
        missedEvent: missed,
      };
    }
    case 'street_wander': {
      // 随机获取情报/低价货源线索/赌场邀请（占位：40% 情报、30% 低价省 2 两、30% 赌场邀请）
      const roll = rng();
      if (roll < 0.4) {
        return {
          ...base,
          narrative: '你在坊市间闲逛，听茶摊上的老客讲起东市的动静（情报——占位，无实际数值）。',
        };
      }
      if (roll < 0.7) {
        return {
          ...base,
          narrative: '你顺路问了几家货栈的价钱，发现有一家新开的铺子进价低些，当即定了批货（省下 2 两——占位）。',
          goldDelta: 2,
        };
      }
      return {
        ...base,
        narrative: '巷子深处有人冲你招手，低声说起赌场新开的局子（赌场邀请——占位，谢七线索可由此引出）。',
        xieQiFavorDelta: state.xieQiFavor > 0 ? 1 : 0,
      };
    }
    default:
      return null;
  }
}

/** 便捷包装：接收完整 TangGameState（store 调用） */
export function executeAfternoonActionOnState(
  state: TangGameState,
  actionId: string,
  npcId?: string,
  rng: () => number = Math.random
): ActionResult | null {
  return executeAfternoonAction(
    {
      energy: state.energy,
      difficulty: state.difficulty,
      employees: state.employees,
      maxEmployees: state.maxEmployees,
      dailyActionsRemaining: state.dailyActionsRemaining,
      afternoonActions: state.afternoonActions,
      xieQiFavor: state.xieQiFavor,
      shenTinglanFavor: state.shenTinglanFavor,
      legacyDebt: state.legacyDebt ?? 0,
      shopType: state.shopType,
      day: state.day,
      eventLog: state.eventLog,
      xieQiIdentityRevealed: state.xieQiIdentityRevealed,
    },
    actionId,
    npcId,
    rng
  );
}

/** 按难度取每日行动次数（1.3：A 2 / B 1 / C 1） */
export function dailyActionCountFor(difficulty: Difficulty): number {
  return getDifficultyParams(difficulty).dailyActionCount;
}

/**
 * 《我在唐朝当掌柜》午后自由行动实质化（内容深化 TANG-CONT-C 模块二）
 * 纯函数（可测；不直接调用 store）：
 * - rollPatrolHazards：午后巡查发现 1-2 个隐患（60% 修缮 / 30% 员工偷懒 / 10% 小偷迹象）
 * - resolvePatrolHazardChoice：隐患处置（修缮→立即修或延后；偷懒→训诫或无视；小偷→加固或雇护卫）
 * - checkPostponedPatrol：延后修缮到期（day+10）未修 → 坍塌损失
 * - performVisitNpc：拜访 NPC（沈听澜/谢七/阿昭；3-5 句古风对话、好感+3~8、20% 额外情报）
 * - performNap：小睡片刻（精力+20；30% 突发事件：贵客错过/阿昭挡麻烦/无事）
 * - performStroll：市井闲逛（40% 坊间传闻 / 25% 捡漏 / 15% 遇谢七 / 10% 小偷光顾 / 10% 无事）
 * - performAfternoonActionCore：统一分派（四行动 + 市场招聘兼容走 legacy）
 * 铁律：古风措辞；rng 可注入；结果叙事由 store 应用（eventLog + 浮动反馈）。
 */
import { executeAfternoonAction, type AfternoonActionContext } from '@/systems/tang-actions';
import type { ClueCategory } from '@/types/tang-clues';
import type {
  ActionResult,
  Employee,
  PatrolChoiceResult,
  PatrolHazard,
  ShopType,
} from '@/types/tang-manager';

/** 巡查隐患类型：修缮 / 员工偷懒 / 小偷迹象 */
export type PatrolHazardKind = 'repair' | 'slack' | 'thief';

/** 巡查所需状态子集 */
export interface PatrolContext {
  day: number;
  silver: number;
  employees: readonly Employee[];
}

/** 拜访 NPC 所需状态子集（扩展至阿昭/赵员外；便于后续 NPC 系统扩展） */
export interface VisitNpcContext {
  shenTinglanFavor: number;
  xieQiFavor: number;
  xiaoerFavor: number;
  legacyDebt: number;
  eventLog: string[];
  xieQiIdentityRevealed: boolean;
  shopType: ShopType | null;
}

/** 闲逛所需状态子集 */
export interface StrollContext {
  day: number;
  shopType: ShopType | null;
  xieQiFavor: number;
  shopItems: readonly { name: string; price: number }[];
}

/** 统一分派所需状态子集（含自由行动次数/精力/难度校验） */
export interface AfternoonCoreContext extends AfternoonActionContext {
  silver: number;
  xiaoerFavor: number;
  xiaoerSatisfaction: number;
  shopItems: readonly { name: string; price: number }[];
}

// ============================================================
// 午后巡查（消耗 10 精力）
// ============================================================

/** 修缮隐患基础花费区间（两；工程定值，注释） */
const REPAIR_COST_MIN = 5;
const REPAIR_COST_MAX = 15;
/** 小偷迹象：加固门锁 / 雇护卫花费（两；工程定值） */
const LOCK_COST = 3;
const GUARD_COST = 8;
/** 延后修缮期限（日；day+10 内不修则坍塌） */
export const POSTPONE_DEADLINE_DAYS = 10;
/** 坍塌损失区间（两；工程定值） */
const COLLAPSE_LOSS_MIN = 15;
const COLLAPSE_LOSS_MAX = 25;

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

let hazardSeq = 0;
function nextHazardId(): string {
  hazardSeq += 1;
  return `patrol-hazard-${hazardSeq}`;
}

/** 生成单个隐患（按 60/30/10 权重；无在职员工时偷懒回退为修缮） */
export function rollPatrolHazard(ctx: PatrolContext, rng: () => number): PatrolHazard {
  const roll = rng();
  const activeEmployees = ctx.employees.filter((e) => !e.restToday);
  const kind: PatrolHazardKind =
    activeEmployees.length === 0 && roll >= 0.6 && roll < 0.9
      ? 'repair'
      : roll < 0.6
        ? 'repair'
        : roll < 0.9
          ? 'slack'
          : 'thief';
  if (kind === 'repair') {
    const cost = randInt(REPAIR_COST_MIN, REPAIR_COST_MAX, rng);
    return {
      id: nextHazardId(),
      kind,
      title: '修缮隐患',
      narrative: `你绕着铺子查看，发现后墙根裂了一道缝，檐角也有几片瓦松了。匠人估摸需 ${cost} 两方能修缮妥当。若不管，十日内恐有坍塌之虞，届时损失更大。`,
      repairCost: cost,
    };
  }
  if (kind === 'slack') {
    const emp = pick(activeEmployees, rng);
    return {
      id: nextHazardId(),
      kind,
      title: '伙计偷懒',
      narrative: `你瞧见 ${emp.name} 躲在账房后头打盹，一整天怕是使不上几分力气（当日效率-30%）。可训诫一番，也可睁一只眼闭一只眼。`,
      employeeId: emp.id,
      employeeName: emp.name,
    };
  }
  return {
    id: nextHazardId(),
    kind,
    title: '小偷迹象',
    narrative: `库房门的锁鼻上有几道新鲜撬痕，地上还落了半截铁片——怕是有贼踩过点。可加固门锁（${LOCK_COST} 两），或雇一名护卫（${GUARD_COST} 两）夜里看顾。`,
    lockCost: LOCK_COST,
    guardCost: GUARD_COST,
  };
}

/** 午后巡查发现 1-2 个隐患 */
export function rollPatrolHazards(rng: () => number = Math.random, ctx?: PatrolContext): PatrolHazard[] {
  const count = rng() < 0.5 ? 1 : 2;
  const hazards: PatrolHazard[] = [];
  for (let i = 0; i < count; i++) {
    hazards.push(rollPatrolHazard(ctx ?? { day: 1, silver: 0, employees: [] }, rng));
  }
  return hazards;
}

/** 巡查发现叙事（总述发现几处隐患） */
export function patrolDiscoveryNarrative(hazards: readonly PatrolHazard[]): string {
  if (hazards.length === 1) {
    return '你绕着铺子内外细细查看，果然发现一处疏漏。';
  }
  return '你绕着铺子内外细细查看，竟发现两处疏漏，不敢大意。';
}

/**
 * 处置隐患（纯函数）：
 * - repair + fix：立即修缮（goldDelta = -repairCost；需要银两充足，由 store 拦截）
 * - repair + delay：延后（postponed=true、deadlineDay=day+10；逾期坍塌）
 * - slack + admonish：训诫（满意度-8、清除当日偷懒）
 * - slack + ignore：无视（保留当日偷懒：效率-30% 近似，settleDay 不计入加成）
 * - thief + lock：加固门锁（goldDelta = -lockCost）
 * - thief + guard：雇护卫（goldDelta = -guardCost）
 */
export function resolvePatrolHazardChoice(
  hazard: PatrolHazard,
  choice: string,
  ctx: { day: number },
  _rng: () => number = Math.random
): PatrolChoiceResult {
  if (hazard.kind === 'repair') {
    if (choice === 'fix') {
      const cost = hazard.repairCost ?? 0;
      return {
        resolved: true,
        hazardId: hazard.id,
        narrative: `你当即唤来匠人，花了 ${cost} 两把墙根砌实、檐瓦换新。看着重新齐整的铺子，你心里踏实不少。`,
        goldDelta: -cost,
      };
    }
    return {
      resolved: false,
      hazardId: hazard.id,
      narrative: '你记在心里，想着改日再寻匠人。可那道裂缝总在眼前晃，叫你夜里睡不踏实。',
      postponed: true,
      deadlineDay: ctx.day + POSTPONE_DEADLINE_DAYS,
    };
  }
  if (hazard.kind === 'slack') {
    if (choice === 'admonish') {
      return {
        resolved: true,
        hazardId: hazard.id,
        narrative: `你板起脸把 ${hazard.employeeName ?? '伙计'} 训诫了一通，他连连告饶，说再不敢偷懒。这一日总算不敢懈怠（满意度-8）。`,
        employeeDelta: hazard.employeeId ? { employeeId: hazard.employeeId, satisfactionChange: -8 } : undefined,
        clearSlack: true,
      };
    }
    return {
      resolved: true,
      hazardId: hazard.id,
      narrative: `你念 ${hazard.employeeName ?? '他'} 平日里还算勤恳，便装作没瞧见，由他偷了这一日的闲。`,
      addSlack: true,
    };
  }
  // thief
  if (choice === 'lock') {
    return {
      resolved: true,
      hazardId: hazard.id,
      narrative: `你让伙计买了新锁换上，又加了一根铁闩，把库房门守得严严实实（-${hazard.lockCost ?? LOCK_COST} 两）。`,
      goldDelta: -(hazard.lockCost ?? LOCK_COST),
    };
  }
  return {
    resolved: true,
    hazardId: hazard.id,
    narrative: `你托人雇了一名护卫，夜里守在库房外。有他在，你总算能睡个安稳觉（-${hazard.guardCost ?? GUARD_COST} 两）。`,
    goldDelta: -(hazard.guardCost ?? GUARD_COST),
  };
}

/** 延后修缮到期检查：deadlineDay <= day 的隐患坍塌（损失 + 声望 + 评分）；未到期保留 */
export function checkPostponedPatrol(
  hazards: readonly PatrolHazard[],
  day: number,
  rng: () => number = Math.random
): { remaining: PatrolHazard[]; collapsed: PatrolChoiceResult[] } {
  const remaining: PatrolHazard[] = [];
  const collapsed: PatrolChoiceResult[] = [];
  for (const h of hazards) {
    if (h.deadlineDay !== undefined && h.deadlineDay <= day) {
      const loss = randInt(COLLAPSE_LOSS_MIN, COLLAPSE_LOSS_MAX, rng);
      collapsed.push({
        resolved: true,
        hazardId: h.id,
        narrative: `那处迟迟未修的疏漏终究塌了——${h.title}一夜之间闹出动静，你连夜收拾，损失 ${loss} 两，还折了些脸面。`,
        goldDelta: -loss,
        reputationDelta: -3,
        scoreDelta: -0.02,
      });
    } else {
      remaining.push(h);
    }
  }
  return { remaining, collapsed };
}

// ============================================================
// 拜访 NPC（消耗 15 精力；好感 +3~8；20% 额外情报）
// ============================================================

/** 各 NPC 对话（3-5 句，古风；config 文案占位允许） */
const NPC_DIALOGUE: Record<string, string[]> = {
  'shen-tinglan': [
    '你提着茶点进了沈家茶寮，他搁下茶盏，笑问：“掌柜今日怎么得闲？”',
    '“东市这几日绸缎走俏，价高了两成。”他蘸着茶水在案上画了两道，“你若囤得，不妨吃进些。”',
    '你道了谢，他又叮嘱：“行商最忌贪心，见好就收方是长久之道。”',
    '临走他亲自送你到门口，道：“常来坐坐。”',
  ],
  'xie-qi': [
    '赌场后巷寻到谢七，他正倚着墙啃胡饼，见你咧嘴一笑：“哟，掌柜的，又给兄弟送钱来了？”',
    '你笑骂一句，他倒正经起来：“西市最近有帮胡商在收生丝，价钱给得痛快，你若有货可去问问。”',
    '他又压低声音：“不过那帮人路子野，留个心眼。”',
    '末了拍拍你肩膀：“下回手头宽裕，再来寻我耍两把。”',
  ],
  'a-zhao': [
    '午后店里清闲，你见阿昭坐在柜台后发呆，便过去问了一声。',
    '她回过神，笑道：“东家，我在盘算明日的菜色呢——今儿新进的羊肉不错，明儿做个葱爆羊肉可好？”',
    '你点头应下，她又絮絮说起街坊的闲话，眉眼间都是欢喜。',
    '你心下一暖，觉得这铺子有了她，才算有了生气。',
  ],
  'zhao-yuanwai': [
    '你亲自给债主赵员外奉上茶，好话说尽，总算把利钱的事缓了缓。',
    '他眯着眼打量你，慢悠悠道：“掌柜是个会来事的，这债，且宽限几日。”',
    '你松了口气，又陪了几句小心话，才告辞出来。',
  ],
};

/** 可拜访 NPC 列表（工程判断：现有 NPC 好感对象——沈听澜/谢七/阿昭；债主按负债保留；后续 NPC 系统扩展时通用） */
export function visitableNpcs(ctx: VisitNpcContext): Array<{ npcId: string; name: string; unavailableReason?: string }> {
  const shenAppeared = ctx.shenTinglanFavor > 0 || ctx.eventLog.includes('shen-tinglan');
  const xieAppeared = ctx.xieQiFavor > 0 || ctx.xieQiIdentityRevealed || ctx.eventLog.includes('xie-qi-debt');
  return [
    { npcId: 'shen-tinglan', name: '沈听澜', unavailableReason: shenAppeared ? undefined : '尚未登场' },
    { npcId: 'xie-qi', name: '谢七', unavailableReason: xieAppeared ? undefined : '尚未登场' },
    { npcId: 'a-zhao', name: '阿昭' },
    { npcId: 'zhao-yuanwai', name: '债主赵员外', unavailableReason: (ctx.legacyDebt ?? 0) > 0 ? undefined : '已无负债，无需周旋' },
  ];
}

/** 拜访 NPC 好感变动（+3~8） */
function npcFavorDelta(rng: () => number): number {
  return 3 + Math.floor(rng() * 6);
}

/** 20% 额外情报（40% 线索 / 30% 势力动向 / 30% 行业预告） */
function rollVisitIntel(npcName: string, rng: () => number): ActionResult['intel'] {
  const roll = rng();
  if (roll < 0.4) {
    const categories: ClueCategory[] = ['shen', 'xie', 'business', 'secret'];
    const cat = pick(categories, rng);
    return {
      kind: 'clue',
      text: `你与 ${npcName} 闲谈间，无意听得一桩秘闻，隐约觉得与旁的事能连上……`,
      clueCategory: cat,
    };
  }
  if (roll < 0.7) {
    return { kind: 'faction', text: `${npcName} 提及长安城中几大势力的近况，你默默记下，以备后用。` };
  }
  return { kind: 'industry', text: `${npcName} 说到这几日行市的风向，你盘算着明日进货该往哪头使劲。` };
}

/** 拜访 NPC（返回对话/好感/情报描述；clue 由 store 落库） */
export function performVisitNpc(
  ctx: VisitNpcContext,
  npcId: string,
  rng: () => number = Math.random
): { ok: boolean; narrative: string; dialogue: string[]; favorDelta: number; npcName: string; intel?: ActionResult['intel'] } {
  const npc = visitableNpcs(ctx).find((n) => n.npcId === npcId);
  if (!npc || npc.unavailableReason) {
    return { ok: false, narrative: '你本想去拜访故人，转念一想人家未必得空，只得作罢。', dialogue: [], favorDelta: 0, npcName: npc?.name ?? '' };
  }
  const delta = npcFavorDelta(rng);
  const dialogue = NPC_DIALOGUE[npcId] ?? ['你与故人叙了叙旧，宾主尽欢。'];
  const intel = rng() < 0.2 ? rollVisitIntel(npc.name, rng) : undefined;
  return {
    ok: true,
    narrative: `你备了些薄礼去拜访 ${npc.name}，聊了半晌，临别时彼此都觉亲近了几分（好感 +${delta}）。`,
    dialogue,
    favorDelta: delta,
    npcName: npc.name,
    intel,
  };
}

// ============================================================
// 小睡片刻（精力 +20；30% 突发事件）
// ============================================================

export type NapEvent = 'big_order_missed' | 'azhao_helped' | 'none';

/** 小睡：精力+20；30% 突发事件三选一（贵客错过 / 阿昭挡麻烦 / 无事） */
export function performNap(rng: () => number = Math.random): {
  narrative: string;
  napEvent: NapEvent;
  xiaoerSatisfactionDelta: number;
} {
  if (rng() >= 0.3) {
    return {
      narrative: '你靠着柜台的躺椅小憩片刻，再睁眼时精神好了不少，店里也安稳无事。',
      napEvent: 'none',
      xiaoerSatisfactionDelta: 0,
    };
  }
  const roll = rng();
  if (roll < 1 / 3) {
    return {
      narrative: '你打了个盹，恍惚听见有贵客登门的声音。醒来问阿昭，她说是一位要订大单的豪客，见你歇着便走了——那大单机会就此错过。',
      napEvent: 'big_order_missed',
      xiaoerSatisfactionDelta: 0,
    };
  }
  if (roll < 2 / 3) {
    return {
      narrative: '你睡得正沉，忽被一阵响动惊醒——原来是阿昭替你挡了一桩麻烦事。她嘴上说“没什么”，但看得出费了不少心神（阿昭满意度-2）。',
      napEvent: 'azhao_helped',
      xiaoerSatisfactionDelta: -2,
    };
  }
  return {
    narrative: '你小憩片刻，醒来神清气爽。阿昭在一旁守着，店里平安无事。',
    napEvent: 'none',
    xiaoerSatisfactionDelta: 0,
  };
}

// ============================================================
// 市井闲逛（消耗 10 精力；40/25/15/10/10）
// ============================================================

export type StrollKind = 'rumor' | 'bargain' | 'xieqi' | 'thief' | 'none';

/** 闲逛捡漏商品池（按店型兜底；优先取货架在售商品） */
export function strollBargainPool(shopType: ShopType | null | undefined, shopItems: readonly { name: string; price: number }[]): { name: string; price: number }[] {
  const inShop = shopItems.map((it) => ({ name: it.name, price: it.price }));
  if (inShop.length > 0) {
    return inShop;
  }
  const pool: Record<ShopType, Array<{ name: string; price: number }>> = {
    jiulou: [
      { name: '酱牛肉', price: 6 },
      { name: '羊肉', price: 10 },
      { name: '米酒', price: 4 },
    ],
    buzhuang: [
      { name: '丝绸', price: 14 },
      { name: '锦缎', price: 22 },
      { name: '粗布', price: 5 },
    ],
    yaopu: [
      { name: '人参', price: 18 },
      { name: '当归', price: 6 },
      { name: '黄连', price: 4 },
    ],
  };
  return pool[shopType ?? 'jiulou'] ?? pool.jiulou;
}

/** 市井闲逛（返回结果与捡漏商品；clue 由 store 落库） */
export function performStroll(
  ctx: StrollContext,
  rng: () => number = Math.random
): {
  narrative: string;
  strollKind: StrollKind;
  goldDelta: number;
  xieQiFavorDelta: number;
  bargain?: { itemName: string; price: number; day: number };
  intel?: ActionResult['intel'];
} {
  const roll = rng();
  // 40% 坊间传闻
  if (roll < 0.4) {
    const categories: ClueCategory[] = ['shen', 'xie', 'debt', 'politics', 'business', 'secret'];
    const cat = pick(categories, rng);
    return {
      narrative: '你在坊市间闲逛，听茶摊上的老客讲起一桩新鲜事，隐约觉得里头有名堂。',
      strollKind: 'rumor',
      goldDelta: 0,
      xieQiFavorDelta: 0,
      intel: { kind: 'rumor', text: '茶摊老客的闲谈，似乎藏着什么门道……', clueCategory: cat },
    };
  }
  // 25% 捡漏（随机商品市价七折，限当日）
  if (roll < 0.65) {
    const item = pick(strollBargainPool(ctx.shopType, ctx.shopItems), rng);
    const price = Math.round(item.price * 0.7 * 100) / 100;
    return {
      narrative: `你顺路问了几家货栈的价钱，有一家新开的铺子急着清货，${item.name} 只按市价七折（${price} 两）出手，限今日。`,
      strollKind: 'bargain',
      goldDelta: 0,
      xieQiFavorDelta: 0,
      bargain: { itemName: item.name, price, day: ctx.day },
    };
  }
  // 15% 遇谢七
  if (roll < 0.8) {
    return {
      narrative: '你在巷口撞见谢七，他正提溜着一壶酒，冲你挤眉弄眼。闲扯几句，他心情不错（谢七好感+1）。',
      strollKind: 'xieqi',
      goldDelta: 0,
      xieQiFavorDelta: ctx.xieQiFavor > 0 ? 1 : 0,
    };
  }
  // 10% 被小偷光顾（损失 5-20 两）
  if (roll < 0.9) {
    const loss = randInt(5, 20, rng);
    return {
      narrative: `你逛得兴起，一摸腰间钱袋——空了！不知何时被贼人顺了去，损失 ${loss} 两。`,
      strollKind: 'thief',
      goldDelta: -loss,
      xieQiFavorDelta: 0,
    };
  }
  // 10% 无事
  return {
    narrative: '你在坊市间走了几圈，除了一身汗，什么也没碰上。倒也落个清净。',
    strollKind: 'none',
    goldDelta: 0,
    xieQiFavorDelta: 0,
  };
}

// ============================================================
// 统一分派（store 调用）
// ============================================================

/**
 * 统一执行午后自由行动（内容深化 TANG-CONT-C）：
 * - afternoon_patrol / visit_npc / nap / street_wander → 新系统真实逻辑
 * - market_recruit → 兼容 legacy（tang-actions 招聘候选）
 * 校验与 legacy 一致：次数/去重/精力；不可执行返回 null。
 */
export function performAfternoonActionCore(
  state: AfternoonCoreContext,
  actionId: string,
  opts: { npcId?: string } = {},
  rng: () => number = Math.random
): ActionResult | null {
  if (state.dailyActionsRemaining <= 0) return null;
  if (state.afternoonActions.includes(actionId)) return null;
  if (state.difficulty === 'C' && state.energy < 30) return null;

  if (actionId === 'market_recruit') {
    // 兼容 legacy：招聘候选流程（getAvailableActions 已校验精力/满员）
    // 注意：legacy 返回 energyDelta=energyCost（正=消耗语义），store 应用为 energy+delta；
    // 统一入口以「实际变更」为准（负=消耗），故取负。
    const legacy = executeAfternoonAction(state, actionId, opts.npcId, rng);
    if (!legacy) return null;
    return { ...legacy, energyDelta: -legacy.energyDelta };
  }

  // 实际精力变更（负=消耗；nap 正=恢复）。与 legacy 配置「正=消耗」语义不同，
  // 此处以 store 应用口径 energy+delta 为准（TANG-CONT-C 修正 legacy 符号翻转 bug）。
  const defDelta: Record<string, number> = {
    afternoon_patrol: -10,
    visit_npc: -15,
    nap: 20,
    street_wander: -10,
  };
  const delta = defDelta[actionId];
  if (delta === undefined) return null;
  if (delta < 0 && state.energy < -delta) return null;

  const base = { actionId, label: actionLabel(actionId), energyDelta: delta };

  switch (actionId) {
    case 'afternoon_patrol': {
      const hazards = rollPatrolHazards(rng, { day: state.day, silver: state.silver, employees: state.employees });
      return {
        ...base,
        narrative: patrolDiscoveryNarrative(hazards),
        patrolHazards: hazards,
      };
    }
    case 'visit_npc': {
      const v = performVisitNpc(
        {
          shenTinglanFavor: state.shenTinglanFavor,
          xieQiFavor: state.xieQiFavor,
          xiaoerFavor: state.xiaoerFavor,
          legacyDebt: state.legacyDebt,
          eventLog: state.eventLog,
          xieQiIdentityRevealed: state.xieQiIdentityRevealed,
          shopType: state.shopType,
        },
        opts.npcId ?? '',
        rng
      );
      const result: ActionResult = { ...base, narrative: v.narrative, dialogue: v.dialogue, intel: v.intel };
      if (v.ok) {
        if (opts.npcId === 'shen-tinglan') result.shenTinglanFavorDelta = v.favorDelta;
        else if (opts.npcId === 'xie-qi') result.xieQiFavorDelta = v.favorDelta;
        else if (opts.npcId === 'a-zhao') result.azhaoFavorDelta = v.favorDelta;
      }
      return result;
    }
    case 'nap': {
      const n = performNap(rng);
      return {
        ...base,
        narrative: n.narrative,
        napEvent: n.napEvent,
        xiaoerSatisfactionDelta: n.xiaoerSatisfactionDelta,
      };
    }
    case 'street_wander': {
      const s = performStroll(
        { day: state.day, shopType: state.shopType, xieQiFavor: state.xieQiFavor, shopItems: state.shopItems },
        rng
      );
      return {
        ...base,
        narrative: s.narrative,
        strollKind: s.strollKind,
        goldDelta: s.goldDelta,
        xieQiFavorDelta: s.xieQiFavorDelta,
        bargain: s.bargain,
        intel: s.intel,
      };
    }
    default:
      return null;
  }
}

function actionLabel(actionId: string): string {
  const map: Record<string, string> = {
    afternoon_patrol: '午后巡查',
    visit_npc: '拜访NPC',
    nap: '小睡片刻',
    street_wander: '市井闲逛',
    market_recruit: '市场招聘',
  };
  return map[actionId] ?? actionId;
}

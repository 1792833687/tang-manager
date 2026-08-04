/**
 * 《我在唐朝当掌柜》长安故人 · 六位新 NPC 纯函数（TANG-MIST-002 模块三/四）
 * 纯函数（可测；不直接调用 store）：
 * - buildInitialGameNPCs：开局六位 NPC（全部 locked、好感 0）
 * - ensureNpcFog：把六位新 NPC 的迷雾条目并入 fogOfWar.npcs（文案来自 config，M1 接口填数据）
 * - checkNPCUnlocks：每日打烊检查六位登场条件（声望/评分/地图解锁/负债/阿昭好感）；
 *   locked→available→active（active=可拜访）；阿萤暗示/明确链式登场
 * - updateNPCFavorPure：好感增减（clamp 0-100）+ 跨阈值专属功能解锁（程掌柜/萨迪/上官）
 * - npcVisitCooldownOk / performNpcVisit：拜访（3 天冷却；对话 3-5 句；好感 +3~8；20% 情报；
 *   陆伯往事 / 上官政令预知 / 萨迪商路玉佩）
 * - performBuyInformation：苏大娘买情报（3 天冷却；5 两 + 5 精力；1-3 条情报）
 * - redeemAyingPure / refuseAyingPure：阿萤赎身 / 婉拒（阿昭好感归零+离职+带走一半熟客）
 * - performSuDaniangFreeIntel：苏大娘每月主动送情报（好感 ≥60）
 * - visitableGameNpcs：午后面板可选池（已登场 + 冷却已过 + 当日未拜访）
 * 铁律：古风措辞；纯函数可测；不持有游戏状态；凛冬要塞零触碰。
 */
import { TANG_NPCS, tangNpcById, type GameNPCConfig } from '@/config/tang-npcs';
import type { ClueCategory } from '@/types/tang-clues';
import type { Faction } from '@/types/tang-factions';
import type { FogState, GameNPC, NPCFog } from '@/types/tang-manager';

// ============================================================
// 常量（用户 3.2-3.7 逐字；工程定值注释）
// ============================================================

/** 拜访冷却（天；用户：3 天冷却） */
export const NPC_VISIT_COOLDOWN_DAYS = 3;
/** 拜访精力消耗（与午后拜访一致，工程定 15） */
export const NPC_VISIT_ENERGY_COST = 15;
/** 拜访好感变动（+3~8） */
export const NPC_VISIT_FAVOR_MIN = 3;
export const NPC_VISIT_FAVOR_MAX = 8;
/** 拜访额外情报概率（20%；40% 线索/30% 势力/30% 行业，与旧拜访一致） */
export const NPC_VISIT_INTEL_CHANCE = 0.2;
/** 陆伯往事交谈次数区间（用户：5-8 次） */
export const LU_BO_CONVO_MIN = 5;
export const LU_BO_CONVO_MAX = 8;
/** 陆伯登场：负债清零后至少 10 天（用户：10-15 天；取下限便于测试，注释） */
export const LU_BO_UNLOCK_MIN_DAYS = 10;
/** 苏大娘买情报：价格 5 两 / 精力 5 / 冷却 3 天 / 情报 1-3 条（用户 3.2 逐字） */
export const SU_DANIANG_INTEL_PRICE = 5;
export const SU_DANIANG_INTEL_ENERGY = 5;
export const SU_DANIANG_INTEL_COOLDOWN_DAYS = 3;
export const SU_DANIANG_INTEL_MIN = 1;
export const SU_DANIANG_INTEL_MAX = 3;
/** 苏大娘每月主动送情报（好感 ≥60；月终打烊概率 50%） */
export const SU_DANIANG_FREE_INTEL_FAVOR = 60;
export const SU_DANIANG_FREE_INTEL_CHANCE = 0.5;
/** 阿萤赎金（用户 3.7 逐字：100 两） */
export const AYING_REDEEM_PRICE = 100;
/** 阿萤暗示/明确好感阈值（用户 3.7：≥60 暗示 / ≥80 明确） */
export const AYING_HINT_FAVOR = 60;
export const AYING_CLEAR_FAVOR = 80;
/** 阿萤在店天数 → 兄妹同心（≥60 天）+ 阿昭 ≥90（用户 3.7） */
export const AYING_XIONGMEI_DAYS = 60;
export const AYING_XIONGMEI_AZHAO_FAVOR = 90;
/** 程掌柜合作 / 进货折扣（用户 3.3：≥50 联接官单 / ≥70 进价 -10%） */
export const CHENG_COOP_FAVOR = 50;
export const CHENG_DISCOUNT_FAVOR = 70;
/** 萨迪隐藏商路 / 赠玉佩（用户 3.5：≥50 / ≥80） */
export const SADI_ROUTE_FAVOR = 50;
export const SADI_JADE_FAVOR = 80;
/** 上官政令预知 / 引荐朝臣（用户 3.6：≥60 / ≥80） */
export const SHANGGUAN_DECREE_FAVOR = 60;
export const SHANGGUAN_COURT_FAVOR = 80;
/** 阿萤告知沈听澜隐藏线索（用户 3.7：≥50） */
export const AYING_CLUE_FAVOR = 50;

/** 情报类型（苏大娘买情报） */
export type NpcIntelKind = 'region' | 'faction' | 'npcSecret' | 'industry';

/** 单条情报 */
export interface NpcIntel {
  kind: NpcIntelKind;
  /** 古风情报文案 */
  text: string;
  /** 地图点位揭示（kind=region 时携带未探明节点 id；store 落库 revealRegion） */
  regionNodeId?: string;
}

// ============================================================
// 初始状态 / 迷雾条目
// ============================================================

/** 开局六位新 NPC（全部 locked、好感 0；立绘/文案来自 config） */
export function buildInitialGameNPCs(): Record<string, GameNPC> {
  const out: Record<string, GameNPC> = {};
  for (const c of TANG_NPCS) {
    out[c.id] = {
      id: c.id,
      name: c.name,
      gender: c.gender,
      age: c.age,
      identity: c.identity,
      location: c.location,
      favor: 0,
      status: 'locked',
      portrait: c.portrait,
      personality: c.personality,
      speakingStyle: c.speakingStyle,
      background: c.background,
      heartSecret: c.heartSecret,
      trueAttitude: c.trueAttitude,
      hiddenStory: c.hiddenStory,
      function: c.function,
    };
  }
  return out;
}

/** 把六位新 NPC 的迷雾条目并入 fogOfWar.npcs（trueAttitude/hiddenStory 文案来自 config；M1 接口填数据） */
export function ensureNpcFog(fog: FogState, npcs: Record<string, GameNPC>): FogState {
  const missing: Record<string, NPCFog> = {};
  for (const npc of Object.values(npcs)) {
    if (fog.npcs[npc.id]) continue;
    missing[npc.id] = {
      npcId: npc.id,
      backgroundRevealed: false,
      heartRevealed: false,
      trueAttitudeRevealed: false,
      fullStoryRevealed: false,
      trueAttitude: npc.trueAttitude,
      hiddenStory: npc.hiddenStory,
    };
  }
  if (Object.keys(missing).length === 0) return fog;
  return { ...fog, npcs: { ...fog.npcs, ...missing } };
}

// ============================================================
// 登场判定（checkNPCUnlocks：每日打烊）
// ============================================================

/** 登场判定所需状态子集（只读；store 组装传入） */
export interface NpcUnlockState {
  day: number;
  reputation: number;
  score: number;
  legacyDebt: number;
  xiaoerFavor: number;
  unlockedLayers: readonly string[];
  visitedNodes: readonly string[];
  factions: readonly Faction[];
  gameNPCs: Record<string, GameNPC>;
  /** 旧债清零日（null=从未清零；陆伯登场用，checkNPCUnlocks 内惰性维护） */
  legacyDebtClearedDay: number | null;
  ayingHinted: boolean;
  ayingRefused: boolean;
  /** 陆伯往事交谈目标次数（登场时 5-8 取定；测试可注入） */
  luBoConvoTarget?: number;
}

/** 登场判定结果 */
export interface NpcUnlockResult {
  npcs: Record<string, GameNPC>;
  /** 本次状态变更的 NPC id（locked→available / locked→active；UI 展示新登场） */
  newlyUnlocked: string[];
  /** 非登场事件文案（阿萤暗示等；store 记 eventLog） */
  hintEvents: string[];
  /** 旧债清零日（可能更新） */
  legacyDebtClearedDay: number | null;
  /** 陆伯往事交谈目标次数（首次登场时 5-8 取定） */
  luBoConvoTarget?: number;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 平康坊势力关系（首探平康坊 = 与该势力已有往来） */
function pingkangRelationship(factions: readonly Faction[]): number {
  return factions.find((f) => f.id === 'pingkang')?.relationship ?? 0;
}

/** 登场文案（古风；返回 null 表示不登场） */
function appearNarrative(npcId: string, day: number): string {
  const name = tangNpcById(npcId)?.name ?? npcId;
  const lines: Record<string, string> = {
    su_daniang: `你闻说平康坊醉太平的苏大娘消息灵通，便去拜会。她倚着柜台笑道：“往后常来坐坐，大娘这儿什么都知道。”`,
    cheng_zhanggui: `你踏入西市锦绣坊，程掌柜正在清点绸缎，见你打量货架，微微一笑：“西市的水深着呢，掌柜若想趟，得先会看人。”`,
    lu_old_servant: `这一日，你见店门外站着个佝偻的老者，手里攥着口旧茶壶，见了你，眼眶一热：“少爷……老朽是陆府的旧人，叫陆伯。”`,
    sadi_merchant: `波斯邸里，一位胡商拦住你：“朋友，你买了我家的货，便是我的朋友。我叫萨迪，波斯来的。”`,
    shangguan_gongzi: `巍明楼上，一位衣冠楚楚的公子向你举杯：“在下上官氏，久闻掌柜之名，今日得见，幸会。”`,
    a_ying: `平康坊的曲声里，阿萤抱着琵琶远远望见你，又怯怯地缩回了帘后——那是阿昭失散多年的妹妹。`,
  };
  return lines[npcId] ?? `${name} 登场了（第 ${day} 日）。`;
}

/**
 * 每日打烊检查六位 NPC 登场条件（纯函数）：
 * - 苏大娘：声望≥400 或 首探平康坊（pingkang 关系 >0）
 * - 程掌柜：评分≥2.5 且已解锁东市西市（首探西市）
 * - 陆伯：旧债清零后 ≥10 日（清零日惰性维护；再负债则重置）
 * - 萨迪：首笔波斯邸交易（到访波斯邸）
 * - 上官：首进巍明楼
 * - 阿萤：阿昭好感 ≥60 暗示 → ≥80 明确（available）→ 支付赎金（redeemAying → active）
 * 返回更新后的 NPC 表、新登场列表、暗示事件文案与清零日。
 */
export function checkNPCUnlocks(state: NpcUnlockState, rng: () => number = Math.random): NpcUnlockResult {
  const npcs: Record<string, GameNPC> = {};
  for (const [k, v] of Object.entries(state.gameNPCs)) npcs[k] = v;
  const newlyUnlocked: string[] = [];
  const hintEvents: string[] = [];
  let clearedDay = state.legacyDebtClearedDay;

  const markActive = (id: string): void => {
    const cur = npcs[id];
    if (!cur || cur.status !== 'locked') return;
    npcs[id] = { ...cur, status: 'active' };
    newlyUnlocked.push(id);
    hintEvents.push(`[第${state.day}日] ${appearNarrative(id, state.day)}`);
  };

  // 1) 苏大娘（声望≥400 或 首探平康坊）
  const su = npcs['su_daniang'];
  if (su && su.status === 'locked' && (state.reputation >= 400 || pingkangRelationship(state.factions) > 0)) {
    markActive('su_daniang');
  }

  // 2) 程掌柜（评分≥2.5 且 L2 解锁首探西市）
  const cheng = npcs['cheng_zhanggui'];
  if (cheng && cheng.status === 'locked' && state.score >= 2.5 && state.unlockedLayers.includes('east_west_market')) {
    markActive('cheng_zhanggui');
  }

  // 3) 陆伯（旧债清零后 ≥10 日；清零日惰性维护）
  const lu = npcs['lu_old_servant'];
  if (lu && lu.status === 'locked') {
    if (state.legacyDebt > 0) {
      clearedDay = null; // 又欠债：重置清零日
    } else if (clearedDay === null) {
      clearedDay = state.day; // 首次清零：记录清零日（本日不登场）
    } else if (state.day - clearedDay >= LU_BO_UNLOCK_MIN_DAYS) {
      markActive('lu_old_servant');
    }
  }

  // 4) 萨迪（首笔波斯邸交易：到访波斯邸）
  const sadi = npcs['sadi_merchant'];
  if (sadi && sadi.status === 'locked' && state.visitedNodes.includes('bosidian')) {
    markActive('sadi_merchant');
  }

  // 5) 上官（首进巍明楼）
  const shangguan = npcs['shangguan_gongzi'];
  if (shangguan && shangguan.status === 'locked' && state.visitedNodes.includes('weiming-lou')) {
    markActive('shangguan_gongzi');
  }

  // 6) 阿萤（阿昭好感 ≥60 暗示 → ≥80 明确）
  const aying = npcs['a_ying'];
  if (aying && !state.ayingRefused && aying.status === 'locked') {
    if (state.xiaoerFavor >= AYING_HINT_FAVOR && !state.ayingHinted) {
      hintEvents.push(
        `[第${state.day}日] 平康坊的曲声里，阿萤远远望见你，欲言又止，最后只留下一句：“掌柜……听说您的店里，有位叫阿昭的姑娘？”`
      );
    }
    if (state.xiaoerFavor >= AYING_CLEAR_FAVOR && state.ayingHinted) {
      npcs['a_ying'] = { ...aying, status: 'available' };
      newlyUnlocked.push('a_ying');
      hintEvents.push(
        `[第${state.day}日] 阿萤终于鼓足勇气拦住你，眼眶通红：“掌柜的，求您赎我出去……我拿 100 两赎身，往后给您做牛做马都行。”`
      );
    }
  }

  // 陆伯登场时取定往事交谈目标次数（5-8）
  let luBoConvoTarget = state.luBoConvoTarget;
  if (newlyUnlocked.includes('lu_old_servant') && luBoConvoTarget === undefined) {
    luBoConvoTarget = randInt(LU_BO_CONVO_MIN, LU_BO_CONVO_MAX, rng);
  }

  return { npcs, newlyUnlocked, hintEvents, legacyDebtClearedDay: clearedDay, luBoConvoTarget };
}

// ============================================================
// 好感增减 + 跨阈值专属功能解锁
// ============================================================

/** 专属功能标记（store 落库字段；updateNPCFavorPure 返回需写入的标记） */
export interface NpcRuntimeFlags {
  chengCooperation: boolean;
  chengDiscountCategory: string | null;
  sadiHiddenRoute: boolean;
  sadiJadeGift: boolean;
  shangguanCourtIntro: boolean;
}

/** 好感更新结果 */
export interface NpcFavorUpdateResult {
  npcs: Record<string, GameNPC>;
  /** 实际变动量（clamp 后） */
  favorDelta: number;
  /** 新解锁专属功能文案（古风；eventLog 展示） */
  functionUnlocks: string[];
  /** 需写入 store 的功能标记 */
  flags: Partial<NpcRuntimeFlags>;
}

function clampFavor(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

/**
 * 好感增减（clamp 0-100）+ 跨阈值专属功能解锁：
 * - 程掌柜：≥50 官单合作 / ≥70 某类进价 -10%
 * - 萨迪：≥50 隐藏商路 / ≥80 赠玉佩
 * - 上官：≥80 引荐朝臣
 * （苏大娘 ≥60 送情报 / 阿萤 ≥50 沈线线索由拜访/打烊钩子实时判定，无需标记）
 */
export function updateNPCFavorPure(
  npcs: Record<string, GameNPC>,
  npcId: string,
  amount: number
): NpcFavorUpdateResult {
  const cur = npcs[npcId];
  if (!cur) return { npcs, favorDelta: 0, functionUnlocks: [], flags: {} };
  const before = cur.favor;
  const after = clampFavor(before + amount);
  const next = { ...cur, favor: after };
  const out: Record<string, GameNPC> = { ...npcs, [npcId]: next };
  const functionUnlocks: string[] = [];
  const flags: Partial<NpcRuntimeFlags> = {};

  if (npcId === 'cheng_zhanggui') {
    if (before < CHENG_COOP_FAVOR && after >= CHENG_COOP_FAVOR) {
      flags.chengCooperation = true;
      functionUnlocks.push('程掌柜点头应下：往后接了官单，咱们利润对半共享。');
    }
    if (before < CHENG_DISCOUNT_FAVOR && after >= CHENG_DISCOUNT_FAVOR) {
      flags.chengDiscountCategory = '布匹';
      functionUnlocks.push('程掌柜松口：西市的布匹进价，我给你让一成利（进价 -10%）。');
    }
  }
  if (npcId === 'sadi_merchant') {
    if (before < SADI_ROUTE_FAVOR && after >= SADI_ROUTE_FAVOR) {
      flags.sadiHiddenRoute = true;
      functionUnlocks.push('萨迪压低声音：大漠深处有条商路，我带你走一遭（隐藏商路开启）。');
    }
    if (before < SADI_JADE_FAVOR && after >= SADI_JADE_FAVOR) {
      flags.sadiJadeGift = true;
      functionUnlocks.push('萨迪解下腰间的玉佩相赠：此玉随我走了千里丝路，今日赠你（特殊商品）。');
    }
  }
  if (npcId === 'shangguan_gongzi') {
    if (before < SHANGGUAN_COURT_FAVOR && after >= SHANGGUAN_COURT_FAVOR) {
      flags.shangguanCourtIntro = true;
      functionUnlocks.push('上官公子颔首：改日引你见几位朝中好友，日后自有助力（引荐朝臣）。');
    }
  }

  return { npcs: out, favorDelta: after - before, functionUnlocks, flags };
}

// ============================================================
// 拜访系统（3 天冷却；对话 3-5 句；好感 +3~8；20% 情报）
// ============================================================

/** 拜访冷却是否已过（lastVisitDay=0 表示从未拜访） */
export function npcVisitCooldownOk(day: number, lastVisitDay: number | undefined): boolean {
  if (!lastVisitDay || lastVisitDay <= 0) return true;
  return day - lastVisitDay >= NPC_VISIT_COOLDOWN_DAYS;
}

/** 拜访结果 */
export interface NpcVisitResult {
  ok: boolean;
  narrative: string;
  dialogue: string[];
  favorDelta: number;
  intel?: { kind: 'clue' | 'faction' | 'industry'; text: string; clueCategory?: ClueCategory };
  /** 陆伯家族往事本次解锁段落 */
  familyStoryLine?: string;
  /** 陆伯往事集齐（隐藏结局「沉冤得雪」条件） */
  storyComplete: boolean;
  /** 上官政令预知（好感 ≥60；下一月政令预告文案） */
  decreePreview?: string;
  /** 阿萤沈听澜隐藏线索提示（好感 ≥50） */
  ayingClueHint?: string;
}

/** 拜访上下文（store 组装；favor 用于上官/阿萤/萨迪阈值文案） */
export interface NpcVisitContext {
  day: number;
  npc: GameNPC;
  favor: number;
  lastVisitDay: number | undefined;
  convoCount: number;
  convoTarget: number;
  luBoStoryRevealed: boolean;
}

function rollVisitIntel(npcName: string, rng: () => number): NpcVisitResult['intel'] {
  const roll = rng();
  if (roll < 0.4) {
    const categories: ClueCategory[] = ['shen', 'xie', 'business', 'secret'];
    const cat = categories[Math.floor(rng() * categories.length)]!;
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

/**
 * 拜访 NPC（纯函数；store 落库：好感/冷却/交谈计数/行动消耗/线索）。
 * 对话用该 NPC 配置文案池；好感 +3~8；20% 额外情报。
 * 陆伯：交谈计数 +1，按段落解锁家族往事，集齐 → storyComplete（隐藏结局条件）。
 * 上官：好感 ≥60 附政令预知；萨迪：好感阈值由 updateNPCFavor 处理（此处仅文案）。
 */
export function performNpcVisit(ctx: NpcVisitContext, rng: () => number = Math.random): NpcVisitResult {
  const { npc, day, lastVisitDay, convoCount, convoTarget } = ctx;
  if (!npcVisitCooldownOk(day, lastVisitDay)) {
    return {
      ok: false,
      narrative: `你本想去拜访 ${npc.name}，但前番拜访未满三日，此时登门反倒失礼，只得作罢。`,
      dialogue: [],
      favorDelta: 0,
      storyComplete: ctx.luBoStoryRevealed,
    };
  }
  const config = tangNpcById(npc.id);
  const delta = randInt(NPC_VISIT_FAVOR_MIN, NPC_VISIT_FAVOR_MAX, rng);
  const dialogue = config?.dialogue ?? ['你与故人叙了叙旧，宾主尽欢。'];
  const intel = rng() < NPC_VISIT_INTEL_CHANCE ? rollVisitIntel(npc.name, rng) : undefined;

  // 陆伯家族往事（逐段解锁；集齐 → 隐藏故事揭示）
  let familyStoryLine: string | undefined;
  let storyComplete = ctx.luBoStoryRevealed;
  if (npc.id === 'lu_old_servant' && !ctx.luBoStoryRevealed) {
    const segments = config?.familyStory ?? [];
    const idx = convoCount; // 本次展示第 convoCount 段（0-based；计数在 store 落库 +1）
    if (segments[idx]) familyStoryLine = segments[idx]!;
    if (convoCount + 1 >= convoTarget) storyComplete = true;
  }

  // 上官：好感 ≥60 提前透露下月政令（政令系统 generateImperialDecree 预知）
  let decreePreview: string | undefined;
  if (npc.id === 'shangguan_gongzi' && npc.favor >= SHANGGUAN_DECREE_FAVOR) {
    decreePreview =
      '上官公子呷了口酒，低声道：“下月的政令，我已听到些风声——或与市中商税有关。掌柜早做打算。”';
  }

  // 阿萤：好感 ≥50 告知沈听澜隐藏线索（generateClue 沈线由 store 落库）
  let ayingClueHint: string | undefined;
  if (npc.id === 'a_ying' && npc.favor >= AYING_CLUE_FAVOR) {
    ayingClueHint =
      '阿萤咬着唇，忽然道：“掌柜……我隐约记得，当年拐我的人，与东市沈家商号的一位管事走得极近。”';
  }

  return {
    ok: true,
    narrative: `你备了些薄礼去拜访 ${npc.name}，聊了半晌，临别时彼此都觉亲近了几分（好感 +${delta}）。`,
    dialogue,
    favorDelta: delta,
    intel,
    familyStoryLine,
    storyComplete,
    decreePreview,
    ayingClueHint,
  };
}

// ============================================================
// 苏大娘买情报（3 天冷却；5 两 + 5 精力；1-3 条）
// ============================================================

/** 买情报所需状态子集（未探明区域/势力/线索） */
export interface NpcIntelContext {
  day: number;
  fogOfWar: FogState;
  factions: readonly Faction[];
  clues: readonly { id: string; content: string }[];
  suDaniangLastIntelDay: number | undefined;
}

/** 买情报结果 */
export interface BuyIntelResult {
  ok: boolean;
  narrative: string;
  intel: NpcIntel[];
}

/** 冷却是否已过（lastDay=0 表示从未买过） */
export function suDaniangCooldownOk(day: number, lastDay: number | undefined): boolean {
  if (!lastDay || lastDay <= 0) return true;
  return day - lastDay >= SU_DANIANG_INTEL_COOLDOWN_DAYS;
}

/** 未探明区域点（买情报时随机揭示 1 个） */
function unrevealedNodeIds(fog: FogState): string[] {
  return Object.values(fog.regions)
    .filter((r) => !r.revealed)
    .map((r) => r.nodeId);
}

/**
 * 苏大娘买情报（纯函数；store 落库：扣 5 两 + 5 精力、写冷却、逐条应用）。
 * 情报 1-3 条：地图点位揭示 / 势力动向 / 人物秘辛 / 行业预告。
 */
export function performBuyInformation(ctx: NpcIntelContext, rng: () => number = Math.random): BuyIntelResult {
  if (!suDaniangCooldownOk(ctx.day, ctx.suDaniangLastIntelDay)) {
    return {
      ok: false,
      narrative: '苏大娘把瓜子壳一吐：“前儿刚买过，大娘的情报可不是大白菜，三日后再来。”',
      intel: [],
    };
  }
  const count = randInt(SU_DANIANG_INTEL_MIN, SU_DANIANG_INTEL_MAX, rng);
  const intel: NpcIntel[] = [];
  const hidden = unrevealedNodeIds(ctx.fogOfWar);
  const kinds: NpcIntelKind[] = ['region', 'faction', 'npcSecret', 'industry'];

  for (let i = 0; i < count; i += 1) {
    // 无未探明区域时 region 情报降级为 faction
    let kind = kinds[Math.floor(rng() * kinds.length)]!;
    if (kind === 'region' && hidden.length === 0) kind = 'faction';
    if (kind === 'region') {
      const nodeId = hidden[Math.floor(rng() * hidden.length)]!;
      intel.push({
        kind,
        regionNodeId: nodeId,
        text: `苏大娘压低声音：“${nodeId} 那处地方，近日常有贵人出没，你若有闲，不妨去瞧瞧。”`,
      });
    } else if (kind === 'faction') {
      const f = ctx.factions[Math.floor(rng() * ctx.factions.length)];
      intel.push({ kind, text: `苏大娘呷了口酒：“${f ? f.name : '城中某方势力'}近来动作不小，你留个心眼。”` });
    } else if (kind === 'npcSecret') {
      intel.push({ kind, text: '苏大娘凑近耳语：“有位故人心里压着桩旧事，你若待他诚心，兴许能换来一桩大机缘。”' });
    } else {
      intel.push({ kind, text: '苏大娘敲着桌面：“下月行市怕是要变，眼下囤货的时机，怕是要来了。”' });
    }
  }
  return {
    ok: true,
    narrative: `你塞给苏大娘 5 两银子，她笑眯眯地收进袖中，压低声音道：“行，大娘给你挑几桩值钱的。”`,
    intel,
  };
}

// ============================================================
// 阿萤赎身 / 婉拒
// ============================================================

/** 赎身（支付 100 两 → 登场帮店）；纯函数返回是否可赎 */
export function redeemAyingPure(silver: number): { ok: boolean; reason?: string } {
  if (silver < AYING_REDEEM_PRICE) {
    return { ok: false, reason: `银两不足（需 ${AYING_REDEEM_PRICE} 两）` };
  }
  return { ok: true };
}

/** 婉拒后果（纯函数）：带走一半熟客（knownGuests 减半）；阿昭好感归零+离职由 store 应用 */
export function refuseAyingPure<T>(knownGuests: Record<string, T> | undefined): { knownGuests: Record<string, T> } {
  const entries = Object.entries(knownGuests ?? {});
  const kept = entries.filter((_, i) => i % 2 === 0); // 取一半（工程定：隔一留一，注释）
  return { knownGuests: Object.fromEntries(kept) };
}

// ============================================================
// 苏大娘每月主动送情报（好感 ≥60；月终打烊概率）
// ============================================================

/** 是否触发月终主动送情报（day % 30 === 0 且概率 50%） */
export function suDaniangFreeIntelRoll(day: number, favor: number, rng: () => number = Math.random): boolean {
  if (favor < SU_DANIANG_FREE_INTEL_FAVOR) return false;
  if (day % 30 !== 0) return false;
  return rng() < SU_DANIANG_FREE_INTEL_CHANCE;
}

/** 主动送情报文案（与买情报同源生成；store 记 eventLog） */
export function performSuDaniangFreeIntel(ctx: NpcIntelContext, rng: () => number = Math.random): string {
  const out = performBuyInformation({ ...ctx, suDaniangLastIntelDay: undefined }, rng);
  return out.ok && out.intel.length > 0
    ? `苏大娘让伙计给你捎来一张纸条：“这个月的风声，大娘白送你。${out.intel.map((i) => i.text).join('')}”`
    : '苏大娘让人捎来话：“这个月没什么大事，掌柜安心做生意便是。”';
}

// ============================================================
// 午后面板可选池（已登场 + 冷却已过 + 当日未拜访）
// ============================================================

/** 午后「拜访NPC」可选池（长安故人六位）：已登场（active）且冷却已过、当日未拜访 */
export function visitableGameNpcs(
  gameNPCs: Record<string, GameNPC>,
  day: number,
  cooldowns: Record<string, number> | undefined,
  afternoonActions: readonly string[] | undefined
): Array<{ npcId: string; name: string; unavailableReason?: string }> {
  if ((afternoonActions ?? []).includes('visit_npc')) {
    // 当日已拜访过任意 NPC（含旧四位的 performAfternoonAction）→ 不再可选
    return TANG_NPCS.map((c) => ({ npcId: c.id, name: c.name, unavailableReason: '今日已拜访过故人' }));
  }
  return TANG_NPCS.map((c) => {
    const npc = gameNPCs[c.id];
    if (!npc || npc.status !== 'active') {
      return { npcId: c.id, name: c.name, unavailableReason: '尚未登场' };
    }
    if (!npcVisitCooldownOk(day, cooldowns?.[c.id])) {
      return { npcId: c.id, name: c.name, unavailableReason: '三日内已拜访过' };
    }
    return { npcId: c.id, name: c.name };
  });
}

/** 好感档位评语（古风；详情弹窗关系状态） */
export function npcFavorVerdict(favor: number): string {
  if (favor >= 80) return '生死之交';
  if (favor >= 60) return '推心置腹';
  if (favor >= 40) return '相交莫逆';
  if (favor >= 20) return '初有来往';
  return '素不相识';
}

/** 取 config（供 UI 层读取对话池/地点等；保持单一数据源） */
export function npcConfigOf(id: string): GameNPCConfig | undefined {
  return tangNpcById(id);
}

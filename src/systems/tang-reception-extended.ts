/**
 * 《我在唐朝当掌柜》接待操作扩展（TANG-RCP-001 模块二）
 * 纯函数：recommendItem / chatWithGuest / giveGift / rejectGuestPolitely。
 * 规则摘要（用户 2.2 / 2.4 逐字）：
 * - recommendItem：推荐库房商品；命中偏好 消费×1.5+满意度+15 / 未命中 ×0.7-10「被宰」；
 *   精力-5；偏好未揭示时 50/50 随机；商品从 shopItems 校验存在（不消耗，注释）。
 * - chatWithGuest：精力额外-5；结果概率——情报线索 40%（地图点位/市易务预告）/
 *   NPC传言 25%（沈/谢/债主线索）/进货渠道 15%（当日某类进货-10%）/偏好揭示 50%/纯聊天 10%（好感+3）。
 * - giveGift：消耗库房商品 1 份；好感+20（第 3 次 +10 / 第 4 次起 +5，用 giftCount 追踪）；
 *   下次消费×1.5；精力-3。
 * - rejectGuestPolitely（用户 2.4 逐字）：redirect 声望+2 但隔壁店好感+5（store 字段或注释）/
 *   excuse 精力额外-3 无负面 / delegate 阿昭满意度+1 收益减半 / refuse 原逻辑评分概率-0.02。
 * 可测性：rng 可选参数（默认 Math.random）。
 */
import { checkPreferenceMatch } from '@/systems/tang-guest-preference';
import type {
  ChatResult,
  GiftResult,
  Guest,
  PoliteRejectMethod,
  PoliteRejectResult,
  RecommendResult,
  ShopItem,
} from '@/types/tang-manager';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 闲聊情报文案（40% 情报线索 / 25% NPC传言 / 15% 进货渠道；古风自拟） */
const CHAT_INTEL_TEXTS: readonly string[] = [
  '东市坊门口今日新挂了一幅舆图，标注了几处无人问津的冷巷。',
  '听市易务的小吏说，明日有批平价官货发卖，赶早能捡漏。',
];
const CHAT_RUMOR_TEXTS: readonly string[] = [
  '邻桌说，沈氏商号的东家最近常在西市盘铺子。',
  '茶楼里有人低声议论，谢七爷前夜在赌坊输红了眼。',
  '街口那债主这几日总往南边跑，怕是有人要倒大霉。',
];
const CHAT_PROCUREMENT_TEXTS: readonly string[] = [
  '这位客人指点：明日时蔬、布匹、药材类进货可压价一成。',
];

/** 婉拒四法文案（古风自拟） */
const REJECT_TEXT: Record<PoliteRejectMethod, string> = {
  redirect: '你拱手笑道：客官这事小店办不妥，东市同记手艺更好，我为您修书一封引荐。',
  excuse: '你欠身告罪：小店今日实在腾不开人手，改日定当亲自招呼。',
  delegate: '你唤来阿昭：好生伺候这位客官，账上记我名下。',
  refuse: '你面色为难，终究摇头婉拒了这位客人。',
};

/**
 * 推荐库房商品（用户 2.2 逐字：命中偏好 消费×1.5+满意度+15 / 未命中 ×0.7-10「被宰」；
 * 精力-5；偏好未揭示时 50/50 随机；从 shopItems 校验存在——推荐不消耗库存，注释）。
 */
export function recommendItem(
  guest: Guest,
  itemId: string,
  state: { shopItems: readonly ShopItem[] },
  rng: () => number = Math.random
): RecommendResult {
  const item = (state.shopItems ?? []).find((it) => it.id === itemId);
  if (!item) {
    return { ok: false, reason: '库房查无此物', income: 0, energyConsumed: 0, satisfactionDelta: 0, matched: null, content: '', handledNote: '' };
  }
  const revealed = (guest.preferences ?? []).some((p) => p.revealed);
  let matched: boolean;
  let satisfactionDelta: number;
  let multiplier: number;
  if (revealed) {
    // 命中判定复用 checkPreferenceMatch；但推荐有专属倍率（×1.5 / ×0.7），与偏好匹配通用倍率（×1.3/×0.8）不同
    const r = checkPreferenceMatch(guest, 'recommend', itemId, item.name);
    matched = r.matched === true;
    multiplier = matched ? 1.5 : 0.7;
    satisfactionDelta = matched ? 15 : -10;
  } else {
    // 偏好未揭示：50/50 随机
    matched = rng() < 0.5;
    multiplier = matched ? 1.5 : 0.7;
    satisfactionDelta = matched ? 15 : -10;
  }
  const income = round1(guest.baseConsumption * multiplier);
  const hitText = matched
    ? `你捧出「${item.name}」，正中这位客人下怀，他眉眼舒展，多点了好些。`
    : `你荐了「${item.name}」，客人却嫌不对胃口，嘀咕着「这是要宰客么」，勉强应付。`;
  return {
    ok: true,
    income,
    energyConsumed: 5,
    satisfactionDelta,
    matched,
    content: hitText,
    handledNote: matched ? `荐「${item.name}」中意，入账 ${income} 两` : `荐「${item.name}」被嫌，入账 ${income} 两`,
  };
}

/**
 * 闲聊（用户 2.2 逐字概率：情报线索 40%/NPC传言 25%/进货渠道 15%/偏好揭示 50%/纯聊天 10%）。
 * 多概率独立掷骰可同时命中；返回 { content, info? }。
 */
export function chatWithGuest(
  guest: Guest,
  state: { shopType: string },
  rng: () => number = Math.random
): ChatResult {
  const parts: string[] = ['你与客人攀谈起来，话头渐热。'];
  const info: { kind: 'intel' | 'rumor' | 'procurement'; text: string }[] = [];
  let reputationChange: number | undefined;
  let favorChange: number | undefined;
  let revealedPreference: ChatResult['revealedPreference'];
  let updatedGuest = guest;

  if (rng() < 0.4) {
    const text = CHAT_INTEL_TEXTS[Math.min(Math.floor(rng() * CHAT_INTEL_TEXTS.length), CHAT_INTEL_TEXTS.length - 1)]!;
    info.push({ kind: 'intel', text });
    parts.push(`客人压低声音：「${text}」`);
  }
  if (rng() < 0.25) {
    const text = CHAT_RUMOR_TEXTS[Math.min(Math.floor(rng() * CHAT_RUMOR_TEXTS.length), CHAT_RUMOR_TEXTS.length - 1)]!;
    info.push({ kind: 'rumor', text });
    parts.push(`闲话间，客人提了一嘴：「${text}」`);
  }
  if (rng() < 0.15) {
    const text = CHAT_PROCUREMENT_TEXTS[0]!;
    info.push({ kind: 'procurement', text });
    parts.push(`临了客人指点进货门道：「${text}」`);
  }
  if (rng() < 0.5) {
    // 偏好揭示 50%：单次掷骰命中即揭示一条未揭示偏好（不叠加 revealPreference 的 observation 二次判定）
    const unrevealed = (updatedGuest.preferences ?? []).filter((p) => !p.revealed);
    if (unrevealed.length > 0) {
      const idx = Math.min(Math.floor(rng() * unrevealed.length), unrevealed.length - 1);
      const target = unrevealed[idx]!;
      updatedGuest = {
        ...updatedGuest,
        preferences: (updatedGuest.preferences ?? []).map((p) =>
          p.type === target.type && p.value === target.value ? { ...p, revealed: true } : p
        ),
        preferenceRevealed: true,
      };
      revealedPreference = { ...target, revealed: true };
      parts.push(`言谈之间，你摸清了这位客人的偏好——「${target.type === 'item' ? '喜' : target.type === 'style' ? '好' : '在意'}${target.value}」。`);
    }
  }
  if (rng() < 0.1) {
    favorChange = 3;
    reputationChange = 1;
    parts.push('这一席话聊得宾主尽欢，客人直夸你待人热忱。');
  }
  if (parts.length === 1) {
    parts.push('虽未聊出什么门道，但彼此都客气周到。');
  }
  return {
    content: parts.join(''),
    energyConsumed: 5,
    income: 0,
    reputationChange,
    favorChange,
    info: info[0] ? info[0] : undefined,
    revealedPreference,
    updatedGuest,
    satisfactionDelta: favorChange ? 3 : 0,
    handledNote: info.length > 0 ? `闲聊探得「${info[0]!.kind === 'intel' ? '情报' : info[0]!.kind === 'rumor' ? '传言' : '门路'}」` : '闲聊一场，宾主尽欢',
  };
}

/**
 * 赠礼（用户 2.2 逐字：消耗库房商品 1 份；好感+20；下次消费×1.5；同客 >2 次递减
 * （第 3 次 +10 / 第 4 次 +5，用 giftCount 字段追踪）；精力-3；商品从 shopItems 扣）。
 */
export function giveGift(
  guest: Guest,
  itemId: string,
  state: { shopItems: readonly ShopItem[] }
): GiftResult {
  const item = (state.shopItems ?? []).find((it) => it.id === itemId);
  if (!item || (item.stock ?? 0) <= 0) {
    return { ok: false, reason: '库房无此物可赠', favorDelta: 0, energyConsumed: 0, income: 0, content: '', handledNote: '', nextConsumptionMultiplier: 1 };
  }
  const giftNo = (guest.giftCount ?? 0) + 1;
  const favorDelta = giftNo <= 2 ? 20 : giftNo === 3 ? 10 : 5; // 第1-2 +20 / 第3 +10 / 第4起 +5
  return {
    ok: true,
    favorDelta,
    energyConsumed: 3,
    income: 0,
    content: `你取出「${item.name}」相赠，客人推辞再三，终是含笑收下（第 ${giftNo} 次收礼，好感 +${favorDelta}）。`,
    handledNote: `赠「${item.name}」好感+${favorDelta}`,
    nextConsumptionMultiplier: 1.5,
    consumedItemId: item.id,
  };
}

/**
 * 婉拒四法（用户 2.4 逐字）：
 * - redirect：声望+2，隔壁店好感+5（neighborFavor 字段，store 或注释占位）；
 * - excuse：精力额外-3（energyConsumed=3），无负面；
 * - delegate：阿昭满意度+1（xiaoerSatisfactionChange=+1），收益减半（income=base×0.5）；
 * - refuse：原逻辑 30% 评分-0.02；type=help 额外声望-2。
 */
export function rejectGuestPolitely(
  guest: Guest,
  method: PoliteRejectMethod,
  rng: () => number = Math.random
): PoliteRejectResult {
  if (method === 'redirect') {
    return {
      ok: true,
      income: 0,
      energyConsumed: 0,
      reputationChange: 2,
      xiaoerSatisfactionChange: 0,
      scoreChange: 0,
      review: 'bad',
      content: REJECT_TEXT.redirect,
      handledNote: '引荐别家，声望+2',
      neighborFavor: 5,
    };
  }
  if (method === 'excuse') {
    return {
      ok: true,
      income: 0,
      energyConsumed: 3,
      reputationChange: 0,
      xiaoerSatisfactionChange: 0,
      scoreChange: 0,
      review: 'bad',
      content: REJECT_TEXT.excuse,
      handledNote: '好言托辞，无伤和气',
    };
  }
  if (method === 'delegate') {
    return {
      ok: true,
      income: round1(guest.baseConsumption * 0.5),
      energyConsumed: 0,
      reputationChange: 0,
      xiaoerSatisfactionChange: 1,
      scoreChange: 0,
      review: 'bad',
      content: REJECT_TEXT.delegate,
      handledNote: `转交阿昭，入账 ${round1(guest.baseConsumption * 0.5)} 两`,
    };
  }
  // refuse：原逻辑 30% 评分-0.02；help 额外声望-2
  return {
    ok: true,
    income: 0,
    energyConsumed: 0,
    reputationChange: guest.type === 'help' ? -2 : 0,
    xiaoerSatisfactionChange: 0,
    scoreChange: rng() < 0.3 ? -0.02 : 0,
    review: 'bad',
    content: REJECT_TEXT.refuse,
    handledNote: '婉拒来客',
  };
}

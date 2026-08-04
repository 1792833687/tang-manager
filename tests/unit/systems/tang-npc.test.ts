/**
 * 长安故人 · 六位新 NPC 纯函数单测（tang-npc-system · TANG-MIST-002 模块三/四）
 * 覆盖：六位登场条件逐项（声望/评分/地图解锁/负债/到访/阿昭好感链式）、
 *       好感揭示阈值（updateNPCFavorPure 跨阈值专属功能 + M1 fog 接口填数据）、
 *       拜访 3 天冷却、赎身流程（明确→支付→登场 / 婉拒带走一半熟客）、
 *       苏大娘买情报冷却与情报条数、月终主动送情报、初始数据完整。
 */
import { describe, expect, it } from 'vitest';
import {
  buildInitialGameNPCs,
  checkNPCUnlocks,
  ensureNpcFog,
  updateNPCFavorPure,
  npcVisitCooldownOk,
  performNpcVisit,
  redeemAyingPure,
  refuseAyingPure,
  performBuyInformation,
  suDaniangCooldownOk,
  suDaniangFreeIntelRoll,
  visitableGameNpcs,
  npcFavorVerdict,
  NPC_VISIT_COOLDOWN_DAYS,
  NPC_VISIT_FAVOR_MIN,
  NPC_VISIT_FAVOR_MAX,
  CHENG_COOP_FAVOR,
  CHENG_DISCOUNT_FAVOR,
  SADI_ROUTE_FAVOR,
  SADI_JADE_FAVOR,
  SHANGGUAN_COURT_FAVOR,
  LU_BO_CONVO_MIN,
  LU_BO_CONVO_MAX,
} from '@/systems/tang-npc-system';
import { buildInitialFogState, checkFogReveals } from '@/systems/tang-fog';
import { TANG_NPCS } from '@/config/tang-npcs';
import { useTangManagerStore } from '@/stores/tang-manager';
import { beforeEach } from 'vitest';
import type { Faction } from '@/types/tang-factions';
import type { GameNPC, FogState, NPCFog } from '@/types/tang-manager';

/** 定序随机（依次吐出给定值，耗尽后 0.5） */
const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function pingkang(relationship: number): Faction {
  return {
    id: 'pingkang',
    name: '平康坊风月场',
    type: 'commercial',
    relationship,
    description: '',
    leader: '赵员外',
    color: '#000',
    perks: [],
  };
}

type UnlockState = Parameters<typeof checkNPCUnlocks>[0];

function unlockState(overrides: Partial<UnlockState> = {}): UnlockState {
  return {
    day: 1,
    reputation: 0,
    score: 1,
    legacyDebt: 0,
    xiaoerFavor: 0,
    unlockedLayers: ['yongle'],
    visitedNodes: [],
    factions: [],
    gameNPCs: buildInitialGameNPCs(),
    legacyDebtClearedDay: null,
    ayingHinted: false,
    ayingRefused: false,
    ...overrides,
  };
}

/** 从结果取指定 NPC */
function npcOf(result: { npcs: Record<string, GameNPC> }, id: string): GameNPC {
  return result.npcs[id]!;
}

describe('初始数据（buildInitialGameNPCs / config）', () => {
  it('六位 NPC 全部初始 locked、好感 0，逐字字段完整（姓名/身份/背景/心结/真实态度/隐藏故事/功能）', () => {
    const npcs = buildInitialGameNPCs();
    expect(TANG_NPCS).toHaveLength(6);
    for (const c of TANG_NPCS) {
      const n = npcs[c.id];
      expect(n).toBeDefined();
      expect(n.status).toBe('locked');
      expect(n.favor).toBe(0);
      expect(n.name).toBeTruthy();
      expect(n.identity).toBeTruthy();
      expect(n.location).toBeTruthy();
      expect(n.portrait).toMatch(/\.svg$/);
      expect(n.background.length).toBeGreaterThan(5);
      expect(n.heartSecret.length).toBeGreaterThan(5);
      expect(n.trueAttitude.length).toBeGreaterThan(5);
      expect(n.hiddenStory.length).toBeGreaterThan(5);
      expect(n.function.length).toBeGreaterThan(5);
      expect(c.dialogue.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('ensureNpcFog：把六位新 NPC 迷雾条目并入 fogOfWar.npcs（trueAttitude/hiddenStory 文案来自 config）', () => {
    const fog = buildInitialFogState({ shenTinglanFavor: 0, xieQiFavor: 0, fuyinFavor: 0, zhaoYuanwaiFavor: 0, xiaoerFavor: 0 });
    const npcs = buildInitialGameNPCs();
    expect(fog.npcs['su_daniang']).toBeUndefined();
    const next = ensureNpcFog(fog, npcs);
    for (const c of TANG_NPCS) {
      const entry: NPCFog | undefined = next.npcs[c.id];
      expect(entry).toBeDefined();
      expect(entry!.backgroundRevealed).toBe(false);
      expect(entry!.trueAttitude).toBe(c.trueAttitude);
      expect(entry!.hiddenStory).toBe(c.hiddenStory);
    }
  });
});

describe('六位登场条件（checkNPCUnlocks 逐项）', () => {
  it('苏大娘：声望≥400 或首探平康坊（pingkang 关系>0）→ active', () => {
    let res = checkNPCUnlocks(unlockState({ reputation: 399 }));
    expect(npcOf(res, 'su_daniang').status).toBe('locked');
    res = checkNPCUnlocks(unlockState({ reputation: 400 }));
    expect(npcOf(res, 'su_daniang').status).toBe('active');
    res = checkNPCUnlocks(unlockState({ reputation: 0, factions: [pingkang(20)] }));
    expect(npcOf(res, 'su_daniang').status).toBe('active');
    expect(res.newlyUnlocked).toContain('su_daniang');
  });

  it('程掌柜：评分≥2.5 且 L2 解锁首探西市 → active', () => {
    let res = checkNPCUnlocks(unlockState({ score: 2.5, unlockedLayers: ['yongle'] }));
    expect(npcOf(res, 'cheng_zhanggui').status).toBe('locked');
    res = checkNPCUnlocks(unlockState({ score: 2.4, unlockedLayers: ['yongle', 'east_west_market'] }));
    expect(npcOf(res, 'cheng_zhanggui').status).toBe('locked');
    res = checkNPCUnlocks(unlockState({ score: 2.5, unlockedLayers: ['yongle', 'east_west_market'] }));
    expect(npcOf(res, 'cheng_zhanggui').status).toBe('active');
  });

  it('陆伯：旧债清零后 ≥10 日登场；清零日惰性维护；再负债重置', () => {
    // 首次清零：记录清零日，本日不登场
    let res = checkNPCUnlocks(unlockState({ day: 5, legacyDebt: 0, legacyDebtClearedDay: null }));
    expect(res.legacyDebtClearedDay).toBe(5);
    expect(npcOf(res, 'lu_old_servant').status).toBe('locked');
    // 清零后第 9 天仍 locked
    res = checkNPCUnlocks(unlockState({ day: 14, legacyDebt: 0, legacyDebtClearedDay: 5 }));
    expect(npcOf(res, 'lu_old_servant').status).toBe('locked');
    // 清零后第 10 天登场
    res = checkNPCUnlocks(unlockState({ day: 15, legacyDebt: 0, legacyDebtClearedDay: 5 }));
    expect(npcOf(res, 'lu_old_servant').status).toBe('active');
    expect(res.newlyUnlocked).toContain('lu_old_servant');
    // 登场时取定交谈目标次数（5-8）
    if (res.luBoConvoTarget !== undefined) {
      expect(res.luBoConvoTarget).toBeGreaterThanOrEqual(LU_BO_CONVO_MIN);
      expect(res.luBoConvoTarget).toBeLessThanOrEqual(LU_BO_CONVO_MAX);
    }
    // 再负债：清零日重置
    res = checkNPCUnlocks(unlockState({ day: 20, legacyDebt: 100, legacyDebtClearedDay: 5 }));
    expect(res.legacyDebtClearedDay).toBeNull();
  });

  it('萨迪：首笔波斯邸交易（到访波斯邸）→ active', () => {
    let res = checkNPCUnlocks(unlockState({ visitedNodes: [] }));
    expect(npcOf(res, 'sadi_merchant').status).toBe('locked');
    res = checkNPCUnlocks(unlockState({ visitedNodes: ['bosidian'] }));
    expect(npcOf(res, 'sadi_merchant').status).toBe('active');
  });

  it('上官公子：首进巍明楼 → active', () => {
    let res = checkNPCUnlocks(unlockState({ visitedNodes: ['weiming-lou'] }));
    expect(npcOf(res, 'shangguan_gongzi').status).toBe('active');
    res = checkNPCUnlocks(unlockState({ visitedNodes: ['huanggong'] }));
    expect(npcOf(res, 'shangguan_gongzi').status).toBe('locked');
  });

  it('阿萤链式：好感≥60 暗示事件 → ≥80 明确（available）→ 仍 locked 直到赎身', () => {
    // <60：无事件，locked
    let res = checkNPCUnlocks(unlockState({ xiaoerFavor: 50 }));
    expect(npcOf(res, 'a_ying').status).toBe('locked');
    expect(res.hintEvents.length).toBe(0);
    // ≥60：暗示事件，仍 locked
    res = checkNPCUnlocks(unlockState({ xiaoerFavor: 60 }));
    expect(npcOf(res, 'a_ying').status).toBe('locked');
    expect(res.hintEvents.some((h) => h.includes('阿昭'))).toBe(true);
    // ≥80 且已暗示：available（明确，可赎）
    res = checkNPCUnlocks(unlockState({ xiaoerFavor: 80, ayingHinted: true }));
    expect(npcOf(res, 'a_ying').status).toBe('available');
    expect(res.newlyUnlocked).toContain('a_ying');
  });
});

describe('好感揭示阈值（updateNPCFavorPure + M1 fog 接口填数据）', () => {
  it('好感增减 clamp 0-100；跨阈值专属功能解锁（程掌柜/萨迪/上官）', () => {
    let npcs = buildInitialGameNPCs();
    // 程掌柜 ≥50 官单合作；≥70 进价 -10%
    let r = updateNPCFavorPure(npcs, 'cheng_zhanggui', CHENG_COOP_FAVOR);
    expect(r.flags.chengCooperation).toBe(true);
    expect(r.functionUnlocks.length).toBeGreaterThan(0);
    r = updateNPCFavorPure(r.npcs, 'cheng_zhanggui', CHENG_DISCOUNT_FAVOR - CHENG_COOP_FAVOR);
    expect(r.flags.chengDiscountCategory).toBe('布匹');
    // 萨迪 ≥50 隐藏商路；≥80 赠玉佩
    r = updateNPCFavorPure(npcs, 'sadi_merchant', SADI_ROUTE_FAVOR);
    expect(r.flags.sadiHiddenRoute).toBe(true);
    r = updateNPCFavorPure(r.npcs, 'sadi_merchant', SADI_JADE_FAVOR - SADI_ROUTE_FAVOR);
    expect(r.flags.sadiJadeGift).toBe(true);
    // 上官 ≥80 引荐朝臣
    r = updateNPCFavorPure(npcs, 'shangguan_gongzi', SHANGGUAN_COURT_FAVOR);
    expect(r.flags.shangguanCourtIntro).toBe(true);
    // clamp：超出 100 与低于 0
    npcs = buildInitialGameNPCs();
    r = updateNPCFavorPure(npcs, 'su_daniang', 999);
    expect(r.npcs['su_daniang']!.favor).toBe(100);
    r = updateNPCFavorPure(r.npcs, 'su_daniang', -999);
    expect(r.npcs['su_daniang']!.favor).toBe(0);
  });

  it('M1 checkFogReveals 填数据：新 NPC 好感达阈值 → 迷雾揭示（背景≥40/心结≥60/真实态度≥80）', () => {
    const base = buildInitialFogState({ shenTinglanFavor: 0, xieQiFavor: 0, fuyinFavor: 0, zhaoYuanwaiFavor: 0, xiaoerFavor: 0 });
    const fog = ensureNpcFog(base, buildInitialGameNPCs());
    const npcFavors = [
      { npcId: 'cheng_zhanggui', npcName: '程掌柜', favor: 45, relationship: '', unlockedPerks: [] },
      { npcId: 'sadi_merchant', npcName: '萨迪', favor: 65, relationship: '', unlockedPerks: [] },
      { npcId: 'shangguan_gongzi', npcName: '上官公子', favor: 85, relationship: '', unlockedPerks: [] },
    ];
    const res = checkFogReveals({ fogOfWar: fog, factions: [], npcFavors, clues: [] });
    expect(res.fogOfWar.npcs['cheng_zhanggui']!.backgroundRevealed).toBe(true);
    expect(res.fogOfWar.npcs['cheng_zhanggui']!.heartRevealed).toBe(false);
    expect(res.fogOfWar.npcs['sadi_merchant']!.heartRevealed).toBe(true);
    expect(res.fogOfWar.npcs['sadi_merchant']!.trueAttitudeRevealed).toBe(false);
    expect(res.fogOfWar.npcs['shangguan_gongzi']!.trueAttitudeRevealed).toBe(true);
    expect(res.revealed.some((r) => r.kind === 'npc' && r.id === 'cheng_zhanggui' && r.infoType === 'background')).toBe(true);
  });
});

describe('拜访系统（3 天冷却 / 对话 / 好感 / 情报）', () => {
  it('冷却：首次可拜访；间隔 <3 天不可；≥3 天可', () => {
    expect(npcVisitCooldownOk(10, undefined)).toBe(true);
    expect(npcVisitCooldownOk(10, 0)).toBe(true);
    expect(npcVisitCooldownOk(10, 8)).toBe(false); // 间隔 2 天
    expect(npcVisitCooldownOk(10, 7)).toBe(true); // 间隔 3 天
    expect(NPC_VISIT_COOLDOWN_DAYS).toBe(3);
  });

  it('performNpcVisit：好感 +3~8、对话来自 config、20% 情报可注入', () => {
    const npc = buildInitialGameNPCs()['su_daniang']!;
    const visit = performNpcVisit(
      { day: 10, npc, favor: 0, lastVisitDay: 3, convoCount: 0, convoTarget: 5, luBoStoryRevealed: false },
      seq(0.99, 0.99) // 情报 roll 0.99 ≥0.2 → 无情报；好感 roll 取 0.99 → +8
    );
    expect(visit.ok).toBe(true);
    expect(visit.favorDelta).toBeGreaterThanOrEqual(NPC_VISIT_FAVOR_MIN);
    expect(visit.favorDelta).toBeLessThanOrEqual(NPC_VISIT_FAVOR_MAX);
    expect(visit.dialogue.length).toBeGreaterThanOrEqual(3);
    // 20% 情报：rng 0.1 → 命中
    const withIntel = performNpcVisit(
      { day: 10, npc, favor: 0, lastVisitDay: 3, convoCount: 0, convoTarget: 5, luBoStoryRevealed: false },
      seq(0.1, 0.1)
    );
    expect(withIntel.intel).toBeDefined();
  });

  it('陆伯交谈：逐段解锁家族往事；集齐 → storyComplete（隐藏结局「沉冤得雪」条件）', () => {
    const npc = buildInitialGameNPCs()['lu_old_servant']!;
    const visit = performNpcVisit(
      { day: 10, npc, favor: 0, lastVisitDay: 0, convoCount: 4, convoTarget: 5, luBoStoryRevealed: false },
      seq(0.5, 0.5)
    );
    expect(visit.familyStoryLine).toBeTruthy();
    expect(visit.storyComplete).toBe(true);
    const early = performNpcVisit(
      { day: 10, npc, favor: 0, lastVisitDay: 0, convoCount: 1, convoTarget: 5, luBoStoryRevealed: false },
      seq(0.5, 0.5)
    );
    expect(early.familyStoryLine).toBeTruthy();
    expect(early.storyComplete).toBe(false);
  });

  it('visitableGameNpcs：未登场/冷却未过/当日已拜访 → 不可选；active 且冷却已过 → 可选', () => {
    const npcs = buildInitialGameNPCs();
    npcs['sadi_merchant'] = { ...npcs['sadi_merchant']!, status: 'active' };
    const list = visitableGameNpcs(npcs, 10, { sadi_merchant: 3 }, []); // 间隔 7 天 ≥3 → 冷却已过
    expect(list.find((x) => x.npcId === 'sadi_merchant')?.unavailableReason).toBeUndefined();
    expect(list.find((x) => x.npcId === 'su_daniang')?.unavailableReason).toBe('尚未登场');
    // 冷却未过
    const cool = visitableGameNpcs(npcs, 10, { sadi_merchant: 8 }, []);
    expect(cool.find((x) => x.npcId === 'sadi_merchant')?.unavailableReason).toBe('三日内已拜访过');
    // 当日已拜访
    const done = visitableGameNpcs(npcs, 10, { sadi_merchant: 3 }, ['visit_npc']);
    expect(done.every((x) => x.unavailableReason === '今日已拜访过故人')).toBe(true);
  });
});

describe('阿萤赎身流程', () => {
  it('赎身需 100 两（银两不足拦截；足够则 ok）', () => {
    expect(redeemAyingPure(99).ok).toBe(false);
    expect(redeemAyingPure(100).ok).toBe(true);
    expect(redeemAyingPure(150).ok).toBe(true);
  });

  it('婉拒：带走一半熟客（knownGuests 减半）', () => {
    const known = { a: { level: 'bronze' }, b: { level: 'silver' }, c: { level: 'gold' }, d: { level: 'diamond' } };
    const res = refuseAyingPure(known);
    expect(Object.keys(res.knownGuests)).toHaveLength(2);
    expect(res.knownGuests['a']).toBeDefined();
    expect(res.knownGuests['c']).toBeDefined();
    expect(res.knownGuests['b']).toBeUndefined();
  });
});

describe('苏大娘情报交易', () => {
  it('买情报：3 天冷却 + 情报 1-3 条；region 情报携带未探明节点 id', () => {
    const base = buildInitialFogState({ shenTinglanFavor: 0, xieQiFavor: 0, fuyinFavor: 0, zhaoYuanwaiFavor: 0, xiaoerFavor: 0 });
    const fog = ensureNpcFog(base, buildInitialGameNPCs());
    // 冷却未过 → 拒绝
    const cooled = performBuyInformation({ day: 10, fogOfWar: fog, factions: [], clues: [], suDaniangLastIntelDay: 9 }, seq(0.5));
    expect(cooled.ok).toBe(false);
    // 冷却已过 → 1-3 条
    const out = performBuyInformation({ day: 10, fogOfWar: fog, factions: [], clues: [], suDaniangLastIntelDay: 3 }, seq(0.9, 0.9));
    expect(out.ok).toBe(true);
    expect(out.intel.length).toBeGreaterThanOrEqual(1);
    expect(out.intel.length).toBeLessThanOrEqual(3);
    expect(suDaniangCooldownOk(10, 7)).toBe(true); // 间隔 3 天
  });

  it('月终主动送情报：好感 <60 或非月终或概率未中 → false', () => {
    expect(suDaniangFreeIntelRoll(10, 60, seq(0.1))).toBe(false); // 非月终
    expect(suDaniangFreeIntelRoll(30, 59, seq(0.1))).toBe(false); // 好感不足
    expect(suDaniangFreeIntelRoll(30, 60, seq(0.6))).toBe(false); // 概率未中
    expect(suDaniangFreeIntelRoll(30, 60, seq(0.1))).toBe(true); // 月终 + 好感足 + 概率中
  });
});

describe('好感评语（npcFavorVerdict）', () => {
  it('按档位返回古风评语', () => {
    expect(npcFavorVerdict(85)).toBe('生死之交');
    expect(npcFavorVerdict(60)).toBe('推心置腹');
    expect(npcFavorVerdict(40)).toBe('相交莫逆');
    expect(npcFavorVerdict(20)).toBe('初有来往');
    expect(npcFavorVerdict(5)).toBe('素不相识');
  });
});

// ============================================================
// store 接线（TANG-MIST-002：checkNPCUnlocks / visitNpc / redeemAying）
// ============================================================

describe('store 接线（长安故人）', () => {
  beforeEach(() => {
    useTangManagerStore.getState().resetGame();
    useTangManagerStore.getState().initByDifficulty('B');
  });

  it('checkNPCUnlocks：声望 400 → 苏大娘登场 active；返回新登场列表', () => {
    const store = useTangManagerStore.getState();
    useTangManagerStore.setState({ reputation: 400 });
    const unlocked = store.checkNPCUnlocks();
    expect(unlocked).toContain('su_daniang');
    expect(useTangManagerStore.getState().gameNPCs['su_daniang']!.status).toBe('active');
  });

  it('visitNpc：消耗 1 次行动 + 15 精力；好感增加；写 3 天冷却；当日不可重复拜访', () => {
    const store = useTangManagerStore.getState();
    useTangManagerStore.setState({ reputation: 400, energy: 60, dailyActionsRemaining: 2 });
    store.checkNPCUnlocks();
    const s = useTangManagerStore.getState();
    const favorBefore = s.gameNPCs['su_daniang']!.favor;
    const res = store.visitNpc('su_daniang', seq(0.5, 0.5));
    expect(res).not.toBeNull();
    const after = useTangManagerStore.getState();
    expect(after.gameNPCs['su_daniang']!.favor).toBeGreaterThan(favorBefore);
    expect(after.npcVisitCooldowns!['su_daniang']).toBe(after.day);
    expect(after.energy).toBe(45); // 60 - 15
    expect(after.dailyActionsRemaining).toBe(1);
    expect(after.afternoonActions).toContain('visit_npc');
    // 冷却未过 → 再次拜访失败（当日也因 visit_npc 已用被拦截）
    expect(store.visitNpc('su_daniang')).toBeNull();
  });

  it('redeemAying：阿萤 available 且银两足够 → 登场 active、扣 100 两', () => {
    const store = useTangManagerStore.getState();
    // 手工置 available（登场流程在纯函数已测）
    const npc = useTangManagerStore.getState().gameNPCs['a_ying']!;
    useTangManagerStore.setState({ gameNPCs: { ...useTangManagerStore.getState().gameNPCs, a_ying: { ...npc, status: 'available' } }, silver: 200 });
    const res = store.redeemAying();
    expect(res?.ok).toBe(true);
    const after = useTangManagerStore.getState();
    expect(after.gameNPCs['a_ying']!.status).toBe('active');
    expect(after.silver).toBe(100);
  });

  it('updateNPCFavor：跨阈值触发程掌柜合作标记 + 迷雾揭示', () => {
    const store = useTangManagerStore.getState();
    // 登场程掌柜
    useTangManagerStore.setState({ score: 3, unlockedLayers: ['yongle', 'east_west_market'] });
    store.checkNPCUnlocks();
    store.updateNPCFavor('cheng_zhanggui', 55);
    const after = useTangManagerStore.getState();
    expect(after.chengCooperation).toBe(true);
    expect(after.gameNPCs['cheng_zhanggui']!.favor).toBe(55);
    // 迷雾：好感 ≥40 → 背景揭示
    expect(after.fogOfWar.npcs['cheng_zhanggui']!.backgroundRevealed).toBe(true);
  });
});

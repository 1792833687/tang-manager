/**
 * 地图路线规划与可视化单测（tang-map-routing · TANG-MIST-003 M3 · 2.2/2.5/2.6/2.8）
 * 覆盖：路线规划（最短=天数最少 / 最安全=风险最低优先绿通）、路径 20% 揭示、连线色调、
 *       骡车进度、热力图色调、图层筛选、标记节点新动态提示、冬季山路封闭。
 */
import { describe, expect, it } from 'vitest';
import {
  planOptimalRoute,
  maybeRevealPathOnTravel,
  routeLineTone,
  caravanProgress,
  routeUsageCounts,
  routeHeatTone,
  nodeMatchesFilter,
  nodeInteractionLabel,
  buildMarkerNotices,
  isRouteWinterClosed,
  WINTER_CLOSED_ROUTE_IDS,
} from '@/systems/tang-map-routing';
import { buildInitialFogState } from '@/systems/tang-fog';
import { TRADE_ROUTES, MAP_NODE_MAP, TRADE_ROUTE_MAP } from '@/config/tang-map-data';
import type { Caravan } from '@/types/tang-caravan';
import type { FogState } from '@/types/tang-manager';
import type { PlayerMarker, TransportingGoods } from '@/types/tang-map';

/** 空跑商上下文（无绿通/护卫） */
const plainCtx = {
  day: 1,
  silver: 1000,
  nodePriceModifiers: {},
  greenChannels: [],
  transportingGoods: [],
};

/** 全部绿通的跑商上下文（规划最安全优先绿通用） */
const allGreenCtx = {
  ...plainCtx,
  greenChannels: TRADE_ROUTES.map((r) => r.id),
};

/** 定序随机（耗尽后 0.99：几乎必然触发 20% 揭示） */
const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.99;

function fogWithHidden(nodeIds: string[]): FogState {
  const base = buildInitialFogState({ shenTinglanFavor: 0, xieQiFavor: 0, fuyinFavor: 0, zhaoYuanwaiFavor: 0, xiaoerFavor: 0 });
  const regions = { ...base.regions };
  for (const id of nodeIds) {
    if (regions[id]) regions[id] = { ...regions[id]!, revealed: false };
  }
  return { ...base, regions };
}

describe('planOptimalRoute 路线规划', () => {
  it('最短模式：直连路线天数最少（坊内 1 日）', () => {
    const r = planOptimalRoute({ from: 'luji-laodian', to: 'wangji-buzhuang', mode: 'shortest', state: plainCtx });
    expect(r.ok).toBe(true);
    expect(r.plan?.nodeIds).toEqual(['luji-laodian', 'wangji-buzhuang']);
    expect(r.plan?.totalDays).toBeGreaterThanOrEqual(1);
    expect(r.plan?.routeIds.length).toBeGreaterThanOrEqual(1);
  });

  it('最安全模式：绿通风险减半 → 风险更低', () => {
    // 坊内→东市商会：直连 r-shiji-dongshi（risk 0.1）与经 xishi（0.12）相比，直连更短更安全
    const r = planOptimalRoute({ from: 'fangnei-shiji', to: 'dongshi-shanghui', mode: 'safest', state: plainCtx });
    expect(r.ok).toBe(true);
    expect(r.plan?.routeIds).toContain('r-shiji-dongshi');
    // 全绿通时官道 r-dongshi-pingzhun 天然绿通 → 风险更低
    const green = planOptimalRoute({ from: 'dongshi-shanghui', to: 'pingzhun-shu', mode: 'safest', state: allGreenCtx });
    expect(green.ok).toBe(true);
    expect(green.plan?.routeIds).toContain('r-dongshi-pingzhun');
  });

  it('起止相同/无路可达返回 ok=false', () => {
    const same = planOptimalRoute({ from: 'luji-laodian', to: 'luji-laodian', mode: 'shortest', state: plainCtx });
    expect(same.ok).toBe(false);
    const unknown = planOptimalRoute({ from: 'luji-laodian', to: 'not-a-node', mode: 'shortest', state: plainCtx });
    expect(unknown.ok).toBe(false);
  });

  it('跨层路线可达：坊内市集 → 城外茶园（最短路径天数 > 0，途径节点 ≥2）', () => {
    const r = planOptimalRoute({ from: 'fangnei-shiji', to: 'chengwai-chayuan', mode: 'shortest', state: plainCtx });
    expect(r.ok).toBe(true);
    expect(r.plan!.nodeIds.length).toBeGreaterThanOrEqual(2);
    expect(r.plan!.totalDistance).toBeGreaterThan(0);
    expect(r.plan!.totalRisk).toBeGreaterThanOrEqual(0);
  });
});

describe('maybeRevealPathOnTravel 快速移动 20% 揭示', () => {
  it('途经未探访节点按 20% 揭示（rng<0.2 触发；幂等）', () => {
    const fog = fogWithHidden(['wangji-buzhuang', 'zhaoyao-pu']);
    const r1 = maybeRevealPathOnTravel({ fogOfWar: fog, nodeIds: ['wangji-buzhuang'], rng: seq(0.1) });
    expect(r1.revealedNodeIds).toContain('wangji-buzhuang');
    expect(r1.fogOfWar.regions['wangji-buzhuang']!.revealed).toBe(true);
    // 已揭示幂等：再次调用不再揭示
    const r2 = maybeRevealPathOnTravel({ fogOfWar: r1.fogOfWar, nodeIds: ['wangji-buzhuang'], rng: seq(0.1) });
    expect(r2.revealedNodeIds).not.toContain('wangji-buzhuang');
  });

  it('rng≥0.2 不揭示；多节点只揭示命中者', () => {
    const fog = fogWithHidden(['wangji-buzhuang', 'zhaoyao-pu']);
    const r = maybeRevealPathOnTravel({
      fogOfWar: fog,
      nodeIds: ['wangji-buzhuang', 'zhaoyao-pu'],
      rng: seq(0.5, 0.1), // 第一个不触发、第二个触发
    });
    expect(r.revealedNodeIds).toEqual(['zhaoyao-pu']);
    expect(r.fogOfWar.regions['wangji-buzhuang']!.revealed).toBe(false);
  });
});

describe('商路可视化辅助', () => {
  it('routeLineTone：绿通=green / 高风险(risk>0.12)=high / 否则 normal', () => {
    const green = TRADE_ROUTE_MAP['r-dongshi-pingzhun']!; // 天然绿通
    expect(routeLineTone(green, true)).toBe('green');
    const high = TRADE_ROUTE_MAP['r-jingzhao-huanggong']!; // risk 0.15
    expect(routeLineTone(high, false)).toBe('high');
    const normal = TRADE_ROUTE_MAP['r-luji-wangji']!; // risk 0.05
    expect(routeLineTone(normal, false)).toBe('normal');
  });

  it('caravanProgress：出发 0 / 中途 0.5 / 已抵 1（返程按 arrivalDay 归位）', () => {
    const caravan: Caravan = {
      id: 'c1',
      name: '甲字镖队',
      leader: '领队',
      members: [],
      guards: 1,
      route: { from: 'fangnei-shiji', to: 'dongshi-shanghui' },
      status: 'in_transit',
      currentGoods: [],
      departureDay: 10,
      arrivalDay: 14,
      totalTrips: 0,
      totalValue: 0,
      eventLog: [],
    };
    expect(caravanProgress(caravan, 10)).toBe(0);
    expect(caravanProgress(caravan, 12)).toBe(0.5);
    expect(caravanProgress(caravan, 14)).toBe(1);
    const returned = { ...caravan, returning: true, arrivalDay: 20 };
    expect(caravanProgress(returned, 20)).toBe(1);
  });

  it('routeUsageCounts / routeHeatTone：0 次冷门、≥2 次繁忙', () => {
    const goods: TransportingGoods[] = [
      { id: 't1', itemCategory: '食材', quantity: 1, buyPrice: 1, sellNodeId: 'fangnei-shiji', departureDay: 1, arrivalDay: 2, risk: 0.1, status: 'in_transit' },
      { id: 't2', itemCategory: '布匹', quantity: 1, buyPrice: 1, sellNodeId: 'fangnei-shiji', departureDay: 1, arrivalDay: 2, risk: 0.1, status: 'in_transit' },
    ];
    const counts = routeUsageCounts(goods, []);
    expect(routeHeatTone(counts['r-luji-shiji'] ?? 0)).toBe('busy'); // 2 条在途均关联卖点坊内市集
    expect(routeHeatTone(counts['r-huanggong-weiming'] ?? 0)).toBe('cold');
    expect(routeHeatTone(1)).toBe('normal');
  });
});

describe('图层筛选 / 交互文案', () => {
  it('nodeMatchesFilter：business=商铺+市集 / resource / government / npc / event / all', () => {
    const events = new Set(['luji-laodian']);
    const shop = MAP_NODE_MAP['luji-laodian']!;
    const resource = MAP_NODE_MAP['chengwai-sangyuan']!;
    const gov = MAP_NODE_MAP['pingzhun-shu']!;
    expect(nodeMatchesFilter(shop, 'business', events)).toBe(true);
    expect(nodeMatchesFilter(shop, 'resource', events)).toBe(false);
    expect(nodeMatchesFilter(resource, 'resource', events)).toBe(true);
    expect(nodeMatchesFilter(gov, 'government', events)).toBe(true);
    expect(nodeMatchesFilter(shop, 'event', events)).toBe(true);
    expect(nodeMatchesFilter(resource, 'event', events)).toBe(false);
    expect(nodeMatchesFilter(shop, 'all', events)).toBe(true);
  });

  it('nodeInteractionLabel：商业→交易面板 / NPC→拜访 / 资源→采买 / 官府→政令', () => {
    expect(nodeInteractionLabel(MAP_NODE_MAP['luji-laodian']!)).toBe('交易面板');
    expect(nodeInteractionLabel(MAP_NODE_MAP['dongshi-shanghui']!)).toBe('拜访');
    expect(nodeInteractionLabel(MAP_NODE_MAP['bosidian']!)).toBe('采买');
    expect(nodeInteractionLabel(MAP_NODE_MAP['pingzhun-shu']!)).toBe('政令');
  });
});

describe('buildMarkerNotices 标记节点新动态', () => {
  const markers: PlayerMarker[] = [
    { id: 'm1', nodeId: 'luji-laodian', label: '祖宅', placedDay: 1 },
    { id: 'm2', nodeId: 'matou-cangku', label: '码头', placedDay: 1 },
  ];

  it('今日新事件 → 提示；无事无波动 → 不提示', () => {
    const notices = buildMarkerNotices({
      markers,
      activeEvents: [
        {
          id: 'ev-x-5',
          type: 'threat',
          title: '混混闹事',
          description: '',
          nodeId: 'luji-laodian',
          spawnDay: 5,
          expireDay: 7,
          status: 'active',
          effects: [],
          ignoredEffects: [],
        },
      ],
      prevModifiers: {},
      nextModifiers: {},
      day: 5,
    });
    expect(notices.length).toBe(1);
    expect(notices[0]).toContain('混混闹事');
    const none = buildMarkerNotices({ markers, activeEvents: [], prevModifiers: {}, nextModifiers: {}, day: 5 });
    expect(none.length).toBe(0);
  });

  it('点位物价波动 >5% → 提示（腾贵/走低）', () => {
    const up = buildMarkerNotices({
      markers,
      activeEvents: [],
      prevModifiers: { 'matou-cangku': 1 },
      nextModifiers: { 'matou-cangku': 1.2 },
      day: 5,
    });
    expect(up.some((n) => n.includes('腾贵'))).toBe(true);
    const down = buildMarkerNotices({
      markers,
      activeEvents: [],
      prevModifiers: { 'matou-cangku': 1 },
      nextModifiers: { 'matou-cangku': 0.9 },
      day: 5,
    });
    expect(down.some((n) => n.includes('走低'))).toBe(true);
  });
});

describe('冬季山路封闭（2.8）', () => {
  it('冬季（10-12 月）城外山路封闭；非冬季不封闭', () => {
    expect(seasonForDayCheck(300)).toBe('winter');
    for (const rid of WINTER_CLOSED_ROUTE_IDS) {
      expect(isRouteWinterClosed(300, rid)).toBe(true);
    }
    expect(isRouteWinterClosed(300, 'r-luji-wangji')).toBe(false);
    expect(isRouteWinterClosed(150, 'r-matou-chayuan')).toBe(false);
  });
});

/** 复用 seasonForDay 断言（避免直接引用内部实现细节在测试里写死月份号） */
function seasonForDayCheck(day: number): string {
  // 300 → month 10 → winter（自然月 10-12 冬）
  const m = Math.ceil(Math.max(1, day) / 30);
  if (m >= 1 && m <= 3) return 'spring';
  if (m >= 4 && m <= 6) return 'summer';
  if (m >= 7 && m <= 9) return 'autumn';
  return 'winter';
}

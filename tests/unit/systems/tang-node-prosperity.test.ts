/**
 * 节点繁荣度单测（tang-node-prosperity · TANG-MIST-003 M3 · 2.1）
 * 覆盖：初始态（全 50/stable）、交易 +1~3、商机 +2~5、威胁 -3~8、季节（秋资源 +5 / 冬部分 -5）、
 *       clamp 0-100、连续升降 3 天改 trend、零变动中断 streak、状态标签（火爆/上升/下滑/冷清/动荡/无）。
 */
import { describe, expect, it } from 'vitest';
import {
  buildInitialNodeProsperity,
  updateNodeProsperity,
  getNodeStatusTag,
  seasonForDay,
  monthForDay,
  BOOM_THRESHOLD,
  CHILL_THRESHOLD,
  WINTER_CHILL_NODES,
  DEFAULT_PROSPERITY,
} from '@/systems/tang-node-prosperity';
import { MAP_NODES, MAP_NODE_MAP } from '@/config/tang-map-data';
import type { MapEvent, MapNode, NodeProsperity } from '@/types/tang-map';

/** 定序随机（耗尽后 0.5） */
const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function node(id: string): MapNode {
  const n = MAP_NODE_MAP[id];
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}

/** 构造指定繁荣度表 */
function pros(entries: Array<[string, Partial<NodeProsperity>]>): Record<string, NodeProsperity> {
  const out: Record<string, NodeProsperity> = {};
  for (const [id, p] of entries) {
    out[id] = { prosperity: p.prosperity ?? DEFAULT_PROSPERITY, trend: p.trend ?? 'stable', streak: p.streak ?? 0 };
  }
  return out;
}

function opportunity(nodeId: string): MapEvent {
  return {
    id: `opp-${nodeId}`,
    type: 'opportunity',
    title: '胡商清仓',
    description: '',
    nodeId,
    spawnDay: 1,
    expireDay: 3,
    status: 'active',
    effects: [],
    ignoredEffects: [],
  };
}

function threat(nodeId: string): MapEvent {
  return {
    id: `thr-${nodeId}`,
    type: 'threat',
    title: '混混闹事',
    description: '',
    nodeId,
    spawnDay: 1,
    expireDay: 3,
    status: 'active',
    effects: [],
    ignoredEffects: [],
  };
}

describe('buildInitialNodeProsperity', () => {
  it('全部节点初始 50 / stable / streak 0', () => {
    const p = buildInitialNodeProsperity();
    expect(Object.keys(p).length).toBe(MAP_NODES.length);
    for (const n of MAP_NODES) {
      expect(p[n.id]).toEqual({ prosperity: 50, trend: 'stable', streak: 0 });
    }
  });
});

describe('updateNodeProsperity 交易/事件/季节', () => {
  it('玩家交易 +1~3（rng=0 → +1；rng=1 → +3）', () => {
    const base = pros([]);
    const r0 = updateNodeProsperity({ day: 2, nodeProsperity: base, tradedNodeIds: ['luji-laodian'], rng: seq(0) });
    expect(r0.nodeProsperity['luji-laodian']!.prosperity).toBe(51);
    const r1 = updateNodeProsperity({ day: 2, nodeProsperity: base, tradedNodeIds: ['luji-laodian'], rng: seq(1) });
    expect(r1.nodeProsperity['luji-laodian']!.prosperity).toBe(53);
  });

  it('商机事件 +2~5；威胁事件 -3~8', () => {
    const base = pros([]);
    const opp = updateNodeProsperity({
      day: 2,
      nodeProsperity: base,
      mapEvents: [opportunity('bosidian')],
      rng: seq(1, 1),
    });
    expect(opp.nodeProsperity['bosidian']!.prosperity).toBe(55); // +5
    const thr = updateNodeProsperity({
      day: 2,
      nodeProsperity: base,
      mapEvents: [threat('luji-laodian')],
      rng: seq(1, 1),
    });
    expect(thr.nodeProsperity['luji-laodian']!.prosperity).toBe(42); // -8
  });

  it('季节影响：秋季资源点 +5；冬季部分节点 -5', () => {
    const base = pros([]);
    // day=240 → month=8 → autumn
    const autumn = updateNodeProsperity({ day: 240, nodeProsperity: base, rng: seq(0.5) });
    expect(autumn.nodeProsperity['chengwai-sangyuan']!.prosperity).toBe(55);
    expect(autumn.nodeProsperity['luji-laodian']!.prosperity).toBe(50); // 商铺不受秋加成
    // day=300 → month=10 → winter
    const winter = updateNodeProsperity({ day: 300, nodeProsperity: base, rng: seq(0.5) });
    expect(winter.nodeProsperity['chengwai-yaotian']!.prosperity).toBe(45);
    expect(WINTER_CHILL_NODES).toContain('matou-cangku');
  });

  it('clamp 0-100：高繁荣被威胁压到下限，低繁荣被交易抬到上限', () => {
    const base = pros([
      ['luji-laodian', { prosperity: 5, trend: 'stable', streak: 0 }],
      ['bosidian', { prosperity: 99, trend: 'rising', streak: 5 }],
    ]);
    const up = updateNodeProsperity({ day: 2, nodeProsperity: base, tradedNodeIds: ['luji-laodian'], rng: seq(1) });
    expect(up.nodeProsperity['luji-laodian']!.prosperity).toBe(8);
    const down = updateNodeProsperity({ day: 2, nodeProsperity: base, mapEvents: [threat('bosidian')], rng: seq(1, 1) });
    expect(down.nodeProsperity['bosidian']!.prosperity).toBe(91);
  });

  it('连续升/降 3 天改 trend；零变动日中断 streak', () => {
    const base = pros([]);
    // 连续升 3 天：day2 交易 +1、day3 交易 +1、day4 交易 +1
    let state = updateNodeProsperity({ day: 2, nodeProsperity: base, tradedNodeIds: ['wangji-buzhuang'], rng: seq(0) });
    expect(state.nodeProsperity['wangji-buzhuang']!.trend).toBe('stable');
    state = updateNodeProsperity({ day: 3, nodeProsperity: state.nodeProsperity, tradedNodeIds: ['wangji-buzhuang'], rng: seq(0) });
    expect(state.nodeProsperity['wangji-buzhuang']!.trend).toBe('stable');
    state = updateNodeProsperity({ day: 4, nodeProsperity: state.nodeProsperity, tradedNodeIds: ['wangji-buzhuang'], rng: seq(0) });
    expect(state.nodeProsperity['wangji-buzhuang']!.trend).toBe('rising');
    expect(state.nodeProsperity['wangji-buzhuang']!.streak).toBe(3);
    // 零变动日 → streak 归零、trend 回 stable
    state = updateNodeProsperity({ day: 5, nodeProsperity: state.nodeProsperity, rng: seq(0) });
    expect(state.nodeProsperity['wangji-buzhuang']!.trend).toBe('stable');
    expect(state.nodeProsperity['wangji-buzhuang']!.streak).toBe(0);
    // 连续降 3 天（威胁）
    let down = state;
    for (let i = 1; i <= 3; i++) {
      down = updateNodeProsperity({
        day: 10 + i,
        nodeProsperity: down.nodeProsperity,
        mapEvents: [threat('zhaoyao-pu')],
        rng: seq(1, 1),
      });
    }
    expect(down.nodeProsperity['zhaoyao-pu']!.trend).toBe('declining');
    expect(down.nodeProsperity['zhaoyao-pu']!.streak).toBe(-3);
  });
});

describe('getNodeStatusTag', () => {
  it('≥80 火爆（红火焰）；<30 冷清（灰）', () => {
    const hot = getNodeStatusTag(node('luji-laodian'), { prosperity: BOOM_THRESHOLD, trend: 'stable', streak: 0 });
    expect(hot?.label).toBe('火爆');
    expect(hot?.icon).toBe('🔥');
    const chill = getNodeStatusTag(node('luji-laodian'), { prosperity: CHILL_THRESHOLD - 1, trend: 'stable', streak: 0 });
    expect(chill?.label).toBe('冷清');
  });

  it('rising 上升（绿箭头）/ declining 下滑（红箭头）', () => {
    const up = getNodeStatusTag(node('luji-laodian'), { prosperity: 60, trend: 'rising', streak: 3 });
    expect(up?.label).toBe('上升');
    const down = getNodeStatusTag(node('luji-laodian'), { prosperity: 60, trend: 'declining', streak: -3 });
    expect(down?.label).toBe('下滑');
  });

  it('有活跃威胁 动荡（橙警告）优先于火爆', () => {
    const tag = getNodeStatusTag(
      node('luji-laodian'),
      { prosperity: 90, trend: 'rising', streak: 3 },
      new Set(['luji-laodian'])
    );
    expect(tag?.label).toBe('动荡');
    expect(tag?.color).toBe('#D97706');
  });

  it('繁荣度中位且趋势平稳 → 无标签', () => {
    const tag = getNodeStatusTag(node('luji-laodian'), { prosperity: 50, trend: 'stable', streak: 0 });
    expect(tag).toBeNull();
  });
});

describe('seasonForDay / monthForDay', () => {
  it('自然月换算：1-3 春 / 4-6 夏 / 7-9 秋 / 10-12 冬', () => {
    expect(monthForDay(1)).toBe(1);
    expect(monthForDay(30)).toBe(1);
    expect(monthForDay(31)).toBe(2);
    expect(monthForDay(90)).toBe(3);
    expect(seasonForDay(1)).toBe('spring');
    expect(seasonForDay(150)).toBe('summer'); // month 5
    expect(seasonForDay(240)).toBe('autumn'); // month 8
    expect(seasonForDay(300)).toBe('winter'); // month 10
    expect(seasonForDay(360)).toBe('winter'); // month 12
  });
});

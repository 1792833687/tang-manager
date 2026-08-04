/**
 * 迷雾系统单测（tang-fog · TANG-MIST-001 模块一）
 * 覆盖：初始雾态（L1 揭示/L2/L3 核心点/其余隐藏）、势力好感度阈值揭示（40/60/80）、
 *       线索墙≥3 隐藏目的、NPC 好感阈值揭示、区域揭示方式（单点/午后探访/快速移动 20%）、
 *       单点揭示幂等、checkFogReveals 批量幂等。
 */
import { describe, expect, it } from 'vitest';
import {
  buildInitialFogState,
  checkFogReveals,
  revealRegion,
  revealFactionInfo,
  revealNPCInfo,
  maybeRevealRegionOnTravel,
  performExploreRegions,
  unrevealedRegions,
  countCluesForFaction,
  CORE_REGION_NODES,
} from '@/systems/tang-fog';
import { MAP_NODES } from '@/config/tang-map-data';
import type { Faction, NPCFavor } from '@/types/tang-factions';
import type { Clue } from '@/types/tang-clues';
import type { FogState, FogRevealResult } from '@/types/tang-manager';

/** 定序随机（依次吐出给定值，耗尽后 0.5） */
const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function faction(id: string, relationship: number): Faction {
  return {
    id,
    name: id,
    type: 'guild',
    relationship,
    description: '',
    leader: `首领-${id}`,
    color: '#000',
    perks: [
      { threshold: 20, name: 'p20', description: '', effect: { type: 'x', value: 1 } },
      { threshold: 40, name: 'p40', description: '', effect: { type: 'x', value: 1 } },
      { threshold: 60, name: 'p60', description: '', effect: { type: 'x', value: 1 } },
      { threshold: 80, name: 'p80', description: '', effect: { type: 'x', value: 1 } },
    ],
  };
}

function npcFavor(npcId: string, favor: number): NPCFavor {
  return { npcId, npcName: npcId, favor, relationship: '', unlockedPerks: [] };
}

function clue(id: string, category: Clue['category'] = 'shen'): Clue {
  return { id, source: '测试', sourceType: 'npc', content: '', category, day: 1, connected: [], resolved: false };
}

function makeFog(overrides?: Partial<FogState>): FogState {
  const base = buildInitialFogState({ shenTinglanFavor: 0, xieQiFavor: 0, fuyinFavor: 0, zhaoYuanwaiFavor: 0, xiaoerFavor: 0 });
  return { ...base, ...overrides };
}

/** 组装判定上下文 */
function makeState(opts: {
  fog?: FogState;
  factions?: Faction[];
  npcFavors?: NPCFavor[];
  clues?: Clue[];
} = {}) {
  return {
    fogOfWar: opts.fog ?? makeFog(),
    factions: opts.factions ?? [],
    npcFavors: opts.npcFavors ?? [],
    clues: opts.clues ?? [],
  };
}

describe('初始雾态（buildInitialFogState）', () => {
  it('L1 全部揭示；L2/L3 仅核心点揭示，其余隐藏', () => {
    const fog = makeFog();
    for (const n of MAP_NODES) {
      const region = fog.regions[n.id]!;
      if (n.layer === 'yongle') {
        expect(region.revealed).toBe(true);
      } else if (CORE_REGION_NODES.includes(n.id)) {
        expect(region.revealed).toBe(true);
      } else {
        expect(region.revealed).toBe(false);
      }
    }
    // 每区必有坊间传言与揭示条件
    const hidden = Object.values(fog.regions).filter((r) => !r.revealed);
    expect(hidden.length).toBeGreaterThan(0);
    for (const r of hidden) {
      expect(r.hint.length).toBeGreaterThan(0);
      expect(r.revealCondition.length).toBeGreaterThan(0);
    }
  });

  it('势力初始按关系部分揭示：<40 首领未知；NPC 按好感部分揭示', () => {
    const fog = makeFog();
    // 初始关系 20/10/20/5/10 <40 → 首领全部未知
    expect(fog.factions['dongshi']!.leaderRevealed).toBe(false);
    expect(fog.factions['xishi']!.leaderRevealed).toBe(false);
    // 好感 0 → 背景未知
    expect(fog.npcs['shen-tinglan']!.backgroundRevealed).toBe(false);
    expect(fog.npcs['a-zhao']!.backgroundRevealed).toBe(false);
  });

  it('初始好感≥40 的 NPC 背景已知（开档即熟识）', () => {
    const fog = buildInitialFogState({ shenTinglanFavor: 45, xieQiFavor: 0, fuyinFavor: 20, zhaoYuanwaiFavor: 10, xiaoerFavor: 45 });
    expect(fog.npcs['shen-tinglan']!.backgroundRevealed).toBe(true);
    expect(fog.npcs['shen-tinglan']!.heartRevealed).toBe(false); // 60 未达
    expect(fog.npcs['a-zhao']!.backgroundRevealed).toBe(true);
  });
});

describe('checkFogReveals 势力好感度阈值', () => {
  it('关系 40 只揭示首领；60 追加关系线；80 追加特权', () => {
    const fog = makeFog();
    const state40 = makeState({ fog, factions: [faction('dongshi', 40)], npcFavors: [npcFavor('shen-tinglan', 0)] });
    const r40 = checkFogReveals(state40);
    expect(r40.revealed.map((r) => r.infoType)).toContain('leader');
    expect(r40.fogOfWar.factions['dongshi']!.leaderRevealed).toBe(true);
    expect(r40.fogOfWar.factions['dongshi']!.relationsRevealed).toBe(false);

    const state60 = makeState({ fog: r40.fogOfWar, factions: [faction('dongshi', 60)], npcFavors: [npcFavor('shen-tinglan', 0)] });
    const r60 = checkFogReveals(state60);
    expect(r60.revealed.map((r) => r.infoType)).toContain('relations');
    expect(r60.fogOfWar.factions['dongshi']!.relationsRevealed).toBe(true);
    expect(r60.fogOfWar.factions['dongshi']!.perksRevealed).toBe(false);

    const state80 = makeState({ fog: r60.fogOfWar, factions: [faction('dongshi', 80)], npcFavors: [npcFavor('shen-tinglan', 0)] });
    const r80 = checkFogReveals(state80);
    expect(r80.revealed.map((r) => r.infoType)).toContain('perks');
    expect(r80.fogOfWar.factions['dongshi']!.perksRevealed).toBe(true);
  });

  it('关系 100 一步到位揭示首领/关系线/特权（批量）', () => {
    const res = checkFogReveals(makeState({ factions: [faction('xishi', 100)] }));
    const infos = res.revealed.map((r) => r.infoType);
    expect(infos).toContain('leader');
    expect(infos).toContain('relations');
    expect(infos).toContain('perks');
    expect(res.fogOfWar.factions['xishi']!.leaderRevealed).toBe(true);
    expect(res.fogOfWar.factions['xishi']!.perksRevealed).toBe(true);
  });
});

describe('checkFogReveals NPC 好感度阈值', () => {
  it('好感 40/60/80 依次揭示背景/心结/真实态度', () => {
    const r1 = checkFogReveals(makeState({ npcFavors: [npcFavor('a-zhao', 40)] }));
    expect(r1.revealed.map((r) => r.infoType)).toContain('background');
    expect(r1.fogOfWar.npcs['a-zhao']!.backgroundRevealed).toBe(true);
    expect(r1.fogOfWar.npcs['a-zhao']!.heartRevealed).toBe(false);

    const r2 = checkFogReveals(makeState({ fog: r1.fogOfWar, npcFavors: [npcFavor('a-zhao', 60)] }));
    expect(r2.revealed.map((r) => r.infoType)).toContain('heart');
    expect(r2.fogOfWar.npcs['a-zhao']!.heartRevealed).toBe(true);

    const r3 = checkFogReveals(makeState({ fog: r2.fogOfWar, npcFavors: [npcFavor('a-zhao', 80)] }));
    expect(r3.revealed.map((r) => r.infoType)).toContain('trueAttitude');
    expect(r3.fogOfWar.npcs['a-zhao']!.trueAttitudeRevealed).toBe(true);
    // fullStory 仅专属事件揭示（checkFogReveals 不自动触发）
    expect(r3.fogOfWar.npcs['a-zhao']!.fullStoryRevealed).toBe(false);
  });
});

describe('线索墙 ≥3 揭示势力隐藏目的', () => {
  it('东市商会（shen 线）线索满 3 条 → hiddenAgendaRevealed', () => {
    const clues = [clue('s1', 'shen'), clue('s2', 'shen'), clue('s3', 'shen')];
    const res = checkFogReveals(makeState({ factions: [faction('dongshi', 20)], clues }));
    const hit = res.revealed.find((r): r is FogRevealResult => r.kind === 'faction' && r.infoType === 'hiddenAgenda' && r.id === 'dongshi');
    expect(hit).toBeDefined();
    expect(res.fogOfWar.factions['dongshi']!.hiddenAgendaRevealed).toBe(true);
    expect(res.fogOfWar.factions['dongshi']!.hiddenAgenda.length).toBeGreaterThan(0);
  });

  it('线索不足 3 条不揭示隐藏目的；countCluesForFaction 正确计数', () => {
    expect(countCluesForFaction('dongshi', [clue('s1', 'shen'), clue('s2', 'shen')])).toBe(2);
    const res = checkFogReveals(makeState({ factions: [faction('dongshi', 20)], clues: [clue('s1', 'shen'), clue('s2', 'shen')] }));
    expect(res.fogOfWar.factions['dongshi']!.hiddenAgendaRevealed).toBe(false);
  });
});

describe('区域揭示（revealRegion / 探访 / 快速移动）', () => {
  it('revealRegion：未揭示区域揭示成功；已揭示幂等返回 changed=false', () => {
    const fog = makeFog();
    const hiddenId = unrevealedRegions(fog)[0]!.nodeId;
    const r1 = revealRegion(makeState({ fog }), hiddenId);
    expect(r1.changed).toBe(true);
    expect(r1.fogOfWar.regions[hiddenId]!.revealed).toBe(true);
    expect(r1.nodeName).toBeTruthy();

    const r2 = revealRegion(makeState({ fog: r1.fogOfWar }), hiddenId);
    expect(r2.changed).toBe(false);
  });

  it('performExploreRegions：揭示 1-2 个未探明点位；无未探明时返回空', () => {
    const fog = makeFog();
    const hidden = unrevealedRegions(fog);
    expect(hidden.length).toBeGreaterThan(1);
    // rng 首值 0.4 → count=1（1+floor(0.8)=1）；次值 0 → 抽中首个
    const out = performExploreRegions(makeState({ fog }), seq(0.4, 0, 0, 0));
    expect(out.revealedIds.length).toBe(1);
    expect(out.narrative.length).toBeGreaterThan(0);

    const out2 = performExploreRegions(makeState({ fog }), seq(0.9, 0, 0)); // count=2（1+floor(1.8)=2）
    expect(out2.revealedIds.length).toBe(2);
    // 全揭示后无未探明 → 空
    const all = { ...fog, regions: Object.fromEntries(Object.entries(fog.regions).map(([k, v]) => [k, { ...v, revealed: true }])) };
    const empty = performExploreRegions(makeState({ fog: all }));
    expect(empty.revealedIds.length).toBe(0);
  });

  it('maybeRevealRegionOnTravel：rng<0.2 揭示（快速移动 20%）；rng≥0.2 不变', () => {
    const fog = makeFog();
    const hiddenId = unrevealedRegions(fog)[0]!.nodeId;
    const hit = maybeRevealRegionOnTravel(makeState({ fog }), hiddenId, seq(0.1));
    expect(hit.changed).toBe(true);
    expect(hit.fogOfWar.regions[hiddenId]!.revealed).toBe(true);

    const miss = maybeRevealRegionOnTravel(makeState({ fog }), hiddenId, seq(0.5));
    expect(miss.changed).toBe(false);
    expect(miss.fogOfWar.regions[hiddenId]!.revealed).toBe(false);
  });
});

describe('单点揭示（revealFactionInfo / revealNPCInfo）与幂等', () => {
  it('revealFactionInfo：强制揭示某信息；重复调用幂等', () => {
    const s = makeState({ factions: [faction('jingzhao', 20)] });
    const r1 = revealFactionInfo(s, 'jingzhao', 'leader');
    expect(r1.changed).toBe(true);
    expect(r1.fogOfWar.factions['jingzhao']!.leaderRevealed).toBe(true);
    expect(r1.fogOfWar.factions['jingzhao']!.perksRevealed).toBe(false); // 只揭单项
    const r2 = revealFactionInfo({ ...s, fogOfWar: r1.fogOfWar }, 'jingzhao', 'leader');
    expect(r2.changed).toBe(false); // 幂等
  });

  it('revealNPCInfo：专属事件后揭示完整隐藏故事', () => {
    const r = revealNPCInfo(makeState(), 'shen-tinglan', 'fullStory');
    expect(r.changed).toBe(true);
    expect(r.fogOfWar.npcs['shen-tinglan']!.fullStoryRevealed).toBe(true);
  });

  it('不存在的势力/NPC 返回 changed=false', () => {
    expect(revealFactionInfo(makeState(), 'nonexistent', 'leader').changed).toBe(false);
    expect(revealNPCInfo(makeState(), 'nonexistent', 'fullStory').changed).toBe(false);
  });
});

describe('checkFogReveals 幂等', () => {
  it('全部已揭示时返回空列表且雾态引用不变', () => {
    const fog = makeFog();
    const s = makeState({ factions: [faction('dongshi', 100)], npcFavors: [npcFavor('shen-tinglan', 100)], clues: [clue('s1', 'shen'), clue('s2', 'shen'), clue('s3', 'shen')] });
    const first = checkFogReveals(s);
    expect(first.revealed.length).toBeGreaterThan(0);
    const second = checkFogReveals({ ...s, fogOfWar: first.fogOfWar });
    expect(second.revealed.length).toBe(0);
    expect(second.fogOfWar).toBe(first.fogOfWar); // 无变化引用不变
  });
});

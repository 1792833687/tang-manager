/**
 * 名声关系网系统单测（tang-factions · TANG-SOC-001 模块五）
 * 覆盖：关系变动（clamp 0-100）、跨阈值特权解锁、触发规则（灰色手段 地下+10 京兆-10 东市-5）、
 *       NPC 好感联动（沈听澜/谢七/赵员外/府尹）、getFactionPerks。
 */
import { describe, expect, it } from 'vitest';
import {
  updateFactionRelationship,
  applyFactionTrigger,
  getFactionPerks,
  syncNpcFavor,
} from '@/systems/tang-factions';
import { FIVE_FACTIONS, buildNpcFavors, FACTION_NPC_MAP } from '@/config/tang-factions';
import type { Faction } from '@/types/tang-factions';

function cloneFactions(): Faction[] {
  return FIVE_FACTIONS.map((f) => ({ ...f, perks: f.perks.map((p) => ({ ...p })) }));
}

describe('updateFactionRelationship 关系变动', () => {
  it('正向变动 +10 → relationship 增加并记录原因', () => {
    const res = updateFactionRelationship(cloneFactions(), 'dongshi', 10, '商会任务');
    expect(res.result!.relationship).toBe(30);
    expect(res.result!.delta).toBe(10);
    expect(res.result!.reason).toBe('商会任务');
  });

  it('clamp 0-100（加超 100 / 减到负）', () => {
    let res = updateFactionRelationship(cloneFactions(), 'dongshi', 200, '商会任务');
    expect(res.result!.relationship).toBe(100);
    expect(res.result!.delta).toBe(80);
    res = updateFactionRelationship(cloneFactions(), 'xishi', -200, '官府罚款');
    expect(res.result!.relationship).toBe(0);
  });

  it('跨阈值提示解锁（xishi 10 → 25 解锁 20 档特权）', () => {
    const factions = cloneFactions();
    const res = updateFactionRelationship(factions, 'xishi', 15, '胡商交易');
    expect(res.result!.newlyUnlocked.map((p) => p.threshold)).toContain(20);
    expect(res.result!.newlyUnlocked[0]!.name).toBe('胡商路子');
  });

  it('未跨阈值不解锁', () => {
    const factions = cloneFactions();
    const res = updateFactionRelationship(factions, 'xishi', 5, '胡商交易');
    // 10→15 未达 20 档
    expect(res.result!.newlyUnlocked).toHaveLength(0);
  });
});

describe('applyFactionTrigger 触发规则（6.1 逐字）', () => {
  it('灰色手段：地下+10 京兆-10 东市-5', () => {
    const factions = cloneFactions();
    const res = applyFactionTrigger(factions, 'gray_means', '灰色手段');
    const underground = res.results.find((r) => r.factionId === 'underground')!;
    const jingzhao = res.results.find((r) => r.factionId === 'jingzhao')!;
    const dongshi = res.results.find((r) => r.factionId === 'dongshi')!;
    expect(underground.delta).toBe(10);
    expect(jingzhao.delta).toBe(-10);
    expect(dongshi.delta).toBe(-5);
  });

  it('商会任务 +8（5~15 中位）', () => {
    const res = applyFactionTrigger(cloneFactions(), 'guild_task', '商会任务');
    expect(res.results[0]!.delta).toBe(8);
  });

  it('按时缴税 京兆府 +5', () => {
    const res = applyFactionTrigger(cloneFactions(), 'tax_on_time', '按时缴税');
    expect(res.results[0]!.factionId).toBe('jingzhao');
    expect(res.results[0]!.delta).toBe(5);
  });
});

describe('getFactionPerks 特权', () => {
  it('已解锁特权 = relationship ≥ threshold', () => {
    const factions = cloneFactions();
    const updated = updateFactionRelationship(factions, 'dongshi', 40, '商会任务'); // 20+40=60
    const perks = getFactionPerks(updated.factions.find((f) => f.id === 'dongshi')!);
    expect(perks.map((p) => p.threshold)).toEqual([20, 40, 60]);
  });
});

describe('NPC 好感联动（5.3）', () => {
  it('syncNpcFavor：东市商会变动联动沈听澜（delta×0.5）', () => {
    const npcFavors = buildNpcFavors({ shenTinglanFavor: 30, xieQiFavor: 0, fuyinFavor: 20, zhaoYuanwaiFavor: 10 });
    const res = syncNpcFavor(npcFavors, 'dongshi', 10, { shenTinglanFavor: 30, xieQiFavor: 0, fuyinFavor: 20, zhaoYuanwaiFavor: 10 });
    const shen = res.npcFavors.find((n) => n.npcId === 'shen-tinglan')!;
    expect(shen.favor).toBe(35); // 30 + 10×0.5
    expect(res.favors.shenTinglanFavor).toBe(35);
  });

  it('buildNpcFavors 四 NPC 映射正确（沈听澜/谢七/赵员外/府尹）', () => {
    const npcFavors = buildNpcFavors({ shenTinglanFavor: 30, xieQiFavor: 25, fuyinFavor: 60, zhaoYuanwaiFavor: 45 });
    expect(npcFavors).toHaveLength(4);
    const shen = npcFavors.find((n) => n.npcId === 'shen-tinglan')!;
    expect(shen.factionId).toBe('dongshi');
    expect(FACTION_NPC_MAP.dongshi!.npcName).toBe('沈听澜');
    expect(FACTION_NPC_MAP.jingzhao!.npcName).toBe('京兆府尹');
    expect(FACTION_NPC_MAP.pingkang!.npcName).toBe('赵员外');
    // 好感 30 → 点头评语（≥20 <40）
    expect(shen.relationship).toBe('点头');
    // 好感 60 → 心腹
    expect(npcFavors.find((n) => n.npcId === 'fu-yin')!.relationship).toBe('心腹');
  });
});

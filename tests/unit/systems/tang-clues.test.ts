/**
 * 蛛丝马迹单测（tang-clues · Step 5b-5 模块二）
 * 覆盖：generateClue 池中抽取/去重/抽尽、connectClues 同类别 ≥3 自动关联、
 *       玩家手动连接（pairwiseConnect）、resolveClue 解析。
 */
import { describe, expect, it } from 'vitest';
import {
  generateClue,
  connectClues,
  pairwiseConnect,
  resolveClue,
} from '@/systems/tang-clues';
import { CLUE_POOL } from '@/config/tang-clue-pool';
import type { Clue } from '@/types/tang-clues';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function clue(id: string, category: Clue['category'] = 'shen', day = 1): Clue {
  return { id, source: '沈听澜', sourceType: 'npc', content: '线索内容', category, day, connected: [], resolved: false };
}

describe('generateClue 池中抽取', () => {
  it('按类别抽取并生成 Clue（source/sourceType/category/day）', () => {
    const c = generateClue('沈听澜', 'npc', 'shen', { day: 3, clues: [] }, seq(0));
    expect(c).not.toBeNull();
    expect(c!.source).toBe('沈听澜');
    expect(c!.sourceType).toBe('npc');
    expect(c!.category).toBe('shen');
    expect(c!.day).toBe(3);
    expect(c!.connected).toEqual([]);
    expect(c!.resolved).toBe(false);
    expect(CLUE_POOL.some((p) => p.id === c!.id)).toBe(true);
  });

  it('已存在的线索不重复抽取（去重）', () => {
    const first = generateClue('沈听澜', 'npc', 'shen', { day: 1, clues: [] }, seq(0))!;
    // 用 rng 逼到 0 仍应抽到同一条 → 已存在则返回另一条；全部被占则该类别抽尽
    const second = generateClue('沈听澜', 'npc', 'shen', { day: 1, clues: [first] }, seq(0));
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first.id);
  });

  it('该类别线索池抽尽返回 null', () => {
    const allShen = CLUE_POOL.filter((p) => p.category === 'shen').map((p) => clue(p.id, 'shen'));
    const c = generateClue('沈听澜', 'npc', 'shen', { day: 1, clues: allShen }, seq(0));
    expect(c).toBeNull();
  });
});

describe('connectClues 自动关联', () => {
  it('同类别 ≥3 条两两互连', () => {
    const clues = [clue('a', 'shen'), clue('b', 'shen'), clue('c', 'shen')];
    const res = connectClues({ day: 1, clues });
    // 3 条两两互连 = 3 对连线
    expect(res.connections.length).toBe(3);
    expect(res.clues[0]!.connected).toContain('b');
    expect(res.clues[0]!.connected).toContain('c');
  });

  it('同类别 <3 条不关联', () => {
    const res = connectClues({ day: 1, clues: [clue('a', 'shen'), clue('b', 'shen')] });
    expect(res.connections.length).toBe(0);
  });

  it('重复运行幂等（已连不重复连）', () => {
    const clues = [clue('a', 'shen'), clue('b', 'shen'), clue('c', 'shen')];
    const once = connectClues({ day: 1, clues });
    const twice = connectClues({ day: 1, clues: once.clues });
    expect(twice.connections.length).toBe(0);
  });
});

describe('pairwiseConnect 手动连接', () => {
  it('两条线索互写 connected；重复连接幂等', () => {
    const clues = [clue('a'), clue('b')];
    const res = pairwiseConnect(clues, 'a', 'b');
    expect(res.connected).toBe(true);
    expect(res.clues[0]!.connected).toContain('b');
    expect(res.clues[1]!.connected).toContain('a');
    const again = pairwiseConnect(res.clues, 'a', 'b');
    expect(again.connected).toBe(false);
  });

  it('同 id 连接被拒', () => {
    const res = pairwiseConnect([clue('a')], 'a', 'a');
    expect(res.connected).toBe(false);
  });
});

describe('resolveClue 解析', () => {
  it('置 resolved=true；已解析幂等', () => {
    const res = resolveClue([clue('a')], 'a');
    expect(res.changed).toBe(true);
    expect(res.clues[0]!.resolved).toBe(true);
    const again = resolveClue(res.clues, 'a');
    expect(again.changed).toBe(false);
  });
});

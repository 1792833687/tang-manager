/**
 * 接待对话引擎单测（模块二 2.1 / 模块七）
 * 覆盖：心情权重、初始状态、状态机转移合法性、回应方式效果、客人回应模板、心情影响。
 */
import { describe, expect, it } from 'vitest';
import {
  advanceDialogue,
  applyResponseStyle,
  buildGuestReply,
  canTransition,
  moodCloseBonus,
  moodSatisfactionMul,
  pickGuestMood,
  responseEffects,
  startDialogue,
} from '@/systems/tang-dialogue-engine';
import type { Guest } from '@/types/tang-manager';

function rngSeq(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length]!;
}

function makeGuest(): Guest {
  return {
    id: 'g4',
    name: '李客官',
    type: 'normal',
    description: '赶了一天的路，有什么热乎的赶紧端上来！',
    baseConsumption: 4,
    handled: false,
  };
}

describe('pickGuestMood（心情权重）', () => {
  it('0 → joyful；0.4 → calm；0.8 → irritated；0.97 → picky', () => {
    expect(pickGuestMood(rngSeq([0]))).toBe('joyful');
    expect(pickGuestMood(rngSeq([0.4]))).toBe('calm');
    expect(pickGuestMood(rngSeq([0.8]))).toBe('irritated');
    expect(pickGuestMood(rngSeq([0.97]))).toBe('picky');
  });
});

describe('startDialogue / 状态机', () => {
  it('初始 greeting、心情随机、好感信任 50、历史空', () => {
    const d = startDialogue(makeGuest(), 'jiulou', rngSeq([0]));
    expect(d.phase).toBe('greeting');
    expect(d.mood).toBe('joyful');
    expect(d.favor).toBe(50);
    expect(d.trust).toBe(50);
    expect(d.history).toHaveLength(0);
  });
  it('canTransition：greeting→player_response 合法，greeting→resolution 非法', () => {
    expect(canTransition('greeting', 'player_response')).toBe(true);
    expect(canTransition('greeting', 'resolution')).toBe(false);
    expect(canTransition('guest_feedback', 'follow_up')).toBe(true);
    expect(canTransition('guest_feedback', 'resolution')).toBe(true);
  });
  it('advanceDialogue：非法转移停留在原阶段', () => {
    const d = startDialogue(makeGuest(), 'jiulou');
    const bad = advanceDialogue(d, 'resolution');
    expect(bad.phase).toBe('greeting');
    const good = advanceDialogue(d, 'player_response');
    expect(good.phase).toBe('player_response');
    expect(good.turn).toBe(1);
  });
});

describe('applyResponseStyle（回应方式效果）', () => {
  it('热情寒暄：好感 +5 信任 -2；专业分析：信任 +5 好感 -2；实在报价：priceSensitive', () => {
    const d = startDialogue(makeGuest(), 'jiulou');
    const warm = applyResponseStyle(d, 'warm');
    expect(warm.favor).toBe(55);
    expect(warm.trust).toBe(48);
    const prof = applyResponseStyle(d, 'professional');
    expect(prof.trust).toBe(55);
    expect(prof.favor).toBe(48);
    const honest = applyResponseStyle(d, 'honest_price');
    expect(honest.priceSensitive).toBe(true);
  });
  it('responseEffects 提供三档选项', () => {
    const effs = responseEffects();
    expect(effs).toHaveLength(3);
    expect(effs.some((e) => e.style === 'honest_price' && e.closeBonus === 10)).toBe(true);
  });
});

describe('buildGuestReply / 心情影响', () => {
  it('客人回应按心情抽取并插值称呼', () => {
    const reply = buildGuestReply('calm', '李客官', rngSeq([0]));
    expect(reply).toContain('李客官');
    expect(reply.length).toBeGreaterThan(0);
  });
  it('挑剔成交后满意度 ×2；烦躁成交率 -10%', () => {
    expect(moodSatisfactionMul('picky')).toBe(2);
    expect(moodCloseBonus('irritated')).toBe(-10);
    expect(moodCloseBonus('joyful')).toBe(10);
  });
});

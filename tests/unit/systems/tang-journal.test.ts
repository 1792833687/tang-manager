/**
 * 手札录单测（tang-journal · Step 5b-5 模块一）
 * 覆盖：四类 record 纯函数（event/npc/milestone/choice）的字段与标签生成。
 */
import { describe, expect, it } from 'vitest';
import {
  recordEvent,
  recordNPCDialogue,
  recordMilestone,
  recordChoice,
  journalContext,
} from '@/systems/tang-journal';

function ctx(day = 7) {
  return journalContext({ day });
}

describe('recordEvent 经营事件', () => {
  it('生成 type=event 条目，携带 day/title/content/tags/relatedEvent', () => {
    const e = recordEvent(ctx(), {
      title: '债主登门',
      content: '矮胖债主上门催讨，言辞不善。',
      tags: ['债主'],
      relatedEvent: 'debt-collection-1',
    });
    expect(e.type).toBe('event');
    expect(e.day).toBe(7);
    expect(e.title).toBe('债主登门');
    expect(e.content).toContain('债主');
    expect(e.tags).toEqual(['债主']);
    expect(e.relatedEvent).toBe('debt-collection-1');
    expect(e.id.length).toBeGreaterThan(0);
  });

  it('relatedNPC 缺省时不写字段', () => {
    const e = recordEvent(ctx(), { title: '开市', content: '东市开市。' });
    expect(e.relatedNPC).toBeUndefined();
  });
});

describe('recordNPCDialogue 人物往来', () => {
  it('生成 type=npc 条目并携带 relatedNPC', () => {
    const e = recordNPCDialogue(ctx(12), {
      title: '沈听澜叙话',
      content: '沈老板抚琴至夜半，只言商道无常。',
      tags: ['沈听澜'],
      relatedNPC: '沈听澜',
    });
    expect(e.type).toBe('npc');
    expect(e.day).toBe(12);
    expect(e.relatedNPC).toBe('沈听澜');
    expect(e.tags).toContain('沈听澜');
  });
});

describe('recordMilestone 里程碑', () => {
  it('生成 type=milestone 条目（成就/阶段晋升共用）', () => {
    const e = recordMilestone(ctx(30), {
      title: '晋入第 2 阶',
      content: '店铺经营更上层楼。',
      tags: ['里程碑', '阶段'],
    });
    expect(e.type).toBe('milestone');
    expect(e.title).toBe('晋入第 2 阶');
    expect(e.tags).toEqual(['里程碑', '阶段']);
  });
});

describe('recordChoice 重大抉择', () => {
  it('生成 type=choice 条目并携带相关事件', () => {
    const e = recordChoice(ctx(45), {
      title: '巍明楼来帖',
      content: '你接过圣旨，踏入庙堂。',
      tags: ['抉择', '转政'],
      relatedEvent: 'imperial-office',
    });
    expect(e.type).toBe('choice');
    expect(e.relatedEvent).toBe('imperial-office');
    expect(e.tags).toContain('转政');
  });
});

describe('journalContext 便捷投影', () => {
  it('从 TangGameState 子集取 day', () => {
    expect(journalContext({ day: 99 }).day).toBe(99);
  });
});

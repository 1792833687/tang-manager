/**
 * 故事标签分配单测（tang-story-assigner · Step 5a 3.2）
 * 覆盖：70% 分配率、通用/专属 60-40 池权重、special 优先专属、observe 偏向敏感标签、
 *       回头客延续（progression 阶段推进）、首见 stage=0。
 */
import { describe, expect, it } from 'vitest';
import { COMMON_STORY_TAGS, SENSITIVE_TAG_IDS, SHOP_STORY_TAGS } from '@/config/tang-story-tags';
import { assignStoryTag } from '@/systems/tang-story-assigner';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

const commonLabels = COMMON_STORY_TAGS.map((t) => t.label);
const shopLabels: Record<string, string[]> = {
  jiulou: SHOP_STORY_TAGS.jiulou.map((t) => t.label),
  buzhuang: SHOP_STORY_TAGS.buzhuang.map((t) => t.label),
  yaopu: SHOP_STORY_TAGS.yaopu.map((t) => t.label),
};

describe('分配率（70%）', () => {
  it('rng<0.7 → 分配标签；stage=0（首见）', () => {
    const tag = assignStoryTag({ type: 'normal' }, 'jiulou', seq(0.1, 0.3));
    expect(tag).not.toBeNull();
    expect(tag!.stage).toBe(0);
    expect(tag!.tagId).toBeTruthy();
  });

  it('rng≥0.7 → 不分配（null）', () => {
    const tag = assignStoryTag({ type: 'normal' }, 'jiulou', () => 0.8);
    expect(tag).toBeNull();
  });
});

describe('通用/专属池权重（60/40）', () => {
  it('普通客人 rng 0.3（<0.6）→ 通用池', () => {
    const tag = assignStoryTag({ type: 'normal' }, 'jiulou', seq(0.1, 0.3));
    expect(commonLabels).toContain(tag!.label);
  });

  it('普通客人 rng 0.7（≥0.6）→ 专属池（按店型）', () => {
    const jiulou = assignStoryTag({ type: 'normal' }, 'jiulou', seq(0.1, 0.7));
    expect(shopLabels.jiulou).toContain(jiulou!.label);
    const buzhuang = assignStoryTag({ type: 'normal' }, 'buzhuang', seq(0.1, 0.7));
    expect(shopLabels.buzhuang).toContain(buzhuang!.label);
  });
});

describe('special 优先专属', () => {
  it('special 且 rng 0.2（<0.7）→ 专属池', () => {
    const tag = assignStoryTag({ type: 'special' }, 'yaopu', seq(0.1, 0.2));
    expect(shopLabels.yaopu).toContain(tag!.label);
  });

  it('special 且 rng 0.8（≥0.7）→ 回退通用池', () => {
    const tag = assignStoryTag({ type: 'special' }, 'yaopu', seq(0.1, 0.8));
    expect(commonLabels).toContain(tag!.label);
  });
});

describe('observe 偏向敏感标签（试探/避祸/保密/寻人）', () => {
  it('observe 且 rng 0.2（<0.6）→ 敏感池', () => {
    const tag = assignStoryTag({ type: 'observe' }, 'jiulou', seq(0.1, 0.2));
    expect(SENSITIVE_TAG_IDS).toContain(tag!.tagId);
  });
});

describe('回头客延续（prevTag + progression）', () => {
  it('做嫁衣 stage0 → 赶制嫁衣 stage1 → 婚宴筹备 stage2（封顶）', () => {
    // 首见分配为随机标签（70% 概率）；延续行为通过显式 prevTag 验证
    const second = assignStoryTag({ type: 'normal' }, 'buzhuang', seq(0.1, 0.3), { tagId: 'wedding-dress', stage: 0 });
    expect(second!.label).toBe('赶制嫁衣');
    expect(second!.stage).toBe(1);
    const third = assignStoryTag({ type: 'normal' }, 'buzhuang', seq(0.1, 0.3), { tagId: 'wedding-dress', stage: 1 });
    expect(third!.label).toBe('婚宴筹备');
    expect(third!.stage).toBe(2);
    const capped = assignStoryTag({ type: 'normal' }, 'buzhuang', seq(0.1, 0.3), { tagId: 'wedding-dress', stage: 2 });
    expect(capped!.label).toBe('婚宴筹备'); // 封顶不再推进
    expect(capped!.stage).toBe(3);
  });

  it('无 progression 的标签沿用同标签（不推进阶段）', () => {
    const tag = assignStoryTag({ type: 'normal' }, 'jiulou', seq(0.1, 0.3), { tagId: 'credit', stage: 0 });
    expect(tag!.label).toBe('赊账');
    expect(tag!.stage).toBe(0);
  });
});

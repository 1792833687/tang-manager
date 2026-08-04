/** 节点微型故事单测（地图与事件深化 模块一 1.1） */
import { describe, expect, it } from 'vitest';
import { generateNodeStory, hasMoreStories, storyRevealed } from '@/systems/tang-node-stories';
import type { NodeStoriesRevealed } from '@/types/tang-map-story';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('generateNodeStory', () => {
  it('首次探访必触发 first 故事', () => {
    const res = generateNodeStory('posi-di', '波斯邸', {}, '春', rngSeq([0.5, 0.5]));
    expect(res).not.toBeNull();
    expect(res!.story.kind).toBe('first');
    expect(res!.story.content.length).toBeGreaterThan(10);
    expect(storyRevealed(res!.revealed, 'posi-di', 'first')).toBe(true);
  });
  it('首次已揭示后：重复访问 30% 概率触发 repeat', () => {
    const revealed: NodeStoriesRevealed = { 'posi-di': ['first'] };
    const hit = generateNodeStory('posi-di', '波斯邸', revealed, '春', rngSeq([0]));
    expect(hit?.story.kind).toBe('repeat');
    const miss = generateNodeStory('posi-di', '波斯邸', revealed, '春', rngSeq([0.5]));
    expect(miss).toBeNull();
  });
  it('特殊时机（季节明确）优先触发 special', () => {
    const revealed: NodeStoriesRevealed = { 'posi-di': ['first'] };
    const res = generateNodeStory('posi-di', '波斯邸', revealed, '秋', rngSeq([0, 0.5]));
    expect(res?.story.kind).toBe('special');
  });
  it('全部揭示后不再触发', () => {
    const revealed: NodeStoriesRevealed = { 'posi-di': ['first', 'repeat', 'special'] };
    expect(generateNodeStory('posi-di', '波斯邸', revealed, '秋', rngSeq([0, 0]))).toBeNull();
    expect(hasMoreStories(revealed, 'posi-di')).toBe(false);
  });
});

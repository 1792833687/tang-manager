/**
 * 《我在唐朝当掌柜》节点微型故事系统（地图与事件深化 模块一 1.1）
 * 首次探访必触发；重复访问 30% 概率触发新故事；特殊时机（季节）触发。
 * 每个节点预设 3-5 套模板，缺省用通用池；AI 接入由 UI 层异步增强，此处纯函数。
 */
import { GENERIC_NODE_STORIES, NODE_STORY_TEMPLATES } from '@/config/tang-node-stories-content';
import type { NodeStory, NodeStoryKind, NodeStoriesRevealed } from '@/types/tang-map-story';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function fill(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? '');
  return out;
}

/** 该节点是否已有某类故事揭示（纯函数） */
export function storyRevealed(revealed: NodeStoriesRevealed, nodeId: string, kind: NodeStoryKind): boolean {
  return (revealed[nodeId] ?? []).includes(kind);
}

/**
 * 生成节点故事（纯函数）：
 * - 首次探访（未揭示 first）→ 必触发 first
 * - 重复访问（已有 first）→ 30% 概率触发 repeat（未揭示时）
 * - 特殊时机（season 非默认）→ 概率触发 special
 * 返回 null 表示本次不触发。
 */
export function generateNodeStory(
  nodeId: string,
  nodeName: string,
  revealed: NodeStoriesRevealed,
  season: string,
  rng: () => number = Math.random
): { story: NodeStory; revealed: NodeStoriesRevealed } | null {
  const pool = NODE_STORY_TEMPLATES[nodeId] ?? GENERIC_NODE_STORIES;
  const current = revealed[nodeId] ?? [];

  // 首次探访：必触发
  if (!current.includes('first')) {
    const tpl = pick(pool.first, rng);
    return {
      story: { id: `ns-${nodeId}-first-${Math.floor(rng() * 1000)}`, nodeId, kind: 'first', content: fill(tpl, { nodeName, season }) },
      revealed: { ...revealed, [nodeId]: [...current, 'first'] },
    };
  }

  // 特殊时机（季节明确且未揭示）→ 优先 50%
  const hasSpecial = pool.special.length > 0 && season !== '春' && season !== '';
  if (hasSpecial && !current.includes('special') && rng() < 0.5) {
    const tpl = pick(pool.special, rng);
    return {
      story: { id: `ns-${nodeId}-special-${Math.floor(rng() * 1000)}`, nodeId, kind: 'special', content: fill(tpl, { nodeName, season }) },
      revealed: { ...revealed, [nodeId]: [...current, 'special'] },
    };
  }

  // 重复访问：30% 触发（已揭示 repeat 则不再重复）
  if (!current.includes('repeat') && rng() < 0.3) {
    const tpl = pick(pool.repeat, rng);
    return {
      story: { id: `ns-${nodeId}-repeat-${Math.floor(rng() * 1000)}`, nodeId, kind: 'repeat', content: fill(tpl, { nodeName, season }) },
      revealed: { ...revealed, [nodeId]: [...current, 'repeat'] },
    };
  }

  return null;
}

/** 节点是否有未揭示的重复故事（UI 提示用；纯函数） */
export function hasMoreStories(revealed: NodeStoriesRevealed, nodeId: string): boolean {
  const pool = NODE_STORY_TEMPLATES[nodeId] ?? GENERIC_NODE_STORIES;
  const current = revealed[nodeId] ?? [];
  return !current.includes('first') || (pool.repeat.length > 0 && !current.includes('repeat'));
}

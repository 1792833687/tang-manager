/**
 * 《我在唐朝当掌柜》故事标签分配（Step 5a 3.2）
 * 纯函数：assignStoryTag(guest, shopType, rng?, prevTag?) → { tagId, label, stage } | null。
 * - 70% 概率分配；通用池 60% / 专属池 40%。
 * - special 类型优先专属（70% 专属 / 30% 通用）。
 * - observe 类型偏向敏感标签（试探/避祸/保密/寻人，60% 从敏感池取）。
 * - 回头客（prevTag 提供）自动继承同类标签并推进阶段（progression 如 做嫁衣→赶制嫁衣→婚宴筹备）。
 * 接线：generateSingleGuest 调用本函数并写入 guest.storyTag/storyStage。
 */
import { COMMON_STORY_TAGS, SENSITIVE_TAG_IDS, SHOP_STORY_TAGS, type StoryTagDef } from '@/config/tang-story-tags';
import type { GuestType, ShopType } from '@/types/tang-manager';

export interface AssignedStoryTag {
  /** 标签 id（延续用） */
  tagId: string;
  /** 标签展示名（做嫁衣 / 赶制嫁衣 …） */
  label: string;
  /** 阶段（首见 0；回头客推进 ≥1） */
  stage: number;
}

export interface PrevStoryTag {
  tagId: string;
  stage: number;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

/** 单池均匀取 */
function pickFrom(pool: readonly StoryTagDef[], rng: () => number): StoryTagDef {
  return pick(pool, rng);
}

/** 敏感标签池（试探/避祸/保密/寻人） */
function sensitivePool(): StoryTagDef[] {
  return COMMON_STORY_TAGS.filter((t) => SENSITIVE_TAG_IDS.includes(t.id));
}

/**
 * 分配故事标签（3.2）。
 * @param guest 仅需 type（special/observe 有专属逻辑）
 * @param prevTag 回头客既往标签（可选）：继承同标签并推进 progression 阶段
 */
export function assignStoryTag(
  guest: { type: GuestType },
  shopType: ShopType,
  rng: () => number = Math.random,
  prevTag?: PrevStoryTag
): AssignedStoryTag | null {
  // 回头客：继承同标签并推进阶段
  if (prevTag) {
    const def = [...COMMON_STORY_TAGS, ...Object.values(SHOP_STORY_TAGS).flat()].find(
      (t) => t.id === prevTag.tagId
    );
    if (!def) {
      return null;
    }
    if (def.progression && def.progression.length > 0) {
      const nextStage = prevTag.stage + 1;
      const label = def.progression[Math.min(nextStage, def.progression.length - 1)]!;
      return { tagId: def.id, label, stage: nextStage };
    }
    return { tagId: def.id, label: def.label, stage: prevTag.stage };
  }

  // 70% 概率分配
  if (rng() >= 0.7) {
    return null;
  }

  const shopPool = SHOP_STORY_TAGS[shopType];

  // special 优先专属（70% 专属 / 30% 通用）
  if (guest.type === 'special') {
    const def = rng() < 0.7 ? pickFrom(shopPool, rng) : pickFrom(COMMON_STORY_TAGS, rng);
    return { tagId: def.id, label: def.label, stage: 0 };
  }

  // observe 偏向敏感标签（60% 敏感池；其余 40% 按通用/专属 60/40）
  if (guest.type === 'observe') {
    if (rng() < 0.6) {
      const def = pickFrom(sensitivePool(), rng);
      return { tagId: def.id, label: def.label, stage: 0 };
    }
    const def = rng() < 0.6 ? pickFrom(COMMON_STORY_TAGS, rng) : pickFrom(shopPool, rng);
    return { tagId: def.id, label: def.label, stage: 0 };
  }

  // 默认：通用 60% / 专属 40%
  const def = rng() < 0.6 ? pickFrom(COMMON_STORY_TAGS, rng) : pickFrom(shopPool, rng);
  return { tagId: def.id, label: def.label, stage: 0 };
}

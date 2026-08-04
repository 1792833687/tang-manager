/**
 * 《我在唐朝当掌柜》宾客留言簿文案池（TANG-RCP-001 模块四）
 * - 纯数据：praise 好评 / story 回头客故事 / event 特殊事件客 三类古风文案。
 * - 特殊客人联动（用户 4.4 逐字，占位注释 / 轻量实现，未实装数值）：
 *   - 进士 → 下次消费 ×10（留言簿 event 条目预留，接线见 store 注释）
 *   - 胡商 → 解锁稀有商品（留言簿 event 条目预留，接线见 store 注释）
 *   - 赵管家 → 债主剧情（留言簿 event 条目预留，接线见 store 注释）
 * - 独立文件避免 tang-narrative.ts 膨胀；纯数据，不依赖 store。
 */
import type { Guest, GuestBookEntry, GuestLevel } from '@/types/tang-manager';

/** 特殊事件客名单（留言簿 type='event' 触发；对应 4.4 联动占位） */
export const SPECIAL_GUEST_NAMES: readonly string[] = ['胡商', '进士', '赵管家'];

/** 特殊客人联动占位说明（4.4 用户逐字；工程上以注释 + 留言簿 event 条目体现，数值接线未实装） */
export const SPECIAL_GUEST_LINKAGE: Record<string, { note: string; hook: string }> = {
  胡商: { note: '解锁稀有商品（占位：后续进货面板接入稀有货清单）', hook: 'unlock-rare-goods' },
  进士: { note: '下次消费 ×10（占位：knownGuests.consumptionMultiplier 设为 10）', hook: 'next-spend-x10' },
  赵管家: { note: '债主剧情（占位：触发 debt_collection 事件线）', hook: 'debt-plot' },
};

/** 好评留言模板（满意度≥80 且累计消费≥50）— 古风自拟 */
export const GUEST_BOOK_PRAISE_TEMPLATES: readonly string[] = [
  '「好菜好酒，宾至如归，来日再访。」',
  '「掌柜待客诚厚，此处堪当长安头一等。」',
  '「酒香不怕巷深，此店值得十里相迎。」',
  '「一席之间，暖了游子半生乡愁。」',
];

/** 回头客故事留言模板（第三次光顾）— 古风自拟 */
export const GUEST_BOOK_STORY_TEMPLATES: readonly string[] = [
  '「三度登门，此店已是我在长安的落脚处。」',
  '「头回是过客，二回是熟客，三回便成了故人。」',
  '「掌柜可还记得我？去年那壶温酒，暖到今日。」',
];

/** 特殊事件客留言模板（胡商/进士/赵管家）— 古风自拟 */
export const GUEST_BOOK_EVENT_TEMPLATES: readonly string[] = [
  '「异乡客题：长安繁华，独此一店有故土味。」',
  '「贵人留墨：此店气运正盛，他日必有大造化。」',
  '「深夜客题：账上的旧债，改日自有分晓。」',
];

/** 客等中文标签（铜/银/金/玉；留言簿与接待面板共用） */
export const GUEST_LEVEL_LABEL: Record<GuestLevel, string> = {
  bronze: '铜',
  silver: '银',
  gold: '金',
  diamond: '玉',
};

/** 按累计消费升级客等（工程定值：铜<50 / 银<150 / 金<400 / 玉≥400；注释） */
export function levelForTotalSpent(totalSpent: number): GuestLevel {
  if (totalSpent >= 400) return 'diamond';
  if (totalSpent >= 150) return 'gold';
  if (totalSpent >= 50) return 'silver';
  return 'bronze';
}

/** 留言簿内容生成：按触发类型 + 客等/故事标签从文案池抽取（工程定值：praise 按名字尾数选池，story/event 随机；注释） */
export function guestBookContentFor(guest: Guest, type: GuestBookEntry['type']): string {
  if (type === 'praise') {
    const pool = GUEST_BOOK_PRAISE_TEMPLATES;
    const idx = Math.abs(guest.name.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0)) % pool.length;
    return pool[idx] ?? pool[0]!;
  }
  if (type === 'story') {
    const pool = GUEST_BOOK_STORY_TEMPLATES;
    const idx = (guest.visitCount ?? 1) % pool.length;
    return pool[idx] ?? pool[0]!;
  }
  const pool = GUEST_BOOK_EVENT_TEMPLATES;
  const idx = Math.abs((guest.totalSpent ?? 0) % pool.length);
  return pool[idx] ?? pool[0]!;
}

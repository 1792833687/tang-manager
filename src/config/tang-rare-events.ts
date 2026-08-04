/**
 * 《我在唐朝当掌柜》意外之喜配置（TANG-ADD-001 模块二）
 * 6 稀有事件逐字：微服私访 声望≥200 2% 金50 / 胡商献宝 西市≥40 1.5% 夜明珠300 /
 * 故人之后 day≥30 3% 线索 old_friend_tree / 天降祥瑞 day≥60 1% 金100 /
 * 街头偶遇 谢七登场未触发 2.5% 好感+20 金-10 / 夜半来客 day≥90 负债0 2% 线索 xuan_gui_mystery。
 * 纯数据，不依赖 store；触发判定纯函数在 systems/tang-rare-events.ts。
 */
import type { RareEvent } from '@/types/tang-manager';

/** 意外之喜全量（打烊遍历独立判定；条件不满足/已触发跳过） */
export const RARE_EVENTS: readonly RareEvent[] = [
  {
    id: 'wei-fu-si-fang',
    title: '微服私访',
    description: '一位自称「白身客」的老者踱进店来，点了一壶最便宜的茶，却出手阔绰，留下一锭银子便飘然而去。',
    chance: 0.02,
    condition: { minReputation: 200 },
    rewards: { silver: 50 },
    triggeredKey: 'rare-wei-fu-si-fang',
  },
  {
    id: 'hu-shang-xian-bao',
    title: '胡商献宝',
    description: '波斯胡商见你待客殷勤，从怀中取出一颗夜明珠相赠，说是西市多年往来的情分。',
    chance: 0.015,
    condition: { minFactionRelationship: 40 },
    rewards: { silver: 300 },
    triggeredKey: 'rare-hu-shang-xian-bao',
  },
  {
    id: 'gu-ren-zhi-hou',
    title: '故人之后',
    description: '一位年轻人持着半枚旧玉佩寻来，说是祖父临终前嘱他，务必到东市陆记打听一位故人的下落。',
    chance: 0.03,
    condition: { minDay: 30 },
    rewards: { clue: 'old_friend_tree' },
    triggeredKey: 'rare-gu-ren-zhi-hou',
  },
  {
    id: 'tian-jiang-xiang-rui',
    title: '天降祥瑞',
    description: '清晨开张，门前落下一对衔着铜钱的喜鹊，街坊都说这是天降祥瑞，必主财源广进。',
    chance: 0.01,
    condition: { minDay: 60 },
    rewards: { silver: 100 },
    triggeredKey: 'rare-tian-jiang-xiang-rui',
  },
  {
    id: 'jie-tou-ou-yu',
    title: '街头偶遇',
    description: '打烊路过赌坊，正撞见谢七输红了眼。他见了你，咧嘴一笑：「掌柜的，借我十两翻本，改日双倍奉还。」',
    chance: 0.025,
    condition: { requireXieQiAppeared: true },
    rewards: { favor: 20, penaltySilver: 10 },
    triggeredKey: 'rare-jie-tou-ou-yu',
  },
  {
    id: 'ye-ban-lai-ke',
    title: '夜半来客',
    description: '夜深人静，忽闻叩门声。门外站着一位披着斗篷的客人，只说：「陆掌柜，我家主人有一物要亲手交给你。」',
    chance: 0.02,
    condition: { minDay: 90, requireDebtZero: true },
    rewards: { clue: 'xuan_gui_mystery' },
    triggeredKey: 'rare-ye-ban-lai-ke',
  },
];

/** id → 事件 索引 */
export const RARE_EVENT_MAP: Readonly<Record<string, RareEvent>> = Object.fromEntries(
  RARE_EVENTS.map((e) => [e.id, e])
);

/** 事件查询（id → 定义；不存在返回 null） */
export function rareEventById(id: string): RareEvent | null {
  return RARE_EVENT_MAP[id] ?? null;
}

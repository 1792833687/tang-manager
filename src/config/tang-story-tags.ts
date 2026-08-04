/**
 * 《我在唐朝当掌柜》故事标签池（Step 5a 3.1）
 * - 用户 3.1 逐字：通用 20 + 三店型专属各 5。
 * - 每个标签带一句话场景描写模板（sceneHint，供降级模板与 AI prompt）。
 * - 线索（3.3 逐字）：沈氏商号/锦衣公子/东市新贵→沈听澜线索；赌场/混子/谢七→谢七线索；
 *   赵员外/催债/利钱→债主线索。以 AI 叙事「细节暗示」呈现，不强制触发。
 * - progression：回头客延续阶段（3.2：做嫁衣→赶制嫁衣→婚宴筹备）。
 * - 纯数据，不依赖 store。
 */
import type { ShopType } from '@/types/tang-manager';

export interface StoryTagDef {
  id: string;
  /** 标签名（展示/AI 输入） */
  label: string;
  /** 一句话场景描写模板（降级模板与 AI prompt 用） */
  sceneHint: string;
  /** 主线线索关键词（3.3；无则缺省） */
  clue?: string;
  /** 回头客延续阶段（3.2；缺省 = 无延续，沿用同标签） */
  progression?: string[];
}

/** 通用标签（20 个，用户 3.1 逐字） */
export const COMMON_STORY_TAGS: readonly StoryTagDef[] = [
  { id: 'homesick', label: '乡愁', sceneHint: '念着故里的酒菜，眼圈微红' },
  { id: 'compare', label: '攀比', sceneHint: '话里话外都在与对门较劲' },
  { id: 'secret', label: '隐情', sceneHint: '欲言又止，似有难言之隐', clue: '锦衣公子' },
  { id: 'nostalgia', label: '怀旧', sceneHint: '絮絮叨叨讲着旧年光景' },
  { id: 'probe', label: '试探', sceneHint: '目光在店堂间来回打量，话里有话', clue: '沈氏商号' },
  { id: 'worry', label: '心事', sceneHint: '眉头微蹙，食不知味' },
  { id: 'repay', label: '报恩', sceneHint: '提及当年受惠，神色郑重' },
  { id: 'flee', label: '逃亡', sceneHint: '压低帽檐，似在躲什么人', clue: '混子' },
  { id: 'showoff', label: '炫耀', sceneHint: '把新得的物件摆到桌上显摆' },
  { id: 'crush', label: '暗恋', sceneHint: '说着话，耳根却悄悄红了' },
  { id: 'reunion', label: '重逢', sceneHint: '与故人久别重逢，又惊又喜' },
  { id: 'breakup', label: '决裂', sceneHint: '赌着气，话音里带着火气' },
  { id: 'secrecy', label: '保密', sceneHint: '左右看看，才压低声音开口', clue: '东市新贵' },
  { id: 'credit', label: '赊账', sceneHint: '搓着手，想开口赊上一回', clue: '催债' },
  { id: 'pray', label: '祈福', sceneHint: '点了香，合十默念几句' },
  { id: 'vow', label: '还愿', sceneHint: '念叨着要还当年许下的愿', clue: '利钱' },
  { id: 'avoid', label: '避祸', sceneHint: '神色紧张，频频望向门口' },
  { id: 'search', label: '寻人', sceneHint: '掏出一张画像，向掌柜打听', clue: '东市新贵' },
  { id: 'legacy', label: '传承', sceneHint: '说要给儿孙留个念想' },
  { id: 'pout', label: '赌气', sceneHint: '一言不合，把银子拍在桌上', clue: '赌场' },
];

/** 店型专属标签（各 5 个，用户 3.1 逐字） */
export const SHOP_STORY_TAGS: Record<ShopType, readonly StoryTagDef[]> = {
  jiulou: [
    { id: 'birthday', label: '摆寿宴', sceneHint: '要为家中老人摆寿酒，点名要好彩头' },
    { id: 'blind-date', label: '相亲宴', sceneHint: '订了一桌相亲宴，反复叮嘱要体面' },
    { id: 'farewell', label: '送别酒', sceneHint: '举杯敬向空座，为远行故人饯别' },
    { id: 'celebration', label: '庆功宴', sceneHint: '一进门就要最好的酒，说是庆功' },
    { id: 'apology', label: '赔罪宴', sceneHint: '备了赔罪酒，想与故人重归于好' },
  ],
  buzhuang: [
    { id: 'wedding-dress', label: '做嫁衣', sceneHint: '量着身段做嫁衣，眉眼都是喜气', progression: ['做嫁衣', '赶制嫁衣', '婚宴筹备'] },
    { id: 'official-robe', label: '赶制官服', sceneHint: '催着赶制官服，说是赴任在即' },
    { id: 'heirloom-mend', label: '缝补传家衣', sceneHint: '捧来一件旧衣，说要缝补传家' },
    { id: 'fashion-copy', label: '仿制时新花样', sceneHint: '指着画样，要仿制东市时新的花样' },
    { id: 'traveler-cloth', label: '为远行人制衣', sceneHint: '要为远行的亲人做身厚实的衣裳' },
  ],
  yaopu: [
    { id: 'rare-illness', label: '疑难杂症', sceneHint: '捂着胸口，说寻遍名医无果' },
    { id: 'fertility', label: '求子药方', sceneHint: '红着脸，低声讨要求子的方子' },
    { id: 'army-herb', label: '军需药材', sceneHint: '说是边关急用，要大批药材' },
    { id: 'palace-recipe', label: '宫中秘方', sceneHint: '压低声音，说想求一味宫中秘方' },
    { id: 'folk-remedy', label: '江湖偏方', sceneHint: '掏出一张泛黄的方子，说要抓药' },
  ],
};

/** 观察型客人偏好的敏感标签（3.2：试探/避祸/保密/寻人） */
export const SENSITIVE_TAG_IDS: readonly string[] = ['probe', 'avoid', 'secrecy', 'search'];

/** 按标签名（label）查找标签定义（通用 + 三店型；接待叙事/降级模板用） */
export function findStoryTag(label: string): StoryTagDef | undefined {
  const all = [
    ...COMMON_STORY_TAGS,
    ...Object.values(SHOP_STORY_TAGS).flat(),
  ];
  return all.find((t) => t.label === label);
}

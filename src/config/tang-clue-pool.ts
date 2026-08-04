/**
 * 《我在唐朝当掌柜》蛛丝马迹线索池（Step 5b-5 模块二；用户 2.2 原文全量）
 * 分类数：沈听澜 5 / 谢七 5 / 债主 3 / 政治 3 / 商业 3 / 隐秘 3，合计 22 条。
 * 说明：任务稿头行写「线索池 18 条」，但分类明细 5+5+3+3+3+3=22——
 * 工程按「逐字分类数」落地（分类数比总数更具体，注释留痕），故 22 条。
 * 每条含 poolId（稳定标识，generateClue 去重用）与 category/content/source 提示。
 * 纯数据，不依赖 store；systems/tang-clues.ts 消费本配置。
 */
import type { ClueCategory } from '@/types/tang-clues';

/** 线索池条目（生成时按 poolId 去重：同一线索只落一次） */
export interface CluePoolItem {
  /** 稳定 id（generateClue 抽取后作为 Clue.id，重复抽取拦截） */
  id: string;
  category: ClueCategory;
  /** 线索正文（古风三行摘要体） */
  content: string;
  /** 默认来源（生成时可被调用方 source 覆盖） */
  source: string;
}

/** 18→22 条线索池（用户 2.2 逐字；沈听澜 5/谢七 5/债主 3/政治 3/商业 3/隐秘 3） */
export const CLUE_POOL: readonly CluePoolItem[] = [
  // ---- 沈听澜 5（category shen）----
  { id: 'clue-shen-1', category: 'shen', source: '沈听澜', content: '沈氏商号的飞钱往来，总在深夜经东市胡商之手转手，账面上却从不见这笔银两。' },
  { id: 'clue-shen-2', category: 'shen', source: '沈听澜', content: '听澜阁后院常有一位紫袍客出入，腰间悬鱼袋，看佩制当是内侍省中人。' },
  { id: 'clue-shen-3', category: 'shen', source: '沈听澜', content: '沈老板抚琴至夜半，曲调总在「商」音上多停半拍，似有所待，又似有所忌。' },
  { id: 'clue-shen-4', category: 'shen', source: '沈听澜', content: '东市商会账册的「杂项」一项，月月入账银额恰好是官仓采买价的三成。' },
  { id: 'clue-shen-5', category: 'shen', source: '沈听澜', content: '有人见沈听澜在巍明楼与朝中主簿对坐，谈至三更，席间并无旁人作陪。' },
  // ---- 谢七 5（category xie）----
  { id: 'clue-xie-1', category: 'xie', source: '谢七', content: '谢七的赌坊里，输家抵押的地契最后都落在同一人手中——长安城里的「半扇门」。' },
  { id: 'clue-xie-2', category: 'xie', source: '谢七', content: '西市商团的驼队进城门时，货物清单上写的是香料，箱底却压着漕运司的封条。' },
  { id: 'clue-xie-3', category: 'xie', source: '谢七', content: '谢七与码头帮把头的暗号是「三短两长」的梆子声，敲过之后，夜里总有船靠岸。' },
  { id: 'clue-xie-4', category: 'xie', source: '谢七', content: '西市当铺柜上那把来历不明的玉扳指，与谢七常把玩的那枚纹路一模一样。' },
  { id: 'clue-xie-5', category: 'xie', source: '谢七', content: '谢七说过一句怪话：钱庄的利钱是明账，赌场的利钱是暗账，官府的利钱是「孝敬」。' },
  // ---- 债主 3（category debt）----
  { id: 'clue-debt-1', category: 'debt', source: '债主', content: '那位催债的矮胖债主，袖中常年揣着一叠泛黄的契书，边角都磨起了毛。' },
  { id: 'clue-debt-2', category: 'debt', source: '债主', content: '债主只在每月十五上门，且从不走正门——据说那是「上面」定的规矩。' },
  { id: 'clue-debt-3', category: 'debt', source: '债主', content: '旧债的利息文书末尾，落着一方奇怪的私印，印文隐约是个「钱」字，却缺了半边。' },
  // ---- 政治 3（category politics）----
  { id: 'clue-pol-1', category: 'politics', source: '京兆府', content: '京兆府衙的卷宗里，夹着一份没有编号的邸报，说的是三年前一桩无人认领的抄家案。' },
  { id: 'clue-pol-2', category: 'politics', source: '平准署', content: '平准署每逢皇商招标，主簿总提前三日「恰好」出城，留下一句：看天意。' },
  { id: 'clue-pol-3', category: 'politics', source: '巍明楼', content: '巍明楼雅间的墙上有道暗门，宴罢人去，门后偶尔会递出一方盖了朱印的条子。' },
  // ---- 商业 3（category business）----
  { id: 'clue-biz-1', category: 'business', source: '东市商会', content: '东市的绸缎价总比西市高两成，可两边的货，分明是从同一支驼队卸下来的。' },
  { id: 'clue-biz-2', category: 'business', source: '波斯邸', content: '波斯邸的胡商只收飞钱不收现银，说是「长安的银子会咬手」。' },
  { id: 'clue-biz-3', category: 'business', source: '码头仓库', content: '码头仓库半夜有人验货，点的是松明火把——官府押运从不用松明。' },
  // ---- 隐秘 3（category secret）----
  { id: 'clue-sec-1', category: 'secret', source: '平康坊', content: '平康坊的歌姬唱词里藏着一句暗语，连唱七日，必有人从坊门东侧递银子。' },
  { id: 'clue-sec-2', category: 'secret', source: '张婆', content: '张婆说，长安城的井水，有几口是「通着暗渠的」，夜里能听见流水声。' },
  { id: 'clue-sec-3', category: 'secret', source: '城外桑园', content: '城外桑园的守园人守的不是桑树，是桑园底下那间锁了十年的地窖。' },
];

/** 线索池查询（id → CluePoolItem） */
export const CLUE_POOL_MAP: Readonly<Record<string, CluePoolItem>> = Object.fromEntries(
  CLUE_POOL.map((c) => [c.id, c])
) as Record<string, CluePoolItem>;

/** 按类别取未抽取线索（供 generateClue 抽取） */
export function unusedCluesByCategory(
  category: ClueCategory,
  existingIds: readonly string[]
): CluePoolItem[] {
  return CLUE_POOL.filter((c) => c.category === category && !existingIds.includes(c.id));
}

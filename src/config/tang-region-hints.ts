/**
 * 《我在唐朝当掌柜》迷雾系统 · 区域坊间传言文案池（TANG-MIST-001 模块一）
 * 地图 L2/L3 未探访点位点击时，展示灰色问号 + 此处坊间传言 + 揭示条件。
 * 用户 1.2 逐字：老字号染坊 / 胡商聚集地 / 茶馆老板娘 / 铺面转手 / 平准署 / 地下赌坊 / 名医坐馆。
 * 纯数据，不依赖 store；systems/tang-fog.ts 消费本配置。
 */
import type { RegionFog } from '@/types/tang-manager';

/** 坊间传言文案池（7 条，用户 1.2 逐字主题；古风措辞） */
export const REGION_HINTS: readonly string[] = [
  '坊间传言，东市有家老字号染坊，一匹布能染出七色，掌柜却轻易不肯示人。',
  '听说西市胡商聚集之地，常有奇珍异宝流转，寻常人轻易进不得。',
  '茶摊老板娘嘴最碎，坊间一应消息，多是从她那儿漏出来的。',
  '有老铺面这几日悄悄转了手，新东家来历不明，街坊们议论纷纷。',
  '平准署的官老爷们最是清高，寻常商户想攀上关系，难。',
  '西市深处有个地下赌坊，三教九流都在那儿过手银钱。',
  '城里有位名医坐馆，据说能治疑难杂症，寻常人轻易请不动。',
];

/** 揭示条件模板（未揭示时 hover/遮罩提示；工程统一文案，注释） */
export const REGION_REVEAL_CONDITION =
  '午后「探访未知区域」可探明此处；或与坊间茶客闲聊、往来此处时偶有所闻（两成）。';

/** 按点位 id 取坊间传言（循环取池，工程定；无点位时取首条） */
export function regionHintFor(nodeId: string): string {
  const idx = Array.from(nodeId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return REGION_HINTS[idx % REGION_HINTS.length] ?? REGION_HINTS[0]!;
}

/** 由点位构建 RegionFog 的提示字段（nodeId 稳定映射，供初始态与揭示用） */
export function buildRegionFogHint(nodeId: string): Pick<RegionFog, 'hint' | 'revealCondition'> {
  return {
    hint: regionHintFor(nodeId),
    revealCondition: REGION_REVEAL_CONDITION,
  };
}

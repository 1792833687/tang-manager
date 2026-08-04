/**
 * 《我在唐朝当掌柜》叙事文案集中配置
 * 全部文案为需求方用户原文，逐字保留；UI 组件仅引用本文件导出常量。
 */
import type { AgeBand } from '@/types/tang-manager';

/** 家传手札 · 开场五段（用户原文，逐字保留） */
export const FAMILY_LEDGER_PARAGRAPHS: readonly string[] = [
  '余陆氏先祖，自贞观年间起于长安东市立店，三代经营，积金累万。',
  '然天宝年中，家道中落，店铺凋零，至汝父辈已仅余一店一仆一债。',
  '今汝既承此业，当知——商道即人道，店心即人心。',
  '此札所记，乃先祖三代商海浮沉之秘，每逢抉择，札中自有指引。',
  '长安万里，始于足下。好自为之。',
];

/** 开场场景描写（用户原文，逐字保留） */
export const OPENING_SCENE =
  '你推开永乐坊那间老店的门板，灰尘在午后的阳光里飞扬。店内空了大半年，桌椅上落了厚厚一层灰。一个年轻人从柜台后面抬起头，手里攥着一块抹布，看见你先是愣了一下，然后咧嘴笑了。';

/** 阿昭 · 身份阶段台词（需求方原文，逐字保留） */
export const AZHAO_IDENTITY_LINE = '您可算来了。';

/** 阿昭 · 店型阶段引导语（用户原文，逐字保留） */
export const AZHAO_SHOP_TYPE_LINE =
  '掌柜的，咱们这铺面开什么营生好？老太爷在世时做过酒楼，也卖过布匹药材。您拿个主意。';

/** 阿昭 · 难度阶段引导语（用户原文，逐字保留） */
export const AZHAO_DIFFICULTY_LINE =
  '掌柜的，有句话我不知当讲不当讲——老太爷在世的时候，在这册子上记了不少买卖上的门道。他说，开店有三条路，就看东家怎么选。';

/** 阿昭 · 进入经营阶段台词 */
export const AZHAO_PLAYING_LINE = '从今往后，这铺子就是您的家了。';

/** 年龄段中文标签 */
export const AGE_LABELS: Record<AgeBand, string> = {
  young: '少年',
  adult: '青年',
  middle: '中年',
};

/** 声望称号（Step 1 仅实现 <100 初露锋芒，其余为占位阶梯） */
export function reputationTitle(reputation: number): string {
  if (reputation < 100) {
    return '初露锋芒';
  }
  if (reputation < 300) {
    return '小有名气';
  }
  if (reputation < 600) {
    return '声名鹊起';
  }
  if (reputation < 1000) {
    return '名动长安';
  }
  return '长安首富';
}

/**
 * 《我在唐朝当掌柜》局外成长系统（TANG-ADD-001 模块九）
 * 局外成长：传承点数按结局评定；开局可选传承（独立 localStorage 'tang-legacy-growth'，与主存档隔离、删档不受影响）。
 * 纯函数：
 * - calculateAncestralBlessing(endingId)：商圣/皇商 3、权倾 4、执棋者 5、教父 2、归隐 1、家道/无人 0。
 * - getAncestralBlessingOptions()：8 传承逐字。
 * - applyAncestralBlessing(save, blessingId)：扣点数 + 记录（store 把生效效果应用到开局状态）。
 * - load/saveLegacyGrowth：独立 localStorage 读写（与 zustand persist 隔离）。
 * 铁律：古风措辞；不持有游戏状态（仅读自身存档）。
 */
import type { AncestralBlessingOption, LegacyGrowthSave } from '@/types/tang-manager';

/** 独立存储键（与主存档 tang-manager-store 隔离） */
export const LEGACY_GROWTH_STORAGE_KEY = 'tang-legacy-growth';

/** 结局 → 传承点数 */
export function calculateAncestralBlessing(endingId: string | null | undefined): number {
  switch (endingId) {
    case 'shang-sheng':
    case 'huangshang':
      return 3;
    case 'quanqing-chaoye':
      return 4;
    case 'zhiqizhe':
      return 5;
    case 'shangjie-jiaofu':
      return 2;
    case 'guiyin':
      return 1;
    case 'jiadao-zhongluo':
    case 'wuren-wenjin':
    default:
      return 0;
  }
}

/** 8 传承逐字（cost 为所需点数；效果由 store 开局应用） */
export const ANCESTRAL_BLESSINGS: readonly AncestralBlessingOption[] = [
  { id: 'blessing-remainder', name: '祖传余荫', cost: 1, description: '先祖庇佑，开局多带三十两现银。' },
  { id: 'blessing-old-friend', name: '故旧之情', cost: 2, description: '开局沈听澜或谢七好感 +20。' },
  { id: 'blessing-old-shop', name: '老店新开', cost: 2, description: '开局店铺评分 1.8。' },
  { id: 'blessing-shiren', name: '识人之明', cost: 3, description: '开局阿昭好感 +20、满意度 +15。' },
  { id: 'blessing-debt-free', name: '债已清偿', cost: 3, description: '开局负债减半。' },
  { id: 'blessing-craft', name: '手艺传承', cost: 3, description: '开局随机获得一张配方。' },
  { id: 'blessing-map', name: '地图已熟', cost: 3, description: '开局解锁地图 L2（东市西市）。' },
  { id: 'blessing-eye', name: '先祖之眼', cost: 5, description: '开局通晓人心 +1 次，反噬阈值翻倍。' },
];

/** id → 传承 索引 */
export const ANCESTRAL_BLESSING_MAP: Readonly<Record<string, AncestralBlessingOption>> = Object.fromEntries(
  ANCESTRAL_BLESSINGS.map((b) => [b.id, b])
);

/** 获取全部传承选项 */
export function getAncestralBlessingOptions(): readonly AncestralBlessingOption[] {
  return ANCESTRAL_BLESSINGS;
}

/** 默认存档（空） */
export function emptyLegacyGrowthSave(): LegacyGrowthSave {
  return { blessingPoints: 0, chosenBlessings: [], endings: {}, activeBlessings: [] };
}

/** 局外成长存档读取（SSR/无 localStorage 安全；解析失败按空档） */
export function loadLegacyGrowthSave(storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): LegacyGrowthSave {
  if (!storage) return emptyLegacyGrowthSave();
  try {
    const raw = storage.getItem(LEGACY_GROWTH_STORAGE_KEY);
    if (!raw) return emptyLegacyGrowthSave();
    const parsed = JSON.parse(raw) as Partial<LegacyGrowthSave>;
    return {
      blessingPoints: typeof parsed.blessingPoints === 'number' ? parsed.blessingPoints : 0,
      chosenBlessings: Array.isArray(parsed.chosenBlessings) ? parsed.chosenBlessings : [],
      endings: parsed.endings && typeof parsed.endings === 'object' ? parsed.endings : {},
      activeBlessings: Array.isArray(parsed.activeBlessings) ? parsed.activeBlessings : [],
    };
  } catch {
    return emptyLegacyGrowthSave();
  }
}

/** 局外成长存档写入（独立存储） */
export function saveLegacyGrowthSave(
  save: LegacyGrowthSave,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null
): void {
  if (!storage) return;
  try {
    storage.setItem(LEGACY_GROWTH_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // 存储不可用（隐私模式等）静默失败，不影响主流程
  }
}

/** 结算结局点数入账：把 endingId 记入 endings 并累加点数（返回更新后存档） */
export function addEndingBlessing(save: LegacyGrowthSave, endingId: string | null | undefined): LegacyGrowthSave {
  const points = calculateAncestralBlessing(endingId);
  const endings = { ...save.endings };
  if (endingId) {
    endings[endingId] = (endings[endingId] ?? 0) + 1;
  }
  return { ...save, blessingPoints: save.blessingPoints + points, endings };
}

/** 应用传承：扣点数 + 记录（返回 { ok, save }；点数不足/已选/不存在 → ok=false） */
export function applyAncestralBlessing(
  save: LegacyGrowthSave,
  blessingId: string
): { ok: boolean; reason?: string; save: LegacyGrowthSave } {
  const blessing = ANCESTRAL_BLESSING_MAP[blessingId];
  if (!blessing) {
    return { ok: false, reason: '传承不存在', save };
  }
  if (save.chosenBlessings.includes(blessingId)) {
    return { ok: false, reason: '该传承本局已选', save };
  }
  if (save.blessingPoints < blessing.cost) {
    return { ok: false, reason: '传承点数不足', save };
  }
  return {
    ok: true,
    save: {
      ...save,
      blessingPoints: save.blessingPoints - blessing.cost,
      chosenBlessings: [...save.chosenBlessings, blessingId],
      activeBlessings: [...save.activeBlessings, blessingId],
    },
  };
}

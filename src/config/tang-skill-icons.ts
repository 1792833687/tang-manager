/**
 * 技能图标映射表（TANG-ART-002 美术接入）
 * - 16 个技能 id → 图标文件名（不含后缀，UI 层加 .png / .svg）
 * - 顺序按 SKILL_POOL 的 quality/efficiency/cost/special 类别内顺序；
 *   文件名按任务约定（knife/fire/select/recipe + swift/memory/multitask/prep
 *   + calculate/bargain/transform/waste + detect/guard/official/heal）。
 * - UI 找不到时返回 undefined，由父组件决定降级（隐藏图标或显示默认）。
 */
export const SKILL_ICON_MAP: Record<string, string> = {
  // 品质类（4）
  'q-chef': 'recipe-skill',
  'q-tailor': 'select-skill',
  'q-pharmacist': 'detect-skill',
  'q-waiter': 'knife-skill',
  // 效率类（4）
  'e-waiter': 'swift-skill',
  'e-chef': 'memory-skill',
  'e-tailor': 'multitask-skill',
  'e-pharmacist': 'prep-skill',
  // 成本类（4）
  'c-accountant': 'calculate-skill',
  'c-buyer': 'bargain-skill',
  'c-thrift': 'transform-skill',
  'c-ledger': 'waste-skill',
  // 特殊类（4）
  's-guard1': 'guard-skill',
  's-guard2': 'official-skill',
  's-social': 'detect-skill',
  's-lucky': 'heal-skill',
};
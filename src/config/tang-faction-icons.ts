/**
 * 势力图标映射表（TANG-ART-002 美术接入）
 * - 5 势力 id → 图标文件名（不含后缀）；imperial 为预留（无对应势力）。
 */
export const FACTION_ICON_MAP: Record<string, string> = {
  dongshi: 'east-guild',
  xishi: 'west-guild',
  jingzhao: 'jingzhao-office',
  underground: 'underground',
  pingkang: 'pingkang',
  // 朝廷派系（预留，FIVE_FACTIONS 当前未包含）
  imperial: 'imperial',
};
/**
 * 《我在唐朝当掌柜》迷雾系统 · 势力/人物迷雾文案池（TANG-MIST-001 模块一）
 * 势力隐藏目的（用户 1.3 逐字 6 条）与 NPC 隐藏故事占位（M2 填充）。
 * 纯数据，不依赖 store；systems/tang-fog.ts 消费本配置。
 */

/** 势力隐藏目的（6 条，用户 1.3 逐字；key=势力 id，含无势力卡的朝廷派系 court） */
export const FACTION_HIDDEN_AGENDAS: Record<string, string> = {
  dongshi: '东市商会暗中吞并独立商铺，欲一统东市货价。',
  xishi: '西市商团囤积铜钱，暗中影响朝廷铸币。',
  jingzhao: '京兆府与地下势力暗通款曲，官商互为倚仗。',
  underground: '地下势力在各商号皆有暗股，进退自如。',
  pingkang: '平康坊向各方贵人贩卖消息，消息即财源。',
  court: '朝中派系欲寻商界代言人，以商驭政。',
};

/** 势力隐藏目的揭示条件文案（线索墙该势力线索 ≥3 条；工程统一文案，注释） */
export const FACTION_AGENDA_REVEAL_CONDITION = '线索墙上此势力传闻渐多（同线线索 ≥ 3 条），或可窥其隐藏目的。';

/**
 * NPC 隐藏故事占位（M2 任务填充具体 NPC 数据）。
 * M1 仅建 NPCFog 数据结构与揭示函数；trueAttitude/hiddenStory 在 M2 前保持空串，UI 不渲染空内容。
 */
export const NPC_HIDDEN_STORY_PLACEHOLDER: Record<string, { trueAttitude: string; hiddenStory: string }> = {
  // 'shen-tinglan': { trueAttitude: '', hiddenStory: '' },  // M2 填充
  // 'xie-qi': { trueAttitude: '', hiddenStory: '' },        // M2 填充
  // 'a-zhao': { trueAttitude: '', hiddenStory: '' },        // M2 填充
};

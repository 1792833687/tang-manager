/**
 * 《我在唐朝当掌柜》库存操作旁白文案（Step 5b-1.5 模块七）
 * - 全部为古风逐字文案，禁止现代商业词汇；生僻术语首次出现须带游戏内注释（见各条注释）。
 * - 用途：shelf-panel 底部旁白展示（toast 风格，不阻塞流程）；由 store 在对应操作后写入
 *   state.inventoryNarratives（瞬时，不持久化）。
 */
export const INVENTORY_NARRATIVE = {
  /** 采买进货（普通采买/挂牌采买后） */
  procurement: '采买入库，货架渐丰。钱货两清，童叟无欺。',
  /** 商品陈损（打烊清除陈损货物后；陈损：货物存放过久变质或陈旧） */
  expired: '库房角落传来霉味——有货物存放过久，已陈损变质，只得弃去。',
  /** 临期提醒（打烊发现近陈损货物；陈损：见上） */
  nearExpiry: '库房管事来报：有几样货物临近陈损之期，宜早出手。',
  /** 库房满仓（采买/到货/加工产出超上限被拦截；库房：存放货物的房间） */
  full: '库房堆得插不进脚，再多也放不下了！',
  /** 加工完成（庖制/染织/炮制出库；庖制：厨房加工制作） */
  processingDone: '庖制、染织、炮制完毕，新货已摆上货架。',
  /** 籴粜契到货（籴粜契：籴（dí）买入、粜（tiào）卖出，向农户预付定金约定来年收购的契约） */
  contractArrived: '籴粜契到期，约定的货物已运抵库房。',
  /** 窃贼光顾（窃贼事件后） */
  thief: '夜半库房有异响——遭贼了！',
  /** 市易务挂牌（每日清晨生成挂牌后；市易务：管理市场物价的官署） */
  marketListing: '市易务今日挂牌，平准物资特价发卖，机不可失。',
} as const;

export type InventoryNarrativeKey = keyof typeof INVENTORY_NARRATIVE;

/** 取旁白文案（key 不存在时返回空串） */
export function inventoryNarrative(key: InventoryNarrativeKey): string {
  return INVENTORY_NARRATIVE[key] ?? '';
}

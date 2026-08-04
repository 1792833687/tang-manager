/**
 * 《我在唐朝当掌柜》员工技能池（Step 5a 2.3）
 * - 用户 2.3：品质 4 / 效率 4 / 成本 4 / 特殊 4 = 16 技能，各带 requiresType 适用类型限制。
 * - 招聘（tang-recruitment.ts）按员工类型过滤本池；结算（tang-settlement.ts）按员工类型
 *   而非具体技能 id 判定加成，因此技能名可独立调整不破坏结算逻辑。
 * - 纯数据，不依赖 store。
 */
import type { EmployeeSkill, EmployeeSkillType } from '@/types/tang-manager';

export const SKILL_POOL: Record<EmployeeSkillType, readonly EmployeeSkill[]> = {
  quality: [
    { id: 'q-chef', name: '招牌菜秘方', type: 'quality', description: '掌勺出品，风味拔群', requiresType: ['chef'] },
    { id: 'q-tailor', name: '针脚细密', type: 'quality', description: '裁衣走线，一丝不苟', requiresType: ['tailor'] },
    { id: 'q-pharmacist', name: '辨药如神', type: 'quality', description: '识药辩材，不出差错', requiresType: ['pharmacist'] },
    { id: 'q-waiter', name: '待客如沐春风', type: 'quality', description: '笑脸迎客，宾至如归', requiresType: ['waiter'] },
  ],
  efficiency: [
    { id: 'e-waiter', name: '手脚麻利', type: 'efficiency', description: '上菜洒扫，快人一步', requiresType: ['waiter'] },
    { id: 'e-chef', name: '灶上功夫', type: 'efficiency', description: '出菜神速，不误饭点', requiresType: ['chef'] },
    { id: 'e-tailor', name: '裁衣如飞', type: 'efficiency', description: '量体裁衣，一日三件', requiresType: ['tailor'] },
    { id: 'e-pharmacist', name: '抓药神速', type: 'efficiency', description: '抓药称量，分毫不差', requiresType: ['pharmacist'] },
  ],
  cost: [
    { id: 'c-accountant', name: '精打细算', type: 'cost', description: '账目明晰，克扣有度', requiresType: ['accountant'] },
    { id: 'c-buyer', name: '采买门路', type: 'cost', description: '进货价比市面低三分', requiresType: ['chef', 'tailor', 'pharmacist'] },
    { id: 'c-thrift', name: '节省用料', type: 'cost', description: '边角料也能物尽其用', requiresType: ['chef', 'tailor', 'pharmacist'] },
    { id: 'c-ledger', name: '记账无误', type: 'cost', description: '手札账目分毫不差', requiresType: ['accountant'] },
  ],
  special: [
    { id: 's-guard1', name: '镇店之宝', type: 'special', description: '往门口一站，宵小退散', requiresType: ['guard'] },
    { id: 's-guard2', name: '忠肝义胆', type: 'special', description: '危急时刻靠得住', requiresType: ['guard'] },
    { id: 's-social', name: '八面玲珑', type: 'special', description: '三教九流都买账', requiresType: ['waiter', 'accountant'] },
    { id: 's-lucky', name: '福星高照', type: 'special', description: '招财进宝，晦气退散' },
  ],
};

/** 按员工类型过滤可用技能（requiresType 缺省 = 通用；否则须包含该类型） */
export function skillsForType(type: string): readonly EmployeeSkill[] {
  return Object.values(SKILL_POOL)
    .flat()
    .filter((s) => !s.requiresType || s.requiresType.includes(type as never));
}

/**
 * 《我在唐朝当掌柜》招聘系统（Step 5a 2.2）
 * 纯函数：generateCandidates(count, rng?, shopType?) 生成 2-3 名候选人。
 * - 姓名：男女分池（用户 2.2 逐字）。
 * - 类型权重：waiter 40% / 技师类 30%（给定 shopType 时匹配技师 50%、另两类各 25%）/
 *   accountant 20% / guard 10%。
 * - 技能：1 个必给 + 5% 概率第 2 个（按类型从 tang-employee-skills 池过滤）。
 * - 要价：基础 3-15 两（公式：3 + rng()*12），多 1 个技能 +1.5 两、特殊员工 +2 两，四舍五入到 0.1。
 * - 10% 概率 isSpecial=true：表面正常，hiddenBackground/hiddenFlaw 预设（入职时不可见）。
 */
import { v4 as uuidv4 } from 'uuid';
import { skillsForType } from '@/config/tang-employee-skills';
import {
  FEMALE_NAME_POOL,
  HIDDEN_BACKGROUNDS,
  HIDDEN_FLAWS,
  MALE_NAME_POOL,
  SHOP_TECHNICIAN,
  TYPE_WEIGHTS,
} from '@/config/tang-recruitment-config';
import type { EmployeeCandidate, EmployeeType, ShopType } from '@/types/tang-manager';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 按权重抽取员工类型（waiter 40 / 技师 30 / 账房 20 / 护卫 10；技师按店型细分） */
export function pickType(rng: () => number, shopType?: ShopType): EmployeeType {
  const roll = rng() * 100;
  let acc = 0;
  for (const { type, weight } of TYPE_WEIGHTS) {
    acc += weight;
    if (roll < acc) {
      // 技师类细分：给定店型时匹配技师 50%、另两类各 25%
      if (type === 'chef' || type === 'tailor' || type === 'pharmacist') {
        const technicians: EmployeeType[] = ['chef', 'tailor', 'pharmacist'];
        const match = shopType ? (SHOP_TECHNICIAN[shopType] as EmployeeType | undefined) : undefined;
        if (match) {
          const others = technicians.filter((t) => t !== match);
          const sub = rng();
          if (sub < 0.5) return match;
          return sub < 0.75 ? others[0]! : others[1]!;
        }
        return technicians[Math.floor(rng() * technicians.length)]!;
      }
      return type;
    }
  }
  return 'waiter'; // 兜底（权重合计 100，理论上不可达）
}

/** 生成 1 名候选人（技能 1 必给 + 5% 第 2 个；10% 特殊） */
export function generateCandidate(rng: () => number, shopType?: ShopType): EmployeeCandidate {
  const type = pickType(rng, shopType);
  const gender = rng() < 0.5 ? 'male' : 'female';
  const name = gender === 'male' ? pick(MALE_NAME_POOL, rng) : pick(FEMALE_NAME_POOL, rng);

  // 技能：从类型过滤池取 1 个，5% 概率第 2 个（不同 id）
  const pool = skillsForType(type);
  const first = pick(pool, rng);
  const skills = [first];
  if (rng() < 0.05) {
    const secondPool = pool.filter((s) => s.id !== first.id);
    if (secondPool.length > 0) {
      skills.push(pick(secondPool, rng));
    }
  }

  // 要价：基础 3-15 两 + 每多 1 技能 1.5 两 + 特殊 2 两
  let salary = 3 + rng() * 12 + (skills.length - 1) * 1.5;
  const isSpecial = rng() < 0.1;
  if (isSpecial) salary += 2;
  salary = round1(salary);

  const candidate: EmployeeCandidate = {
    id: uuidv4(),
    name,
    gender,
    type,
    salary,
    skills,
    isSpecial,
  };
  if (isSpecial) {
    candidate.hiddenBackground = pick(HIDDEN_BACKGROUNDS, rng);
    candidate.hiddenFlaw = pick(HIDDEN_FLAWS, rng);
  }
  return candidate;
}

/** 生成 count（2|3）名候选人 */
export function generateCandidates(
  count: 2 | 3,
  rng: () => number = Math.random,
  shopType?: ShopType
): EmployeeCandidate[] {
  const result: EmployeeCandidate[] = [];
  for (let i = 0; i < count; i++) {
    result.push(generateCandidate(rng, shopType));
  }
  return result;
}

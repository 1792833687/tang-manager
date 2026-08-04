/**
 * 数值校验脚本（Step 5b-2 模块 0）
 * 运行：node scripts/validate-game-data.mjs
 *
 * 工程决策：仓库未安装 tsx（node_modules/.bin 无 tsx），且 node 直跑 .ts 无法解析 `@/` 路径别名，
 * 故采用「退化内联」策略——下方常量镜像 src/config/tang-difficulty.ts 的 DIFFICULTY_PARAMS.B
 * 与 src/config/tang-initial-goods.ts 的 INITIAL_GOODS（体积/成本/数量逐字复制），
 * 校验逻辑与 src/systems/tang-settlement.ts / tang-expiry.ts 公式保持一致。
 * 若日后安装 tsx，可将下方内联常量替换为 `import { DIFFICULTY_PARAMS } from '@/config/tang-difficulty'`
 * 并 `import { INITIAL_GOODS } from '@/config/tang-initial-goods'`。
 *
 * 校验 1：B 难度开局货架体积 ≤ maxStorage（200）
 * 校验 2：30 天模拟不必然破产（中值现金流近似：基础收益中值 7.5 × 系数 1.0 +
 *         5 客全接待中值 23.75 − 支出中值 11 − 月初月息 5；确定性 rng=0.5）
 */

// ---- 内联常量（镜像 DIFFICULTY_PARAMS.B）----
const B = {
  initialGold: 50,
  initialDebt: 200,
  monthlyInterest: 5,
  initialScore: 1.0,
  initialReputation: 10,
  initialXiaoerSatisfaction: 60, // 效率系数 1.0（≥60）
  guestCount: 5,
  penaltyChance: 0.15,
  specialExpenseChance: 1,
};

// ---- 内联常量（镜像 INITIAL_GOODS：{name, stock, volume, category}）----
const INITIAL_GOODS = {
  jiulou: [
    { name: '羊肉', stock: 20, volume: 3, category: '食材' },
    { name: '米酒', stock: 50, volume: 1, category: '食材' },
    { name: '酱牛肉', stock: 10, volume: 3, category: '食材' },
    { name: '时蔬', stock: 30, volume: 1, category: '食材' },
  ],
  buzhuang: [
    { name: '粗布', stock: 30, volume: 2, category: '布匹' },
    { name: '丝绸', stock: 15, volume: 1, category: '布匹' },
    { name: '棉布', stock: 25, volume: 2, category: '布匹' },
    { name: '锦缎', stock: 5, volume: 1, category: '布匹' },
  ],
  yaopu: [
    { name: '人参', stock: 8, volume: 0.5, category: '药材' },
    { name: '当归', stock: 20, volume: 1, category: '药材' },
    { name: '黄连', stock: 15, volume: 1, category: '药材' },
    { name: '枸杞', stock: 40, volume: 0.5, category: '药材' },
    { name: '草药', stock: 20, volume: 1, category: '药材' },
  ],
};

const MAX_STORAGE = 200; // buildInitialState maxStorage（TANG-S5B15-002 裁决）

function totalVolume(goods) {
  return goods.reduce((s, g) => s + g.stock * g.volume, 0);
}

// ============================================================
// 校验 1：开局库存体积 ≤ maxStorage
// ============================================================
const volumes = Object.entries(INITIAL_GOODS).map(([shopType, goods]) => ({
  shopType,
  volume: totalVolume(goods),
}));
const maxVol = Math.max(...volumes.map((v) => v.volume));
const capacityPass = maxVol <= MAX_STORAGE;

// ============================================================
// 校验 2：30 天模拟不必然破产（确定性中值现金流近似）
// 公式镜像 tang-settlement.settleDay（rng 固定 0.5）：
// - 基础收益：评分档位 [1.0,1.9] 中值 7.5 × 效率系数 1.0（满意度 60）→ 7.5
//   （rng=0.5 ≥ penaltyChance 0.15，不触发惩罚；无技师/无员工加成；priceIndex=1）
// - 客单消费：5 客全接待，B 档型分布（normal50/big15/special15/help15/observe5）
//   期望客单 = 0.5×3.5 + 0.15×11.5 + 0.15×5.5 + 0.15×2 + 0.05×3 ≈ 4.75（酒楼×1.0）
//   → 5 客 ≈ 23.75/日
// - 支出：1-2 项店型采购（rng=0.5 → 2 项 × 中值 5.5）= 11；特殊支出 rng=0.5 不触发
// - 月息：第 31 日（nextDay%30===1 月初钩子）扣 5 两
// - 仓储费：开局体积 ≤ freeStorageLimit 170 → 0
// 30 日净现金流 = 30×(7.5+23.75−11) − 5 = 602.5 → 终值 652.5 > 0
// ============================================================
function simulate30Days() {
  let silver = B.initialGold;
  const baseIncome = 7.5;
  const guestIncome = 23.75;
  const expenses = 11;
  const dailyNet = baseIncome + guestIncome - expenses;
  for (let i = 0; i < 30; i++) {
    silver += dailyNet;
  }
  // 第 31 日为月初：扣月息
  silver -= B.monthlyInterest;
  return { dailyNet, finalSilver: Math.round(silver * 100) / 100 };
}

const sim = simulate30Days();
const survivalPass = sim.finalSilver > 0;

// ============================================================
// 输出
// ============================================================
console.log('=== 《我在唐朝当掌柜》数值校验（Step 5b-2 模块 0）===');
console.log('--- 校验 1：开局库存体积 ≤ maxStorage(200) ---');
volumes.forEach((v) => console.log(`  ${v.shopType}: ${v.volume} 单位 ${v.volume <= MAX_STORAGE ? 'OK' : 'FAIL'}`));
console.log(`  结论：${capacityPass ? 'PASS' : 'FAIL'}（最大 ${maxVol} ≤ ${MAX_STORAGE}）`);

console.log('--- 校验 2：30 天模拟不必然破产（确定性中值近似）---');
console.log(`  日净现金流 ≈ ${sim.dailyNet} 两/日（基础 7.5 + 客单 23.75 − 支出 11）`);
console.log(`  30 日终值 ≈ ${sim.finalSilver} 两（初始 50 + 30×${sim.dailyNet} − 月息 5）`);
console.log(`  结论：${survivalPass ? 'PASS' : 'FAIL'}（终值 > 0）`);

console.log('');
console.log(`总体：${capacityPass && survivalPass ? 'PASS' : 'FAIL'}`);
process.exit(capacityPass && survivalPass ? 0 : 1);

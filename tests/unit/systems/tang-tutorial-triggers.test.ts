/**
 * 新手引导（TANG-TUT-002 模块三~五）触发决策验收测试
 *
 * 覆盖（需求方 2.4 / 4.3 逐字）：
 * 1. 优先级/排队判定（shouldTriggerTutorial）：手札 > 阿昭；同类只展示一个；
 *    currentTutorial 清空才放行下一个（排队）
 * 2. 重要引导标记（isTutorialImportant）：welcome/first_guest/first_mind_read/first_preorder
 * 3. triggerTutorial 接线（防重/排队/顶替）
 * 4. 面板首次打开映射（TUTORIAL_NAV_TRIGGER：7 个面板）
 * 5. 状态型触发点逐项（evaluateTutorialTriggers ≥9 用例）：
 *    welcome 开局 / first_guest 首日 / 精力<20 策略 / 评分2.0 / 声望300 / 负债清零 /
 *    陈损 / 周要务 / 员工事件 + 已读防重 + 过渡判定
 * 6. 阿昭气泡双标记（acknowledgeAzhaoTutorial：FIRST_EXPIRY + FIRST_SHELF）
 * 7. 优先级锁集成 + 重置后可重触发
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangManagerStore } from '@/stores/tang-manager';
import { TANG_TUTORIAL_IDS, type TangTutorialId } from '@/config/tang-tutorial-ids';
import {
  acknowledgeAzhaoTutorial,
  evaluateTutorialTriggers,
  isTutorialImportant,
  shouldTriggerTutorial,
  triggerTutorial,
  TUTORIAL_IMPORTANT_IDS,
  TUTORIAL_NAV_TRIGGER,
  type TutorialTriggerSnapshot,
} from '@/systems/tang-tutorial-triggers';

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
});

/** 构造状态型触发点快照（字段缺省按「不触发」填） */
function snap(partial: Partial<TutorialTriggerSnapshot>): TutorialTriggerSnapshot {
  return {
    phase: 'playing', // 状态型引导在游戏内触发（2026-08-05 P0：开局身份/店型/难度阶段不得触发）
    day: 2,
    currentGuestIndex: 1,
    energy: 50,
    score: 1.5,
    reputation: 100,
    legacyDebt: 100,
    tutorialFlags: {},
    hasNearExpiry: false,
    hasWeeklyTasks: false,
    hasEmployeeEvent: false,
    ...partial,
  };
}

describe('TANG-TUT-002 · 优先级/排队判定 shouldTriggerTutorial', () => {
  it('未读 + 无当前引导 → 可触发', () => {
    expect(shouldTriggerTutorial({}, null, 'WELCOME')).toBe(true);
    expect(shouldTriggerTutorial({}, null, 'FIRST_EXPIRY')).toBe(true);
  });

  it('已读 → 不可触发（防重复）', () => {
    expect(shouldTriggerTutorial({ WELCOME: true }, null, 'WELCOME')).toBe(false);
  });

  it('未知 id → 不可触发', () => {
    expect(shouldTriggerTutorial({}, null, 'NOT_A_GUIDE')).toBe(false);
    expect(shouldTriggerTutorial({}, null, '')).toBe(false);
  });

  it('当前即同 id → 不可触发（防重复弹窗）', () => {
    expect(shouldTriggerTutorial({}, 'FIRST_GUEST', 'FIRST_GUEST')).toBe(false);
  });

  it('手札（handbook）顶替阿昭（azhao）→ 可触发（展示优先级：手札 > 阿昭）', () => {
    // 阿昭正展示时，货架手札顶替
    expect(shouldTriggerTutorial({}, 'FIRST_EXPIRY', 'FIRST_SHELF')).toBe(true);
  });

  it('阿昭撞手札 → 排队（不可触发，等 currentTutorial 清空）', () => {
    expect(shouldTriggerTutorial({}, 'FIRST_SHELF', 'FIRST_EXPIRY')).toBe(false);
  });

  it('同类相撞 → 排队（同类型只展示一个）', () => {
    // 手札撞手札
    expect(shouldTriggerTutorial({}, 'WELCOME', 'FIRST_GUEST')).toBe(false);
    // 阿昭撞阿昭（当前亦 FIRST_EXPIRY 已覆盖同 id；用未知 azhao 场景：当前 azhao + 目标 azhao）
    expect(shouldTriggerTutorial({}, 'FIRST_EXPIRY', 'FIRST_EXPIRY')).toBe(false);
  });
});

describe('TANG-TUT-002 · 重要引导标记 isTutorialImportant', () => {
  it('welcome/first_guest/first_mind_read/first_preorder 为重要（不可点遮罩关闭）', () => {
    for (const id of ['WELCOME', 'FIRST_GUEST', 'FIRST_MIND_READ', 'FIRST_PREORDER']) {
      expect(isTutorialImportant(id)).toBe(true);
    }
    expect(TUTORIAL_IMPORTANT_IDS.size).toBe(4);
  });

  it('其余引导非重要（可点遮罩关闭）', () => {
    for (const id of TANG_TUTORIAL_IDS) {
      if (TUTORIAL_IMPORTANT_IDS.has(id)) continue;
      expect(isTutorialImportant(id)).toBe(false);
    }
    expect(isTutorialImportant('FIRST_SETTLE')).toBe(false);
    expect(isTutorialImportant('bogus')).toBe(false);
  });
});

describe('TANG-TUT-002 · triggerTutorial 接线（防重/排队/顶替）', () => {
  it('无锁未读 → 弹出并返回 true', () => {
    useTangManagerStore.getState().initByDifficulty('B'); // 进入 playing（干净未读）
    expect(triggerTutorial('WELCOME')).toBe(true);
    expect(useTangManagerStore.getState().currentTutorial).toBe('WELCOME');
  });

  it('被锁（当前有手札）→ 排队不弹，返回 false', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    triggerTutorial('WELCOME');
    expect(triggerTutorial('FIRST_GUEST')).toBe(false);
    expect(useTangManagerStore.getState().currentTutorial).toBe('WELCOME');
  });

  it('手札顶替阿昭（集成：阿昭展示中被手札顶替）', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    useTangManagerStore.getState().showTutorial('FIRST_EXPIRY');
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_EXPIRY');
    expect(triggerTutorial('FIRST_SHELF')).toBe(true);
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_SHELF');
    // 阿昭再触发 → 排队（不顶手札）
    expect(triggerTutorial('FIRST_EXPIRY')).toBe(false);
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_SHELF');
  });

  it('已读 → 返回 false（防重复）', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    useTangManagerStore.getState().markTutorialRead('WELCOME');
    expect(triggerTutorial('WELCOME')).toBe(false);
  });
});

describe('TANG-TUT-002 · 面板首次打开映射 TUTORIAL_NAV_TRIGGER', () => {
  it('7 个面板映射正确（shelf/staff/ledger/bank/map/politics/caravan）', () => {
    expect(TUTORIAL_NAV_TRIGGER['shelf']).toBe('FIRST_SHELF');
    expect(TUTORIAL_NAV_TRIGGER['staff']).toBe('FIRST_STAFF');
    expect(TUTORIAL_NAV_TRIGGER['ledger']).toBe('FIRST_LEDGER');
    expect(TUTORIAL_NAV_TRIGGER['bank']).toBe('FIRST_BANK');
    expect(TUTORIAL_NAV_TRIGGER['map']).toBe('FIRST_MAP');
    expect(TUTORIAL_NAV_TRIGGER['politics']).toBe('FIRST_POLITICS');
    expect(TUTORIAL_NAV_TRIGGER['caravan']).toBe('FIRST_CARAVAN');
  });

  it('接待/我/门路/手札录/成就 等面板不触发引导', () => {
    expect(TUTORIAL_NAV_TRIGGER['me']).toBeUndefined();
    expect(TUTORIAL_NAV_TRIGGER['reception']).toBeUndefined();
    expect(TUTORIAL_NAV_TRIGGER['faction']).toBeUndefined();
    expect(TUTORIAL_NAV_TRIGGER['journal']).toBeUndefined();
    expect(TUTORIAL_NAV_TRIGGER['achievement']).toBeUndefined();
  });
});

describe('TANG-TUT-002 · 状态型触发点逐项 evaluateTutorialTriggers', () => {
  it('welcome：进入 playing（未读）→ 触发 WELCOME', () => {
    const ids = evaluateTutorialTriggers(snap({ phase: 'playing' }));
    expect(ids).toContain('WELCOME');
  });

  it('first_guest：day===1 且 currentGuestIndex===0（未读）→ 触发 FIRST_GUEST', () => {
    const ids = evaluateTutorialTriggers(snap({ phase: 'playing', day: 1, currentGuestIndex: 0 }));
    expect(ids).toContain('FIRST_GUEST');
    // 已接待（index>0）不再触发
    const after = evaluateTutorialTriggers(snap({ phase: 'playing', day: 1, currentGuestIndex: 1 }));
    expect(after).not.toContain('FIRST_GUEST');
  });

  it('精力<20 且跨越 20 阈值 → 触发 FIRST_STRATEGY（精力一直<20 不重复触发）', () => {
    const ids = evaluateTutorialTriggers(snap({ energy: 15, prevEnergy: 25 }));
    expect(ids).toContain('FIRST_STRATEGY');
    // prev 也 <20（未跨阈值）→ 不再触发
    const steady = evaluateTutorialTriggers(snap({ energy: 15, prevEnergy: 15 }));
    expect(steady).not.toContain('FIRST_STRATEGY');
  });

  it('评分≥2.0 且跨过 2.0 → 触发 FIRST_REGULAR', () => {
    const ids = evaluateTutorialTriggers(snap({ score: 2.2, prevScore: 1.9 }));
    expect(ids).toContain('FIRST_REGULAR');
    const notCrossed = evaluateTutorialTriggers(snap({ score: 2.2, prevScore: 2.1 }));
    expect(notCrossed).not.toContain('FIRST_REGULAR');
  });

  it('声望≥300 且跨过 300 → 触发 FIRST_SHEN_HINT', () => {
    const ids = evaluateTutorialTriggers(snap({ reputation: 320, prevReputation: 250 }));
    expect(ids).toContain('FIRST_SHEN_HINT');
  });

  it('负债清零（>0 → 0）→ 触发 DEBT_CLEARED；负债未清不触发', () => {
    const ids = evaluateTutorialTriggers(snap({ legacyDebt: 0, prevLegacyDebt: 120 }));
    expect(ids).toContain('DEBT_CLEARED');
    const stillInDebt = evaluateTutorialTriggers(snap({ legacyDebt: 80, prevLegacyDebt: 120 }));
    expect(stillInDebt).not.toContain('DEBT_CLEARED');
  });

  it('陈损预警 → 触发 FIRST_EXPIRY（阿昭；确认时连带 FIRST_SHELF）', () => {
    const ids = evaluateTutorialTriggers(snap({ hasNearExpiry: true }));
    expect(ids).toContain('FIRST_EXPIRY');
  });

  it('周要务/员工事件 → 触发 FIRST_WEEKLY_TASK / FIRST_EMPLOYEE_EVENT', () => {
    const ids = evaluateTutorialTriggers(snap({ hasWeeklyTasks: true, hasEmployeeEvent: true }));
    expect(ids).toContain('FIRST_WEEKLY_TASK');
    expect(ids).toContain('FIRST_EMPLOYEE_EVENT');
  });

  it('已读标志 → 对应触发点不再出现', () => {
    const ids = evaluateTutorialTriggers(
      snap({
        phase: 'playing',
        day: 1,
        currentGuestIndex: 0,
        energy: 10,
        prevEnergy: 50,
        hasNearExpiry: true,
        tutorialFlags: { WELCOME: true, FIRST_GUEST: true, FIRST_STRATEGY: true, FIRST_EXPIRY: true },
      })
    );
    expect(ids).not.toContain('WELCOME');
    expect(ids).not.toContain('FIRST_GUEST');
    expect(ids).not.toContain('FIRST_STRATEGY');
    expect(ids).not.toContain('FIRST_EXPIRY');
  });

  it('首次快照（无 prev）→ 按当前状态判定（如精力已<20 首次即触发）', () => {
    const ids = evaluateTutorialTriggers(snap({ energy: 15 }));
    expect(ids).toContain('FIRST_STRATEGY');
  });
});

describe('TANG-TUT-002 · 阿昭双标记 + 优先级锁 + 重置', () => {
  it('acknowledgeAzhaoTutorial：FIRST_EXPIRY + FIRST_SHELF 双标记已读 + 关闭当前引导', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    useTangManagerStore.getState().showTutorial('FIRST_EXPIRY');
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_EXPIRY');
    acknowledgeAzhaoTutorial();
    const s = useTangManagerStore.getState();
    expect(s.tutorialFlags['FIRST_EXPIRY']).toBe(true);
    expect(s.tutorialFlags['FIRST_SHELF']).toBe(true);
    expect(s.currentTutorial).toBeNull();
  });

  it('优先级锁：手札展示时阿昭排队，手札读完阿昭才弹（排队释放）', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    // 手札先弹（WELCOME）
    expect(triggerTutorial('WELCOME')).toBe(true);
    // 陈损触发 → 被手札锁住（排队）
    useTangManagerStore.getState().showTutorial('FIRST_EXPIRY'); // 直接 show 会顶替，改用 trigger 路径验证：
    useTangManagerStore.getState().dismissTutorial();
    useTangManagerStore.getState().showTutorial('WELCOME');
    expect(triggerTutorial('FIRST_EXPIRY')).toBe(false);
    // 读完手札（currentTutorial 清空）→ 阿昭可弹
    useTangManagerStore.getState().markTutorialRead('WELCOME');
    expect(triggerTutorial('FIRST_EXPIRY')).toBe(true);
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_EXPIRY');
  });

  it('重置入口：resetAllTutorials 后同引导可再次触发', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    expect(triggerTutorial('WELCOME')).toBe(true);
    useTangManagerStore.getState().markTutorialRead('WELCOME');
    expect(triggerTutorial('WELCOME')).toBe(false);
    useTangManagerStore.getState().resetAllTutorials();
    expect(triggerTutorial('WELCOME')).toBe(true);
  });

  it('完整排队流程：WELCOME → 读完 → FIRST_GUEST 弹出（队列补发）', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    triggerTutorial('WELCOME');
    expect(useTangManagerStore.getState().currentTutorial).toBe('WELCOME');
    // 排队被锁
    expect(triggerTutorial('FIRST_GUEST')).toBe(false);
    useTangManagerStore.getState().markTutorialRead('WELCOME');
    // 锁释放 → 队首补发
    expect(triggerTutorial('FIRST_GUEST')).toBe(true);
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_GUEST');
  });

  it('首次打烊结算 → FIRST_SETTLE（接线点：playing-actions/reception-panel 打烊按钮）', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    // 打烊结算路径（UI 调用点语义）：结算返回非空 → 触发 FIRST_SETTLE
    expect(triggerTutorial('FIRST_SETTLE')).toBe(true);
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_SETTLE');
    // 已读后不再触发
    useTangManagerStore.getState().markTutorialRead('FIRST_SETTLE');
    expect(triggerTutorial('FIRST_SETTLE')).toBe(false);
  });

  it('TANG_TUTORIAL_IDS 与触发点常量一致（无越权 id）', () => {
    for (const id of Object.values(TUTORIAL_NAV_TRIGGER)) {
      expect(TANG_TUTORIAL_IDS).toContain(id satisfies TangTutorialId);
    }
    for (const id of TUTORIAL_IMPORTANT_IDS) {
      expect(TANG_TUTORIAL_IDS).toContain(id);
    }
  });
});

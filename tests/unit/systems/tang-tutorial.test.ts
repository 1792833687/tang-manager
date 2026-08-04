/**
 * 新手引导（TANG-TUT-001 模块一）验收测试 — 引导状态存储 + 25 条手札文案
 *
 * 覆盖（需求方逐字）：
 * 1. tutorialFlags 默认全 false（初始空对象；25 个 id 均未读）
 * 2. showTutorial：合法 id 弹当前引导 / 未知 id 忽略 / 已读忽略（防重复）
 * 3. markTutorialRead：标记已读；若为当前引导同时关闭 currentTutorial
 * 4. dismissTutorial：关闭当前引导但不标已读（可再次弹出）
 * 5. resetAllTutorials：全部重置
 * 6. 文案完整性：25 条逐字 id 与 TANG_TUTORIAL_IDS 一致；title/body 非空
 * 7. 文案 kind：仅 first_expiry 为 azhao（阿昭气泡），其余 24 条 handbook（家传手札）
 * 8. 持久化白名单：partialize 含 tutorialFlags/currentTutorial（persist v16）
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangManagerStore } from '@/stores/tang-manager';
import {
  TANG_TUTORIAL_IDS,
  TANG_TUTORIAL_ID_SET,
  isTangTutorialId,
  type TangTutorialId,
} from '@/config/tang-tutorial-ids';
import {
  TANG_TUTORIAL_CONTENT,
  TANG_TUTORIAL_CONTENT_LIST,
  tangTutorialById,
} from '@/config/tang-tutorial-content';

beforeEach(() => {
  // 每个用例从干净存档起步（resetGame → buildInitialState：tutorialFlags={}、currentTutorial=null）
  useTangManagerStore.getState().resetGame();
});

describe('TANG-TUT-001 · 引导状态默认值', () => {
  it('tutorialFlags 初始为空对象（25 个引导 id 全部默认未读 false）', () => {
    const s = useTangManagerStore.getState();
    expect(s.tutorialFlags).toEqual({});
    for (const id of TANG_TUTORIAL_IDS) {
      expect(s.tutorialFlags[id]).toBeUndefined(); // 未读 = 无 true 标记
    }
    expect(TANG_TUTORIAL_IDS).toHaveLength(25);
  });

  it('currentTutorial 初始为 null（无当前引导）', () => {
    expect(useTangManagerStore.getState().currentTutorial).toBeNull();
  });
});

describe('TANG-TUT-001 · showTutorial 弹出', () => {
  it('合法 id → currentTutorial 设为该引导', () => {
    useTangManagerStore.getState().showTutorial('WELCOME');
    expect(useTangManagerStore.getState().currentTutorial).toBe('WELCOME');
  });

  it('未知 id → 忽略（不弹）', () => {
    useTangManagerStore.getState().showTutorial('NOT_A_REAL_GUIDE');
    expect(useTangManagerStore.getState().currentTutorial).toBeNull();
  });

  it('已读引导 → 忽略（防重复弹窗）', () => {
    const s = useTangManagerStore.getState();
    s.markTutorialRead('FIRST_GUEST');
    s.showTutorial('FIRST_GUEST');
    expect(useTangManagerStore.getState().currentTutorial).toBeNull();
  });
});

describe('TANG-TUT-001 · markTutorialRead / dismissTutorial', () => {
  it('markTutorialRead：标记已读 + 若为当前引导同时关闭 currentTutorial', () => {
    useTangManagerStore.getState().showTutorial('FIRST_MIND_READ');
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_MIND_READ');
    useTangManagerStore.getState().markTutorialRead('FIRST_MIND_READ');
    const after = useTangManagerStore.getState();
    expect(after.tutorialFlags['FIRST_MIND_READ']).toBe(true);
    expect(after.currentTutorial).toBeNull();
  });

  it('markTutorialRead：非当前引导时只标已读，不影响 currentTutorial', () => {
    const s = useTangManagerStore.getState();
    s.showTutorial('FIRST_SETTLE');
    s.markTutorialRead('FIRST_SHELF'); // 标记别的引导
    const after = useTangManagerStore.getState();
    expect(after.tutorialFlags['FIRST_SHELF']).toBe(true);
    expect(after.currentTutorial).toBe('FIRST_SETTLE'); // 当前引导未被误关
  });

  it('dismissTutorial：关闭当前引导但不标记已读（可再次弹出）', () => {
    const s = useTangManagerStore.getState();
    s.showTutorial('FIRST_LEDGER');
    s.dismissTutorial();
    const after = useTangManagerStore.getState();
    expect(after.currentTutorial).toBeNull();
    expect(after.tutorialFlags['FIRST_LEDGER']).toBeUndefined();
    // 再次弹出应成功（未读）
    useTangManagerStore.getState().showTutorial('FIRST_LEDGER');
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_LEDGER');
  });

  it('resetAllTutorials：清空全部 flags 与当前引导', () => {
    const s = useTangManagerStore.getState();
    s.showTutorial('FIRST_BANK');
    s.markTutorialRead('WELCOME');
    s.markTutorialRead('FIRST_GUEST');
    s.resetAllTutorials();
    const after = useTangManagerStore.getState();
    expect(after.tutorialFlags).toEqual({});
    expect(after.currentTutorial).toBeNull();
  });
});

describe('TANG-TUT-001 · 文案完整性（25 条逐字）', () => {
  it('TANG_TUTORIAL_CONTENT 覆盖全部 25 个 id（Record 键完整）', () => {
    expect(Object.keys(TANG_TUTORIAL_CONTENT)).toHaveLength(25);
    for (const id of TANG_TUTORIAL_IDS) {
      expect(TANG_TUTORIAL_CONTENT[id]).toBeDefined();
    }
  });

  it('TANG_TUTORIAL_CONTENT_LIST 顺序与 TANG_TUTORIAL_IDS 完全一致', () => {
    expect(TANG_TUTORIAL_CONTENT_LIST.map((c) => c.id)).toEqual([...TANG_TUTORIAL_IDS]);
  });

  it('每条文案 title/body 非空；id 与键一致', () => {
    for (const c of TANG_TUTORIAL_CONTENT_LIST) {
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.body.trim().length).toBeGreaterThan(0);
      expect(c.id).toBe(c.id);
      expect(TANG_TUTORIAL_CONTENT[c.id]).toBe(c);
    }
  });

  it('kind 规则：仅 first_expiry 为 azhao（阿昭气泡），其余 24 条为 handbook（家传手札）', () => {
    for (const c of TANG_TUTORIAL_CONTENT_LIST) {
      if (c.id === 'FIRST_EXPIRY') {
        expect(c.kind).toBe('azhao');
        expect(c.title).toBe('阿昭');
      } else {
        expect(c.kind).toBe('handbook');
        expect(c.title).toBe('家传手札');
      }
    }
    expect(TANG_TUTORIAL_CONTENT.FIRST_EXPIRY.kind).toBe('azhao');
  });

  it('家书口吻逐字抽查：WELCOME 十二面板 / DEBT_CLEARED 债清 / FIRST_EXPIRY 阿昭口吻', () => {
    expect(TANG_TUTORIAL_CONTENT.WELCOME.body).toContain('十二件家什');
    expect(TANG_TUTORIAL_CONTENT.WELCOME.body).toContain('长安舆图');
    expect(TANG_TUTORIAL_CONTENT.DEBT_CLEARED.body).toContain('债清之日，便是新局之时');
    expect(TANG_TUTORIAL_CONTENT.FIRST_EXPIRY.body).toContain('掌柜的');
    // 不用现代词汇抽查：正文不含「攻略/教程/提示」等现代词
    for (const c of TANG_TUTORIAL_CONTENT_LIST) {
      expect(c.body).not.toMatch(/攻略|教程|新手|提示|功能|按钮|点击|玩家/);
    }
  });

  it('tangTutorialById：存在返回内容，不存在返回 null', () => {
    expect(tangTutorialById('WELCOME')?.id).toBe('WELCOME');
    expect(tangTutorialById('nope')).toBeNull();
  });
});

describe('TANG-TUT-001 · 持久化白名单（persist v16）', () => {
  it('partialize 含 tutorialFlags/currentTutorial（默认态）', () => {
    const partial = useTangManagerStore.persist.getOptions().partialize(useTangManagerStore.getState());
    expect(partial.tutorialFlags).toEqual({});
    expect(partial.currentTutorial).toBeNull();
  });

  it('partialize 随状态更新：已读标记与当前引导进入持久化白名单', () => {
    const s = useTangManagerStore.getState();
    s.showTutorial('FIRST_PREORDER');
    s.markTutorialRead('FIRST_PREORDER');
    const partial = useTangManagerStore.persist.getOptions().partialize(useTangManagerStore.getState());
    expect(partial.tutorialFlags).toMatchObject({ FIRST_PREORDER: true });
    expect(partial.currentTutorial).toBeNull();
  });
});

describe('TANG-TUT-001 · 与既有系统并存 + ID 守卫', () => {
  it('引导字段与功能解锁/迷雾字段并存（不互相覆盖）', () => {
    const s = useTangManagerStore.getState();
    expect('unlockedFeatures' in s).toBe(true);
    expect('fogOfWar' in s).toBe(true);
    expect('tutorialFlags' in s).toBe(true);
    expect('currentTutorial' in s).toBe(true);
    // 操作引导后既有系统字段不受影响（仍为默认）
    s.showTutorial('WELCOME');
    s.markTutorialRead('WELCOME');
    const after = useTangManagerStore.getState();
    expect(after.tutorialFlags['WELCOME']).toBe(true);
    expect(after.unlockedFeatures).toEqual({});
    expect(after.fogOfWar).toBeDefined();
  });

  it('isTangTutorialId 守卫：25 个合法 id 通过，其余拒绝', () => {
    expect(TANG_TUTORIAL_ID_SET.size).toBe(25);
    for (const id of TANG_TUTORIAL_IDS) {
      expect(isTangTutorialId(id)).toBe(true);
    }
    expect(isTangTutorialId('bogus')).toBe(false);
    expect(isTangTutorialId('')).toBe(false);
    expect(isTangTutorialId('WELCOME ')).toBe(false);
  });

  it('ID 全集逐字（顺序不可变）：25 个 id 与用户 2.1 一致', () => {
    expect(TANG_TUTORIAL_IDS).toEqual([
      'WELCOME',
      'FIRST_STRATEGY',
      'FIRST_GUEST',
      'FIRST_MIND_READ',
      'FIRST_PREORDER',
      'FIRST_SETTLE',
      'FIRST_SHELF',
      'FIRST_STAFF',
      'FIRST_LEDGER',
      'FIRST_BANK',
      'FIRST_MAP',
      'FIRST_FORWARD_CONTRACT',
      'FIRST_PROCESSING',
      'FIRST_EXPIRY',
      'FIRST_REGULAR',
      'FIRST_WEEKLY_TASK',
      'DEBT_CLEARED',
      'FIRST_EMPLOYEE_EVENT',
      'FIRST_SHEN_HINT',
      'FIRST_POLITICS',
      'FIRST_CARAVAN',
      'FIRST_DEPOSIT',
      'FIRST_TRADE',
      'FIRST_SCHEDULE',
      'FIRST_HIRE',
    ] satisfies TangTutorialId[]);
  });
});
describe('TANG-TUT-001 · 里程碑引导（首次存款/跑商/排班/雇佣）', () => {
  it('四个里程碑 id 合法、文案完备、均为 handbook（非重要可遮罩关闭）', () => {
    const milestoneIds = ['FIRST_DEPOSIT', 'FIRST_TRADE', 'FIRST_SCHEDULE', 'FIRST_HIRE'] as const;
    for (const id of milestoneIds) {
      expect(isTangTutorialId(id)).toBe(true);
      expect(TANG_TUTORIAL_CONTENT[id]).toBeDefined();
      expect(TANG_TUTORIAL_CONTENT[id].body.trim().length).toBeGreaterThan(0);
      expect(TANG_TUTORIAL_CONTENT[id].kind).toBe('handbook');
    }
  });

  it('里程碑文案逐字抽查：不含现代词汇（攻略/教程/提示等）', () => {
    for (const id of ['FIRST_DEPOSIT', 'FIRST_TRADE', 'FIRST_SCHEDULE', 'FIRST_HIRE'] as const) {
      expect(TANG_TUTORIAL_CONTENT[id].body).not.toMatch(/攻略|教程|新手|提示|功能|按钮|点击|玩家/);
    }
  });
});

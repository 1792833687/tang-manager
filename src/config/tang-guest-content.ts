/**
 * 《我在唐朝当掌柜》客人内容池（Step 2 需求 2.2 / 2.3 / 2.9；Step 3 3.2 反噬/幻觉池）
 * - GUEST_NAME_POOLS      名称池（2.2 用户原文，逐字保留）
 * - GUEST_OS_POOLS        心声池（2.3 用户规格：5 类型各 2 条）
 * - REVERSE_OS_POOL       反噬后反讽/假信息池（3.2 自拟）
 * - HALLUCINATION_OS_POOL 污染后幻觉池（3.2 用户示例，逐字保留）
 * - GUEST_DESC_TEMPLATES  需求描述模板（2.9 自拟，风格与原文一致）
 * - GUEST_TYPE_LABEL      类型标签（接待面板 #大单/#特殊/#求助/#观察/#普通）
 * 独立文件避免 tang-narrative.ts 膨胀；纯数据，不依赖 store。
 */
import type { GuestType } from '@/types/tang-manager';

/** 2.2 名称池 — 按客人类型（用户原文逐字保留） */
export const GUEST_NAME_POOLS: Record<GuestType, readonly string[]> = {
  normal: ['李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十', '钱十一'],
  big_order: ['胡商', '波斯商人', '节度使家仆', '官宦子弟'],
  special: ['刘员外', '张员外', '陈大人', '县尉'],
  help: ['卖炭翁', '落魄书生', '逃荒老汉', '小乞丐'],
  observe: ['同街掌柜', '游学公子', '微服公子'],
};

/** 2.3 心声池（「通晓人心」成功时随机抽取；5 类型各 2 条） */
export const GUEST_OS_POOLS: Record<GuestType, readonly string[]> = {
  normal: ['「近来东市酒价涨了三成。」', '「店里那道招牌菜，别家学不去。」'],
  big_order: ['「府上宴客三日，银钱不是问题，只要排场。」', '「东家交代，这单只认陆记的名头。」'],
  special: ['「老朽走南闯北，最懂货好货坏。」', '「你这店若是实在，往后常来。」'],
  help: ['「掌柜行行好，赊我几个铜板，改日加倍奉还。」', '「我饿了三日，只求一顿饱饭。」'],
  observe: ['「且看这家店如何待客。」', '「东市要开新铺，我先来探探行情。」'],
};

/** 3.2 反讽/假信息池 — 该 NPC 身份已触发反噬后，mind_read 的心声从本池抽取（自拟 3-5 条） */
export const REVERSE_OS_POOL: readonly string[] = [
  '「他说会常来照顾生意——转头就去隔壁店。」',
  '「他说今日手头宽裕，可分明是赊账的老手。」',
  '「他说这菜合口味——可筷子根本没动过。」',
  '「他口口声声夸你实诚，眼神却飘向别处。」',
];

/** 3.2 幻觉池 — 通晓人心累计达阈值（B30/C20）污染后，mind_read 的心声从本池抽取且不标注来源（用户示例逐字保留） */
export const HALLUCINATION_OS_POOL: readonly string[] = [
  '「（你看不清他的脸，只能听见自己心跳如鼓。）」',
  '「（店里的烛火忽然全灭了，再亮起时他正冲你笑。）」',
  '「（他说——欢迎来到大唐。）」',
];

/** 2.9 需求描述模板（接待面板展示；自拟，风格与开场文案一致） */
export const GUEST_DESC_TEMPLATES: Record<GuestType, readonly string[]> = {
  normal: ['点了店里最贵的菜。', '要了二两酒一碟花生。', '进门便喊：掌柜，来壶热茶。'],
  big_order: ['包下整间雅间，点名要最上等的席面。', '要为府上寿宴订五十桌流水席。'],
  special: ['举止不凡，出手阔绰。', '随行带着小厮，一看便是大户人家。'],
  help: ['衣衫褴褛，面有菜色。', '声音低弱，似是多日未进食。'],
  observe: ['进门不点单，只四处打量。', '在门口驻足，似在盘算什么。'],
};

/** 类型标签（接待面板：大单/特殊/求助/观察/普通 不同配色由组件 ANCIENT 令牌映射） */
export const GUEST_TYPE_LABEL: Record<GuestType, string> = {
  normal: '#普通',
  big_order: '#大单',
  special: '#特殊',
  help: '#求助',
  observe: '#观察',
};

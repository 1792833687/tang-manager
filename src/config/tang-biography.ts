/**
 * 《我在唐朝当掌柜》伙计小传模板配置（TANG-ADD-001 模块七）
 * 小传："小传：手札录中为每位伙计专辟一页，随相处渐深，其过往自会浮现于纸上。"
 * 4 阶段（按员工 type 差异化模板，古风自拟）：
 *  1 出身（入职 15 天）/ 2 为何来（满意度≥80）/ 3 隐藏暴露（好感≥70）/
 *  4 真故事（专属事件后；全解锁获专属技能）。
 * 纯数据，不依赖 store；框架生成/解锁纯函数在 systems/tang-biography.ts。
 */
import type { BiographyEntry, EmployeeType } from '@/types/tang-manager';

/** 各员工类型 → 4 阶段小传模板（title/content 占位按 type 差异化；unlockCondition 文案） */
export interface BiographyTemplate {
  title: string;
  content: string;
  unlockCondition: string;
}

export const BIOGRAPHY_TEMPLATES: Record<EmployeeType, readonly BiographyTemplate[]> = {
  waiter: [
    { title: '出身', content: '这伙计原是西市巷口跑堂的，家中排行最末，打小练就一双察言观色的眼睛。', unlockCondition: '共事满 15 日' },
    { title: '为何来', content: '他说那年旱灾，是东家一句话收留了他一家老小——这份恩，他记一辈子。', unlockCondition: '满意度 ≥ 80' },
    { title: '隐藏暴露', content: '原来他从前在平康坊当过差，认得半城贵人，只是从不挂在嘴上。', unlockCondition: '好感 ≥ 70' },
    { title: '真故事', content: '那一夜他酒后吐真言：当年家中败落，是陆家老太爷出资送他进了酒楼学艺。', unlockCondition: '触发专属事件' },
  ],
  chef: [
    { title: '出身', content: '这厨子祖上三代掌勺，据说师从御膳房退下来的老太监，刀工火候皆有名堂。', unlockCondition: '共事满 15 日' },
    { title: '为何来', content: '他道：「满长安的馆子都嫌我脾气大，只有陆记肯让我照着规矩做菜。」', unlockCondition: '满意度 ≥ 80' },
    { title: '隐藏暴露', content: '其实他年轻时曾在东市输光家产，这才发愤学厨，灶台是他赎罪的地方。', unlockCondition: '好感 ≥ 70' },
    { title: '真故事', content: '他祖上那本御膳菜谱，页页都记着陆家老太爷的批注——这门手艺，本就是陆家传给他的。', unlockCondition: '触发专属事件' },
  ],
  tailor: [
    { title: '出身', content: '这裁缝生于蜀地，幼时跟着母亲在染坊长大，指尖一拈便知布料好坏。', unlockCondition: '共事满 15 日' },
    { title: '为何来', content: '她说陆记的料子最正，量体裁衣从不偷工减料，这才愿意留下。', unlockCondition: '满意度 ≥ 80' },
    { title: '隐藏暴露', content: '她随身带着一柄旧剪刀，据说是当年蜀锦名匠所赠，从不离身。', unlockCondition: '好感 ≥ 70' },
    { title: '真故事', content: '那柄剪刀的来历：她的父亲是蜀锦织户，为护一匹贡锦得罪了权贵，家道中落。', unlockCondition: '触发专属事件' },
  ],
  pharmacist: [
    { title: '出身', content: '这药师自幼跟着游方郎中走南闯北，识得百草，也尝过百草。', unlockCondition: '共事满 15 日' },
    { title: '为何来', content: '他说陆记药铺规矩正，不卖假药、不坑病人，是长安难得干净的地方。', unlockCondition: '满意度 ≥ 80' },
    { title: '隐藏暴露', content: '他袖里总藏着个小药囊，里头装着几味罕见的药材，来历成谜。', unlockCondition: '好感 ≥ 70' },
    { title: '真故事', content: '那药囊是陆家老太爷当年在他病重时赠的——药材是假，活命之恩是真。', unlockCondition: '触发专属事件' },
  ],
  accountant: [
    { title: '出身', content: '这账房原是县衙的文书，写得一手好字，算盘打得比衙门的师爷还快。', unlockCondition: '共事满 15 日' },
    { title: '为何来', content: '他叹道衙门里勾心斗角，不如陆记账房一壶清茶、一本账册来得清静。', unlockCondition: '满意度 ≥ 80' },
    { title: '隐藏暴露', content: '他年轻时替人做过假账，差点锒铛入狱，从此立誓再不做亏心事。', unlockCondition: '好感 ≥ 70' },
    { title: '真故事', content: '当年替他脱罪的，正是陆家老太爷——这恩情，他算了一辈子账也没算清。', unlockCondition: '触发专属事件' },
  ],
  guard: [
    { title: '出身', content: '这护卫原是边军出身，身上带着刀疤，话不多，眼神却亮得像鹰。', unlockCondition: '共事满 15 日' },
    { title: '为何来', content: '他说战场杀敌是替朝廷卖命，守着陆记的门，是替自己守一份安生。', unlockCondition: '满意度 ≥ 80' },
    { title: '隐藏暴露', content: '他腰间那块旧军牌，刻着的是当年那支全军覆没的边军番号。', unlockCondition: '好感 ≥ 70' },
    { title: '真故事', content: '那年粮草被截，是陆家老太爷的商队冒死送粮，才让他捡回一条命。', unlockCondition: '触发专属事件' },
  ],
};

/** 专属技能：全解锁后获得（注释占位；按类型给技能名） */
export const BIOGRAPHY_MASTER_SKILL: Record<EmployeeType, { name: string; description: string }> = {
  waiter: { name: '知恩图报', description: '小传全解锁：待客口碑更佳，每日常驻一位回头客（工程定注释占位）' },
  chef: { name: '御膳真传', description: '小传全解锁：出品品质评分额外 +0.1（工程定注释占位）' },
  tailor: { name: '蜀锦绝艺', description: '小传全解锁：裁衣收入上浮 5%（工程定注释占位）' },
  pharmacist: { name: '百草通晓', description: '小传全解锁：抓药成本下降 5%（工程定注释占位）' },
  accountant: { name: '铁算盘', description: '小传全解锁：账目清晰，随机支出概率 -10%（工程定注释占位）' },
  guard: { name: '忠肝义胆', description: '小传全解锁：威慑宵小，差评师概率 -10%（工程定注释占位）' },
};

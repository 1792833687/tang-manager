/**
 * 《我在唐朝当掌柜》zustand Store（Step 2 + Step 3 世界激活 + Step 5a 员工/阶段 + Step 5b 货币与金融）
 * - 接入 persist：createJSONStorage 桥接 StorageRouter（见 zustand-persist-bridge）。
 * - 经营/金融系统均为纯函数（tang-settlement/tang-bank/tang-credit/tang-investment/tang-inflation/
 *   tang-debt），本 store 只做「调用 + 应用变更」的接线层，避免接线 bug 脱离测试。
 * - SSR/hydration 安全：persist 使用异步存储，客户端挂载后异步 rehydrate（page.tsx 另有 mounted 门闩）。
 * - 接待收入约定：handleCurrentGuest 不立即入账 silver，仅记录 guest.incomeEarned；
 *   打烊 settleDay 按 净收益=基础收益+五单消费-支出 一次性入账（避免双重计入）。
 * - Step 5b 兼容字段：gold = silver 别名、debt = legacyDebt 别名（zustand Object.assign 会把 getter
 *   降级为数据属性，故采用「普通字段 + 每处写 silver/legacyDebt 时同步写 gold/debt」方案；另有
 *   onRehydrateStorage 兜底同步，保证旧 UI useTangManagerStore(s=>s.gold) 不炸）。
 * - persist version 5：旧 v4 存档字段不完整 → migrate 丢弃重建（沿用 v2→v3→v4 策略，注释说明）。
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { getDifficultyParams } from '@/config/tang-difficulty';
import { STREET_NEWS_POOL, STREET_NEWS_KEEP } from '@/config/tang-street-news';
import { MEDICAL_BOOKS, MEDICAL_BOOK_MAP } from '@/config/tang-medical-books';
import { banquetTier } from '@/systems/tang-banquet-scoring';
import { INITIAL_GOODS } from '@/config/tang-initial-goods';
import { EVENT_DEFINITIONS, EVENT_MAP, buildSeizureEvent } from '@/config/tang-events';
import { createZustandPersistStorage } from '@/infrastructure/storage/zustand-persist-bridge';
import { checkBankruptcy, applyBankruptcy, dailyHustle, bankruptcyDaysSurvived, bankruptcyRestartValues } from '@/systems/tang-bankruptcy';
import { handleComplaint, checkBadReviewer, badReviewerCandidates } from '@/systems/tang-complaints';
import { checkAndTriggerEvents, applyEventEffect, checkInventoryEvents, applyInventoryEventSpecial } from '@/systems/tang-events';
import { generateDailyGuests, generateSingleGuest } from '@/systems/tang-guest-generator';
import {
  generateDailyGuestsWithWeights,
  applyReceptionStrategy,
} from '@/systems/tang-dynamic-traffic';
import { checkGamblingAddiction, GAMBLING_ADDICTION_DAYS, useLuckyStar } from '@/systems/tang-luck';
import { handleGuest, markContaminatedGuests, computeStockInfo, BACKLASH_THRESHOLD } from '@/systems/tang-reception';
import { settleDay as settleDaySystem } from '@/systems/tang-settlement';
import { dailyActionCountFor } from '@/systems/tang-actions';
import {
  performAfternoonActionCore,
  resolvePatrolHazardChoice,
  checkPostponedPatrol,
} from '@/systems/tang-afternoon-actions';
import {
  rollArrivalEvent,
  applyArrivalEvent,
  applyWoundedGuestOutcome,
  rollDepartureEvent,
} from '@/systems/tang-guest-arrival-events';
import { checkEmployeeEvents, applyEmployeeEvents, checkSocialEmployeeEvents, applySocialEvent } from '@/systems/tang-employee-events';
import { initializeRelations, evolveRelations, establishMentorship as establishMentorshipSystem, flattenRelations, AZHAO_ID } from '@/systems/tang-employee-relations';
import { assignShift as assignShiftSystem, checkOverwork as checkOverworkSystem, suggestOptimalSchedule, applyScheduleSuggestions, getShiftCoverage } from '@/systems/tang-scheduling';
import { sendForTraining as sendForTrainingSystem, checkTrainingCompletion as checkTrainingCompletionSystem, findMaster as findMasterSystem, azhaoGrowth } from '@/systems/tang-training';
import { updateFactionRelationship as updateFactionRelationshipSystem, applyFactionTrigger, getFactionPerks as getFactionPerksSystem, syncNpcFavor } from '@/systems/tang-factions';
import {
  buildInitialGameNPCs,
  checkNPCUnlocks as checkNPCUnlocksSystem,
  ensureNpcFog as ensureNpcFogSystem,
  updateNPCFavorPure,
  performNpcVisit,
  performBuyInformation,
  redeemAyingPure,
  refuseAyingPure,
  suDaniangFreeIntelRoll,
  performSuDaniangFreeIntel,
  npcVisitCooldownOk,
  suDaniangCooldownOk,
  NPC_VISIT_ENERGY_COST,
  NPC_VISIT_COOLDOWN_DAYS,
  SU_DANIANG_INTEL_PRICE,
  SU_DANIANG_INTEL_ENERGY,
  SU_DANIANG_INTEL_COOLDOWN_DAYS,
  AYING_REDEEM_PRICE,
  AYING_XIONGMEI_DAYS,
  AYING_XIONGMEI_AZHAO_FAVOR,
} from '@/systems/tang-npc-system';
import { FIVE_FACTIONS, buildNpcFavors, FACTION_NPC_MAP } from '@/config/tang-factions';
import { buildStageUpgradeEvent, checkStageUpgrade } from '@/systems/tang-stage';
import { revealPreference } from '@/systems/tang-guest-preference';
import {
  recommendItem as recommendItemSystem,
  chatWithGuest as chatWithGuestSystem,
  giveGift as giveGiftSystem,
  rejectGuestPolitely as rejectPolitelySystem,
} from '@/systems/tang-reception-extended';
import {
  updateAtmosphere as updateAtmosphereSystem,
  checkEmotionContagion,
  updatePatience,
  mergeGuests as mergeGuestsSystem,
  checkGuestBookTrigger,
} from '@/systems/tang-atmosphere';
import { levelForTotalSpent } from '@/config/tang-guest-book-content';
import {
  updateExpiry,
  removeExpiredGoods,
  calculateStorageCost,
  maxStorageForLevel,
  expandWarehouseCost,
  expandWarehouseDuration,
  totalVolumeOf,
} from '@/systems/tang-expiry';
import {
  createForwardContract as createForwardContractSystem,
  checkForwardContracts,
  generateMarketListings,
  purchaseListing as purchaseListingSystem,
} from '@/systems/tang-procurement';
import {
  startProcessing as startProcessingSystem,
  checkProcessingQueue,
  getProcessingRecipeById,
  createAssemble as createAssembleSystem,
  getAssembleRecipeById,
} from '@/systems/tang-processing';
import { inventoryNarrative } from '@/config/tang-inventory-narrative';
import { isTangTutorialId } from '@/config/tang-tutorial-ids';
import {
  exchangeSilverToFeiqian,
  exchangeFeiqianToSilver,
  interShopTransfer as interShopTransferSystem,
  depositSilver,
  withdrawDeposit,
  accrueDepositInterests,
  mortgageLoan,
  usuryLoan,
  repayLoan as repayLoanSystem,
  checkLoanOverdue,
} from '@/systems/tang-bank';
import {
  calculateCreditGain,
  calculateCreditCost,
  checkCreditEligibility,
  getCreditTier,
  checkCreditBankruptcy,
  releaseCreditLock,
  type CreditAction,
} from '@/systems/tang-credit';
import {
  investInGuildFund,
  investWithShen,
  investInUnderground,
  checkInvestmentMaturity,
} from '@/systems/tang-investment';
import { updatePriceIndex } from '@/systems/tang-inflation';
import { repayLegacyDebt } from '@/systems/tang-debt';
import { MAP_NODES, TRADE_ROUTES, TRADE_ROUTE_MAP, MAP_NODE_MAP, getLayerUnlockRule } from '@/config/tang-map-data';
import {
  generateMapEvents,
  handleMapEvent as handleMapEventSystem,
  expireMapEvents,
  getActiveMapEventEffects,
  mapEventIncomeFactor,
} from '@/systems/tang-map-events';
import {
  executeTradeRun as executeTradeRunSystem,
  unlockGreenChannel as unlockGreenChannelSystem,
  checkTransportArrivals as checkTransportArrivalsSystem,
  updateNodePriceModifiers,
  type TradeContext,
  type UnlockGreenChannelResult,
} from '@/systems/tang-trade';
// ---- TANG-MIST-003 M3：地图功能增强（节点繁荣度 / 路线规划 / 标记 / 快速移动）----
import {
  updateNodeProsperity,
  buildInitialNodeProsperity,
} from '@/systems/tang-node-prosperity';
import {
  planOptimalRoute,
  maybeRevealPathOnTravel,
  buildMarkerNotices,
  nodeInteractionLabel,
  QUICK_TRAVEL_ENERGY_COST,
} from '@/systems/tang-map-routing';
import type {
  MapEvent,
  MapLayer,
  MapRoutePlan,
  NodeProsperity,
  PlayerMarker,
  TradeRunResult,
  TransportArrivalResult,
} from '@/types/tang-map';
import type {
  ActionResult,
  ChatResult,
  ComplaintChoice,
  ComplaintResult,
  DaySettlement,
  DepositResult,
  Difficulty,
  Employee,
  EmployeeCandidate,
  PatrolChoiceResult,
  EmployeeShift,
  EmployeeSkillType,
  ExchangeResult,
  ForwardContract,
  GameEvent,
  GamePhase,
  GiftResult,
  Guest,
  GuestBookEntry,
  HandleGuestResult,
  HandleMethod,
  InvestApplyResult,
  InvestmentSettlementResult,
  KnownGuestRecord,
  LedgerEntry,
  LoanApplyResult,
  LoanRepayResult,
  LuckResult,
  MarketListing,
  MasterResult,
  MergeResult,
  PlayerIdentity,
  PoliteRejectMethod,
  PoliteRejectResult,
  ProcessingJob,
  RecommendResult,
  RelationshipEvent,
  RevealPreferenceResult,
  ShopItem,
  ShopType,
  GameMessage,
  TangManagerStore,
  TangViewMode,
  TrainingCompletionResult,
  TrainingResult,
  TransferResult,
  UnifiedRepayResult,
  WarehouseExpansion,
  WithdrawResult,
} from '@/types/tang-manager';
import type { FactionPerk, FactionUpdateResult } from '@/types/tang-factions';
import { generateStaffReminders, applyReminderEffect } from '@/systems/tang-staff-reminders';
import { generateAiText, generateAiGuestReview } from '@/systems/tang-ai-generator';
import { pickStaffGreeting, pickStaffReport } from '@/systems/tang-staff-daily';
import type { ReminderContext, StaffReminder } from '@/types/tang-reminders';
import { startTavernResearch as startTavernResearchSystem, settleTavernResearch as settleTavernResearchSystem, canSetSignature, signaturePrice, tavernLevelPriceBonus, checkTavernLevelUp, applyResearchExperience } from '@/systems/tang-tavern-recipes';
import { generateBanquetOrder as generateBanquetOrderSystem, prepareBanquet as prepareBanquetSystem, settleBanquet as settleBanquetSystem } from '@/systems/tang-tavern-banquets';
import { generateWeaver as generateWeaverSystem, sellConsignment as sellConsignmentSystem, consignmentGoods as consignmentGoodsSystem, maxWeavers as maxWeaversSystem } from '@/systems/tang-clothier-cooperative';
import { generateCustomOrder as generateCustomOrderSystem, deliverCustomOrder as deliverCustomOrderSystem, officialUnlocked as officialUnlockedSystem } from '@/systems/tang-clothier-custom-orders';
import { generatePhysician as generatePhysicianSystem, physicianDailyPatients as physicianDailyPatientsSystem, physicianPrescription as physicianPrescriptionSystem, stockMatchesPrescription as stockMatchesPrescriptionSystem, maxPhysicians as maxPhysiciansSystem } from '@/systems/tang-herbalist-physician';
import { startHerbResearch as startHerbResearchSystem, settleHerbResearch as settleHerbResearchSystem, setPatent as setPatentSystem } from '@/systems/tang-herbalist-recipes';
import { INDUSTRY_BLESSINGS, industryLevel as industryLevelDef, industryName as industryNameDef } from '@/config/tang-industry-content';
import type { Banquet, BanquetType, CustomOrder, CustomOrderType, DishCategory, HerbRecipe, HerbRecipeCategory, HerbResearchJob, IndustryOverview, Physician, TavernDish, TavernResearchJob, Weaver } from '@/types/tang-industry';
import { generateNodeStory } from '@/systems/tang-node-stories';
import { addPendingConsequence as addPendingConsequenceSystem, checkPendingConsequences as checkPendingConsequencesSystem, recordEvent as recordEventSystem } from '@/systems/tang-event-consequences';
import { checkBehaviorTriggers } from '@/systems/tang-event-consequences';
import { BEHAVIOR_EVENTS } from '@/config/tang-behavior-events';
import { POLITICS_DECISIONS, type PoliticsDecision } from '@/config/tang-politics-decisions';
import { SHOP_ASSETS, shopAssetById, shopAssetModifiers } from '@/config/tang-shop-assets';
import { canTriggerEvent as canTriggerEventSystem, recordTrigger as recordTriggerSystem, createEventFatigue } from '@/systems/tang-event-fatigue';
import { YONGLE_EVENTS } from '@/config/tang-events-yongle';
import { EAST_MARKET_EVENTS } from '@/config/tang-events-east-market';
import { WEST_MARKET_EVENTS } from '@/config/tang-events-west-market';
import { CHANGAN_EVENTS } from '@/config/tang-events-changan';
import type { EventFatigue, NodeStory, PendingConsequence, MapRegion } from '@/types/tang-map-story';
// ---- Step 5b-5：叙事与后期系统（手札录 / 蛛丝马迹 / 巍明楼 / 镖队 / 多结局）----
import {
  recordEvent as recordEventJournal,
  recordNPCDialogue as recordNPCDialogueJournal,
  recordMilestone as recordMilestoneJournal,
  recordChoice as recordChoiceJournal,
  journalContext,
} from '@/systems/tang-journal';
import {
  generateClue as generateClueSystem,
  connectClues as connectCluesSystem,
  pairwiseConnect,
  resolveClue as resolveClueSystem,
} from '@/systems/tang-clues';
import {
  generateImperialDecree,
  alignWithFaction as alignWithFactionSystem,
  factionPowerStruggle as factionPowerStruggleSystem,
  checkPoliticalTransition,
} from '@/systems/tang-politics';
import type { Decree, AlignResult } from '@/systems/tang-politics';
import {
  createCaravan,
  setupCaravanRoute as setupCaravanRouteSystem,
  loadCaravan as loadCaravanSystem,
  checkCaravanDaily as checkCaravanDailySystem,
} from '@/systems/tang-caravan';
import { checkEndingConditions as checkEndingConditionsSystem, endingById } from '@/systems/tang-endings';
import { ACHIEVEMENT_MAP, applyAchievementReward, achievementRegularCustomerBonus } from '@/config/tang-achievements';
import { businessStrategyGuestFactor } from '@/systems/tang-business-strategy';
import { sellBranch, maxEmployeesForShops } from '@/systems/tang-shop-sale';
import type { JournalEntry } from '@/types/tang-journal';
import type { Clue } from '@/types/tang-clues';
import type { CaravanGoods } from '@/types/tang-caravan';
// ---- TANG-ADD-001：成瘾性玩法模块（手札占候 / 意外之喜 / 今日要务 / 陆家遗命 / 谢七彩头 / 市易务暗标 / 伙计小传 / 商阶 / 局外成长 / 月度总结）----
import {
  drawHexagram as drawHexagramSystem,
  applyHexagramEffect,
} from '@/systems/tang-hexagram';
import { checkRareEvents as checkRareEventsSystem } from '@/systems/tang-rare-events';
import {
  generateDailyTasks as generateDailyTasksSystem,
  checkTaskCompletion as checkTaskCompletionSystem,
  dailyTaskById as dailyTaskByIdSystem,
  generateWeeklyTasks as generateWeeklyTasksSystem,
  checkWeeklyTasks as checkWeeklyTasksSystem,
  addWeeklyProgress as addWeeklyProgressSystem,
} from '@/systems/tang-daily-tasks';
import {
  checkPreOrderTrigger as checkPreOrderTriggerSystem,
  reserveGoodsForOrder as reserveGoodsForOrderSystem,
  deliverOrder as deliverOrderSystem,
  checkOverdueOrders as checkOverdueOrdersSystem,
  getPreOrderPenalty as getPreOrderPenaltySystem,
  generateOrderNarrative as generateOrderNarrativeSystem,
} from '@/systems/tang-preorder';
import {
  checkLegacyQuestTrigger as checkLegacyQuestTriggerSystem,
  checkLegacyQuestCompletion as checkLegacyQuestCompletionSystem,
} from '@/systems/tang-legacy-quests';
import {
  checkBetOffer as checkBetOfferSystem,
  resolveBet as resolveBetSystem,
} from '@/systems/tang-bets';
import {
  checkBlindAuction as checkBlindAuctionSystem,
  bidOnAuction as bidOnAuctionSystem,
  resolveAuction as resolveAuctionSystem,
} from '@/systems/tang-blind-auction';
import {
  generateBiography as generateBiographySystem,
  checkBiographyUnlock as checkBiographyUnlockSystem,
  biographyMasterSkill,
} from '@/systems/tang-biography';
import {
  evaluateRank as evaluateRankSystem,
  getRankPromotionMessage,
  rankProgress as rankProgressSystem,
} from '@/systems/tang-ranks';
import {
  loadLegacyGrowthSave,
  saveLegacyGrowthSave,
  applyAncestralBlessing as applyAncestralBlessingSystem,
} from '@/systems/tang-legacy-growth';
import {
  generateMonthlyReview as generateMonthlyReviewSystem,
  displayMonthlyReview,
} from '@/systems/tang-monthly-review';
// ---- v1.0 功能解锁（TANG-POLISH-001 模块二）----
import {
  checkFeatureUnlock as checkFeatureUnlockSystem,
} from '@/systems/tang-feature-unlock';
// ---- 内容深化 TANG-CONT-D：西市赌坊 / 负反馈系统 / 负债拓展 ----
import {
  placeBet as placeGamblingBetSystem,
  rollGamblingOdds as rollGamblingOddsSystem,
  rollXieQiGamblingEncounter,
  type GamblingResult,
} from '@/systems/tang-gambling';
import {
  checkNegativeFeedback as checkNegativeFeedbackSystem,
  applyNegativeChoice as applyNegativeChoiceSystem,
  type NegativeEvent,
  type NegativeChoiceResult,
} from '@/systems/tang-negative-feedback';
import {
  offerRevolvingLoan,
  canTakeTradeCredit,
  takeTradeCredit as takeTradeCreditSystem,
  accrueTradeCreditInterest,
  checkShenDebtMoment,
  resolveShenDebt,
  checkFramed,
  resolveFramed,
} from '@/systems/tang-debt-extension';
// ---- TANG-MIST-001：迷雾系统（区域 / 势力 / 人物三类迷雾）----
import {
  buildInitialFogState,
  checkFogReveals as checkFogRevealsSystem,
  revealRegion as revealRegionSystem,
  revealFactionInfo as revealFactionInfoSystem,
  revealNPCInfo as revealNPCInfoSystem,
  maybeRevealRegionOnTravel,
  performExploreRegions,
  EXPLORE_ENERGY_COST,
  type FactionInfoType,
  type NPCInfoType,
  type FogRevealState,
} from '@/systems/tang-fog';
import type {
  BlindAuction,
  BlindAuctionOutcome,
  BiographyEntry,
  DailyTask,
  Hexagram,
  LegacyQuest,
  MerchantRank,
  MonthlyReview,
  PreOrder,
  RareEvent,
  ReceptionStrategy,
  BusinessStrategy,
  TangBet,
  BankLoan,
  WeeklyTask,
  FogRevealResult,
} from '@/types/tang-manager';
/** 数值夹取（0..max），防御越界 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 账本追加（上限 max 条，超出裁掉最旧） */
function appendLedger(ledger: LedgerEntry[], entries: LedgerEntry[], max = 50): LedgerEntry[] {
  const merged = [...ledger, ...entries];
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

/** 成就合并（防重复） */
function mergeUnique(base: readonly string[], add: readonly string[]): string[] {
  const set = new Set(base);
  add.forEach((id) => set.add(id));
  return Array.from(set);
}

/** 信用流水追加（上限 20 条） */
function appendCreditHistory(
  history: TangManagerStore['creditHistory'],
  entry: TangManagerStore['creditHistory'][number]
): TangManagerStore['creditHistory'] {
  return [...(history ?? []), entry].slice(-20);
}

/** 兼容字段同步：写 silver 时同步 gold、写 legacyDebt 时同步 debt（见文件头 Step 5b 兼容方案说明） */
function syncCompat<T extends Partial<TangManagerStore>>(
  s: TangManagerStore,
  patch: T
): T & { gold: number; debt: number } {
  return {
    ...patch,
    gold: patch.silver !== undefined ? patch.silver : s.silver,
    debt: patch.legacyDebt !== undefined ? patch.legacyDebt : s.legacyDebt,
  };
}

/** 库存旁白追加（保留最近 3 条；shelf-panel 底部展示，不持久化） */
function pushNarrative(list: string[] | undefined, text: string): string[] {
  return [...(list ?? []), text].slice(-3);
}

/** 满仓拦截：返回 true 表示超限（旁白「库房堆得插不进脚…」） */
function storageFullFor(shopItems: readonly ShopItem[] | undefined, maxStorage: number | undefined, incomingVolume: number): boolean {
  return totalVolumeOf(shopItems) + incomingVolume > (maxStorage ?? 200);
}

/** 同名商品合并加库存（到货/加工/组合产出共用；不覆盖原售价/陈损，仅加 stock） */
function mergeByName(shopItems: readonly ShopItem[] | undefined, incoming: ShopItem): ShopItem[] {
  const existing = (shopItems ?? []).find((it) => it.name === incoming.name);
  if (existing) {
    return (shopItems ?? []).map((it) =>
      it.name === incoming.name
        ? { ...it, stock: Math.round((it.stock + incoming.stock) * 100) / 100 }
        : it
    );
  }
  return [...(shopItems ?? []), incoming];
}

// ============================================================
// TANG-RCP-001：接待结果统一接线（六操作共用）
// 纯函数可测部分在 systems/tang-reception|reception-extended|atmosphere；
// 本函数是 store 接线层：标记处理/收入/满意 → 气氛 → 传染 → 耐心 → 留言簿 → 回头客池。
// ============================================================

/** 六操作接待结果的统一描述（store 内部契约） */
interface ReceptionInput {
  guestId: string;
  income: number;
  energyConsumed: number;
  review: 'good' | 'bad';
  reputationChange?: number;
  scoreChange?: number;
  mentalOS?: string | null;
  usedMindRead?: boolean;
  /** 通晓人心反噬触发（回写 guest.backlashed） */
  backlashTriggered?: boolean;
  satisfactionDelta?: number;
  /** 赠礼好感（并入满意度） */
  favorDelta?: number;
  /** 婉拒 delegate：阿昭满意度 */
  xiaoerSatisfactionChange?: number;
  /** 夸奖触发（气氛+10 / 传染当众夸奖） */
  praiseTriggered?: boolean;
  /** 投诉触发（气氛-15 / 传染当众投诉 30% 殃及） */
  complaintTriggered?: boolean;
  /** 赠礼标记（giftCount+1） */
  giftGiven?: boolean;
  /** 消耗库房商品（赠礼扣 1 份） */
  consumesItem?: { itemId: string };
  /** 赠礼「下次消费×1.5」写入 knownGuests */
  nextConsumptionMultiplier?: number;
  /** 闲聊揭示偏好后的 guest（替换 preferences/preferenceRevealed） */
  preferenceGuest?: Guest;
  /** 拼桌双命中偏好额外 +10 气氛 */
  forceAtmosphere?: number;
  /** 排队耐心衰减基数（艮卦 阻滞 ×2 → 60；缺省 30） */
  patienceDecay?: number;
  handledNote?: string;
}

/**
 * 构建六操作接待的完整状态补丁（顺序：详情→操作→偏好匹配→气氛→传染→留言簿→耐心→结果）。
 * 返回 Partial<TangManagerStore> 由 store action 应用。
 */

/** 店员提醒上下文构建（店员互动提升 模块五；store → ReminderContext） */
function buildReminderContext(s: TangManagerStore, phase: string): ReminderContext {
  return {
    day: s.day,
    phase,
    shopType: s.shopType,
    employees: (s.employees ?? []).map((e) => ({ id: e.id, name: e.name, type: e.type, satisfaction: e.satisfaction })),
    xiaoerSatisfaction: s.xiaoerSatisfaction,
    guests: (s.guests ?? []).map((g) => ({ id: g.id, name: g.name, type: g.type, visitCount: g.visitCount, isBadReviewer: g.isBadReviewer, preferenceRevealed: g.preferenceRevealed, patience: g.patience })),
    shopItems: (s.shopItems ?? []).map((i) => ({ name: i.name, stock: i.stock, price: i.price, cost: i.cost, expiry: i.expiry, category: i.category })),
    todayHexagram: s.todayHexagram?.id ?? null,
    todayNetProfit: s.todayNetProfit,
    todayComplaint: (s.todayComplaints ?? 0) > 0,
    todayMindReadUsed: s.todayMindReadUsed,
    silver: s.silver,
    loans: s.loans,
    credit: s.credit,
    investments: s.investments,
    deposits: s.deposits,
    idleSilver: s.silver >= 500 && (s.investments ?? []).length === 0,
  };
}

function buildReceptionPatch(
  s: TangManagerStore,
  input: ReceptionInput,
  rng: () => number
): Partial<TangManagerStore> {
  const guest = s.guests.find((g) => g.id === input.guestId);
  if (!guest || guest.handled) {
    return {};
  }

  // 1. 当前客人更新（收入 × 消费意愿修正；满意度/累计消费累加）
  const incomeEarned = Math.round(input.income * (guest.consumptionModifier ?? 1) * 100) / 100;
  const assetMod = shopAssetModifiers(s.shopAssets ?? []);
  const satDelta = (input.satisfactionDelta ?? 0) + (input.favorDelta ?? 0) + assetMod.satisfaction;
  const satisfaction = clamp((guest.satisfaction ?? 50) + satDelta, 0, 100);
  const totalSpent = (guest.totalSpent ?? 0) + incomeEarned;
  const currentGuest: Guest = {
    ...guest,
    ...(input.preferenceGuest
      ? {
          preferences: input.preferenceGuest.preferences,
          preferenceRevealed: guest.preferenceRevealed || input.preferenceGuest.preferenceRevealed,
        }
      : {}),
    handled: true,
    review: input.review,
    ...(input.mentalOS !== undefined ? { mentalOS: input.mentalOS ?? null } : {}),
    backlashed: guest.backlashed || (input.backlashTriggered ?? false),
    incomeEarned,
    satisfaction,
    totalSpent,
    giftCount: input.giftGiven ? (guest.giftCount ?? 0) + 1 : guest.giftCount,
    handledNote: input.handledNote,
  };
  let guests = s.guests.map((g) => (g.id === guest.id ? currentGuest : g));
  let atmosphere = (s.shopAtmosphere ?? 50) + assetMod.atmosphere;
  let guestBook = s.guestBook ?? [];

  // 2. 气氛（3.1：夸奖+10 / 投诉-15 / 当场离开-8 / 拼桌双命中+10）
  if (input.praiseTriggered) {
    atmosphere = updateAtmosphereSystem('praise', { shopAtmosphere: atmosphere }).shopAtmosphere;
  }
  if (input.complaintTriggered) {
    atmosphere = updateAtmosphereSystem('complaint', { shopAtmosphere: atmosphere }).shopAtmosphere;
  }
  if (input.forceAtmosphere) {
    atmosphere = clamp(atmosphere + input.forceAtmosphere, 0, 100);
  }

  // 3. 情绪传染（3.1：当众投诉 30% 其他客人走掉；当众夸奖 其余消费意愿+10%）
  if (input.complaintTriggered) {
    const contagion = checkEmotionContagion(currentGuest, 'complaint', { guests: s.guests }, rng);
    if (contagion.walkOutIds.length > 0) {
      guests = guests.map((g) =>
        contagion.walkOutIds.includes(g.id)
          ? { ...g, handled: true, incomeEarned: 0, review: 'bad' as const, consumptionModifier: 0, handledNote: '被投诉殃及，拂袖而去' }
          : g
      );
      atmosphere = clamp(atmosphere + updateAtmosphereSystem('leave', { shopAtmosphere: atmosphere }).delta * contagion.walkOutIds.length, 0, 100);
    }
  }
  if (input.praiseTriggered) {
    const contagion = checkEmotionContagion(currentGuest, 'praise', { guests: s.guests });
    if (contagion.boostIds.length > 0) {
      guests = guests.map((g) =>
        contagion.boostIds.includes(g.id) ? { ...g, consumptionModifier: (g.consumptionModifier ?? 1) * 1.1 } : g
      );
    }
  }

  // 4. 排队耐心（3.1：上一位接待后，其余未接待客人每轮 -5；归零拂袖而去 + 差评）
  //    TANG-ADD-001：艮卦 阻滞 → patienceDecay ×2（占候接线）
  const decayBase = input.patienceDecay ?? 30;
  guests = guests.map((g) => {
    if (g.id === guest.id || g.handled) {
      return g;
    }
    const p = updatePatience(g, decayBase, rng);
    if (p.zeroed) {
      atmosphere = clamp(atmosphere - 8, 0, 100); // 当场离开 -8
      return { ...g, patience: 0, handled: true, incomeEarned: 0, review: 'bad' as const, consumptionModifier: 0, handledNote: '久候不耐，拂袖而去' };
    }
    return { ...g, patience: p.patience, ...(p.lowPatience ? { consumptionModifier: p.consumptionModifier } : {}) };
  });

  // 5. 宾客留言簿（4.1：满意度≥80 且累计消费≥50 praise / 第三次 story / 特殊事件客 event）
  const trigger = checkGuestBookTrigger(currentGuest, { guestBook });
  if (trigger.type) {
    guestBook = [
      ...guestBook,
      {
        id: uuidv4(),
        guestName: guest.name,
        guestLevel: levelForTotalSpent(totalSpent),
        visitCount: guest.visitCount ?? 1,
        content: trigger.content,
        day: s.day,
        type: trigger.type,
      },
    ];
  }

  // 6. 回头客池更新（7.3：key=guest.name；等级按累计消费；赠礼倍率写入 consumptionMultiplier）
  const knownGuests: Record<string, KnownGuestRecord> = { ...(s.knownGuests ?? {}) };
  const prevRec = knownGuests[guest.name];
  knownGuests[guest.name] = {
    level: levelForTotalSpent(totalSpent),
    totalSpent,
    visitCount: guest.visitCount ?? 1,
    preferences: (currentGuest.preferences ?? []).map((p) => ({ ...p })),
    lastVisit: s.day,
    satisfaction,
    consumptionMultiplier: input.nextConsumptionMultiplier ?? prevRec?.consumptionMultiplier,
  };

  // 7. 赠礼消耗库房商品（扣 1 份；推荐不消耗，注释）
  let shopItems = s.shopItems;
  if (input.consumesItem) {
    shopItems = s.shopItems.map((it) =>
      it.id === input.consumesItem!.itemId
        ? { ...it, stock: Math.max(0, (it.stock ?? 0) - 1), status: (it.stock ?? 0) - 1 <= 0 ? ('out_of_stock' as const) : it.status }
        : it
    );
  }

  // 8. 连续缺货日数（5b-1.5 主顾流失轻量实现；六操作统一口径）
  const stockInfo = computeStockInfo(s.shopItems, s.shopType, guest, s.missingGoodStreak ?? 0);
  const missingGoodStreak = stockInfo.missingGood ? (s.missingGoodStreak ?? 0) + 1 : 0;

  // 9. 进场事件「客人带伤员」（内容深化 TANG-CONT-C 模块五）：
  //    帮忙（正常接待 review=good）→ 精力-10 + 声望+15 + 耗少许药材；婉拒（reject）→ 气氛-5
  let woundedRepDelta = input.reputationChange ?? 0;
  let woundedEnergyCost = input.energyConsumed;
  let woundedAtmosphere = atmosphere;
  let woundedItems = shopItems;
  if (guest.arrivalEvent === 'wounded') {
    if (input.review === 'good') {
      woundedRepDelta += 15;
      woundedEnergyCost += 10;
      const herb = woundedItems.find(
        (it) => (it.category === '药材' || /药|参|归|连/.test(it.name)) && (it.stock ?? 0) > 0
      );
      if (herb) {
        woundedItems = woundedItems.map((it) =>
          it.id === herb.id
            ? { ...it, stock: Math.max(0, (it.stock ?? 0) - 1), status: (it.stock ?? 0) - 1 <= 0 ? ('out_of_stock' as const) : it.status }
            : it
        );
      }
      guests = guests.map((g) =>
        g.id === guest.id ? { ...g, handledNote: `${g.handledNote ?? ''}（见其伤重，你费心包扎，耗了些许药材）`.trim() } : g
      );
    } else {
      woundedAtmosphere = clamp(atmosphere - 5, 0, 100);
      guests = guests.map((g) =>
        g.id === guest.id ? { ...g, handledNote: `${g.handledNote ?? ''}（你婉拒了伤者，心中略有不忍）`.trim() } : g
      );
    }
  }

  return {
    guests,
    shopItems: woundedItems,
    currentGuestIndex: Math.min(s.currentGuestIndex + 1, guests.length),
    energy: clamp(s.energy - woundedEnergyCost, 0, 100),
    dailyEnergyConsumed: s.dailyEnergyConsumed + woundedEnergyCost,
    reputation: clamp(s.reputation + woundedRepDelta, 0, 1000),
    score: clamp(s.score + (input.scoreChange ?? 0), 1.0, 5.0),
    xiaoerSatisfaction: clamp(s.xiaoerSatisfaction + (input.xiaoerSatisfactionChange ?? 0), 0, 100),
    insightRemaining: input.usedMindRead ? s.insightRemaining - 1 : s.insightRemaining,
    insightUsedTotal: input.usedMindRead ? s.insightUsedTotal + 1 : s.insightUsedTotal,
    insightUsedOnNPC: input.usedMindRead
      ? { ...s.insightUsedOnNPC, [guest.name]: (s.insightUsedOnNPC[guest.name] ?? 0) + 1 }
      : s.insightUsedOnNPC,
    missingGoodStreak,
    shopAtmosphere: woundedAtmosphere,
    guestBook,
    knownGuests,
    pendingComplaint: input.complaintTriggered
      ? { guestId: guest.id, guestName: guest.name, isBadReviewer: !!guest.isBadReviewer, income: incomeEarned }
      : s.pendingComplaint,
  };
}

/** 从 store 状态构建跑商上下文（Step 5b-2；供跑商/绿通/到货结算复用） */
function buildTradeContext(s: TangManagerStore): TradeContext {
  return {
    day: s.day,
    silver: s.silver,
    nodePriceModifiers: s.nodePriceModifiers ?? {},
    greenChannels: s.greenChannels ?? [],
    transportingGoods: s.transportingGoods ?? [],
    employees: s.employees,
    shenTinglanFavor: s.shenTinglanFavor,
    xieQiFavor: s.xieQiFavor,
    reputation: s.reputation,
    shopItems: s.shopItems,
    mapEvents: s.mapEvents,
  };
}

/** 从 store 状态构建迷雾判定上下文（TANG-MIST-001；供 checkFogReveals/reveal* 复用）
 *  TANG-MIST-002：长安故人六位好感并入 npcFavors（迷雾揭示读 favor 的唯一来源） */
function regionRevealState(s: TangManagerStore): FogRevealState {
  const npcFavors = [...(s.npcFavors ?? [])];
  for (const npc of Object.values(s.gameNPCs)) {
    npcFavors.push({ npcId: npc.id, npcName: npc.name, favor: npc.favor, relationship: '', unlockedPerks: [] });
  }
  return {
    fogOfWar: s.fogOfWar,
    factions: s.factions ?? [],
    npcFavors,
    clues: s.clues ?? [],
  };
}

// TANG-MIST-002：长安故人 · 六位新 NPC 上下文构建（store 组装；系统纯函数）
function npcUnlockStateOf(s: TangManagerStore): Parameters<typeof checkNPCUnlocksSystem>[0] {
  return {
    day: s.day,
    reputation: s.reputation,
    score: s.score,
    legacyDebt: s.legacyDebt ?? 0,
    xiaoerFavor: s.xiaoerFavor,
    unlockedLayers: s.unlockedLayers,
    visitedNodes: s.visitedNodes,
    factions: s.factions ?? [],
    gameNPCs: s.gameNPCs,
    legacyDebtClearedDay: s.legacyDebtClearedDay ?? null,
    ayingHinted: s.ayingHinted ?? false,
    ayingRefused: s.ayingRefused ?? false,
    luBoConvoTarget: s.luBoConvoTarget,
  };
}

function npcIntelContextOf(s: TangManagerStore): Parameters<typeof performBuyInformation>[0] {
  return {
    day: s.day,
    fogOfWar: s.fogOfWar,
    factions: s.factions ?? [],
    clues: (s.clues ?? []).map((c) => ({ id: c.id, content: c.content })),
    suDaniangLastIntelDay: s.suDaniangLastIntelDay,
  };
}

/** 初始状态：B 难度默认值（DIFFICULTY_PARAMS.B 为唯一事实源；Step 5b 新增字段一并初始化） */function buildInitialState(): Omit<
  TangManagerStore,
  | 'setPhase'
  | 'setViewMode'
  | 'setPlayerIdentity'
  | 'setShopType'
  | 'setDifficulty'
  | 'initByDifficulty'
  | 'updateSilver'
  | 'updateFeiqian'
  | 'updateCredit'
  | 'exchangeCurrency'
  | 'interShopTransfer'
  | 'depositToBank'
  | 'withdrawFromBank'
  | 'takeMortgageLoan'
  | 'takeUsuryLoan'
  | 'repayLoan'
  | 'invest'
  | 'checkInvestments'
  | 'dismissInvestmentResults'
  | 'updateReputation'
  | 'updateScore'
  | 'updateXiaoerFavor'
  | 'updateXiaoerSatisfaction'
  | 'updateEnergy'
  | 'advanceDay'
  | 'resetGame'
  | 'startNewDay'
  | 'handleCurrentGuest'
  | 'settleDay'
  | 'addLedgerEntry'
  | 'updateShopItem'
  | 'addShopItem'
  | 'removeShopItem'
  | 'expandWarehouse'
  | 'createForwardContract'
  | 'purchaseListing'
  | 'startProcessing'
  | 'createAssemble'
  | 'adjustPrice'
  | 'dismissInventoryNarratives'
  | 'unlockAchievement'
  | 'triggerEvent'
  | 'resolveEventChoice'
  | 'addToEventLog'
  | 'setXiaoerGone'
  | 'updateShenFavor'
  | 'updateXieQiFavor'
  | 'playLuckyStar'
  | 'resolveComplaint'
  | 'dismissComplaint'
  | 'repayDebt'
  | 'enterBankruptcy'
  | 'bankruptcyDailyHustle'
  | 'restartAfterBankruptcy'
  | 'setAiNarrationEnabled'
  | 'setAiModel'
  | 'hireEmployee'
  | 'fireEmployee'
  | 'raiseSalary'
  | 'arrangeRestDay'
  | 'revealEmployeeBackground'
  | 'praiseEmployee'
  | 'reprimandEmployee'
  | 'performAfternoonAction'
  | 'resolvePatrolHazard'
  | 'buyStrollBargain'
  | 'unlockMapLayer'
  | 'visitNode'
  | 'generateDailyMapEvents'
  | 'handleMapEvent'
  | 'executeTradeRun'
  | 'unlockGreenChannel'
  | 'checkTransportArrivals'
  | 'revealGuestPreference'
  | 'recommendItem'
  | 'chatWithGuest'
  | 'giveGift'
  | 'mergeGuests'
  | 'rejectPolitely'
  | 'updateAtmosphere'
  | 'addGuestBookEntry'
  | 'assignShift'
  | 'autoSchedule'
  | 'sendForTraining'
  | 'findMaster'
  | 'checkTrainingCompletion'
  | 'evolveRelations'
  | 'establishMentorship'
  | 'updateFactionRelationship'
  | 'getFactionPerks'
  | 'setFactionPanelOpen'
  | 'addJournalEntry'
  | 'addClue'
  | 'connectClues'
  | 'resolveClue'
  | 'generateDecree'
  | 'alignWithFaction'
  | 'setupCaravan'
  | 'setupCaravanRoute'
  | 'loadCaravan'
  | 'checkEndingConditions'
  | 'triggerEnding'
  | 'continueEnding'
  | 'setJournalPanelOpen'
  | 'setPoliticsPanelOpen'
  | 'setCaravanPanelOpen'
  | 'checkCaravanDaily'
  | 'runFactionPowerStruggle'
  | 'acceptImperialOffice'
  | 'declineImperialOffice'
  | 'drawDailyHexagram'
  | 'dismissHexagramCard'
  | 'generateDailyTasks'
  | 'checkDailyTasks'
  | 'triggerLegacyQuest'
  | 'checkLegacyQuestCompletion'
  | 'checkRareEvents'
  | 'checkBetOffer'
  | 'acceptBet'
  | 'declineBet'
  | 'resolveBet'
  | 'checkBlindAuction'
  | 'placeBid'
  | 'resolveAuction'
  | 'checkBiographies'
  | 'evaluateRank'
  | 'applyAncestralBlessing'
  | 'generateMonthlyReview'
  | 'setReceptionStrategy'
  | 'setBusinessStrategy'
  | 'sellShop'
  | 'acceptPreOrder'
  | 'reserveGoods'
  | 'deliverOrder'
  | 'checkOverdueOrders'
  | 'updateWeeklyTaskProgress'
  | 'settleWeeklyTasks'
  | 'checkFeatureUnlock'
  | 'openGamblingPanel'
  | 'closeGamblingPanel'
  | 'placeGamblingBet'
  | 'checkNegativeFeedback'
  | 'resolveNegativeEvent'
  | 'dismissNegativeEvent'
  | 'acceptRevolvingLoan'
  | 'declineRevolvingLoan'
  | 'takeTradeCreditPurchase'
  | 'resolveShenDebtMoment'
  | 'resolveFramedMoment'
  | 'checkFramedMoment'
  | 'checkShenDebtMoment'
  | 'checkFogReveals'
  | 'revealRegion'
  | 'revealFactionInfo'
  | 'revealNPCInfo'
  | 'exploreUnknownRegion'
  | 'checkNPCUnlocks'
  | 'updateNPCFavor'
  | 'visitNpc'
  | 'buyInformation'
  | 'redeemAying'
  | 'refuseAying'
  | 'maybeFreeIntelFromSuDaniang'
  | 'setMapLocateNode'
  // ---- TANG-MIST-003 M3：地图功能增强 actions（节点繁荣度 / 标记 / 快速移动 / 路线规划 / 面板跳转）----
  | 'updateNodeProsperityDaily'
  | 'noteNodeTrade'
  | 'placeMarker'
  | 'removeMarker'
  | 'quickTravelTo'
  | 'setRoutePlan'
  | 'clearRoutePlan'
  | 'prefillCaravanRoute'
  | 'consumeMapCaravanPrefill'
  | 'requestNavPanel'
  | 'consumeMapMarkerNotices'
  // ---- TANG-TUT-001 模块一：新手引导 actions（行为接口，不属初始数据）----
  | 'markTutorialRead'
  | 'resetAllTutorials'
  | 'showTutorial'
  | 'dismissTutorial'
  | 'appendDialogue'
  | 'clearDialogue'
  | 'setGuestMood'
  | 'completeDialogueReception'
  | 'showStoryNarrative'
  | 'dismissStoryNarrative'
  | 'generateReminders'
  | 'applyReminder'
  | 'dismissReminder'
  | 'clearReminders'
  | 'setDailyStaffGreeting'
  | 'setDailyStaffReport'
  | 'tavernStartResearch'
  | 'tavernSettleResearch'
  | 'tavernSetSignature'
  | 'tavernAcceptBanquet'
  | 'tavernPrepareBanquet'
  | 'tavernHoldBanquet'
  | 'clothierHireWeaver'
  | 'clothierSellConsignment'
  | 'clothierAcceptCustomOrder'
  | 'clothierDeliverCustomOrder'
  | 'herbalistHirePhysician'
  | 'herbalistPhysicianDaily'
  | 'herbalistStartResearch'
  | 'herbalistSettleResearch'
  | 'herbalistSetPatent'
  | 'industryTick'
  | 'industryUpgrade'
  | 'industryOverview'
  | 'recordEvent'
  | 'addPendingConsequence'
  | 'checkPendingConsequences'
  | 'revealNodeStory'
  | 'triggerRegionEvent'
  | 'setAiContentToggle'
  | 'recordAiLog'
  | 'clearAiLog'
  | 'checkBehaviorEvents'
  | 'maybeRegionEvent'
  | 'purchaseBranch'
  | 'resolvePoliticsDecision'
  | 'dismissSettlementPopup'
  | 'addMessage'
  | 'dismissMessage'
  | 'purchaseShopAsset'
  | 'azhaoRaiseSalary'
  | 'generateStreetNews'
  | 'createDialogueContext'
  | 'updateDialogueEmotion'
  | 'clearDialogueContext'
  | 'appendDialogueHistory'
  | 'purchaseMedicalBook'
  | 'performDiagnosis'
  | 'settleBanquetMenu'
  | 'settleFabricOrder'
> {
  const b = getDifficultyParams('B');
  return {
    phase: 'identity',
    viewMode: 'operations', // 双视图默认：日常经营（dashboard 由导航切换进入）
    player: null,
    shopType: null,
    difficulty: 'B',
    silver: b.initialGold,
    gold: b.initialGold,
    feiqian: 0,
    credit: 50,
    creditHistory: [],
    creditLocked: 0,
    creditBankruptDays: 0,
    legacyDebt: b.initialDebt,
    debt: b.initialDebt,
    deposits: [],
    loans: [],
    investments: [],
    priceIndex: 1,
    lastPriceUpdate: 1,
    // Step 5b-1.5 裁决（TANG-S5B15-002）：规格 maxStorage 100 与初始货架 170 冲突 → 取容纳值留余量 200
    maxStorage: 200,
    inflationModifier: 0,
    depositRateBoostDays: 0,
    monthlyInterest: b.monthlyInterest,
    score: b.initialScore,
    reputation: b.initialReputation,
    xiaoerFavor: b.initialXiaoerFavor,
    xiaoerSatisfaction: b.initialXiaoerSatisfaction,
    energy: 100,
    day: 1,
    insightRemaining: b.insightChances,
    luckRemaining: b.luckChances,
    guests: [],
    currentGuestIndex: 0,
    dialogueHistory: [],
    guestMood: {},
    storyNarrative: null,
    staffReminders: [],
    staffIgnoreCounts: {},
    dailyStaffGreeting: null,
    dailyStaffReport: null,
    tavernDishes: [],
    tavernBanquets: [],
    tavernLevel: 1,
    tavernResearchJobs: [],
    tavernBanquetCount: 0,
    tavernResearchExp: 0,
    weavers: [],
    customOrders: [],
    clothierLevel: 1,
    customOrderCount: 0,
    physicians: [],
    herbRecipes: [],
    herbResearchJobs: [],
    herbalistLevel: 1,
    curedPatientCount: 0,
    todayPatients: 0,
    lastIndustryBlessing: null,
    eventHistory: [],
    pendingConsequences: [],
    nodeStoriesRevealed: {},
    eventFatigue: createEventFatigue(),
    aiContentToggles: {},
    aiGenerationLog: [],
    lastMindReadDay: 0,
    noExpiryStreak: 0,
    consecutiveFullReceptionDays: 0,
    politicsStep: 0,
    politicsDone: false,
    currentPoliticsDecision: null,
    settlementPopupOpen: false,
    messages: [],
    shopAssets: [],
    ledger: [],
    todaySettlement: null,
    shopItems: [],
    unlockedAchievements: [],
    insightUsedTotal: 0,
    dailyEnergyConsumed: 0,
    events: [...EVENT_DEFINITIONS],
    pendingEvents: [],
    eventLog: [],
    insightUsedOnNPC: {},
    totalNetProfit: 0,
    maxGamblingWin: 0,
    hasGoneBroke: false,
    xiaoerGone: false,
    shenDebt: false,
    shenPartner: false,
    xieQiFavor: 0,
    shenTinglanFavor: 0,
    gamblingAddictionDays: 0,
    luckUsedTotal: 0,
    bankruptcyStartDay: 0,
    pendingComplaint: null,
    aiNarrationEnabled: true,
    aiModel: 'openai/gpt-4o-mini',
    stage: 1,
    employees: [],
    maxEmployees: 4,
    dailyActionsRemaining: b.dailyActionCount,
    afternoonActions: [],
    // 内容深化 TANG-CONT-C：午后自由行动 + 接待随机事件初始
    pendingPatrolHazards: [],
    postponedPatrolHazards: [],
    strollBargain: null,
    nextDayExtraGuests: 0,
    slackingEmployeeIds: [],
    shopCount: 1,
    xieQiIdentityRevealed: false,
    specialEmployeeStoryCompleted: false,
    employeeBonusRate: 0,
    // Step 5b-1.5：库存压力/进货/加工
    warehouseLevel: 1,
    storageCostPerDay: 0,
    // Step 5b-1.5 裁决（TANG-S5B15-002）：规格 freeStorageLimit 50 与初始货架 170 冲突 → 取初始货架体积 170，开局零仓储费，囤货超限才收费
    freeStorageLimit: 170,
    forwardContracts: [],
    marketListings: [],
    processingQueue: [],
    warehouseExpansion: null,
    inventoryNarratives: [],
    missingGoodStreak: 0,
    // Step 5b-2：商业地图系统（初始 L1 永乐坊；商路静态快照；物价系数空表起步）
    unlockedLayers: ['yongle'],
    visitedNodes: [],
    mapEvents: [],
    tradeRoutes: [...TRADE_ROUTES],
    greenChannels: [],
    transportingGoods: [],
    nodePriceModifiers: {},
    // TANG-MIST-003 M3：地图功能增强（节点繁荣度 / 标记 / 今日交易节点 / 路线规划 / 面板跳转）
    nodeProsperity: buildInitialNodeProsperity(),
    playerMarkers: [],
    todayTradedNodes: [],
    mapRoutePlan: null,
    mapCaravanPrefill: null,
    mapMarkerNotices: [],
    requestedNavPanel: null,
    // TANG-RCP-001：接待深度升级（气氛 / 留言簿 / 回头客池）
    shopAtmosphere: 50,
    guestBook: [],
    knownGuests: {},
    // TANG-SOC-001：名声关系网 / 内部交情
    factions: FIVE_FACTIONS.map((f) => ({ ...f, perks: f.perks.map((p) => ({ ...p })) })),
    npcFavors: buildNpcFavors({
      shenTinglanFavor: b.initialXiaoerFavor, // 沈听澜初始好感（与小二同档，注释占位）
      xieQiFavor: 0,
      fuyinFavor: 20, // 京兆府初始 20
      zhaoYuanwaiFavor: 10, // 赵员外初始 10
    }),
    employeeRelations: [],
    fuyinFavor: 20,
    zhaoYuanwaiFavor: 10,
    azhaoTrait: null,
    factionPanelOpen: false,
    // Step 5b-5：叙事与后期系统（手札录 / 蛛丝马迹 / 巍明楼 / 镖队 / 多结局）
    journal: [],
    clues: [],
    // TANG-MIST-001：迷雾系统初始态（L1 揭示；L2/L3 核心点揭示；势力/NPC 按初始好感部分揭示）
    // TANG-MIST-002：六位新 NPC 迷雾条目并入（trueAttitude/hiddenStory 文案来自 config）
    fogOfWar: ensureNpcFogSystem(
      buildInitialFogState({
        shenTinglanFavor: b.initialXiaoerFavor, // 与 npcFavors 初始一致（沈听澜初始好感）
        xieQiFavor: 0,
        fuyinFavor: 20,
        zhaoYuanwaiFavor: 10,
        xiaoerFavor: b.initialXiaoerFavor, // 阿昭（小二）好感
      }),
      buildInitialGameNPCs()
    ),
    // TANG-MIST-002：长安故人 · 六位新 NPC 初始（全部 locked；运行时字段）
    gameNPCs: buildInitialGameNPCs(),
    npcVisitCooldowns: {},
    npcConvoCounts: {},
    suDaniangLastIntelDay: 0,
    ayingHinted: false,
    ayingRefused: false,
    ayingInShopDays: 0,
    luBoStoryRevealed: false,
    luBoConvoTarget: undefined, // 陆伯登场时 checkNPCUnlocks 取定 5-8（见 tang-npc-system）
    chengCooperation: false,
    chengDiscountCategory: null,
    sadiHiddenRoute: false,
    sadiJadeGift: false,
    shangguanCourtIntro: false,
    xiongmeiUnlocked: false,
    legacyDebtClearedDay: null,
    mapLocateNodeId: null,
    decrees: [],
    politicalFaction: null,
    politicalAlignment: 0,
    caravans: [],
    endingTriggered: null,
    journalPanelOpen: false,
    politicsPanelOpen: false,
    caravanPanelOpen: false,
    imperialBidCount: 0,
    courtCooperation: false,
    soldShops: false,
    apprenticeOpenedShop: false,
    retiredDays: 0,
    politicalLine: false,
    politicalEndgame: false,
    joinedCourt: false,
    // TANG-ADD-001：成瘾性玩法模块（手札占候 / 意外之喜 / 今日要务 / 陆家遗命 / 谢七彩头 / 暗标 / 商阶 / 月度总结）
    todayHexagram: null,
    todayTasks: [],
    todayTasksCompleted: [],
    streetNews: [],
    dialogueContexts: {},
    medicalKnowledge: 0,
    ownedMedicalBooks: [],
    todayTaskMindReadBonus: 0,
    completedRareEvents: [],
    hexagramCardOpen: false,
    activeLegacyQuest: null,
    completedLegacyQuests: [],
    legacyQuestRevealOpen: false,
    activeBet: null,
    betAccepted: false,
    currentBlindAuction: null,
    blindAuctionBid: null,
    blindAuctionResolved: false,
    rank: null,
    rankProgress: 0,
    monthlyReviews: [],
    rankPromotionOpen: false,
    todayNetProfit: 0,
    todayMindReadUsed: 0,
    todaySilkSold: 0,
    todayMarketDealTriggered: false,
    todayChatUsed: 0,
    todayComplaints: 0,
    todayGuestsHandled: 0,
    todayRejectedGuests: 0,
    todayMindReadBackfired: 0,
    ancestralEyeActive: false,
    // TANG-TRF-001：动态客流 + 大单预购 + 周级要务
    receptionStrategy: 'all',
    // 内容深化 TANG-CONT-B 模块六·1：经营策略默认稳健经营
    businessStrategy: 'steady',
    preOrders: [],
    weeklyTasks: [],
    weeklyTaskProgress: {},
    // v1.0 功能解锁（TANG-POLISH-001 模块二）：默认全 false，每日清晨/打烊 checkFeatureUnlock 更新
    unlockedFeatures: {},
    // 新手引导（TANG-TUT-001 模块一）：默认全未读、无当前引导（与功能解锁/迷雾等并存）
    tutorialFlags: {},
    currentTutorial: null,
    // 内容深化 TANG-CONT-D：西市赌坊 / 负反馈 / 负债拓展 初始字段
    gamblingPanelOpen: false,
    gamblingOdds: 2,
    gamblingSuspicion: false,
    gamblingLuckyTable: false,
    gamblingEncounterMsg: '',
    consecutiveProfitDays: 0,
    pendingNegativeEvents: [],
    disasterType: undefined,
    disasterUntil: 0,
    shenSchemeUntil: 0,
    shenSchemeCategory: undefined,
    bankRunDays: 0,
    salaryMultiplier: 1,
    azhaoNoRaiseMonths: 0,
    tradeCredit: 0,
    creditDueDay: 0,
    revolvingLoanOffer: null,
    shenDebtType: null,
    shenDebtMomentOpen: false,
    framedOpen: false,
  };
}

/**
 * 月初钩子（nextDay % 30 === 1）：通胀更新 + 贷款检查（自动扣息/逾期/没收）+ 存款计息
 * + 高利贷惩罚 + 信用破产恢复（30 天）。返回变更建议与额外入队事件；由 startNewDay 应用。
 */
function buildMonthStartPatch(state: TangManagerStore): {
  patch: Partial<TangManagerStore>;
  extraPending: GameEvent[];
} {
  const nextDay = state.day + 1;
  const price = updatePriceIndex({
    priceIndex: state.priceIndex,
    inflationModifier: state.inflationModifier,
  });
  const overdue = checkLoanOverdue({ loans: state.loans ?? [], silver: state.silver });
  const deposits = accrueDepositInterests({ deposits: state.deposits ?? [], day: nextDay });

  const patch: Partial<TangManagerStore> = {
    priceIndex: price.priceIndex,
    lastPriceUpdate: nextDay,
    inflationModifier: 0,
    deposits,
    loans: overdue.loans,
  };
  const extraPending: GameEvent[] = [];
  const eventLogAdd: string[] = [];
  let creditDelta = 0;
  let xieQiDelta = 0;
  let silverDelta = -overdue.interestPaid;
  let shopCountDelta = 0;
  let clearStock = false;
  let phase: GamePhase | undefined;
  // Step 5b-1.5：月初扣除整月仓储费（超过 freeStorageLimit 部分；时令修正见 calculateStorageCost）
  const storageCost = calculateStorageCost({ shopItems: state.shopItems, freeStorageLimit: state.freeStorageLimit, day: nextDay });
  let storageLedger: LedgerEntry[] = [];
  if (storageCost > 0) {
    silverDelta -= storageCost;
    storageLedger = [{ day: nextDay, project: '仓储费', category: '支出', amount: -storageCost }];
  }

  for (const ev of overdue.events) {
    eventLogAdd.push(`loan-overdue:${ev.loanId}:${ev.kind}`);
    creditDelta -= 50; // 逾期 -50 信用（模块三）
    if (ev.type === 'mortgage') {
      if (ev.kind === 'seize') {
        const loan = overdue.loans.find((l) => l.id === ev.loanId);
        phase = 'seized';
        const collateral =
          loan?.collateral === 'shop' || loan?.collateral === 'deed' || loan?.collateral === 'goods'
            ? loan.collateral
            : 'shop';
        extraPending.push(buildSeizureEvent(collateral, nextDay));
        if (loan?.collateral === 'deed') {
          // 失去地契：分店减少（注释：店数与剧情联动为占位）
          shopCountDelta = -1;
        } else if (loan?.collateral === 'goods') {
          clearStock = true; // goods → 库存清零
        }
        // collateral==='shop' → phase='seized'（夺回老店复仇剧情占位见 seized-panel）
      }
    } else {
      // 高利贷逐级恶化（用户规格：1 月好感-30+追债、2 月赌场剧情、3 月官府查封）
      if (ev.kind === 'usury_1') {
        xieQiDelta -= 30;
        eventLogAdd.push('usury-debt-collect');
      } else if (ev.kind === 'usury_2') {
        eventLogAdd.push('usury-casino-plot');
      } else {
        phase = 'seized';
        eventLogAdd.push('usury-seized');
      }
    }
  }

  // 信用破产恢复：credit<0 → 30 天追踪（供应商现金交易/官府盘查翻倍为注释预留）；到期 credit 归 0
  let credit = (state.credit ?? 0) + creditDelta;
  let creditBankruptDays = state.creditBankruptDays ?? 0;
  if (credit < 0) {
    creditBankruptDays = creditBankruptDays > 0 ? creditBankruptDays - 1 : 30;
    if (creditBankruptDays === 0) {
      credit = 0;
      creditBankruptDays = 0;
    }
  } else if (creditBankruptDays > 0) {
    creditBankruptDays -= 1;
  }

  patch.silver = Math.max(0, state.silver + silverDelta);
  patch.gold = patch.silver;
  patch.credit = Math.min(1000, Math.max(0, credit));
  patch.creditBankruptDays = creditBankruptDays;
  patch.storageCostPerDay = Math.round(storageCost / 30 * 100) / 100; // 日费展示用（月费/30）
  if (storageLedger.length > 0) {
    patch.ledger = appendLedger(state.ledger, storageLedger);
  }
  if (creditDelta !== 0) {
    patch.creditHistory = appendCreditHistory(state.creditHistory, {
      day: nextDay,
      reason: '贷款逾期',
      amount: creditDelta,
    });
  }
  if (xieQiDelta !== 0) {
    patch.xieQiFavor = Math.min(100, Math.max(0, (state.xieQiFavor ?? 0) + xieQiDelta));
  }
  if (shopCountDelta !== 0) {
    patch.shopCount = Math.max(1, (state.shopCount ?? 1) + shopCountDelta);
  }
  if (clearStock) {
    patch.shopItems = (state.shopItems ?? []).map((it) => ({ ...it, stock: 0 }));
  }
  if (phase) {
    patch.phase = phase;
  }
  if (eventLogAdd.length > 0) {
    patch.eventLog = [...state.eventLog, ...eventLogAdd];
  }
  // 内容深化 TANG-CONT-D 模块八：赊账逾期月息（5% 可叠加）+ 阿昭连续未涨月钱月数
  const creditAccrue = accrueTradeCreditInterest({
    credit: state.credit,
    tradeCredit: state.tradeCredit ?? 0,
    creditDueDay: state.creditDueDay ?? 0,
    day: nextDay,
  });
  if (creditAccrue.interest > 0) {
    patch.tradeCredit = creditAccrue.tradeCredit;
    patch.eventLog = [...(patch.eventLog ?? state.eventLog), `[第${nextDay}日] 赊账逾期：月息 ${creditAccrue.interest} 两（逾期 ${creditAccrue.overdueMonths} 月）`];
    patch.ledger = appendLedger(patch.ledger ?? state.ledger, [{ day: nextDay, project: '赊账逾期月息', category: '支出', amount: -creditAccrue.interest }]);
  }
  patch.azhaoNoRaiseMonths = (state.azhaoNoRaiseMonths ?? 0) + 1;
  return { patch, extraPending };
}

/** 投资到期结算（每日打烊）：应用盈亏/风险到 state，返回结算结果列表 */
function applyInvestmentMaturity(
  state: TangManagerStore,
  results: InvestmentSettlementResult[]
): Partial<TangManagerStore> {
  const gainTotal = results.reduce((sum, r) => sum + r.gain, 0);
  const lostIds = new Set(results.filter((r) => r.lost).map((r) => r.id));
  const dilemmaIds = new Set(results.filter((r) => r.dilemmaHit).map((r) => r.id));
  const maturedIds = new Set(results.map((r) => r.id));
  let creditDelta = 0;
  let xieQiDelta = 0;
  const eventLogAdd: string[] = [];
  if (lostIds.size > 0) {
    creditDelta -= 50 * lostIds.size; // 查封：信用-50
    xieQiDelta -= 20 * lostIds.size; // 谢七好感-20
    eventLogAdd.push('underground-seized');
  }
  const patch: Partial<TangManagerStore> = {
    silver: Math.max(0, state.silver + gainTotal),
    gold: Math.max(0, state.silver + gainTotal),
    investments: (state.investments ?? []).map((inv) =>
      maturedIds.has(inv.id)
        ? {
            ...inv,
            status: inv.type === 'underground' && lostIds.has(inv.id) ? ('lost' as const) : ('matured' as const),
            actualReturn: results.find((r) => r.id === inv.id)?.actualReturn ?? inv.expectedReturn,
            dilemmaHit: dilemmaIds.has(inv.id),
          }
        : inv
    ),
  };
  if (creditDelta !== 0) {
    patch.credit = Math.max(0, (state.credit ?? 0) + creditDelta);
    patch.creditHistory = appendCreditHistory(state.creditHistory, {
      day: state.day,
      reason: '投资查封',
      amount: creditDelta,
    });
  }
  if (xieQiDelta !== 0) {
    patch.xieQiFavor = Math.min(100, Math.max(0, (state.xieQiFavor ?? 0) + xieQiDelta));
  }
  if (eventLogAdd.length > 0) {
    patch.eventLog = [...state.eventLog, ...eventLogAdd];
  }
  return patch;
}

/** 持久化键名（当前版本 16：TANG-TUT-001 新增引导字段；历史迁移见 persist migrate 注释） */
const PERSIST_NAME = 'tang-manager-store';

export const useTangManagerStore = create<TangManagerStore>()(
  persist(
    (set, get) => ({
      ...buildInitialState(),

      setPhase: (phase: GamePhase): void => {
        set({ phase });
      },

      /** 切换双视图（operations 日常经营 / dashboard 经营看板） */
      setViewMode: (mode: TangViewMode): void => {
        set({ viewMode: mode });
      },

      setPlayerIdentity: (identity: PlayerIdentity): void => {
        set({ player: identity });
      },

      setShopType: (shopType: ShopType): void => {
        set({ shopType });
      },

      setDifficulty: (difficulty: Difficulty): void => {
        set({ difficulty });
      },

      /** 以难度参数初始化全部数值并进入 playing 阶段；开局即生成今日客人 */
      initByDifficulty: (difficulty: Difficulty): void => {
        const p = getDifficultyParams(difficulty);
        const shopType = get().shopType ?? 'jiulou';
        const goods = INITIAL_GOODS[shopType] ?? INITIAL_GOODS.jiulou;
        const guests = generateDailyGuests(shopType, difficulty, 1);
        const initialSilver = p.initialGold;
        const initialCredit = difficulty === 'A' ? 100 : difficulty === 'B' ? 50 : 0;
        set({
          difficulty,
          silver: initialSilver,
          gold: initialSilver,
          feiqian: 0,
          credit: initialCredit,
          creditHistory: [],
          creditLocked: 0,
          creditBankruptDays: 0,
          legacyDebt: p.initialDebt,
          debt: p.initialDebt,
          deposits: [],
          loans: [],
          investments: [],
          priceIndex: 1,
          lastPriceUpdate: 1,
          maxStorage: 200,
          inflationModifier: 0,
          depositRateBoostDays: 0,
          monthlyInterest: p.monthlyInterest,
          score: p.initialScore,
          reputation: p.initialReputation,
          xiaoerFavor: p.initialXiaoerFavor,
          xiaoerSatisfaction: p.initialXiaoerSatisfaction,
          energy: 100,
          day: 1,
          insightRemaining: p.insightChances,
          luckRemaining: p.luckChances,
          phase: 'playing',
          guests,
          currentGuestIndex: 0,
          dailyEnergyConsumed: 0,
          todaySettlement: null,
          shopItems: [...goods],
          ledger: [],
          unlockedAchievements: [],
          insightUsedTotal: 0,
          events: [...EVENT_DEFINITIONS],
          pendingEvents: [],
          eventLog: [],
          insightUsedOnNPC: {},
          totalNetProfit: 0,
          maxGamblingWin: 0,
          hasGoneBroke: false,
          xiaoerGone: false,
          shenDebt: false,
          shenPartner: false,
          xieQiFavor: 0,
          shenTinglanFavor: 0,
          gamblingAddictionDays: 0,
          luckUsedTotal: 0,
          bankruptcyStartDay: 0,
          pendingComplaint: null,
          stage: 1,
          employees: [],
          maxEmployees: 4,
          dailyActionsRemaining: p.dailyActionCount,
          afternoonActions: [],
          // 内容深化 TANG-CONT-C：午后自由行动 + 接待随机事件初始
          pendingPatrolHazards: [],
          postponedPatrolHazards: [],
          strollBargain: null,
          nextDayExtraGuests: 0,
          slackingEmployeeIds: [],
          shopCount: 1,
          xieQiIdentityRevealed: false,
          specialEmployeeStoryCompleted: false,
          employeeBonusRate: 0,
          // Step 5b-1.5：库存压力/进货/加工
          warehouseLevel: 1,
          storageCostPerDay: 0,
          freeStorageLimit: 170,
          forwardContracts: [],
          marketListings: [],
          processingQueue: [],
          warehouseExpansion: null,
          inventoryNarratives: [],
          missingGoodStreak: 0,
          // Step 5b-2：商业地图系统（开档同样初始化）
          unlockedLayers: ['yongle'],
          visitedNodes: [],
          mapEvents: [],
          tradeRoutes: [...TRADE_ROUTES],
          greenChannels: [],
          transportingGoods: [],
          nodePriceModifiers: {},
          // TANG-MIST-003 M3：开档重置（节点繁荣度 / 标记 / 今日交易 / 路线规划）
          nodeProsperity: buildInitialNodeProsperity(),
          playerMarkers: [],
          todayTradedNodes: [],
          mapRoutePlan: null,
          mapCaravanPrefill: null,
          mapMarkerNotices: [],
          requestedNavPanel: null,
          // TANG-RCP-001：接待深度升级（开档同样初始化）
          shopAtmosphere: 50,
          guestBook: [],
          knownGuests: {},
          // Step 5b-5：叙事与后期系统（开档同样初始化）
          journal: [],
          clues: [],
          decrees: [],
          politicalFaction: null,
          politicalAlignment: 0,
          caravans: [],
          endingTriggered: null,
          journalPanelOpen: false,
          politicsPanelOpen: false,
          caravanPanelOpen: false,
          imperialBidCount: 0,
          courtCooperation: false,
          soldShops: false,
          apprenticeOpenedShop: false,
          retiredDays: 0,
          politicalLine: false,
          politicalEndgame: false,
          joinedCourt: false,
          // TANG-TRF-001：动态客流 + 大单预购 + 周级要务（day 1 = 周一 → 首周要务即生成）
          receptionStrategy: 'all',
          // 内容深化 TANG-CONT-B 模块六·1：经营策略默认稳健经营
          businessStrategy: 'steady',
          preOrders: [],
          weeklyTasks: generateWeeklyTasksSystem(p.initialScore),
          weeklyTaskProgress: {},
        });
      },

      updateSilver: (amount: number): void => {
        set((s) => syncCompat(s, { silver: s.silver + amount }));
      },

      updateFeiqian: (amount: number): void => {
        set((s) => ({ feiqian: Math.max(0, (s.feiqian ?? 0) + amount) }));
      },

      updateCredit: (amount: number, reason: string): void => {
        set((s) => ({
          credit: Math.min(1000, Math.max(0, (s.credit ?? 0) + amount)),
          creditHistory: appendCreditHistory(s.creditHistory, { day: s.day, reason, amount }),
        }));
      },

      exchangeCurrency: (type: 'silver_to_feiqian' | 'feiqian_to_silver', amount: number): ExchangeResult | null => {
        const s = get();
        if (type === 'silver_to_feiqian') {
          const r = exchangeSilverToFeiqian(amount, s);
          if (!r.ok) return r;
          set((st) =>
            syncCompat(st, {
              silver: st.silver - amount,
              feiqian: (st.feiqian ?? 0) + r.actualAmount,
            })
          );
          return r;
        }
        const r = exchangeFeiqianToSilver(amount, s);
        if (!r.ok) return r;
        set((st) =>
          syncCompat(st, {
            feiqian: (st.feiqian ?? 0) - amount,
            silver: st.silver + r.actualAmount,
          })
        );
        return r;
      },

      interShopTransfer: (amount: number, useFeiqian: boolean): TransferResult | null => {
        const s = get();
        if ((s.shopCount ?? 1) < 2) {
          return {
            ok: false,
            actualAmount: 0,
            fee: 0,
            usedFeiqian: useFeiqian,
            arrivalDays: 0,
            robbed: false,
            reason: '尚无分店，无法调拨',
          };
        }
        const r = interShopTransferSystem(amount, '本店', '分店', useFeiqian, s);
        if (!r.ok) return r;
        set((st) =>
          syncCompat(
            st,
            useFeiqian
              ? { feiqian: (st.feiqian ?? 0) - amount }
              : { silver: st.silver - amount } // 现银：扣全额（被劫则损失，未劫则到账占位）
          )
        );
        return r;
      },

      depositToBank: (amount: number): DepositResult | null => {
        const s = get();
        const r = depositSilver(amount, s);
        if (!r.ok || !r.deposit) return r;
        set((st) =>
          syncCompat(st, {
            silver: st.silver - amount,
            deposits: [...(st.deposits ?? []), r.deposit!],
          })
        );
        get().showTutorial('FIRST_DEPOSIT');
        return r;
      },

      withdrawFromBank: (depositId: string): WithdrawResult | null => {
        const s = get();
        const deposit = (s.deposits ?? []).find((d) => d.id === depositId);
        if (!deposit) return null;
        // 内容深化 TANG-CONT-D 模块七：钱庄挤兑（当月存款不可取；下月恢复但损半月利息）
        if ((s.bankRunDays ?? 0) > 0) {
          return { ok: false, principal: deposit.amount, interest: 0, total: 0, reason: '钱庄挤兑，本月存款暂不可取（下月恢复）' };
        }
        const r = withdrawDeposit(deposit, s.day);
        set((st) =>
          syncCompat(st, {
            silver: st.silver + r.total,
            deposits: (st.deposits ?? []).filter((d) => d.id !== depositId),
          })
        );
        return r;
      },

      takeMortgageLoan: (amount: number, collateral: 'shop' | 'deed' | 'goods'): LoanApplyResult | null => {
        const s = get();
        // 边缘场景（模块三）：信用破产期间禁止新增借贷
        if ((s.creditBankruptDays ?? 0) > 0) {
          return { ok: false, loan: null, reason: `信用破产中（剩 ${s.creditBankruptDays} 天恢复），暂不可借贷` };
        }
        const r = mortgageLoan(amount, collateral, s);
        if (!r.ok || !r.loan) return r;
        set((st) =>
          syncCompat(st, {
            silver: st.silver + amount,
            loans: [...(st.loans ?? []), r.loan!],
          })
        );
        return r;
      },

      takeUsuryLoan: (amount: number): LoanApplyResult | null => {
        const s = get();
        // 边缘场景（模块三）：信用破产期间禁止新增借贷
        if ((s.creditBankruptDays ?? 0) > 0) {
          return { ok: false, loan: null, reason: `信用破产中（剩 ${s.creditBankruptDays} 天恢复），暂不可借贷` };
        }
        const r = usuryLoan(amount, s);
        if (!r.ok || !r.loan) return r;
        set((st) =>
          syncCompat(st, {
            silver: st.silver + amount,
            loans: [...(st.loans ?? []), r.loan!],
          })
        );
        return r;
      },

      repayLoan: (loanId: string): LoanRepayResult | null => {
        const s = get();
        const loan = (s.loans ?? []).find((l) => l.id === loanId && l.status !== 'paid');
        if (!loan) return null;
        const result = repayLoanSystem(loan, s.silver);
        if (!result.ok) return result;
        set((st) =>
          syncCompat(st, {
            silver: st.silver - result.total,
            loans: (st.loans ?? []).map((l) => (l.id === loanId ? { ...l, status: 'paid' as const } : l)),
            eventLog: [...st.eventLog, `loan-repaid:${loanId}:${s.day}`],
            // 按时还贷信用 +15；还款后释放信用锁定
            credit: Math.min(1000, (st.credit ?? 0) + calculateCreditGain('loan_repaid', st)),
            creditHistory: appendCreditHistory(st.creditHistory, { day: s.day, reason: '按时还贷', amount: 15 }),
            creditLocked: releaseCreditLock(st).creditLocked,
            // 高利贷还款：谢七好感 +5
            xieQiFavor:
              loan.type === 'usury' ? Math.min(100, (st.xieQiFavor ?? 0) + 5) : st.xieQiFavor,
          })
        );
        // 内容深化 TANG-CONT-D 模块八：还清抵押贷款 → 钱庄循环借贷 offer（额度×1.5、利率+1%）
        if (loan.type === 'mortgage' && !(s.revolvingLoanOffer)) {
          const offer = offerRevolvingLoan({ lastPaidMortgage: { ...loan, status: 'paid' as const }, revolvingLoanOffered: false });
          if (offer.offered) {
            set((st) => ({
              revolvingLoanOffer: { amount: offer.amount, interestRate: offer.interestRate },
              eventLog: [...st.eventLog, `[第${s.day}日] 循环借贷 offer：${offer.message}`],
            }));
          }
        }
        return result;
      },

      invest: (type: 'guild' | 'shen' | 'underground', amount: number): InvestApplyResult | null => {
        const s = get();
        const r =
          type === 'guild'
            ? investInGuildFund(amount, s)
            : type === 'shen'
              ? investWithShen(amount, s)
              : investInUnderground(amount, s);
        if (!r.ok || !r.investment) return r;
        set((st) =>
          syncCompat(st, {
            silver: st.silver - amount,
            investments: [...(st.investments ?? []), r.investment!],
          })
        );
        return r;
      },

      checkInvestments: (): InvestmentSettlementResult[] => {
        const s = get();
        const results = checkInvestmentMaturity({ day: s.day, investments: s.investments ?? [] });
        if (results.length === 0) return [];
        set((st) => ({
          ...applyInvestmentMaturity(st, results),
          lastInvestmentResults: results,
        }));
        return results;
      },

      dismissInvestmentResults: (): void => {
        set({ lastInvestmentResults: undefined });
      },

      updateReputation: (amount: number): void => {
        set((s) => ({ reputation: clamp(s.reputation + amount, 0, 1000) }));
      },

      updateScore: (amount: number): void => {
        set((s) => ({ score: clamp(s.score + amount, 1.0, 5.0) }));
      },

      updateXiaoerFavor: (amount: number): void => {
        set((s) => ({ xiaoerFavor: clamp(s.xiaoerFavor + amount, 0, 100) }));
      },

      updateXiaoerSatisfaction: (amount: number): void => {
        set((s) => ({ xiaoerSatisfaction: clamp(s.xiaoerSatisfaction + amount, 0, 100) }));
      },

      updateEnergy: (amount: number): void => {
        set((s) => ({ energy: clamp(s.energy + amount, 0, 100) }));
      },

      advanceDay: (): void => {
        set((s) => ({ day: s.day + 1 }));
      },

      resetGame: (): void => {
        set({ ...buildInitialState() });
      },

      /** 进入下一天：day+1、生成新客、重置接待指针/每日精力/精力回满/清空今日结算；
       *  应用污染标记（3.2）、差评师标记（3.4）、事件触发入队（3.1）；
       *  Step 5a：重置每日自由行动次数与已执行列表、清空员工休假标记；
       *  Step 5b：月初（nextDay%30===1）通胀/贷款检查/存款计息；每日钱庄优惠递减；信用破产恢复；
       *  Step 5b-1.5 清晨钩子：籴粜契到货 / 市易务挂牌刷新 / 加工出库 / 库存事件 / 库房扩建完工。 */
      startNewDay: (): void => {
        set((s) => {
          const shopType = s.shopType ?? 'jiulou';
          const nextDay = s.day + 1;
          // TANG-TRF-001 动态客流：客人数随评分/声望浮动 + 四档类型权重（回头客 20% 逻辑保留）
          // 内容深化 TANG-CONT-B 模块六·1/6·2：经营策略客流系数（薄利多销 +30%/奇货可居 -30%）
          // + 成就「回头客」熟客光顾概率加成（+5%）
          const strategy = s.businessStrategy ?? 'steady';
          const regularBonus = achievementRegularCustomerBonus(s.unlockedAchievements ?? []);
          let guests = generateDailyGuestsWithWeights(
            {
              shopType,
              difficulty: s.difficulty,
              score: s.score,
              reputation: s.reputation,
              knownGuests: s.knownGuests,
              day: nextDay,
              guestCountFactor: businessStrategyGuestFactor(strategy),
              regularCustomerChance: 0.2 + regularBonus / 100,
              // 内容深化 TANG-CONT-C 模块五：离场「带新客来」次日 +N
              extraGuestCount: s.nextDayExtraGuests ?? 0,
              // 内容深化 TANG-CONT-D 模块七：瘟疫客流减半 7 天
              ...(s.disasterType === 'plague' && (s.disasterUntil ?? 0) >= nextDay
                ? { guestCountFactor: businessStrategyGuestFactor(strategy) * 0.5 }
                : {}),
            },
            Math.random
          );
          // 内容深化 TANG-CONT-C 模块五：进场事件（30% 触发 1 个；applyArrivalEvent 修改客人/气氛/好感）
          const arrivalType = rollArrivalEvent(Math.random);
          const arrivalRes = applyArrivalEvent(
            { guests, shopAtmosphere: s.shopAtmosphere ?? 50, xiaoerFavor: s.xiaoerFavor },
            arrivalType,
            Math.random
          );
          if (arrivalRes.guests) {
            guests = arrivalRes.guests;
          }
          const arrivalAtmosphereDelta = arrivalRes.atmosphereDelta ?? 0;
          const arrivalXiaoerFavorDelta = arrivalRes.xiaoerFavorDelta ?? 0;
          // 内容深化 TANG-CONT-C 模块二：延后修缮隐患到期（day+10）未修 → 坍塌损失
          const patrolCollapse = checkPostponedPatrol(s.postponedPatrolHazards ?? [], nextDay, Math.random);
          let collapseSilver = 0;
          let collapseRep = 0;
          let collapseScore = 0;
          for (const c of patrolCollapse.collapsed) {
            collapseSilver += c.goldDelta ?? 0;
            collapseRep += c.reputationDelta ?? 0;
            collapseScore += c.scoreDelta ?? 0;
          }
          // 污染（3.2）：insightUsedTotal 达阈值后随机标记 1-2 位（B 30 / C 20）
          guests = markContaminatedGuests(guests, s.insightUsedTotal, s.difficulty);
          // 差评师（3.4）：B 评分≥3.0 / C 评分≥2.5 时 5% 概率标记 1 位（护卫在场 -50%）
          const guardPresent = (s.employees ?? []).some((e) => e.type === 'guard' && !e.restToday);
          if (checkBadReviewer({ difficulty: s.difficulty, score: s.score }, Math.random, guardPresent)) {
            const candidates = badReviewerCandidates(guests);
            if (candidates.length > 0) {
              const target = candidates[Math.floor(Math.random() * candidates.length)]!;
              guests = guests.map((g) => (g.id === target ? { ...g, isBadReviewer: true } : g));
            }
          }
          // 事件触发（3.1）：以「新的一天」视角判定
          const pendingEvents = checkAndTriggerEvents({ ...s, day: nextDay });
          const patch: Partial<TangManagerStore> = {
            day: nextDay,
            guests,
            currentGuestIndex: 0,
            dailyEnergyConsumed: 0,
            energy: 100,
            // 内容深化 TANG-CONT-B 模块六·5 修复：通晓人心/福星高照次数每日清晨按难度重置
            // （grep 确认原 startNewDay 未重置，次数只减不增导致第二天起永久归零）
            insightRemaining: getDifficultyParams(s.difficulty).insightChances,
            luckRemaining: getDifficultyParams(s.difficulty).luckChances,
            todaySettlement: null,
            pendingEvents,
            dailyActionsRemaining: dailyActionCountFor(s.difficulty),
            afternoonActions: [],
            // 内容深化 TANG-CONT-C：午后自由行动/接待随机事件状态维护
            pendingPatrolHazards: [],
            postponedPatrolHazards: patrolCollapse.remaining,
            strollBargain: null,
            nextDayExtraGuests: 0,
            slackingEmployeeIds: [],
            shopAtmosphere: clamp((s.shopAtmosphere ?? 50) + arrivalAtmosphereDelta, 0, 100),
            xiaoerFavor: clamp(s.xiaoerFavor + arrivalXiaoerFavorDelta, 0, 100),
            ...(collapseSilver !== 0 ? { silver: Math.max(0, s.silver + collapseSilver) } : {}),
            ...(collapseRep !== 0 ? { reputation: clamp(s.reputation + collapseRep, 0, 1000) } : {}),
            ...(collapseScore !== 0 ? { score: clamp(s.score + collapseScore, 1.0, 5.0) } : {}),
            employees: (s.employees ?? []).map((e) => ({ ...e, restToday: false })),
            depositRateBoostDays: Math.max(0, (s.depositRateBoostDays ?? 0) - 1),
            // TANG-ADD-001：今日追踪重置（要务/赌约/暗标判定输入；清晨钩子随后填充）
            todayHexagram: null,
            todayTasks: [],
            todayTasksCompleted: [],
            streetNews: [],
            dialogueContexts: {},
            medicalKnowledge: 0,
            ownedMedicalBooks: [],
            todayTaskMindReadBonus: 0,
            hexagramCardOpen: false,
            activeBet: null,
            betAccepted: false,
            currentBlindAuction: null,
            blindAuctionBid: null,
            blindAuctionResolved: false,
            todayNetProfit: 0,
            todayMindReadUsed: 0,
            todaySilkSold: 0,
            todayMarketDealTriggered: false,
            todayChatUsed: 0,
            todayComplaints: 0,
            todayGuestsHandled: 0,
            todayRejectedGuests: 0,
            todayMindReadBackfired: 0,
          };
          // TANG-TRF-001：每周一（day%7===1）刷新周级要务与进度（周日打烊已结算奖励）
          if (nextDay % 7 === 1) {
            patch.weeklyTasks = generateWeeklyTasksSystem(s.score);
            patch.weeklyTaskProgress = {};
          }
          // TANG-SOC-001：每日清晨结算学艺到期（checkTrainingCompletion）
          if ((s.employees ?? []).some((e) => (e.trainingCompletionDay ?? 0) > 0 && (e.trainingCompletionDay ?? 0) <= nextDay)) {
            const trainingRes = checkTrainingCompletionSystem(s.employees ?? [], nextDay, Math.random);
            if (trainingRes.results.length > 0) {
              patch.employees = trainingRes.employees;
            }
          }
          // Step 5b-1.5：库房扩建完工（期间容量不增，完工日到后生效）
          if (s.warehouseExpansion && nextDay >= s.warehouseExpansion.completionDay) {
            const targetLevel = s.warehouseExpansion.targetLevel;
            patch.warehouseLevel = targetLevel;
            patch.maxStorage = maxStorageForLevel(targetLevel);
            patch.warehouseExpansion = null;
          }
          // Step 5b-1.5 清晨钩子：籴粜契到货 → 入库（含次品损失）
          const contractResult = checkForwardContracts({
            forwardContracts: s.forwardContracts,
            day: nextDay,
            difficulty: s.difficulty,
            employees: s.employees,
          });
          let shopItems = s.shopItems ?? [];
          if (contractResult.delivered.length > 0) {
            for (const d of contractResult.delivered) {
              // 满仓拦截：到货超限 → 旁白提示（不阻塞，取可容纳部分入库）
              const incomingVol = d.actualQuantity * (s.shopItems?.find((it) => it.id === d.contract.itemId)?.volume ?? 1);
              if (storageFullFor(shopItems, patch.maxStorage ?? s.maxStorage, incomingVol)) {
                patch.inventoryNarratives = pushNarrative(patch.inventoryNarratives, inventoryNarrative('full'));
                continue;
              }
              const item = s.shopItems?.find((it) => it.id === d.contract.itemId);
              shopItems = mergeByName(shopItems, {
                id: d.contract.itemId,
                name: d.contract.itemName,
                price: item?.price ?? d.contract.unitPrice,
                cost: item?.cost ?? d.contract.unitPrice,
                stock: d.actualQuantity,
                category: item?.category ?? '食材',
                volume: item?.volume ?? 1,
                expiry: item?.expiry ?? -1,
                status: 'normal',
              });
            }
            patch.shopItems = shopItems;
            patch.forwardContracts = contractResult.contracts;
            patch.inventoryNarratives = pushNarrative(patch.inventoryNarratives, inventoryNarrative('contractArrived'));
            patch.ledger = appendLedger(s.ledger, [
              { day: nextDay, project: '籴粜契到货', category: '经营', amount: 0 },
              ...contractResult.delivered
                .filter((d) => d.loss > 0)
                .map((d) => ({ day: nextDay, project: '籴粜契次品', category: '支出' as const, amount: -d.loss * d.contract.unitPrice })),
            ]);
          }
          // Step 5b-1.5 清晨钩子：市易务挂牌刷新（仅当日）
          patch.marketListings = generateMarketListings({ shopItems, day: nextDay });
          if ((patch.marketListings ?? []).length > 0) {
            patch.inventoryNarratives = pushNarrative(patch.inventoryNarratives, inventoryNarrative('marketListing'));
          }
          // Step 5b-1.5 清晨钩子：加工出库
          const processingResult = checkProcessingQueue({ processingQueue: s.processingQueue, day: nextDay }, shopItems);
          if (processingResult.completed.length > 0) {
            for (const c of processingResult.completed) {
              if (storageFullFor(shopItems, patch.maxStorage ?? s.maxStorage, c.outputItem.stock * (c.outputItem.volume ?? 1))) {
                patch.inventoryNarratives = pushNarrative(patch.inventoryNarratives, inventoryNarrative('full'));
                continue;
              }
              shopItems = mergeByName(shopItems, c.outputItem);
            }
            patch.shopItems = shopItems;
            patch.processingQueue = processingResult.remainingJobs;
            patch.inventoryNarratives = pushNarrative(patch.inventoryNarratives, inventoryNarrative('processingDone'));
          }
          // Step 5b-1.5：库存事件（邻居借粮/官府征用/乞丐讨食/窃贼光顾）
          const invEvents = checkInventoryEvents({ shopItems });
          if (invEvents.length > 0) {
            patch.pendingEvents = [...(patch.pendingEvents ?? []), ...invEvents];
          }
          // Step 5b：月初钩子（先跑，patch.silver 以月初结果为准；Step 5b-2 到货在其上叠加）
          if (nextDay % 30 === 1) {
            const monthStart = buildMonthStartPatch(s);
            Object.assign(patch, monthStart.patch);
            if (monthStart.extraPending.length > 0) {
              patch.pendingEvents = [...(patch.pendingEvents ?? []), ...monthStart.extraPending];
            }
          }
          // Step 5b-5：月初政令（generateImperialDecree；持续 30 天；同月只持一条由系统保证）
          if (nextDay % 30 === 1) {
            const decree = generateImperialDecree({ day: nextDay, decrees: s.decrees ?? [] });
            if (decree) {
              patch.decrees = [...(s.decrees ?? []), decree];
              patch.eventLog = [...(patch.eventLog ?? s.eventLog), `decree:${decree.type}:${nextDay}`];
            }
          }
          // Step 5b-5：镖队每日推进（在途事件 / 到达结算 / 返程归店）
          const caravanDaily = checkCaravanDailySystem({
            day: nextDay,
            caravans: s.caravans ?? [],
            trade: buildTradeContext({ ...s, day: nextDay }),
          });
          if (caravanDaily.events.length > 0 || caravanDaily.silverDelta !== 0) {
            patch.caravans = caravanDaily.caravans;
            patch.silver = Math.max(0, (patch.silver ?? s.silver) + caravanDaily.silverDelta);
            patch.gold = patch.silver;
            patch.eventLog = [...(patch.eventLog ?? s.eventLog), `caravan-daily:${nextDay}`];
          }
          // Step 5b-2 清晨钩子：点位物价微调（每日 ±5%）
          const nextModifiers = updateNodePriceModifiers(s.nodePriceModifiers, nextDay);
          patch.nodePriceModifiers = nextModifiers;
          // TANG-MIST-003 M3 · 2.1：每日清晨节点繁荣度结算（昨日交易 + 事件 + 季节）
          const prosperityRes = updateNodeProsperity({
            day: nextDay,
            nodeProsperity: s.nodeProsperity ?? {},
            tradedNodeIds: s.todayTradedNodes ?? [],
            mapEvents: (s.mapEvents ?? []).filter((e) => e.status === 'active'),
          });
          patch.nodeProsperity = prosperityRes.nodeProsperity;
          patch.todayTradedNodes = [];
          // TANG-MIST-003 M3 · 2.4：标记节点新动态提示（新事件 / 物价波动 >5%）
          const markerNotices = buildMarkerNotices({
            markers: s.playerMarkers ?? [],
            activeEvents: (s.mapEvents ?? []).filter((e) => e.status === 'active'),
            prevModifiers: s.nodePriceModifiers ?? {},
            nextModifiers,
            day: nextDay,
          });
          if (markerNotices.length > 0) {
            patch.mapMarkerNotices = [...(s.mapMarkerNotices ?? []), ...markerNotices].slice(-6);
          }
          // Step 5b-2 清晨钩子：跑商到货结算（到达日 ≤ 今日；售得入账 / 被劫损失）
          const arrivalsCtx: TradeContext = {
            day: nextDay,
            silver: patch.silver ?? s.silver,
            nodePriceModifiers: s.nodePriceModifiers ?? {},
            greenChannels: s.greenChannels ?? [],
            transportingGoods: s.transportingGoods ?? [],
            employees: s.employees,
            shenTinglanFavor: s.shenTinglanFavor,
            xieQiFavor: s.xieQiFavor,
            reputation: s.reputation,
            shopItems: s.shopItems,
            mapEvents: s.mapEvents,
          };
          const arrivals = checkTransportArrivalsSystem(arrivalsCtx);
          if (arrivals.length > 0) {
            let arrivalSilverDelta = 0;
            const arrivalLedger: LedgerEntry[] = [];
            const arrivedIds = new Set(arrivals.map((r) => r.goodsId));
            for (const r of arrivals) {
              arrivalSilverDelta += r.gross;
              arrivalLedger.push({
                day: nextDay,
                project: r.status === 'arrived' ? `跑商售货·${r.itemCategory}` : `跑商被劫·${r.itemCategory}`,
                category: r.status === 'arrived' ? '经营' : '支出',
                amount: r.status === 'arrived' ? r.gross : -r.robbedLoss,
              });
            }
            patch.silver = Math.max(0, (patch.silver ?? s.silver) + arrivalSilverDelta);
            patch.gold = patch.silver;
            patch.ledger = appendLedger(patch.ledger ?? s.ledger, arrivalLedger);
            patch.transportingGoods = (s.transportingGoods ?? []).map((g) =>
              arrivedIds.has(g.id)
                ? {
                    ...g,
                    status: (arrivals.find((r) => r.goodsId === g.id)?.status ?? 'arrived') as 'arrived' | 'robbed',
                  }
                : g
            );
          }
          // Step 5b-2 清晨钩子：地图事件生成（已解锁层随机 1-2 个；同模板去重）
          const activeTemplates = new Set(
            (s.mapEvents ?? []).filter((e) => e.status === 'active').map((e) => e.id.replace(/-\d+$/, ''))
          );
          const freshEvents = generateMapEvents({
            day: nextDay,
            unlockedLayers: s.unlockedLayers,
            activeEventIds: [...activeTemplates],
          });
          if (freshEvents.length > 0) {
            patch.mapEvents = [...(s.mapEvents ?? []), ...freshEvents];
          }
          // 内容深化 TANG-CONT-C：进场事件/坍塌损失叙事入 eventLog（可读文本；日前缀防去重误伤）
          if (arrivalType !== 'none' || patrolCollapse.collapsed.length > 0) {
            const extras: string[] = [];
            if (arrivalType !== 'none') extras.push(`[第${nextDay}日] ${arrivalRes.narrative}`);
            for (const c of patrolCollapse.collapsed) extras.push(`[第${nextDay}日] ${c.narrative}`);
            patch.eventLog = [...(patch.eventLog ?? s.eventLog), ...extras];
          }
          return patch;
        });
        // ---- TANG-ADD-001 清晨钩子（在 day 推进与重置后依次执行；各钩子自带 set）----
        get().drawDailyHexagram();
        get().generateDailyTasks();
        get().generateStreetNews();
        get().triggerLegacyQuest();
        get().checkBiographies();
        if (get().day % 30 === 1) {
          get().checkBlindAuction();
        }
        get().checkBetOffer();
        // E 消息代办（2026-08-05）：按清晨状态生成 NPC 待办消息
        {
          const cur = get();
          const mk = (id: string, from: string, content: string): GameMessage => ({ id, from, type: 'errand', content, createdDay: cur.day });
          const msgs: GameMessage[] = [];
          if (cur.activeBet && !cur.betAccepted) msgs.push(mk('msg-bet-' + cur.day, '谢七', '谢七又来了，揣着骰子笑嘻嘻地等你下注——去西市赌坊看看？'));
          if (cur.currentBlindAuction && !cur.blindAuctionResolved) msgs.push(mk('msg-auction-' + cur.day, '账房', '市易务暗标今日开标，别忘了去瞧瞧。'));
          if (msgs.length > 0) set({ messages: [...(cur.messages ?? []), ...msgs].slice(-20) });
        }
        // TANG-TRF-001：每日清晨检查逾期预购（违约惩罚分级 + 解除预留）
        get().checkOverdueOrders();
        // v1.0 功能解锁（TANG-POLISH-001 模块二）：每日清晨检查一次
        get().checkFeatureUnlock();
        // 店员互动提升（模块四/五）：每日清晨随机员工问候 + 清晨阶段提醒
        get().generateReminders('morning', buildReminderContext(get(), 'morning'));
        // 店铺特色产业系统（模块五）：产业每日结算（研发到期/宴席举办/郎中问诊/织工补货）
        get().industryTick(get().day);
        // 地图与事件深化（模块七）：每日检查到期连锁事件（弹窗展示）
        set({ settlementPopupOpen: false }); // 次日清晨关闭结算弹窗
        get().checkPendingConsequences();
        // 行为/区域事件接入（模块四 4.1 / 模块三）：库房无陈损累计 + 行为触发 + 区域事件
        {
          const cur = get();
          const hasExpiry = (cur.shopItems ?? []).some((it) => (it.expiry ?? -1) >= 0 && (it.expiry ?? -1) <= 2);
          set({ noExpiryStreak: hasExpiry ? 0 : (cur.noExpiryStreak ?? 0) + 1 });
        }
        get().checkBehaviorEvents(get().day);
        get().maybeRegionEvent(get().day);
        // P1-2026-08-05：派系党争接线（已选政治派系时每 30 天触发一次）
        {
          const cur = get();
          if ((cur.politicalFaction ?? null) && (cur.day % 30 === 0)) {
            get().runFactionPowerStruggle();
          }
        }
        // P1-2026-08-05：月度政令接线（每月初生成 Decree；巍明楼政令横幅已动态渲染）
        if (get().day % 30 === 1) {
          get().generateDecree();
        }
        // P1-2026-08-05：转政最小闭环——官场线每日派发政务
        {
          const cur = get();
          if (cur.phase === 'politics' && !cur.politicsDone && !cur.currentPoliticsDecision) {
            set({ currentPoliticsDecision: POLITICS_DECISIONS[cur.politicsStep ?? 0] ?? null });
          }
        }
        set({
          dailyStaffGreeting: pickStaffGreeting({
            employees: get().employees ?? [],
            xiaoerSatisfaction: get().xiaoerSatisfaction,
            hexagram: get().todayHexagram?.id ?? null,
          }),
        });
      },

      /** 接待当前客人（未处理才处理）；返回本单结果供 UI 展示，无法处理返回 null。
       *  TANG-RCP-001 7.1：流程扩展为 详情→操作→偏好匹配→气氛→传染→留言簿→耐心→结果+叙事，
       *  统一由 buildReceptionPatch 接线（纯函数可测部分在 systems/）。
       *  TANG-TRF-001 接线：
       *  - 大单预购：normal 接待大单客时 20% 变预购（与现货互斥），势力特殊事件（沈听澜/谢七/势力）触发；
       *  - 接待策略：delegate 全托伙计（收益 ×0.7~0.8 无精力不走偏好匹配）/ priority 择要接待
       *    （大单/特殊亲接，其余指派）。 */
      handleCurrentGuest: (method: HandleMethod, rng: () => number = Math.random): HandleGuestResult | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const guest = s.guests[s.currentGuestIndex];
        if (!guest || guest.handled) {
          return null;
        }
        if (method === 'mind_read' && s.insightRemaining <= 0) {
          return null;
        }

        // TANG-TRF-001 大单预购触发（大单 20% 与现货互斥；势力特殊事件；最多 5 个进行中）
        // TANG-TRF-002：rng 可选注入（测试固定序列，避免 20% 预购分支 flaky）
        if (method === 'normal') {
          const factionRelationships = Object.fromEntries(
            (s.factions ?? []).map((f) => [f.id, f.relationship])
          );
          const preorder = checkPreOrderTriggerSystem(
            guest,
            {
              shopType: s.shopType ?? 'jiulou',
              day: s.day,
              preOrders: s.preOrders ?? [],
              shopItems: s.shopItems ?? [],
              factionRelationships,
            },
            rng
          );
          if (preorder) {
            // 大客下订预购 → 本单不再现货消费（互斥）；客人标记已处理、收入 0
            const offerPatch = buildReceptionPatch(
              s,
              {
                guestId: guest.id,
                income: 0,
                energyConsumed: 0,
                review: 'good',
                handledNote: `大客下订预购「${preorder.items.map((it) => it.itemName).join('、')}」`,
              },
              rng
            );
            set({
              ...offerPatch,
              preOrders: [...(s.preOrders ?? []), preorder],
            });
            // 周级要务：本周接待大单 +1（预购形态同样计入）
            if (guest.type === 'big_order') {
              set({ weeklyTaskProgress: addWeeklyProgressSystem(s.weeklyTaskProgress, 'week-big-orders', 1) });
            }
            return {
              guestId: guest.id,
              income: 0,
              energyConsumed: 0,
              reputationChange: 0,
              scoreChange: 0,
              mentalOS: null,
              usedMindRead: false,
              review: 'good',
            };
          }
        }

        // TANG-TRF-001 接待策略（delegate/priority → 伙计代劳；无精力消耗、不走偏好匹配）
        const strategy = s.receptionStrategy ?? 'all';
        const strat = applyReceptionStrategy(guest, strategy, rng);
        if (strat.mode === 'delegated') {
          const delegatedResult: HandleGuestResult = {
            guestId: guest.id,
            income: strat.delegatedIncome ?? 0,
            energyConsumed: 0,
            reputationChange: 0,
            scoreChange: 0,
            mentalOS: null,
            usedMindRead: false,
            review: 'good',
          };
          const delegatedPatch = buildReceptionPatch(
            s,
            {
              guestId: guest.id,
              income: delegatedResult.income,
              energyConsumed: 0,
              review: 'good',
              handledNote: `伙计代劳，入账 ${delegatedResult.income} 两`,
            },
            rng
          );
          set(delegatedPatch);
          if (guest.type === 'big_order') {
            set({ weeklyTaskProgress: addWeeklyProgressSystem(s.weeklyTaskProgress, 'week-big-orders', 1) });
          }
          return delegatedResult;
        }

        // Step 5b-1.5：库存联动（缺货/品类充足/连续缺货）
        const stockInfo = computeStockInfo(s.shopItems, s.shopType, guest, s.missingGoodStreak ?? 0);
        const result = handleGuest(guest, method, {
          insightRemaining: s.insightRemaining,
          difficulty: s.difficulty,
          insightUsedOnNPC: s.insightUsedOnNPC[guest.name] ?? 0,
          insightUsedTotal: s.insightUsedTotal,
          stockInfo,
          // TANG-ADD-001 先祖之眼：反噬阈值翻倍
          ...(s.ancestralEyeActive ? { backlashThresholdOverride: BACKLASH_THRESHOLD[s.difficulty] * 2 } : {}),
        }, rng);
        if (!result) {
          return null;
        }

        const praiseTriggered = !result.usedMindRead && result.reputationChange > 0;
        // TANG-ADD-001 占候接线（接待）：艮卦 阻滞 → 排队耐心衰减 ×2
        const hexPatience = applyHexagramEffect(s.todayHexagram, { patienceDecay: 30 });
        const patch = buildReceptionPatch(
          s,
          {
            guestId: guest.id,
            income: result.income,
            energyConsumed: result.energyConsumed,
            review: result.review,
            reputationChange: result.reputationChange,
            scoreChange: result.scoreChange,
            mentalOS: result.mentalOS,
            usedMindRead: result.usedMindRead,
            backlashTriggered: result.backlashTriggered ?? false,
            praiseTriggered,
            complaintTriggered: result.complaintTriggered ?? false,
            patienceDecay: hexPatience.patienceDecay ?? 30,
            handledNote:
              result.review === 'good'
                ? result.complaintTriggered
                  ? '接待生怨，投诉'
                  : `接待入账 ${result.income} 两`
                : '婉拒来客',
          },
          rng
        );
        set(patch);
        // TANG-ADD-001 今日追踪：通晓人心次数 / 反噬 / 投诉 / 布庄丝绸销量（要务/赌约判定输入）
        const trackPatch: Partial<TangManagerStore> = {};
        if (result.usedMindRead) {
          trackPatch.todayMindReadUsed = (s.todayMindReadUsed ?? 0) + 1;
          trackPatch.lastMindReadDay = s.day; // 行为触发「能力生疏」追踪
          if (result.backlashTriggered) {
            trackPatch.todayMindReadBackfired = (s.todayMindReadBackfired ?? 0) + 1;
          }
        }
        if (result.complaintTriggered) {
          trackPatch.todayComplaints = (s.todayComplaints ?? 0) + 1;
        }
        if ((s.shopType ?? 'jiulou') === 'buzhuang' && result.review === 'good') {
          trackPatch.todaySilkSold = (s.todaySilkSold ?? 0) + 1;
        }
        if (Object.keys(trackPatch).length > 0) {
          set(trackPatch);
        }
        // TANG-TRF-001 周级要务：本周接待大单 +1（现货接待形态）
        if (guest.type === 'big_order') {
          set({ weeklyTaskProgress: addWeeklyProgressSystem(s.weeklyTaskProgress, 'week-big-orders', 1) });
        }
        return result;
      },

      // ============================================================
      // TANG-RCP-001：接待深度升级 actions（六操作 + 留言簿 + 气氛）
      // ============================================================

      /** 揭示客人偏好（通晓人心前置：不处理客人，便于按偏好推荐/闲聊；消耗 1 次 + 精力-5） */
      revealGuestPreference: (guestId: string): RevealPreferenceResult | null => {
        const s = get();
        if (s.phase !== 'playing' || s.insightRemaining <= 0) {
          return null;
        }
        const guest = s.guests.find((g) => g.id === guestId);
        if (!guest || guest.handled) {
          return null;
        }
        const result = revealPreference(guest, 'mind_read', Math.random);
        if (!result.revealed) {
          return result; // 偏好已全揭示，不消耗
        }
        set((st) => ({
          guests: st.guests.map((g) => (g.id === guestId ? result.guest : g)),
          insightRemaining: st.insightRemaining - 1,
          insightUsedTotal: st.insightUsedTotal + 1,
          insightUsedOnNPC: { ...st.insightUsedOnNPC, [guest.name]: (st.insightUsedOnNPC[guest.name] ?? 0) + 1 },
          energy: clamp(st.energy - 5, 0, 100),
          dailyEnergyConsumed: st.dailyEnergyConsumed + 5,
          // TANG-ADD-001 今日追踪：通晓人心使用次数（要务判定输入）
          todayMindReadUsed: (st.todayMindReadUsed ?? 0) + 1,
          // TANG-TRF-001 周级要务：本周通晓人心 +1
          weeklyTaskProgress: addWeeklyProgressSystem(st.weeklyTaskProgress, 'week-mind-read', 1),
        }));
        return result;
      },

      /** 推荐库房商品（命中偏好 消费×1.5+满意+15 / 未命中 ×0.7-10；精力-5；本单即接待完成） */
      recommendItem: (guestId: string, itemId: string): RecommendResult | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const guest = s.guests.find((g) => g.id === guestId);
        if (!guest || guest.handled) {
          return null;
        }
        const result = recommendItemSystem(guest, itemId, { shopItems: s.shopItems }, Math.random);
        if (!result.ok) {
          return result;
        }
        set(
          buildReceptionPatch(
            s,
            {
              guestId,
              income: result.income,
              energyConsumed: result.energyConsumed,
              review: 'good',
              satisfactionDelta: result.satisfactionDelta,
              praiseTriggered: result.matched === true,
              handledNote: result.handledNote,
            },
            Math.random
          )
        );
        return result;
      },

      /** 闲聊（情报/NPC传言/进货渠道/偏好揭示/纯聊天；精力-5；本单即接待完成） */
      chatWithGuest: (guestId: string): ChatResult | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const guest = s.guests.find((g) => g.id === guestId);
        if (!guest || guest.handled) {
          return null;
        }
        const result = chatWithGuestSystem(guest, { shopType: s.shopType ?? 'jiulou' }, Math.random);
        set(
          buildReceptionPatch(
            s,
            {
              guestId,
              income: result.income,
              energyConsumed: result.energyConsumed,
              review: 'good',
              reputationChange: result.reputationChange,
              satisfactionDelta: result.satisfactionDelta,
              preferenceGuest: result.updatedGuest,
              handledNote: result.handledNote,
            },
            Math.random
          )
        );
        // Step 5b-5：蛛丝马迹轻量接线——闲聊情报线索（40%）/ NPC传言（25%）→ generateClue
        const info = result.info;
        if (info && (info.kind === 'intel' || info.kind === 'rumor')) {
          const clue = generateClueSystem(
            guest.name,
            info.kind === 'intel' ? ('guest' as const) : ('rumor' as const),
            info.kind === 'intel' ? ('business' as const) : ('secret' as const),
            { day: s.day, clues: s.clues ?? [] }
          );
          if (clue) {
            get().addClue(clue);
          }
        }
        // TANG-ADD-001 今日追踪：闲聊次数（要务「闲话一席」判定输入）
        set({ todayChatUsed: (s.todayChatUsed ?? 0) + 1 });
        return result;
      },

      /** 赠礼（消耗库房商品；好感+20 递减；下次消费×1.5；精力-3；本单即接待完成） */
      giveGift: (guestId: string, itemId: string): GiftResult | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const guest = s.guests.find((g) => g.id === guestId);
        if (!guest || guest.handled) {
          return null;
        }
        const result = giveGiftSystem(guest, itemId, { shopItems: s.shopItems });
        if (!result.ok) {
          return result;
        }
        set(
          buildReceptionPatch(
            s,
            {
              guestId,
              income: result.income,
              energyConsumed: result.energyConsumed,
              review: 'good',
              favorDelta: result.favorDelta,
              giftGiven: true,
              consumesItem: result.consumedItemId ? { itemId: result.consumedItemId } : undefined,
              nextConsumptionMultiplier: result.nextConsumptionMultiplier,
              handledNote: result.handledNote,
            },
            Math.random
          )
        );
        return result;
      },

      /** 婉拒四法（redirect 引荐 / excuse 托辞 / delegate 转交阿昭 / refuse 原逻辑拒绝；本单即接待完成） */
      rejectPolitely: (guestId: string, method: PoliteRejectMethod): PoliteRejectResult | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const guest = s.guests.find((g) => g.id === guestId);
        if (!guest || guest.handled) {
          return null;
        }
        const result = rejectPolitelySystem(guest, method, Math.random);
        set(
          buildReceptionPatch(
            s,
            {
              guestId,
              income: result.income,
              energyConsumed: result.energyConsumed,
              review: result.review,
              reputationChange: result.reputationChange,
              scoreChange: result.scoreChange,
              xiaoerSatisfactionChange: result.xiaoerSatisfactionChange,
              handledNote: result.handledNote,
            },
            Math.random
          )
        );
        return result;
      },

      /** 拼桌并单（同类型+耐心>50；一次接待两人、每人消费 8 折、精力×1.5；双命中偏好 +10 气氛） */
      mergeGuests: (guestAId: string, guestBId: string): MergeResult | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const a = s.guests.find((g) => g.id === guestAId);
        const b = s.guests.find((g) => g.id === guestBId);
        if (!a || !b || a.handled || b.handled) {
          return null;
        }
        const result = mergeGuestsSystem(a, b);
        if (!result.ok) {
          return result;
        }
        const patch = buildReceptionPatch(
          s,
          {
            guestId: a.id,
            income: result.income,
            energyConsumed: result.energyConsumed,
            review: 'good',
            forceAtmosphere: result.atmosphereBonus,
            handledNote: `拼桌并单，入账 ${result.income} 两`,
          },
          Math.random
        );
        // 拼桌同时处理 B（收入已并入 A；B 记 0 避免双重计入）
        patch.guests = (patch.guests ?? s.guests).map((g) =>
          g.id === b.id ? { ...g, handled: true, incomeEarned: 0, review: 'good' as const, handledNote: '拼桌并单' } : g
        );
        set(patch);
        return result;
      },

      /** 气氛增减（clamp 0-100；UI「解决投诉」等调用） */
      updateAtmosphere: (amount: number): void => {
        set((s) => ({ shopAtmosphere: clamp((s.shopAtmosphere ?? 50) + amount, 0, 100) }));
      },

      /** 追加宾客留言簿条目（防重复：同客同日同类型只记一条） */
      addGuestBookEntry: (entry: GuestBookEntry): void => {
        set((s) => {
          const book = s.guestBook ?? [];
          const dup = book.some((e) => e.guestName === entry.guestName && e.day === entry.day && e.type === entry.type);
          if (dup) {
            return {};
          }
          return { guestBook: [...book, entry] };
        });
        // 天机阁 AI 接线（v1.1 模块五 5.1：客人评价 AI 优先，模板兜底；best-effort 不阻塞）
        if (entry.type === 'praise') {
          void (async () => {
            const res = await generateAiGuestReview(entry.guestName, entry.content, { onLog: (e) => get().recordAiLog(e) });
            if (res.source === 'ai' && res.text) {
              const cur = get();
              set({ guestBook: (cur.guestBook ?? []).map((e) => (e.guestName === entry.guestName && e.day === entry.day && e.type === 'praise' ? { ...e, content: res.text } : e)) });
            }
          })();
        }
      },

      // ============================================================
      // TANG-SOC-001：排班 / 交情 / 学艺 / 名声门路
      // ============================================================

      /** 排班（轮值）：assignShift 纯函数 + 应用；冲突（学艺中）拒绝；返回更新后的员工或 null */
      assignShift: (employeeId: string, shift: EmployeeShift): Employee | null => {
        const s = get();
        const target = (s.employees ?? []).find((e) => e.id === employeeId);
        if (!target) return null;
        const res = assignShiftSystem(target, shift, s.day);
        if (!res) return null;
        const employees = (s.employees ?? []).map((e) => (e.id === employeeId ? res.employee : e));
        set({ employees });
        get().showTutorial('FIRST_SCHEDULE');
        return res.employee;
      },

      /** 自动排班（suggestOptimalSchedule 结果应用到 employees） */
      autoSchedule: (): Employee[] => {
        const s = get();
        const suggestions = suggestOptimalSchedule(s.employees ?? [], s.day);
        const applied = applyScheduleSuggestions(s.employees ?? [], suggestions, s.day);
        set({ employees: applied.employees });
        return applied.employees;
      },

      /** 送伙计学艺（sendForTraining；扣束脩、置 trainingCompletionDay；学艺中不可排班） */
      sendForTraining: (employeeId: string, skillId: string): TrainingResult | null => {
        const s = get();
        const result = sendForTrainingSystem(employeeId, skillId, s.employees ?? [], s.silver, s.day, Math.random);
        if (!result) return null;
        if (!result.ok || !result.completionDay) {
          return result;
        }
        const employees = (s.employees ?? []).map((e) =>
          e.id === employeeId
            ? { ...e, trainingCompletionDay: result.completionDay, trainedSkillIds: [...(e.trainedSkillIds ?? []), skillId] }
            : e
        );
        set((st) =>
          syncCompat(st, {
            employees,
            silver: Math.max(0, st.silver - result.cost),
            ledger: appendLedger(st.ledger, [{ day: st.day, project: `束脩·学艺`, category: '支出' as const, amount: -result.cost }]),
            eventLog: [...st.eventLog, `training:${employeeId}:${skillId}:${st.day}`],
          })
        );
        return result;
      },

      /** 拜师（findMaster：需地图区域解锁、费 200+、周期 2-4 天、成功率 95%、10% 隐藏绝技） */
      findMaster: (skillType: EmployeeSkillType): MasterResult | null => {
        const s = get();
        const result = findMasterSystem(skillType, s.unlockedLayers ?? [], s.shopType, Math.random);
        if (!result.ok) {
          return result;
        }
        // 拜师为「授业」：选满意度最高且未学艺的员工送去（轻量接线，注释：师傅随行授业）
        const candidate = (s.employees ?? [])
          .filter((e) => !((e.trainingCompletionDay ?? 0) > s.day))
          .sort((a, b) => b.satisfaction - a.satisfaction)[0];
        if (!candidate) {
          return { ...result, ok: false, reason: '店内无伙计可送学' };
        }
        const employees = (s.employees ?? []).map((e) =>
          e.id === candidate.id
            ? {
                ...e,
                trainingCompletionDay: s.day + result.durationDays,
                trainedSkillIds: [...(e.trainedSkillIds ?? []), result.hiddenMasterpiece?.name ?? skillType],
              }
            : e
        );
        set((st) =>
          syncCompat(st, {
            employees,
            silver: Math.max(0, st.silver - result.cost),
            ledger: appendLedger(st.ledger, [{ day: st.day, project: `束脩·授业`, category: '支出' as const, amount: -result.cost }]),
            eventLog: [...st.eventLog, `master:${skillType}:${st.day}`],
          })
        );
        return result;
      },

      /** 每日清晨结算学艺到期（checkTrainingCompletion；学成/失败列表） */
      checkTrainingCompletion: (): TrainingCompletionResult[] => {
        const s = get();
        const res = checkTrainingCompletionSystem(s.employees ?? [], s.day, Math.random);
        if (res.results.length > 0) {
          set({ employees: res.employees });
        }
        return res.results;
      },

      /** 每日打烊演化内部交情（evolveRelations；和睦/竞争/矛盾增减） */
      evolveRelations: (): RelationshipEvent[] => {
        const s = get();
        const res = evolveRelations(s.employees ?? [], {}, Math.random);
        set({
          employees: res.employees,
          employeeRelations: flattenRelations(res.employees),
        });
        return res.events;
      },

      /** 确立师徒关系（establishMentorship；mentor 技能≥3、apprentice≤2） */
      establishMentorship: (mentorId: string, apprenticeId: string): boolean => {
        const s = get();
        const res = establishMentorshipSystem(mentorId, apprenticeId, s.employees ?? []);
        if (!res.ok) return false;
        set({
          employees: res.employees,
          employeeRelations: flattenRelations(res.employees),
          eventLog: [...s.eventLog, `mentor:${mentorId}:${apprenticeId}:${s.day}`],
        });
        return true;
      },

      /** 更新势力关系（updateFactionRelationship；clamp 0-100、记录原因、跨阈值提示解锁） */
      updateFactionRelationship: (factionId: string, delta: number, reason: string): FactionUpdateResult | null => {
        const s = get();
        const res = updateFactionRelationshipSystem(s.factions ?? [], factionId, delta, reason);
        if (!res.result) return null;
        // NPC 好感联动（5.3）：势力变动同向联动 NPC favor
        const npcSync = syncNpcFavor(
          s.npcFavors ?? [],
          factionId,
          res.result.delta,
          {
            shenTinglanFavor: s.shenTinglanFavor,
            xieQiFavor: s.xieQiFavor,
            fuyinFavor: s.fuyinFavor ?? 20,
            zhaoYuanwaiFavor: s.zhaoYuanwaiFavor ?? 10,
          }
        );
        set((st) => ({
          factions: res.factions,
          npcFavors: npcSync.npcFavors,
          shenTinglanFavor: npcSync.favors.shenTinglanFavor,
          xieQiFavor: npcSync.favors.xieQiFavor,
          fuyinFavor: npcSync.favors.fuyinFavor,
          zhaoYuanwaiFavor: npcSync.favors.zhaoYuanwaiFavor,
          eventLog: [...st.eventLog, `faction:${factionId}:${reason}:${st.day}`],
        }));
        return res.result;
      },

      /** 获取势力已解锁特权（getFactionPerks） */
      getFactionPerks: (factionId: string): FactionPerk[] => {
        const s = get();
        const faction = (s.factions ?? []).find((f) => f.id === factionId);
        return faction ? getFactionPerksSystem(faction) : [];
      },

      /** 打开/关闭名声关系网 overlay（门路第 9 项） */
      setFactionPanelOpen: (open: boolean): void => {
        set({ factionPanelOpen: open });
      },

      // ============================================================
      // Step 5b-5：叙事与后期系统 actions（手札录 / 蛛丝马迹 / 巍明楼 / 镖队 / 多结局）
      // ============================================================

      /** 追加手札条目（上限 200 条，超出裁掉最旧；recordX 纯函数生成后写入） */
      addJournalEntry: (entry: JournalEntry): void => {
        set((s) => ({ journal: [...(s.journal ?? []), entry].slice(-200) }));
      },

      /** 追加线索（防重复按 id；generateClue 纯函数生成后写入） */
      addClue: (clue: Clue): void => {
        set((s) => {
          if ((s.clues ?? []).some((c) => c.id === clue.id)) return {};
          return { clues: [...(s.clues ?? []), clue] };
        });
      },

      /** 手动连接两条线索（互写 connected；防重复） */
      connectClues: (clueIdA: string, clueIdB: string): void => {
        const s = get();
        const res = pairwiseConnect(s.clues ?? [], clueIdA, clueIdB);
        if (res.connected) {
          set({ clues: res.clues });
        }
      },

      /** 解析线索（置 resolved=true） */
      resolveClue: (clueId: string): void => {
        const s = get();
        const res = resolveClueSystem(s.clues ?? [], clueId);
        if (res.changed) {
          set({ clues: res.clues });
        }
      },

      /** 每月初生成 1 条政令（generateImperialDecree；返回新政令或 null） */
      generateDecree: (): Decree | null => {
        const s = get();
        if (s.day % 30 !== 1) return null;
        const decree = generateImperialDecree({ day: s.day, decrees: s.decrees ?? [] });
        if (decree) {
          set((st) => ({
            decrees: [...(st.decrees ?? []), decree],
            eventLog: [...st.eventLog, `decree:${decree.type}:${s.day}`],
          }));
        }
        return decree;
      },

      /** 支持派系（alignWithFaction；+20 对立 -10 + 三子派特殊效果；站队即视为加入朝廷） */
      alignWithFaction: (factionId: string): AlignResult | null => {
        const s = get();
        const res = alignWithFactionSystem(factionId, {
          politicalFaction: s.politicalFaction ?? null,
          politicalAlignment: s.politicalAlignment ?? 0,
          reputation: s.reputation,
        });
        if (!res.ok) return res;
        set((st) =>
          syncCompat(st, {
            politicalFaction: res.politicalFaction,
            politicalAlignment: res.politicalAlignment,
            reputation: clamp(st.reputation + res.reputationDelta, 0, 1000),
            joinedCourt: true,
            eventLog: [...st.eventLog, `court-align:${factionId}:${st.day}`],
          })
        );
        return res;
      },

      /** 组建镖队（createCaravan + setupCaravanRoute） */
      setupCaravan: (input: { name: string; leader: string; members: string[]; guards: number; from: string; to: string }): boolean => {
        const s = get();
        if (s.phase !== 'playing') return false;
        const fresh = createCaravan(
          { name: input.name, leader: input.leader, members: input.members, guards: input.guards },
          s.day
        );
        const res = setupCaravanRouteSystem(fresh, input.from, input.to, {
          day: s.day,
          caravans: s.caravans ?? [],
          trade: buildTradeContext(s),
        });
        if (!res.ok || !res.caravan) return false;
        set((st) => ({ caravans: [...(st.caravans ?? []), res.caravan!] }));
        return true;
      },

      /** 设定镖队路线（返回是否成功） */
      setupCaravanRoute: (caravanId: string, from: string, to: string): boolean => {
        const s = get();
        const c = (s.caravans ?? []).find((x) => x.id === caravanId);
        if (!c) return false;
        const res = setupCaravanRouteSystem(c, from, to, {
          day: s.day,
          caravans: s.caravans ?? [],
          trade: buildTradeContext(s),
        });
        if (!res.ok || !res.caravan) return false;
        set((st) => ({
          caravans: (st.caravans ?? []).map((x) => (x.id === caravanId ? res.caravan! : x)),
        }));
        return true;
      },

      /** 装货发车（loadCaravan；库房减、镖队增、置 in_transit） */
      loadCaravan: (caravanId: string, goods: CaravanGoods[]): boolean => {
        const s = get();
        const c = (s.caravans ?? []).find((x) => x.id === caravanId);
        if (!c) return false;
        const res = loadCaravanSystem(c, goods, {
          day: s.day,
          caravans: s.caravans ?? [],
          trade: buildTradeContext(s),
        });
        if (!res.ok || !res.caravan) return false;
        // 库房减货（按名；库存不足则扣至 0）
        let shopItems = s.shopItems;
        for (const d of res.shopItems ?? []) {
          shopItems = shopItems.map((it) =>
            it.name === d.itemName
              ? {
                  ...it,
                  stock: Math.max(0, (it.stock ?? 0) - d.quantity),
                  status: (it.stock ?? 0) - d.quantity <= 0 ? ('out_of_stock' as const) : it.status,
                }
              : it
          );
        }
        set((st) => ({
          caravans: (st.caravans ?? []).map((x) => (x.id === caravanId ? res.caravan! : x)),
          shopItems,
          eventLog: [...st.eventLog, `caravan-load:${caravanId}:${st.day}`],
        }));
        // TANG-MIST-003 M3 · 2.1：镖队出发点记今日交易（次日清晨繁荣度 +1~3）
        if (c.route) get().noteNodeTrade(c.route.from);
        return true;
      },

      /** 每日推进在途镖队（checkCaravanDaily；startNewDay 内部调用，对外暴露便于测试） */
      checkCaravanDaily: (): void => {
        const s = get();
        const res = checkCaravanDailySystem({
          day: s.day,
          caravans: s.caravans ?? [],
          trade: buildTradeContext(s),
        });
        if (res.events.length > 0 || res.silverDelta !== 0) {
          set((st) =>
            syncCompat(st, {
              caravans: res.caravans,
              silver: Math.max(0, st.silver + res.silverDelta),
            })
          );
        }
        // TANG-MIST-003 M3 · 2.1：镖队到达目的地记今日交易（次日清晨繁荣度 +1~3）
        for (const ev of res.events) {
          if (!ev.arrival) continue;
          const arrived = res.caravans.find((x) => x.id === ev.caravanId);
          if (arrived?.route) get().noteNodeTrade(arrived.route.to);
        }
      },

      /** 每日打烊检测结局（checkEndingConditions 纯函数；命中即 triggerEnding） */
      checkEndingConditions: (): string | null => {
        const s = get();
        const hit = checkEndingConditionsSystem({
          shopCount: s.shopCount ?? 1,
          silver: s.silver,
          reputation: s.reputation,
          score: s.score,
          day: s.day,
          legacyDebt: s.legacyDebt ?? 0,
          credit: s.credit ?? 0,
          courtCooperation: s.courtCooperation ?? false,
          imperialBidCount: s.imperialBidCount ?? 0,
          soldShops: s.soldShops ?? false,
          apprenticeOpenedShop: s.apprenticeOpenedShop ?? false,
          retiredDays: s.retiredDays ?? 0,
          politicalLine: s.politicalLine ?? false,
          politicalAlignment: s.politicalAlignment ?? 0,
          politicalEndgame: s.politicalEndgame ?? false,
          factions: s.factions ?? [],
          clues: s.clues ?? [],
          joinedCourt: s.joinedCourt ?? false,
        });
        if (hit && !s.endingTriggered) {
          get().triggerEnding(hit);
        }
        return hit;
      },

      /** 触发结局（设置 endingTriggered + 手札录记录；幂等） */
      triggerEnding: (endingId: string): void => {
        const s = get();
        if (s.endingTriggered === endingId) return;
        const def = endingById(endingId);
        if (!def) return;
        const patch: Partial<TangManagerStore> = { endingTriggered: endingId };
        if (endingId === 'quanqing-chaoye') {
          patch.politicalEndgame = true; // 权倾朝野：政治终局补全
        }
        set(patch);
        const entry = recordChoiceJournal(journalContext(s), {
          title: def.title,
          content: def.subtitle,
          tags: ['归途', '结局'],
        });
        set((st) => ({ journal: [...(st.journal ?? []), entry] }));
      },

      /** 继续经营（可继续结局关闭弹窗；强制结束结局不可继续） */
      continueEnding: (): void => {
        const s = get();
        const def = s.endingTriggered ? endingById(s.endingTriggered) : null;
        if (def?.forceEnd) return;
        set({ endingTriggered: null });
      },

      /** 打开/关闭手札录 overlay（第 10 项） */
      setJournalPanelOpen: (open: boolean): void => {
        set({ journalPanelOpen: open });
      },

      /** 打开/关闭巍明楼 overlay（第 12 项；条件解锁） */
      setPoliticsPanelOpen: (open: boolean): void => {
        set({ politicsPanelOpen: open });
      },

      /** 打开/关闭镖队 overlay（第 11 项；条件解锁） */
      setCaravanPanelOpen: (open: boolean): void => {
        set({ caravanPanelOpen: open });
      },

      /** 季度派系斗争（factionPowerStruggle；胜出特权翻倍 / 失利 -20 + 对立打压） */
      runFactionPowerStruggle: (): void => {
        const s = get();
        const res = factionPowerStruggleSystem({
          politicalFaction: s.politicalFaction ?? null,
          politicalAlignment: s.politicalAlignment ?? 0,
          day: s.day,
        });
        set((st) => ({
          politicalAlignment: Math.max(0, (st.politicalAlignment ?? 0) + res.alignmentDelta),
          eventLog: [...st.eventLog, `court-struggle:${res.winner}:${st.day}`],
        }));
        const entry = recordEventJournal(journalContext(s), {
          title: '派系党争',
          content: res.description,
          tags: ['庙堂', '党争'],
        });
        set((st) => ({ journal: [...(st.journal ?? []), entry] }));
        // P1-2026-08-05：党争结果弹窗展示
        set({ storyNarrative: { title: '派系党争', body: res.description, numbers: ['政治立场 ±变动', '已记入手札'], source: 'template' } });
      },

      /** 接受官职（转政：phase='politics' + politicalLine=true + 记录抉择） */
      acceptImperialOffice: (): void => {
        const s = get();
        set({ phase: 'politics', politicalLine: true, politicsPanelOpen: true });
        const entry = recordChoiceJournal(journalContext(s), {
          title: '巍明楼来帖',
          content: '你接过圣旨，踏入庙堂。商海已成过往，官场线占位待续。',
          tags: ['抉择', '转政'],
          relatedEvent: 'imperial-office',
        });
        set((st) => ({ journal: [...(st.journal ?? []), entry] }));
      },

      /** 婉拒官职（仅记录抉择） */
      declineImperialOffice: (): void => {
        const s = get();
        const entry = recordChoiceJournal(journalContext(s), {
          title: '婉拒入朝',
          content: '你以商务缠身为由婉拒圣意，仍守着长安东市的一间铺面。',
          tags: ['抉择'],
          relatedEvent: 'imperial-office',
        });
        set((st) => ({ journal: [...(st.journal ?? []), entry] }));
      },

      // ============================================================
      // TANG-ADD-001：成瘾性玩法模块 actions（手札占候 / 今日要务 / 遗命 / 赌约 / 暗标 / 小传 / 商阶 / 月度总结）
      // ============================================================

      /** 清晨抽取今日卦象（手札占候；写入 todayHexagram 并置翻开卡待展示） */
      drawDailyHexagram: (): Hexagram => {
        const hexagram = drawHexagramSystem();
        set({ todayHexagram: hexagram, hexagramCardOpen: true });
        return hexagram;
      },

      /** 关闭手札占候翻开卡 */
      dismissHexagramCard: (): void => {
        set({ hexagramCardOpen: false });
      },

      /** 清晨生成今日要务（排除昨日已完成；写入 todayTasks） */
      generateDailyTasks: (): DailyTask[] => {
        const s = get();
        const tasks = generateDailyTasksSystem(s.todayTasksCompleted ?? []);
        set({ todayTasks: tasks, todayTasksCompleted: [] });
        return tasks;
      },
      /** 清晨生成市井消息（2026-08-06 新增系统；随机 1-2 条，保留最近 STREET_NEWS_KEEP 条） */
      generateStreetNews: (): string[] => {
        const s = get();
        const pool = [...STREET_NEWS_POOL];
        const count = 1 + Math.floor(Math.random() * Math.min(2, pool.length));
        const picked: string[] = [];
        const seen = new Set(s.streetNews ?? []);
        for (let i = 0; i < count && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          const msg = pool.splice(idx, 1)[0]!;
          if (!seen.has(msg)) picked.push(msg);
        }
        if (picked.length === 0 && STREET_NEWS_POOL.length > 0) {
          picked.push(STREET_NEWS_POOL[Math.floor(Math.random() * STREET_NEWS_POOL.length)]!);
        }
        set({ streetNews: [...(s.streetNews ?? []), ...picked].slice(-STREET_NEWS_KEEP) });
        return picked;
      },
      /** 创建 AI 对话上下文（规格书 5.4） */
      createDialogueContext: (guestId, guestInfo): void => {
        const s = get();
        const prev = s.dialogueContexts?.[guestId];
        set({
          dialogueContexts: {
            ...(s.dialogueContexts ?? {}),
            [guestId]: prev ?? { guestId, history: [], guestInfo, shopType: s.shopType ?? 'jiulou', emotion: guestInfo.mood === '愉悦' ? 70 : guestInfo.mood === '烦躁' ? 30 : guestInfo.mood === '挑剔' ? 40 : 50 },
          },
        });
      },
      /** 更新情绪（clamp 0-100；规格书 1.6/5.4） */
      updateDialogueEmotion: (guestId, delta): void => {
        const s = get();
        const ctx = s.dialogueContexts?.[guestId];
        if (!ctx) return;
        set({ dialogueContexts: { ...(s.dialogueContexts ?? {}), [guestId]: { ...ctx, emotion: clamp(ctx.emotion + delta, 0, 100) } } });
      },
      /** 清空对话上下文（规格书 5.4） */
      clearDialogueContext: (guestId): void => {
        const s = get();
        const next = { ...(s.dialogueContexts ?? {}) };
        delete next[guestId];
        set({ dialogueContexts: next });
      },
      /** 追加对话历史（保留最近 10 条；规格书 5.3） */
      appendDialogueHistory: (guestId, entry): void => {
        const s = get();
        const ctx = s.dialogueContexts?.[guestId];
        if (!ctx) return;
        set({
          dialogueContexts: {
            ...(s.dialogueContexts ?? {}),
            [guestId]: { ...ctx, history: [...ctx.history, entry].slice(-10) },
          },
        });
      },
      /** 购买医书（规格书 2.2/5.4）：银两足够 → 扣款 + 加入 ownedMedicalBooks */
      purchaseMedicalBook: (bookId): { ok: boolean; reason?: string } => {
        const s = get();
        const book = MEDICAL_BOOK_MAP[bookId];
        if (!book) return { ok: false, reason: '无此书' };
        if ((s.ownedMedicalBooks ?? []).includes(bookId)) return { ok: false, reason: '此书已购' };
        if ((s.silver ?? 0) < book.price) return { ok: false, reason: '银两不足' };
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - book.price),
            ownedMedicalBooks: [...(st.ownedMedicalBooks ?? []), bookId],
            eventLog: [...st.eventLog, `med-book:${bookId}:${st.day}`],
          })
        );
        return { ok: true };
      },
      /** 宴席菜单结算（规格书 3.3：≥8 大获成功声望+10 / 5-7 顺利 / <5 有瑕疵收益-20%） */
      settleBanquetMenu: (input): { silverDelta: number; reputationDelta: number } => {
        const s = get();
        if (s.phase !== 'playing') return { silverDelta: 0, reputationDelta: 0 };
        const tier = banquetTier(input.score);
        const base = Math.round((input.budget ?? 30) * 0.4 * 100) / 100;
        const mult = tier === 'great' ? 1.3 : tier === 'ok' ? 1 : 0.8;
        const silverDelta = Math.round(base * mult * 100) / 100;
        const reputationDelta = tier === 'great' ? 10 : 0;
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + silverDelta),
            reputation: clamp((st.reputation ?? 0) + reputationDelta, 0, 1000),
            tavernBanquetCount: (st.tavernBanquetCount ?? 0) + 1,
            eventLog: [...st.eventLog, `banquet-settle:${input.banquetType}:score${input.score}:${st.day}`],
          })
        );
        return { silverDelta, reputationDelta };
      },
      /** 面料定制结算（规格书 4.3：satisfied 溢价 / normal 正常 / refund 退款受损） */
      settleFabricOrder: (input): { silverDelta: number; reputationDelta: number } => {
        const s = get();
        if (s.phase !== 'playing') return { silverDelta: 0, reputationDelta: 0 };
        const silverDelta = input.tier === 'satisfied' ? 12 : input.tier === 'normal' ? 8 : -4;
        const reputationDelta = input.tier === 'satisfied' ? 6 : input.tier === 'refund' ? -3 : 0;
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + silverDelta),
            reputation: clamp((st.reputation ?? 0) + reputationDelta, 0, 1000),
            customOrderCount: (st.customOrderCount ?? 0) + 1,
            eventLog: [...st.eventLog, `fabric-order:match${input.match}:${st.day}`],
          })
        );
        return { silverDelta, reputationDelta };
      },
      /** 亲自坐诊（规格书 2.1）：消耗 10 精力 */
      performDiagnosis: (guestId): { ok: boolean; reason?: string } => {
        const s = get();
        if (s.phase !== 'playing') return { ok: false, reason: '当前不可坐诊' };
        if ((s.energy ?? 0) < 10) return { ok: false, reason: '精力不足，坐诊需耗 10 点' };
        set((st) => ({
          energy: clamp((st.energy ?? 100) - 10, 0, 100),
          dailyEnergyConsumed: (st.dailyEnergyConsumed ?? 0) + 10,
          eventLog: [...st.eventLog, `diagnose:${guestId}:${st.day}`],
        }));
        return { ok: true };
      },

      /** 打烊判定今日要务完成并发放奖励（盖「了」红印；返回新完成 id） */
      checkDailyTasks: (): string[] => {
        const s = get();
        const guests = s.guests ?? [];
        const track = {
          netProfit: s.todayNetProfit ?? 0,
          bigOrderHandled: guests.filter((g) => g.type === 'big_order' && g.handled).length,
          mindReadUsed: s.todayMindReadUsed ?? 0,
          silkSold: s.todaySilkSold ?? 0,
          marketDealTriggered: s.todayMarketDealTriggered ?? false,
          chatUsed: s.todayChatUsed ?? 0,
          complaints: s.todayComplaints ?? 0,
          guestsHandled: guests.filter((g) => g.handled).length,
          guestsTotal: guests.length,
          rejectedGuests: guests.filter((g) => g.review === 'bad').length,
        };
        const newly = checkTaskCompletionSystem(s.todayTasks ?? [], track, s.todayTasksCompleted ?? []);
        if (newly.length === 0) {
          // 记录今日已接待/拒客数（赌约/展示用）
          set({
            todayGuestsHandled: track.guestsHandled,
            todayRejectedGuests: track.rejectedGuests,
          });
          return [];
        }
        const completed = [...(s.todayTasksCompleted ?? []), ...newly];
        let insightBonus = s.todayTaskMindReadBonus ?? 0;
        const patches: Partial<TangManagerStore> = { todayTasksCompleted: completed };
        for (const id of newly) {
          const task = dailyTaskByIdSystem(id);
          if (!task) continue;
          if (task.reward.reputation) patches.reputation = clamp((patches.reputation ?? s.reputation) + (task.reward.reputation ?? 0), 0, 1000);
          if (task.reward.satisfaction) patches.xiaoerSatisfaction = clamp((patches.xiaoerSatisfaction ?? s.xiaoerSatisfaction) + (task.reward.satisfaction ?? 0), 0, 100);
          if (task.reward.mindReadBonus) insightBonus += task.reward.mindReadBonus;
          if (task.reward.score) patches.score = clamp((patches.score ?? s.score) + (task.reward.score ?? 0), 1.0, 5.0);
          if (task.reward.silver) {
            patches.silver = Math.max(0, (patches.silver ?? s.silver) + (task.reward.silver ?? 0));
            patches.gold = patches.silver; // 兼容字段同步
          }
          if (task.reward.atmosphere) patches.shopAtmosphere = clamp((patches.shopAtmosphere ?? s.shopAtmosphere ?? 50) + (task.reward.atmosphere ?? 0), 0, 100);
          if (task.reward.energy) patches.energy = clamp((patches.energy ?? s.energy) + (task.reward.energy ?? 0), 0, 100);
          if (task.reward.clue) {
            const clue = generateClueSystem('今日要务', 'rumor', 'business', { day: s.day, clues: s.clues ?? [] });
            if (clue) {
              get().addClue(clue);
            }
          }
        }
        if (insightBonus > (s.todayTaskMindReadBonus ?? 0)) {
          patches.insightRemaining = clamp((s.insightRemaining ?? 0) + insightBonus - (s.todayTaskMindReadBonus ?? 0), 0, 99);
          patches.todayTaskMindReadBonus = insightBonus;
        }
        patches.todayGuestsHandled = track.guestsHandled;
        patches.todayRejectedGuests = track.rejectedGuests;
        set(patches);
        return newly;
      },

      /** 清晨检测遗命触发（条件+前置完成；写入 activeLegacyQuest；返回新激活遗命或 null） */
      triggerLegacyQuest: (): LegacyQuest | null => {
        const s = get();
        const factionRel = (s.factions ?? []).find((f) => f.id === 'xishi')?.relationship ?? 0;
        const quest = checkLegacyQuestTriggerSystem({
          day: s.day,
          silver: s.silver,
          reputation: s.reputation,
          legacyDebt: s.legacyDebt,
          factionRelationship: factionRel,
          clueIds: (s.clues ?? []).map((c) => c.id),
          visitedNodes: s.visitedNodes ?? [],
          hasGoneBroke: s.hasGoneBroke,
          completedLegacyQuests: s.completedLegacyQuests ?? [],
          activeLegacyQuestId: s.activeLegacyQuest?.id ?? null,
        });
        if (quest) {
          set({ activeLegacyQuest: quest, legacyQuestRevealOpen: true });
        }
        return quest;
      },

      /** 打烊检测遗命完成（达成→手札翻开 narrative+奖励+解锁下一个） */
      checkLegacyQuestCompletion: (): LegacyQuest | null => {
        const s = get();
        const active = s.activeLegacyQuest ?? null;
        if (!active) return null;
        const factionRel = (s.factions ?? []).find((f) => f.id === 'xishi')?.relationship ?? 0;
        const done = checkLegacyQuestCompletionSystem(
          {
            day: s.day,
            silver: s.silver,
            reputation: s.reputation,
            legacyDebt: s.legacyDebt,
            factionRelationship: factionRel,
            clueIds: (s.clues ?? []).map((c) => c.id),
            visitedNodes: s.visitedNodes ?? [],
            hasGoneBroke: s.hasGoneBroke,
            completedLegacyQuests: s.completedLegacyQuests ?? [],
            activeLegacyQuestId: active.id,
          },
          active
        );
        if (!done) return null;
        const completed = [...(s.completedLegacyQuests ?? []), done.id];
        const patches: Partial<TangManagerStore> = {
          completedLegacyQuests: completed,
          activeLegacyQuest: null,
          legacyQuestRevealOpen: true,
        };
        if (done.reward.silver) {
          patches.silver = Math.max(0, s.silver + done.reward.silver);
          patches.gold = patches.silver; // 兼容字段同步
        }
        if (done.reward.reputation) patches.reputation = clamp(s.reputation + done.reward.reputation, 0, 1000);
        if (done.reward.unlockShop) patches.shopCount = (s.shopCount ?? 1) + 1;
        if (done.reward.shenInvite) patches.shenTinglanFavor = clamp(s.shenTinglanFavor + 20, 0, 100);
        // 手札翻开 narrative（recordMilestone）
        const entry = recordMilestoneJournal(journalContext(s), {
          title: `遗命·${done.title}`,
          content: done.narrative,
          tags: ['遗命'],
        });
        patches.journal = [...(s.journal ?? []), entry];
        set(patches);
        return done;
      },

      /** 打烊检测稀有事件（checkRareEvents；应用奖励并标记+手札录记录；返回触发列表） */
      checkRareEvents: (): RareEvent[] => {
        const s = get();
        const factionRel = (s.factions ?? []).find((f) => f.id === 'xishi')?.relationship ?? 0;
        const hexChance = applyHexagramEffect(s.todayHexagram, { eventChance: 1 }).eventChance ?? 1;
        const triggered = checkRareEventsSystem(
          {
            reputation: s.reputation,
            day: s.day,
            legacyDebt: s.legacyDebt,
            factionRelationship: factionRel,
            xieQiFavor: s.xieQiFavor,
            completedRareEvents: s.completedRareEvents ?? [],
            hexagramEventChance: hexChance,
          },
          Math.random
        );
        if (triggered.length === 0) return [];
        const done = [...(s.completedRareEvents ?? [])];
        const patches: Partial<TangManagerStore> = { completedRareEvents: done };
        let silverDelta = 0;
        let repDelta = 0;
        let favorDelta = 0;
        for (const ev of triggered) {
          done.push(ev.triggeredKey);
          if (ev.rewards.silver) silverDelta += ev.rewards.silver;
          if (ev.rewards.penaltySilver) silverDelta -= ev.rewards.penaltySilver;
          if (ev.rewards.favor) favorDelta += ev.rewards.favor;
          if (ev.rewards.clue) {
            const clue = generateClueSystem(ev.title, 'event', 'business', { day: s.day, clues: s.clues ?? [] });
            if (clue) {
              get().addClue(clue);
            }
          }
          // 手札录记录
          const entry = recordEventJournal(journalContext(s), {
            title: `意外之喜·${ev.title}`,
            content: ev.description,
            tags: ['意外之喜'],
          });
          patches.journal = [...(patches.journal ?? s.journal ?? []), entry];
        }
        if (silverDelta !== 0) {
          patches.silver = Math.max(0, s.silver + silverDelta);
          patches.gold = patches.silver;
        }
        if (repDelta !== 0) patches.reputation = clamp(s.reputation + repDelta, 0, 1000);
        if (favorDelta !== 0) patches.xieQiFavor = clamp(s.xieQiFavor + favorDelta, 0, 100);
        set(patches);
        return triggered;
      },

      /** 清晨检测谢七赌约（谢七登场+30% 概率；写入 activeBet） */
      checkBetOffer: (): TangBet | null => {
        const s = get();
        const bet = checkBetOfferSystem({ xieQiFavor: s.xieQiFavor, betOfferedToday: s.activeBet !== null }, Math.random);
        if (bet) {
          set({ activeBet: bet, betAccepted: false });
        }
        return bet;
      },

      /** 玩家接下当前赌约 */
      acceptBet: (): void => {
        const s = get();
        if (!s.activeBet) return;
        set({ betAccepted: true });
      },

      /** 玩家拒绝当前赌约（清空） */
      declineBet: (): void => {
        set({ activeBet: null, betAccepted: false });
      },

      /** 打烊结算赌约（赢：好感+10+双倍赌注；输：拿走+bonusOnLose；未接无影响） */
      resolveBet: (): { bet: TangBet; outcome: 'win' | 'lose' | 'declined'; silverDelta: number; favorDelta: number; message: string } | null => {
        const s = get();
        const guests = s.guests ?? [];
        const track = {
          netProfit: s.todayNetProfit ?? 0,
          backlashToday: s.todayMindReadBackfired ?? 0,
          rejectedToday: guests.filter((g) => g.review === 'bad').length,
          specialGuestToday: guests.some((g) => g.type === 'special' && g.handled),
        };
        const result = resolveBetSystem(s.activeBet ?? null, s.betAccepted ?? false, track);
        if (!result) return null;
        const patches: Partial<TangManagerStore> = { activeBet: null, betAccepted: false };
        if (result.silverDelta !== 0) {
          patches.silver = Math.max(0, s.silver + result.silverDelta);
          patches.gold = patches.silver;
          patches.ledger = appendLedger(s.ledger, [{ day: s.day, project: `彩头·${result.bet.title}`, category: result.silverDelta > 0 ? '经营' : '支出', amount: result.silverDelta }]);
        }
        if (result.favorDelta !== 0) {
          patches.xieQiFavor = clamp(s.xieQiFavor + result.favorDelta, 0, 100);
        }
        if (result.outcome === 'win' || result.outcome === 'lose') {
          const entry = recordNPCDialogueJournal(journalContext(s), {
            title: `彩头·${result.bet.title}`,
            content: result.message,
            tags: ['彩头'],
            relatedNPC: '谢七',
          });
          patches.journal = [...(s.journal ?? []), entry];
        }
        set(patches);
        return result;
      },

      /** 每月初一清晨挂出暗标（写入 currentBlindAuction） */
      checkBlindAuction: (): BlindAuction | null => {
        const auction = checkBlindAuctionSystem();
        set({ currentBlindAuction: auction, blindAuctionBid: null, blindAuctionResolved: false });
        return auction;
      },

      /** 玩家对暗标出价（≥起拍；扣款；50% 概率中标，起价越高越高中标封顶 90%；未中退还） */
      placeBid: (amount: number): { ok: boolean; reason?: string; won?: boolean } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const auction = s.currentBlindAuction;
        if (!auction || s.blindAuctionResolved) return { ok: false, reason: '当前无暗标可出价' };
        const r = bidOnAuctionSystem(auction, amount, s.silver, Math.random);
        if (!r.ok) return { ok: false, reason: r.reason };
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - r.cost),
            blindAuctionBid: r.won ? amount : null,
            todayMarketDealTriggered: true,
            ledger: appendLedger(st.ledger, [{ day: st.day, project: '市易务暗标', category: '支出', amount: -r.cost }]),
          })
        );
        return { ok: true, won: r.won };
      },

      /** 开标展示（市易务差人送箱/恭喜/遗憾；按概率抽奖结算；未中标已退还） */
      resolveAuction: (): { auction: BlindAuction; won: boolean; outcome: BlindAuctionOutcome | null; silverDelta: number; message: string } | null => {
        const s = get();
        const auction = s.currentBlindAuction;
        if (!auction) return null;
        const won = s.blindAuctionBid !== null && s.blindAuctionBid !== undefined && s.blindAuctionBid > 0;
        const result = resolveAuctionSystem(auction, won, Math.random);
        const patches: Partial<TangManagerStore> = { blindAuctionResolved: true };
        if (result.silverDelta !== 0) {
          patches.silver = Math.max(0, s.silver + result.silverDelta);
          patches.gold = patches.silver;
          patches.ledger = appendLedger(s.ledger, [{ day: s.day, project: '暗标开箱', category: result.silverDelta > 0 ? '经营' : '支出', amount: result.silverDelta }]);
        }
        if (result.outcome?.recipe) {
          // 稀有配方：加入加工/组合配方池（占位：记入手札录）
          patches.inventoryNarratives = pushNarrative(s.inventoryNarratives, `开箱得「${result.outcome.label}」，附稀有配方「${result.outcome.recipe}」。`);
        }
        const entry = recordEventJournal(journalContext(s), {
          title: `暗标开箱·${auction.category}`,
          content: result.message,
          tags: ['暗标'],
        });
        patches.journal = [...(s.journal ?? []), entry];
        set(patches);
        return result;
      },

      /** 清晨检测伙计小传解锁（checkBiographyUnlock；返回本次解锁条目） */
      checkBiographies: (): BiographyEntry[] => {
        const s = get();
        const newlyAll: BiographyEntry[] = [];
        const employees = (s.employees ?? []).map((e) => {
          const res = checkBiographyUnlockSystem(e, {
            day: s.day,
            xiaoerFavor: s.xiaoerFavor,
            specialEmployeeStoryCompleted: s.specialEmployeeStoryCompleted ?? false,
          });
          newlyAll.push(...res.newlyUnlocked);
          return res.employee;
        });
        if (newlyAll.length === 0) return [];
        const patches: Partial<TangManagerStore> = { employees };
        // 全解锁获专属技能（注释占位：biographyMasterSkill）
        for (const e of employees) {
          const master = biographyMasterSkill(e);
          if (master) {
            patches.inventoryNarratives = pushNarrative(s.inventoryNarratives, `${e.name}的小传已写尽，习得绝艺「${master.name}」。`);
            // 手札录记录
            const entry = recordMilestoneJournal(journalContext(s), {
              title: `小传·${e.name}`,
              content: `${e.name}的过往尽数浮现于纸上，终获绝艺「${master.name}」。`,
              tags: ['伙计小传'],
              relatedNPC: e.name,
            });
            patches.journal = [...(patches.journal ?? s.journal ?? []), entry];
          }
        }
        set(patches);
        return newlyAll;
      },

      /** 打烊评定商阶（evaluateRank；晋升→手札贺词+rank 更新） */
      evaluateRank: (): MerchantRank | null => {
        const s = get();
        const prevRank = s.rank ?? null;
        const rank = evaluateRankSystem({
          day: s.day,
          score: s.score,
          shopCount: s.shopCount ?? 1,
          silver: s.silver,
          reputation: s.reputation,
          totalNetProfit: s.totalNetProfit,
          endingTriggered: s.endingTriggered ?? null,
        });
        const progress = rankProgressSystem({ day: s.day, score: s.score, shopCount: s.shopCount ?? 1, silver: s.silver, reputation: s.reputation, totalNetProfit: s.totalNetProfit, endingTriggered: s.endingTriggered ?? null });
        const patches: Partial<TangManagerStore> = { rank: rank.id, rankProgress: progress };
        if (prevRank && prevRank !== rank.id) {
          const message = getRankPromotionMessage(prevRank, rank.id);
          if (message) {
            patches.rankPromotionOpen = true;
            const entry = recordMilestoneJournal(journalContext(s), {
              title: `商阶·${rank.name}`,
              content: message,
              tags: ['商阶'],
            });
            patches.journal = [...(s.journal ?? []), entry];
          }
        }
        set(patches);
        return rank;
      },

      /** 应用局外成长传承（applyAncestralBlessing；独立 localStorage 存储，与主存档隔离） */
      applyAncestralBlessing: (blessingId: string): { ok: boolean; reason?: string } | null => {
        const s = get();
        const save = loadLegacyGrowthSave();
        const res = applyAncestralBlessingSystem(save, blessingId);
        if (!res.ok) return { ok: false, reason: res.reason };
        saveLegacyGrowthSave(res.save);
        // 把传承效果应用到当前开局状态（身份后店型前选择；选完进正常流程）
        const patches: Partial<TangManagerStore> = {};
        switch (blessingId) {
          case 'blessing-remainder':
            patches.silver = (s.silver ?? 0) + 30;
            patches.gold = patches.silver;
            break;
          case 'blessing-old-friend':
            patches.shenTinglanFavor = clamp((s.shenTinglanFavor ?? 0) + 20, 0, 100);
            patches.xieQiFavor = clamp((s.xieQiFavor ?? 0) + 20, 0, 100);
            break;
          case 'blessing-old-shop':
            patches.score = 1.8;
            break;
          case 'blessing-shiren':
            patches.xiaoerFavor = clamp((s.xiaoerFavor ?? 0) + 20, 0, 100);
            patches.xiaoerSatisfaction = clamp((s.xiaoerSatisfaction ?? 0) + 15, 0, 100);
            break;
          case 'blessing-debt-free':
            patches.legacyDebt = Math.max(0, Math.floor((s.legacyDebt ?? 0) / 2));
            patches.debt = patches.legacyDebt;
            break;
          case 'blessing-craft':
            patches.inventoryNarratives = pushNarrative(s.inventoryNarratives, '先祖留下一张泛黄配方，聊胜于无。');
            break;
          case 'blessing-map':
            patches.unlockedLayers = Array.from(new Set([...(s.unlockedLayers ?? []), 'east_west_market' as const]));
            break;
          case 'blessing-eye':
            patches.insightRemaining = (s.insightRemaining ?? 0) + 1;
            patches.ancestralEyeActive = true;
            break;
          default:
            break;
        }
        set(patches);
        return { ok: true };
      },

      /** 生成月度总结（每月初一打烊；AI 或模板；写入 monthlyReviews） */
      generateMonthlyReview: (): MonthlyReview | null => {
        const s = get();
        const month = Math.max(1, Math.ceil(s.day / 30));
        // 本月净收益近似：总净利增量（工程定；逐日统计由打烊结算累计）
        const prevMonth = s.monthlyReviews?.[s.monthlyReviews.length - 1];
        const netProfit = Math.max(0, Math.round((s.totalNetProfit ?? 0) - (prevMonth ? prevMonth.netProfit + prevMonth.prevNetProfit : 0)));
        const bestGood = (s.shopItems ?? []).slice(0, 1).map((it) => it.name)[0] ?? '无';
        const specialGuest = s.guests.find((g) => g.type === 'special' && g.handled);
        const memorableGuest = specialGuest?.name ?? '无';
        const biggestMistake = s.ledger.filter((l) => l.amount < 0).slice(0, 1).map((l) => l.project)[0] ?? '无';
        const hired = (s.employees ?? []).length > 0 ? `在册伙计 ${s.employees.length} 人` : '无';
        const review = generateMonthlyReviewSystem({
          day: s.day,
          month,
          netProfit,
          prevNetProfit: prevMonth ? prevMonth.netProfit : 0,
          bestGood,
          memorableGuest,
          biggestMistake,
          employeeChanges: hired,
          // 天机阁 AI 已配时在此接线（当前模板降级）
        });
        const display = displayMonthlyReview(review);
        const entry = recordMilestoneJournal(journalContext(s), {
          title: display.title,
          content: display.content,
          tags: ['月度总结'],
        });
        set((st) => ({
          monthlyReviews: [...(st.monthlyReviews ?? []), review],
          journal: [...(st.journal ?? []), entry],
        }));
        // 天机阁 AI 接线（v1.1 模块五 5.1：月度总结 AI 优先，模板兜底；best-effort 不阻塞）
        void (async () => {
          const base = '第' + month + '月，本月净收益 ' + netProfit + ' 两，最畅销 ' + bestGood + '，难忘之客 ' + memorableGuest + '，最大失策 ' + biggestMistake + '。' + hired;
          const res = await generateAiText('monthly', { userPrompt: base, fallback: review.content }, { onLog: (e) => get().recordAiLog(e) });
          if (res.source === 'ai' && res.text) {
            const cur = get();
            const idx = (cur.monthlyReviews ?? []).length - 1;
            if (idx >= 0) {
              set({ monthlyReviews: (cur.monthlyReviews ?? []).map((r, i) => (i === idx ? { ...r, content: res.text } : r)) });
              const jList = cur.journal ?? [];
              const revIdx = jList.map((j) => (j.tags ?? []).includes('月度总结')).lastIndexOf(true);
              if (revIdx >= 0) {
                set({ journal: jList.map((e, i) => (i === revIdx ? { ...e, content: res.text } : e)) });
              }
            }
          }
        })();
        return review;
      },

      // ============================================================
      // TANG-TRF-001：动态客流 + 大单预购 + 周级要务 actions
      // ============================================================

      /** 设定今日接待策略（亲力亲为/择要接待/全托伙计；当日生效；startNewDay 不重置——策略为玩家预设） */
      setReceptionStrategy: (strategy: ReceptionStrategy): void => {
        set({ receptionStrategy: strategy });
      },

      /** 设定经营策略（内容深化 TANG-CONT-B 模块六·1：薄利多销/奇货可居/稳健经营；当日生效） */
      setBusinessStrategy: (strategy: BusinessStrategy): void => {
        set({ businessStrategy: strategy });
      },

      /** 变卖一家分店（内容深化 TANG-CONT-B 模块一）：
       * 估值（累计投入×七成）入现银、店铺数 -1、员工上限收敛、超出上限员工离职；
       * 祖传老店（只剩一家店）不可变卖。soldShops=true 联动「归隐田园」结局条件。
       * 势力关联（faction 注释决策）：变卖分店不改变东市商会/西市商团等势力关系
       * （店铺数为抽象计数、无势力绑定；若有势力辖店需求可后续扩展 faction 减益，注释预留）。 */
      sellShop: (): { ok: boolean; reason?: string; valuation?: number; laidOffNames?: string[] } => {
        const s = get();
        if (s.phase !== 'playing') {
          return { ok: false, reason: '此刻不便变卖' };
        }
        const res = sellBranch(s.shopCount ?? 1, s.employees ?? []);
        if (!res.ok || res.newShopCount === undefined) {
          return { ok: false, reason: res.reason ?? '变卖失败' };
        }
        const newShopCount = res.newShopCount;
        const newMaxEmployees = res.newMaxEmployees ?? maxEmployeesForShops(newShopCount);
        const valuation = res.valuation ?? 0;
        const laidOffNames = res.laidOffNames ?? [];
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + valuation),
            shopCount: newShopCount,
            maxEmployees: newMaxEmployees,
            employees: res.keptEmployees ?? [],
            soldShops: true,
            // 离职伙计去向逐条登记（轻量：事件日志；若需逐一提示可在 UI 层消费 laidOffNames）
            eventLog: [
              ...st.eventLog,
              `shop-sold:${s.day}:${valuation}`,
              ...laidOffNames.map((n) => `emp-laidoff:${n}:${s.day}`),
            ],
          })
        );
        return { ok: true, valuation, laidOffNames };
      },

      /** 接下预购订单（pending → accepted；定金入账）；待应订单在预购面板展示 */
      acceptPreOrder: (orderId: string): { ok: boolean; reason?: string; order?: PreOrder } | null => {
        const s = get();
        const order = (s.preOrders ?? []).find((o) => o.id === orderId);
        if (!order) return { ok: false, reason: '订单不存在' };
        if (order.status !== 'pending') return { ok: false, reason: '订单不在待应状态' };
        set((st) =>
          syncCompat(st, {
            preOrders: (st.preOrders ?? []).map((o) => (o.id === orderId ? { ...o, status: 'accepted' as const } : o)),
            silver: Math.max(0, st.silver + order.deposit),
          })
        );
        return { ok: true, order: { ...order, status: 'accepted' } };
      },

      /** 为预购订单预留库房货品（商品标记 reserved；货齐置 ready） */
      reserveGoods: (orderId: string): { ok: boolean; reason?: string; order?: PreOrder } | null => {
        const s = get();
        const res = reserveGoodsForOrderSystem(orderId, s.shopItems ?? [], s.preOrders ?? []);
        if (!res.ok) return { ok: false, reason: res.reason };
        set((st) => ({
          preOrders: (st.preOrders ?? []).map((o) => (o.id === orderId ? res.order! : o)),
          shopItems: res.shopItems ?? st.shopItems,
        }));
        return { ok: true, order: res.order };
      },

      /** 交货（reserved≥required 才可；商品移库、尾款入账、声望+5~30、来源关系奖励、新客入回头客池、周要务进度） */
      deliverOrder: (orderId: string): { ok: boolean; reason?: string; order?: PreOrder } | null => {
        const s = get();
        const order = (s.preOrders ?? []).find((o) => o.id === orderId);
        if (!order) return { ok: false, reason: '订单不存在' };
        const res = deliverOrderSystem(
          orderId,
          {
            preOrders: s.preOrders ?? [],
            shopItems: s.shopItems ?? [],
            silver: s.silver,
            reputation: s.reputation,
            shenTinglanFavor: s.shenTinglanFavor,
            xieQiFavor: s.xieQiFavor,
            factions: s.factions ?? [],
            knownGuests: s.knownGuests ?? {},
            day: s.day,
          },
          Math.random
        );
        if (!res.ok) return { ok: false, reason: res.reason };
        const patch: Partial<TangManagerStore> = {
          preOrders: (s.preOrders ?? []).map((o) => (o.id === orderId ? res.order! : o)),
          shopItems: res.shopItems ?? s.shopItems,
        };
        if (res.silverDelta !== undefined) {
          patch.silver = Math.max(0, s.silver + res.silverDelta);
        }
        if (res.reputationDelta) {
          patch.reputation = clamp(s.reputation + res.reputationDelta, 0, 1000);
        }
        if (res.shenDelta) {
          patch.shenTinglanFavor = clamp(s.shenTinglanFavor + res.shenDelta, 0, 100);
        }
        if (res.xieDelta) {
          patch.xieQiFavor = clamp(s.xieQiFavor + res.xieDelta, 0, 100);
        }
        if (res.factionDelta && res.factionId) {
          const factionRes = updateFactionRelationshipSystem(s.factions ?? [], res.factionId, res.factionDelta, '预购交货');
          patch.factions = factionRes.factions;
          // 势力关系 NPC 联动（复用 5.3）
          const npcSync = syncNpcFavor(
            s.npcFavors ?? [],
            res.factionId,
            res.factionDelta,
            {
              shenTinglanFavor: patch.shenTinglanFavor ?? s.shenTinglanFavor,
              xieQiFavor: patch.xieQiFavor ?? s.xieQiFavor,
              fuyinFavor: s.fuyinFavor ?? 20,
              zhaoYuanwaiFavor: s.zhaoYuanwaiFavor ?? 10,
            }
          );
          patch.npcFavors = npcSync.npcFavors;
        }
        if (res.knownGuest) {
          patch.knownGuests = { ...s.knownGuests, [order.guestName]: res.knownGuest };
        }
        patch.ledger = appendLedger(s.ledger, [
          { day: s.day, project: `预购尾款·${order.guestName}`, category: '经营', amount: res.silverDelta ?? 0 },
        ]);
        // 周级要务：本周完成预购 +1
        patch.weeklyTaskProgress = addWeeklyProgressSystem(s.weeklyTaskProgress, 'week-preorder', 1);
        set(syncCompat(s, patch));
        return { ok: true, order: res.order };
      },

      /** 每日清晨检查逾期预购（违约惩罚分级 + 解除预留 + 记账）；返回逾期列表 */
      checkOverdueOrders: (): PreOrder[] => {
        const s = get();
        const res = checkOverdueOrdersSystem(s.preOrders ?? [], s.shopItems ?? [], s.day);
        if (res.overdue.length === 0) return [];
        let silverDelta = 0;
        let repDelta = 0;
        let shenDelta = 0;
        let xieDelta = 0;
        const factionDeltas: Record<string, number> = {};
        const ledgerEntries: LedgerEntry[] = [];
        for (const o of res.overdue) {
          const pen = getPreOrderPenaltySystem(o.source, o);
          const loss = pen.depositRefund + pen.extraPenalty;
          silverDelta -= loss;
          repDelta -= pen.reputationDelta;
          shenDelta -= pen.shenDelta;
          xieDelta -= pen.xieDelta;
          if (pen.factionId && pen.factionDelta > 0) {
            factionDeltas[pen.factionId] = (factionDeltas[pen.factionId] ?? 0) - pen.factionDelta;
          }
          ledgerEntries.push({
            day: s.day,
            project: `预购违约·${o.guestName}`,
            category: '支出',
            amount: -loss,
          });
        }
        const patch: Partial<TangManagerStore> = {
          preOrders: res.preOrders,
          shopItems: res.shopItems,
        };
        if (silverDelta !== 0) patch.silver = Math.max(0, s.silver + silverDelta);
        if (repDelta !== 0) patch.reputation = clamp(s.reputation + repDelta, 0, 1000);
        if (shenDelta !== 0) patch.shenTinglanFavor = clamp(s.shenTinglanFavor + shenDelta, 0, 100);
        if (xieDelta !== 0) patch.xieQiFavor = clamp(s.xieQiFavor + xieDelta, 0, 100);
        if (Object.keys(factionDeltas).length > 0) {
          let factions = s.factions ?? [];
          for (const [fid, delta] of Object.entries(factionDeltas)) {
            const fr = updateFactionRelationshipSystem(factions, fid, delta, '预购逾期');
            factions = fr.factions;
          }
          patch.factions = factions;
        }
        if (ledgerEntries.length > 0) {
          patch.ledger = appendLedger(s.ledger, ledgerEntries);
        }
        set(syncCompat(s, patch));
        return res.overdue;
      },

      /** 周级要务进度累加（接待/预购/结算/通晓人心接线） */
      updateWeeklyTaskProgress: (key: string, delta: number): void => {
        set((s) => ({ weeklyTaskProgress: addWeeklyProgressSystem(s.weeklyTaskProgress, key, delta) }));
      },

      /** 周日打烊结算本周要务并发放奖励（周一 startNewDay 刷新）；返回完成 id */
      settleWeeklyTasks: (): string[] => {
        const s = get();
        const done = checkWeeklyTasksSystem(s.weeklyTasks ?? [], s.weeklyTaskProgress ?? {});
        if (done.length === 0) return [];
        let silverDelta = 0;
        let repDelta = 0;
        let scoreDelta = 0;
        let satDelta = 0;
        let atmoDelta = 0;
        let energyDelta = 0;
        let insightDelta = 0;
        for (const id of done) {
          const task = (s.weeklyTasks ?? []).find((t) => t.id === id);
          if (!task) continue;
          if (task.reward.silver) silverDelta += task.reward.silver;
          if (task.reward.reputation) repDelta += task.reward.reputation;
          if (task.reward.score) scoreDelta += task.reward.score;
          if (task.reward.satisfaction) satDelta += task.reward.satisfaction;
          if (task.reward.atmosphere) atmoDelta += task.reward.atmosphere;
          if (task.reward.energy) energyDelta += task.reward.energy;
          if (task.reward.mindReadBonus) insightDelta += task.reward.mindReadBonus;
        }
        const patches: Partial<TangManagerStore> = {};
        if (silverDelta !== 0) {
          patches.silver = Math.max(0, s.silver + silverDelta);
          patches.ledger = appendLedger(s.ledger, [{ day: s.day, project: '周要务奖赏', category: '经营', amount: silverDelta }]);
        }
        if (repDelta !== 0) patches.reputation = clamp(s.reputation + repDelta, 0, 1000);
        if (scoreDelta !== 0) patches.score = clamp(s.score + scoreDelta, 1.0, 5.0);
        if (satDelta !== 0) patches.xiaoerSatisfaction = clamp(s.xiaoerSatisfaction + satDelta, 0, 100);
        if (atmoDelta !== 0) patches.shopAtmosphere = clamp((s.shopAtmosphere ?? 50) + atmoDelta, 0, 100);
        if (energyDelta !== 0) patches.energy = clamp(s.energy + energyDelta, 0, 100);
        if (insightDelta !== 0) patches.insightRemaining = clamp(s.insightRemaining + insightDelta, 0, 99);
        set(syncCompat(s, patches));
        return done;
      },

      /** 每日解锁检查（v1.0 模块二）：清晨/打烊各调一次；返回本次新解锁 featureId 并写入记录 */
      checkFeatureUnlock: (): string[] => {
        const s = get();
        const newly = checkFeatureUnlockSystem(s.unlockedFeatures ?? {}, {
          day: s.day,
          reputation: s.reputation,
          employeesCount: (s.employees ?? []).length,
          stage: s.stage,
          unlockedAchievementsCount: (s.unlockedAchievements ?? []).length,
        });
        if (newly.length > 0) {
          const next: Record<string, boolean> = { ...(s.unlockedFeatures ?? {}) };
          for (const id of newly) next[id] = true;
          set({ unlockedFeatures: next });
          // 解锁展示由 page.tsx FeatureUnlockToast 监听 unlockedFeatures 新增 → 手札浮现提示
          // （v1.0 模块二；不再向 notification store 重复 push，避免双弹条）
        }
        return newly;
      },

      // ============================================================
      // 内容深化 TANG-CONT-D：西市赌坊 / 负反馈系统 / 负债拓展
      // ============================================================

      /** 打开赌坊弹窗（刷新预估赔率；谢七互动：好感≥20 可能提私人赌约 / ≥60 手气台） */
      openGamblingPanel: (): void => {
        const s = get();
        // 赌坊节点解锁条件：谢七登场（xieQiFavor>0 或身份揭晓或 eventLog 含谢七登场）
        const xieAppeared = s.xieQiFavor > 0 || s.xieQiIdentityRevealed || s.eventLog.includes('xie-qi-debt');
        if (!xieAppeared) return;
        const encounter = rollXieQiGamblingEncounter(
          { xieQiFavor: s.xieQiFavor, betOfferedToday: s.activeBet !== null },
          Math.random
        );
        const patch: Partial<TangManagerStore> = {
          gamblingPanelOpen: true,
          gamblingOdds: rollGamblingOddsSystem(Math.random),
          gamblingLuckyTable: encounter.luckyTable,
          gamblingEncounterMsg: encounter.message,
        };
        // 谢七提私人赌约：写入 activeBet（复用 tang-bets 结算流程）
        if (encounter.betOffer) {
          patch.activeBet = encounter.betOffer;
          patch.betAccepted = false;
        }
        set(patch);
      },

      /** 关闭赌坊弹窗 */
      closeGamblingPanel: (): void => {
        set({ gamblingPanelOpen: false });
      },

      /** 赌坊下注（1-100 两；useLuckyStar 胜率 45%→65% 但被老板盯上概率翻倍；结果进 eventLog） */
      placeGamblingBet: (amount: number, useLuckyStar: boolean, rng: () => number = Math.random): GamblingResult | null => {
        const s = get();
        if (s.phase !== 'playing' || !s.gamblingPanelOpen) return null;
        const odds = s.gamblingOdds ?? 2;
        const result = placeGamblingBetSystem(
          amount,
          odds,
          useLuckyStar,
          { silver: s.silver, luckRemaining: s.luckRemaining, gamblingSuspicion: s.gamblingSuspicion },
          rng,
          { luckyTable: s.gamblingLuckyTable === true }
        );
        if (!result.ok) return result;
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + result.silverDelta),
            luckRemaining: useLuckyStar ? Math.max(0, st.luckRemaining - 1) : st.luckRemaining,
            gamblingSuspicion: result.markedByBoss || st.gamblingSuspicion,
            maxGamblingWin: Math.max(st.maxGamblingWin, result.win ? result.silverDelta : 0),
            eventLog: [...st.eventLog, `[第${s.day}日] 赌坊：${result.message}`],
          })
        );
        // 用福星高照：累计次数（赌瘾阈值判定复用）
        if (useLuckyStar) {
          const st = get();
          const newTotal = st.luckUsedTotal + 1;
          set({ luckUsedTotal: newTotal });
          if (checkGamblingAddiction({ difficulty: s.difficulty, luckUsedTotal: newTotal })) {
            const cur = get();
            if (cur.gamblingAddictionDays <= 0) {
              set({ gamblingAddictionDays: GAMBLING_ADDICTION_DAYS });
            }
          }
        }
        return result;
      },

      /** 每日打烊检查负反馈（树大招风/集体涨薪/灾害/背叛/意外损失；入队 pendingNegativeEvents + eventLog） */
      checkNegativeFeedback: (rng: () => number = Math.random): NegativeEvent[] => {
        const s = get();
        if (s.phase !== 'playing') return [];
        const events = checkNegativeFeedbackSystem(
          {
            day: s.day,
            silver: s.silver,
            score: s.score,
            reputation: s.reputation,
            shopType: s.shopType ?? undefined,
            consecutiveProfitDays: s.consecutiveProfitDays ?? 0,
            shenTinglanFavor: s.shenTinglanFavor,
            xiaoerFavor: s.xiaoerFavor,
            xiaoerSatisfaction: s.xiaoerSatisfaction,
            energy: s.energy,
            employees: s.employees ?? [],
            shopItems: s.shopItems ?? [],
            tradeCredit: s.tradeCredit ?? 0,
            deposits: s.deposits ?? [],
            shenShopScore: 4.0,
            clueIds: (s.clues ?? []).map((c) => c.id),
            azhaoNoRaiseMonths: s.azhaoNoRaiseMonths ?? 0,
            azhaoRaisedLastMonth: false,
            salaryMultiplier: s.salaryMultiplier ?? 1,
            triggeredToday: (s.pendingNegativeEvents ?? []).map((e) => e.kind),
            disasterType: s.disasterType,
          },
          rng
        );
        if (events.length === 0) return [];
        const existing = new Set((s.pendingNegativeEvents ?? []).map((e) => e.id));
        const fresh = events.filter((e) => !existing.has(e.id));
        if (fresh.length > 0) {
          set((st) => ({
            pendingNegativeEvents: [...(st.pendingNegativeEvents ?? []), ...fresh],
            eventLog: [...st.eventLog, ...fresh.map((e) => `[第${s.day}日] 负反馈·${e.title}`)],
          }));
        }
        return fresh;
      },

      /** 处理负反馈事件选项（应用纯函数结果并出队） */
      resolveNegativeEvent: (eventId: string, optionId: string, rng: () => number = Math.random): NegativeChoiceResult | null => {
        const s = get();
        const event = (s.pendingNegativeEvents ?? []).find((e) => e.id === eventId);
        if (!event) return null;
        const result = applyNegativeChoiceSystem(
          event,
          optionId,
          {
            day: s.day,
            silver: s.silver,
            score: s.score,
            reputation: s.reputation,
            shopType: s.shopType ?? undefined,
            consecutiveProfitDays: s.consecutiveProfitDays ?? 0,
            shenTinglanFavor: s.shenTinglanFavor,
            xiaoerFavor: s.xiaoerFavor,
            xiaoerSatisfaction: s.xiaoerSatisfaction,
            energy: s.energy,
            employees: s.employees ?? [],
            shopItems: s.shopItems ?? [],
            tradeCredit: s.tradeCredit ?? 0,
            deposits: s.deposits ?? [],
            clueIds: (s.clues ?? []).map((c) => c.id),
            azhaoNoRaiseMonths: s.azhaoNoRaiseMonths ?? 0,
            targetEmployeeId: event.payload?.employeeId as string | undefined,
            targetEmployeeName: event.payload?.employeeName as string | undefined,
            disasterType: (event.payload?.disasterType as 'flood' | 'fire' | 'plague') ?? s.disasterType,
          },
          rng
        );
        if (!result.ok) return result;
        set((st) =>
          syncCompat(st, {
            ...result.changes,
            pendingNegativeEvents: (st.pendingNegativeEvents ?? []).filter((e) => e.id !== eventId),
            eventLog: [...st.eventLog, `[第${s.day}日] ${result.message}`, ...result.eventLog],
            ledger: appendLedger(st.ledger, result.ledger ?? []),
          })
        );
        return result;
      },

      /** 强制清除某负反馈事件（UI 防御） */
      dismissNegativeEvent: (eventId: string): void => {
        const s = get();
        set({ pendingNegativeEvents: (s.pendingNegativeEvents ?? []).filter((e) => e.id !== eventId) });
      },

      /** 接受循环借贷 offer（新贷款入账：额度×1.5、利率+1%；可拒绝不影响关系） */
      acceptRevolvingLoan: (): { ok: boolean; reason?: string; loan?: BankLoan } | null => {
        const s = get();
        const offer = s.revolvingLoanOffer;
        if (!offer) return { ok: false, reason: '暂无循环借贷 offer' };
        const loan = mortgageLoan(offer.amount, 'deed', s);
        if (!loan.ok || !loan.loan) return { ok: false, reason: loan.reason ?? '借贷失败' };
        const loanWithRate: BankLoan = { ...loan.loan, interestRate: offer.interestRate };
        set((st) =>
          syncCompat(st, {
            silver: st.silver + offer.amount,
            loans: [...(st.loans ?? []), loanWithRate],
            revolvingLoanOffer: null,
            eventLog: [...st.eventLog, `[第${s.day}日] 循环借贷：借 ${offer.amount} 两，月息 ${Math.round(offer.interestRate * 100)}%`],
          })
        );
        return { ok: true, loan: loanWithRate };
      },

      /** 拒绝循环借贷 offer（不影响钱庄关系） */
      declineRevolvingLoan: (): void => {
        set({ revolvingLoanOffer: null });
      },

      /** 赊账进货（信用≥300、上限=信用×2、30 天无息；锁信用 50；不入现银） */
      takeTradeCreditPurchase: (amount: number): { ok: boolean; reason?: string; tradeCredit?: number; creditDueDay?: number } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const res = takeTradeCreditSystem(amount, {
          credit: s.credit,
          tradeCredit: s.tradeCredit ?? 0,
          creditDueDay: s.creditDueDay ?? 0,
          day: s.day,
        });
        if (!res.ok) return res;
        set((st) =>
          syncCompat(st, {
            tradeCredit: res.tradeCredit,
            creditDueDay: res.creditDueDay,
            creditLocked: (st.creditLocked ?? 0) + 50,
            credit: Math.max(0, (st.credit ?? 0) - 50),
            creditHistory: appendCreditHistory(st.creditHistory, { day: s.day, reason: '赊账进货', amount: -50 }),
          })
        );
        return { ok: true, tradeCredit: res.tradeCredit, creditDueDay: res.creditDueDay };
      },

      /** 处理沈听澜人情债（让出一笔生意/中断谢七合作/站队；拒绝 沈-30+声望-50） */
      resolveShenDebtMoment: (choiceId: 'concede' | 'break_xie' | 'align' | 'refuse'): { ok: boolean; message: string } | null => {
        const s = get();
        if (!s.shenDebt) return null;
        const res = resolveShenDebt(choiceId, {
          day: s.day,
          silver: s.silver,
          reputation: s.reputation,
          shenTinglanFavor: s.shenTinglanFavor,
          xieQiFavor: s.xieQiFavor,
          shenDebt: s.shenDebt,
        });
        set((st) =>
          syncCompat(st, {
            ...res.changes,
            shenDebtMomentOpen: false,
            shenDebtType: res.changes.shenDebt === false ? null : st.shenDebtType,
            eventLog: [...st.eventLog, `[第${s.day}日] ${res.message}`, ...res.eventLog],
          })
        );
        return { ok: res.ok, message: res.message };
      },

      /** 处理被栽赃事件（A 找证据 / B 花钱摆平 / C 死不认账） */
      resolveFramedMoment: (choiceId: 'evidence' | 'payoff' | 'deny', rng: () => number = Math.random): { ok: boolean; message: string } | null => {
        const s = get();
        const res = resolveFramed(
          choiceId,
          {
            day: s.day,
            score: s.score,
            silver: s.silver,
            reputation: s.reputation,
            energy: s.energy,
            hasClue: (s.clues ?? []).length > 0,
            fuyinFavor: s.fuyinFavor ?? 20,
          },
          rng
        );
        if (!res.ok) return res;
        set((st) =>
          syncCompat(st, {
            ...res.changes,
            framedOpen: false,
            eventLog: [...st.eventLog, `[第${s.day}日] ${res.message}`, ...res.eventLog],
          })
        );
        return { ok: true, message: res.message };
      },

      /** 每日打烊检查被栽赃（评分≥3.0 约 3%/日；触发置 framedOpen=true） */
      checkFramedMoment: (rng: () => number = Math.random): void => {
        const s = get();
        if (s.phase !== 'playing' || s.framedOpen) return;
        const moment = checkFramed(
          {
            day: s.day,
            score: s.score,
            silver: s.silver,
            reputation: s.reputation,
            energy: s.energy,
            hasClue: (s.clues ?? []).length > 0,
            fuyinFavor: s.fuyinFavor ?? 20,
          },
          rng
        );
        if (moment.triggered) {
          set({
            framedOpen: true,
            eventLog: [...s.eventLog, `[第${s.day}日] 被栽赃：${moment.title}`],
          });
        }
      },

      /** 每日打烊检查沈听澜人情债时机（shenDebt=true 且 15% 概率触发；置 shenDebtMomentOpen=true） */
      checkShenDebtMoment: (rng: () => number = Math.random): void => {
        const s = get();
        if (s.phase !== 'playing' || s.shenDebtMomentOpen) return;
        const moment = checkShenDebtMoment(
          {
            day: s.day,
            silver: s.silver,
            reputation: s.reputation,
            shenTinglanFavor: s.shenTinglanFavor,
            xieQiFavor: s.xieQiFavor,
            shenDebt: s.shenDebt,
          },
          rng
        );
        if (!moment.triggered) return;
        // 15% 概率触发（纯函数只判 shenDebt；概率由 store 侧掷骰，注释）
        if (rng() >= 0.15) return;
        set({ shenDebtMomentOpen: true });
      },

      // ============================================================
      // TANG-MIST-001：迷雾系统 actions（区域 / 势力 / 人物三类迷雾）
      // 纯函数在 systems/tang-fog.ts；本 store 只做「读取 + 应用 + 记 eventLog」接线。
      // ============================================================

      /** 每日打烊批量揭示（按好感度/线索数；返回本次新揭示列表供浮层/手札用） */
      checkFogReveals: (): FogRevealResult[] => {
        const s = get();
        // TANG-MIST-002：六位新 NPC 迷雾条目补全（文案来自 config；M1 接口填数据）
        const fog = ensureNpcFogSystem(s.fogOfWar, s.gameNPCs);
        const res = checkFogRevealsSystem({ ...regionRevealState(s), fogOfWar: fog });
        if (res.revealed.length > 0 || fog !== s.fogOfWar) {
          set((st) => ({
            fogOfWar: res.fogOfWar,
            eventLog: [
              ...st.eventLog,
              ...res.revealed.map((r) => `fog-reveal:${r.kind}:${r.id}:${r.infoType}:${st.day}`),
            ],
          }));
        }
        return res.revealed;
      },

      /** 区域揭示（午后探访/闲聊情报/快速移动调用）；不存在或已揭示返回 ok=false */
      revealRegion: (nodeId: string): { ok: boolean; nodeName?: string; hint?: string } | null => {
        const s = get();
        const res = revealRegionSystem(regionRevealState(s), nodeId);
        if (!res.changed) return { ok: false };
        set((st) => ({
          fogOfWar: res.fogOfWar,
          eventLog: [...st.eventLog, `fog-region:${nodeId}:${st.day}`],
        }));
        return { ok: true, nodeName: res.nodeName, hint: res.region?.hint };
      },

      /** 势力单点揭示（任务/情报强制揭示；幂等） */
      revealFactionInfo: (factionId: string, infoType: FactionInfoType): void => {
        const s = get();
        const res = revealFactionInfoSystem(regionRevealState(s), factionId, infoType);
        if (res.changed) {
          set((st) => ({
            fogOfWar: res.fogOfWar,
            eventLog: [...st.eventLog, `fog-faction-info:${factionId}:${infoType}:${st.day}`],
          }));
        }
      },

      /** NPC 单点揭示（专属事件后完整故事；幂等） */
      revealNPCInfo: (npcId: string, infoType: NPCInfoType): void => {
        const s = get();
        const res = revealNPCInfoSystem(regionRevealState(s), npcId, infoType);
        if (res.changed) {
          set((st) => ({
            fogOfWar: res.fogOfWar,
            eventLog: [...st.eventLog, `fog-npc-info:${npcId}:${infoType}:${st.day}`],
          }));
        }
      },

      /**
       * 午后「探访未知区域」（TANG-MIST-001 模块一）：消耗 10 精力 + 1 次午后行动，
       * 揭示 1-2 个未探明 L2/L3 点位。独立于 performAfternoonAction（其归属 C 子任务），
       * 纯函数 performExploreRegions 返回应揭示点位，store 逐条 revealRegion 落库。
       */
      exploreUnknownRegion: (rng: () => number = Math.random): { ok: boolean; reason?: string; revealedIds?: string[]; narrative?: string } | null => {
        const s = get();
        if (s.phase !== 'playing') return { ok: false, reason: '当前不可外出探访' };
        if (s.dailyActionsRemaining <= 0) return { ok: false, reason: '今日行动次数已用完' };
        if (s.afternoonActions.includes('explore_unknown_region')) return { ok: false, reason: '今日已探访过未知区域' };
        if (s.energy < EXPLORE_ENERGY_COST) return { ok: false, reason: `精力不足（需 ${EXPLORE_ENERGY_COST}）` };
        const out = performExploreRegions(regionRevealState(s), rng);
        if (out.revealedIds.length === 0) {
          // 无未探明区域：不消耗行动/精力（防御；UI 一般已隐藏按钮）
          return { ok: false, reason: '城中已无可探访的未知之处' };
        }
        let fog = s.fogOfWar;
        for (const id of out.revealedIds) {
          const res = revealRegionSystem({ ...regionRevealState(s), fogOfWar: fog }, id);
          if (res.changed) fog = res.fogOfWar;
        }
        set(syncCompat(s, {
          fogOfWar: fog,
          energy: clamp(s.energy - EXPLORE_ENERGY_COST, 0, 100),
          dailyActionsRemaining: Math.max(0, s.dailyActionsRemaining - 1),
          afternoonActions: [...s.afternoonActions, 'explore_unknown_region'],
          dailyEnergyConsumed: s.dailyEnergyConsumed + EXPLORE_ENERGY_COST,
          eventLog: [...s.eventLog, `afternoon:explore_unknown_region:${s.day}`, `[第${s.day}日] ${out.narrative}`],
        }));
        return { ok: true, revealedIds: out.revealedIds, narrative: out.narrative };
      },

      // ============================================================
      // TANG-MIST-002：长安故人 · 六位新 NPC actions
      // 纯函数在 systems/tang-npc-system.ts；本 store 只做「读取 + 应用 + 记 eventLog」接线。
      // ============================================================

      /** 每日打烊检查六位 NPC 登场条件（locked→available→active）；返回本次新登场 id */
      checkNPCUnlocks: (): string[] => {
        const s = get();
        const res = checkNPCUnlocksSystem(npcUnlockStateOf(s));
        const changed =
          res.newlyUnlocked.length > 0 || res.hintEvents.length > 0 || res.legacyDebtClearedDay !== (s.legacyDebtClearedDay ?? null);
        if (!changed) return [];
        const patch: Partial<TangManagerStore> = {
          gameNPCs: res.npcs,
          legacyDebtClearedDay: res.legacyDebtClearedDay,
          eventLog: [...s.eventLog, ...res.hintEvents],
        };
        if (res.luBoConvoTarget !== undefined) patch.luBoConvoTarget = res.luBoConvoTarget;
        set(syncCompat(s, patch));
        // 登场 NPC 迷雾条目补全 + 好感阈值揭示
        const after = get();
        const fog = ensureNpcFogSystem(after.fogOfWar, after.gameNPCs);
        if (fog !== after.fogOfWar) set({ fogOfWar: fog });
        get().checkFogReveals();
        return res.newlyUnlocked;
      },

      /** 好感增减（clamp 0-100；跨阈值专属功能解锁 + 迷雾揭示） */
      updateNPCFavor: (npcId: string, amount: number): void => {
        const s = get();
        if (!s.gameNPCs[npcId]) return;
        const res = updateNPCFavorPure(s.gameNPCs, npcId, amount);
        if (res.favorDelta === 0 && res.functionUnlocks.length === 0) return;
        const patch: Partial<TangManagerStore> = { gameNPCs: res.npcs };
        if (res.flags.chengCooperation !== undefined) patch.chengCooperation = res.flags.chengCooperation;
        if (res.flags.chengDiscountCategory !== undefined) patch.chengDiscountCategory = res.flags.chengDiscountCategory;
        if (res.flags.sadiHiddenRoute !== undefined) patch.sadiHiddenRoute = res.flags.sadiHiddenRoute;
        if (res.flags.sadiJadeGift !== undefined) patch.sadiJadeGift = res.flags.sadiJadeGift;
        if (res.flags.shangguanCourtIntro !== undefined) patch.shangguanCourtIntro = res.flags.shangguanCourtIntro;
        if (res.functionUnlocks.length > 0) {
          patch.eventLog = [...s.eventLog, ...res.functionUnlocks.map((t) => `[第${s.day}日] ${t}`)];
        }
        set(syncCompat(s, patch));
        get().checkFogReveals();
      },

      /** 拜访 NPC（长安故人六位；3 天冷却 + 1 次午后行动 + 15 精力；好感 +3~8、20% 情报） */
      visitNpc: (npcId: string, rng: () => number = Math.random): ActionResult | null => {
        const s = get();
        if (s.phase !== 'playing' || s.dailyActionsRemaining <= 0 || s.afternoonActions.includes('visit_npc')) {
          return null;
        }
        const npc = s.gameNPCs[npcId];
        if (!npc || npc.status !== 'active') return null;
        if (!npcVisitCooldownOk(s.day, s.npcVisitCooldowns?.[npcId])) return null;
        if (s.energy < NPC_VISIT_ENERGY_COST) return null;
        const visit = performNpcVisit(
          {
            day: s.day,
            npc,
            favor: npc.favor,
            lastVisitDay: s.npcVisitCooldowns?.[npcId],
            convoCount: s.npcConvoCounts?.[npcId] ?? 0,
            convoTarget: s.luBoConvoTarget ?? 5,
            luBoStoryRevealed: s.luBoStoryRevealed ?? false,
          },
          rng
        );
        if (!visit.ok) {
          set((st) => ({ eventLog: [...st.eventLog, `[第${st.day}日] ${visit.narrative}`] }));
          return null;
        }
        // 好感增减 + 跨阈值功能解锁
        const favorRes = updateNPCFavorPure(s.gameNPCs, npcId, visit.favorDelta);
        const eventAdd: string[] = [`afternoon:visit_npc:${s.day}`, `[第${s.day}日] ${visit.narrative}`];
        if (visit.familyStoryLine) eventAdd.push(`[第${s.day}日] 陆伯顿了顿，说起一段旧事：${visit.familyStoryLine}`);
        if (visit.decreePreview) eventAdd.push(`[第${s.day}日] ${visit.decreePreview}`);
        // K3 修复（2026-08-06）：上官政令预知 → 实际预生成 Decree（此前仅静态文案，未生成政令对象）
        let extraDecrees: Decree[] | undefined;
        if (visit.decreePreview) {
          const d = generateImperialDecree({ day: s.day, decrees: s.decrees ?? [] });
          if (d) extraDecrees = [...(s.decrees ?? []), d];
        }
        if (visit.ayingClueHint) eventAdd.push(`[第${s.day}日] ${visit.ayingClueHint}`);
        for (const t of favorRes.functionUnlocks) eventAdd.push(`[第${s.day}日] ${t}`);

        const patch: Partial<TangManagerStore> = {
          gameNPCs: favorRes.npcs,
          npcVisitCooldowns: { ...(s.npcVisitCooldowns ?? {}), [npcId]: s.day },
          energy: clamp(s.energy - NPC_VISIT_ENERGY_COST, 0, 100),
          dailyActionsRemaining: Math.max(0, s.dailyActionsRemaining - 1),
          afternoonActions: [...s.afternoonActions, 'visit_npc'],
          dailyEnergyConsumed: s.dailyEnergyConsumed + NPC_VISIT_ENERGY_COST,
          eventLog: [...s.eventLog, ...eventAdd],
          ...(extraDecrees ? { decrees: extraDecrees } : {}),
        };
        if (npcId === 'lu_old_servant') {
          const nextCount = (s.npcConvoCounts?.[npcId] ?? 0) + 1;
          patch.npcConvoCounts = { ...(s.npcConvoCounts ?? {}), [npcId]: nextCount };
          if (visit.storyComplete && !s.luBoStoryRevealed) {
            patch.luBoStoryRevealed = true;
            patch.eventLog = [
              ...(patch.eventLog ?? []),
              `[第${s.day}日] 陆伯将半块玉牌郑重放到你手心：“少爷，陆家的冤屈，就托付给你了。”`,
            ];
          }
        }
        if (favorRes.flags.chengCooperation !== undefined) patch.chengCooperation = favorRes.flags.chengCooperation;
        if (favorRes.flags.chengDiscountCategory !== undefined) patch.chengDiscountCategory = favorRes.flags.chengDiscountCategory;
        if (favorRes.flags.sadiHiddenRoute !== undefined) patch.sadiHiddenRoute = favorRes.flags.sadiHiddenRoute;
        if (favorRes.flags.sadiJadeGift !== undefined) patch.sadiJadeGift = favorRes.flags.sadiJadeGift;
        if (favorRes.flags.shangguanCourtIntro !== undefined) patch.shangguanCourtIntro = favorRes.flags.shangguanCourtIntro;
        set(syncCompat(s, patch));

        // 迷雾揭示（好感跨阈值 40/60/80）
        get().checkFogReveals();
        // 陆伯往事集齐 → 完整隐藏故事揭示（专属事件后）
        if (npcId === 'lu_old_servant' && visit.storyComplete && !s.luBoStoryRevealed) {
          get().revealNPCInfo('lu_old_servant', 'fullStory');
        }
        // 阿萤沈听澜隐藏线索（好感 ≥50 → generateClue 沈线）
        if (visit.ayingClueHint) {
          const clue = generateClueSystem('阿萤', 'npc', 'shen', { day: s.day, clues: s.clues ?? [] });
          if (clue) get().addClue(clue);
        }
        // 拜访 20% 情报线索落库（kind=clue）
        if (visit.intel?.kind === 'clue' && visit.intel.clueCategory) {
          const clue = generateClueSystem(npc.name, 'npc', visit.intel.clueCategory, { day: s.day, clues: s.clues ?? [] });
          if (clue) get().addClue(clue);
        }
        // 非线索情报叙事（势力动向/行业预告）入 eventLog
        if (visit.intel && visit.intel.kind !== 'clue') {
          set((st) => ({ eventLog: [...st.eventLog, `[第${st.day}日] ${visit.intel!.text}`] }));
        }
        return {
          actionId: 'visit_npc',
          label: `拜访${npc.name}`,
          energyDelta: -NPC_VISIT_ENERGY_COST,
          narrative: visit.narrative,
          dialogue: visit.dialogue,
          intel: visit.intel,
        } as ActionResult;
      },

      /** 苏大娘买情报（3 天冷却；5 两 + 5 精力；1-3 条情报；region 情报揭示点位） */
      buyInformation: (npcId: string, rng: () => number = Math.random): { ok: boolean; reason?: string; narrative?: string; intelCount?: number } | null => {
        const s = get();
        if (npcId !== 'su_daniang') return { ok: false, reason: '此人并无情报可卖' };
        const npc = s.gameNPCs['su_daniang'];
        if (!npc || npc.status !== 'active') return { ok: false, reason: '苏大娘尚未登场' };
        if (!suDaniangCooldownOk(s.day, s.suDaniangLastIntelDay)) {
          return { ok: false, reason: `三日内已买过情报（冷却 ${SU_DANIANG_INTEL_COOLDOWN_DAYS} 日）` };
        }
        if (s.silver < SU_DANIANG_INTEL_PRICE) return { ok: false, reason: `银两不足（需 ${SU_DANIANG_INTEL_PRICE} 两）` };
        if (s.energy < SU_DANIANG_INTEL_ENERGY) return { ok: false, reason: `精力不足（需 ${SU_DANIANG_INTEL_ENERGY}）` };
        const out = performBuyInformation(npcIntelContextOf(s), rng);
        if (!out.ok) return { ok: false, reason: out.narrative };
        let fog = s.fogOfWar;
        for (const it of out.intel) {
          if (it.kind === 'region' && it.regionNodeId) {
            const res = revealRegionSystem({ ...regionRevealState(s), fogOfWar: fog }, it.regionNodeId);
            if (res.changed) fog = res.fogOfWar;
          }
        }
        set(syncCompat(s, {
          silver: Math.max(0, s.silver - SU_DANIANG_INTEL_PRICE),
          energy: clamp(s.energy - SU_DANIANG_INTEL_ENERGY, 0, 100),
          dailyEnergyConsumed: s.dailyEnergyConsumed + SU_DANIANG_INTEL_ENERGY,
          suDaniangLastIntelDay: s.day,
          fogOfWar: fog,
          eventLog: [...s.eventLog, `npc-intel:su_daniang:${s.day}`, `[第${s.day}日] ${out.narrative}`, ...out.intel.map((i) => `[第${s.day}日] ${i.text}`)],
        }));
        return { ok: true, narrative: out.narrative, intelCount: out.intel.length };
      },

      /** 阿萤赎身（阿昭好感 ≥80 明确后；支付 100 两 → 登场帮店） */
      redeemAying: (): { ok: boolean; reason?: string; narrative?: string } | null => {
        const s = get();
        const npc = s.gameNPCs['a_ying'];
        if (!npc || npc.status !== 'available') return { ok: false, reason: '阿萤尚未可赎' };
        if (s.ayingRefused) return { ok: false, reason: '你已婉拒过赎身之事' };
        const check = redeemAyingPure(s.silver);
        if (!check.ok) return { ok: false, reason: check.reason };
        set(syncCompat(s, {
          silver: Math.max(0, s.silver - AYING_REDEEM_PRICE),
          gameNPCs: { ...s.gameNPCs, a_ying: { ...npc, status: 'active', location: '店门口 · 陆记老店（帮店）' } },
          ayingInShopDays: 0,
          eventLog: [
            ...s.eventLog,
            `npc-redeem:a_ying:${s.day}`,
            `[第${s.day}日] 你备好 100 两银子，替阿萤赎了身。她换下歌衫，怯怯地朝你磕了个头：“掌柜大恩，阿萤此生不忘。”当晚，她与阿昭相认，兄妹抱头痛哭。`,
          ],
        }));
        get().checkFogReveals();
        return { ok: true, narrative: '你替阿萤赎了身。她如今在店里帮衬，与阿昭兄妹相认，店里也添了几分生气。' };
      },

      /** 婉拒阿萤赎身（阿昭好感归零 + 离职 + 带走一半熟客） */
      refuseAying: (): { ok: boolean; reason?: string; narrative?: string } | null => {
        const s = get();
        const npc = s.gameNPCs['a_ying'];
        if (!npc || npc.status !== 'available') return { ok: false, reason: '阿萤尚未可赎' };
        const res = refuseAyingPure(s.knownGuests ?? {});
        set(syncCompat(s, {
          xiaoerFavor: 0,
          xiaoerGone: true,
          ayingRefused: true,
          knownGuests: res.knownGuests,
          gameNPCs: { ...s.gameNPCs, a_ying: { ...npc, status: 'locked' } },
          eventLog: [
            ...s.eventLog,
            `npc-refuse:a_ying:${s.day}`,
            `[第${s.day}日] 你终究没有拿出那 100 两。阿萤远远望着你，眼底的光一点点暗下去，转身没入平康坊的灯火。阿昭得知后，心灰意冷，留下一纸辞书离了店，店里一半熟客也跟着散了。`,
          ],
        }));
        return { ok: true, narrative: '你婉拒了赎身之事。阿昭伤心离去，店里熟客散了一半，一片萧索。' };
      },

      /** 苏大娘每月主动送情报（好感 ≥60；月终打烊概率触发；打烊钩子） */
      maybeFreeIntelFromSuDaniang: (rng: () => number = Math.random): string | null => {
        const s = get();
        const npc = s.gameNPCs['su_daniang'];
        if (!npc || npc.status !== 'active') return null;
        if (!suDaniangFreeIntelRoll(s.day, npc.favor, rng)) return null;
        const narrative = performSuDaniangFreeIntel(npcIntelContextOf(s), rng);
        set((st) => ({ eventLog: [...st.eventLog, `[第${st.day}日] ${narrative}`] }));
        return narrative;
      },

      /** 地图定位请求（NPC 详情「在地图上查看」→ 长安舆图自动聚焦；null 清空） */
      setMapLocateNode: (nodeId: string | null): void => {
        set({ mapLocateNodeId: nodeId });
      },

      // ============================================================
      // TANG-MIST-003 M3：地图功能增强 actions（节点繁荣度 / 标记 / 快速移动 / 路线规划）
      // 纯函数在 systems/tang-node-prosperity.ts / tang-map-routing.ts；store 只做接线。
      // ============================================================

      /** 记录今日玩家在节点有交易（采买/卖出/镖队到达；次日清晨繁荣度结算消费后重置） */
      noteNodeTrade: (nodeId: string): void => {
        set((s) => ({
          todayTradedNodes: Array.from(new Set([...(s.todayTradedNodes ?? []), nodeId])),
        }));
      },

      /** 每日清晨节点繁荣度结算（独立入口；startNewDay 已接线，此处供 UI/测试复用；幂等——消费今日交易清单） */
      updateNodeProsperityDaily: (): void => {
        const s = get();
        const res = updateNodeProsperity({
          day: s.day,
          nodeProsperity: s.nodeProsperity ?? {},
          tradedNodeIds: s.todayTradedNodes ?? [],
          mapEvents: (s.mapEvents ?? []).filter((e) => e.status === 'active'),
        });
        set(syncCompat(s, { nodeProsperity: res.nodeProsperity, todayTradedNodes: [] }));
      },

      /** 放置自定义标记（已探访节点；最多 5 个；默认名=节点名，可输入） */
      placeMarker: (nodeId: string, label?: string): { ok: boolean; reason?: string } => {
        const s = get();
        if (!s.visitedNodes.includes(nodeId)) return { ok: false, reason: '尚未探访该处，不可立标' };
        if ((s.playerMarkers ?? []).some((m) => m.nodeId === nodeId)) return { ok: false, reason: '该处已有标记' };
        if ((s.playerMarkers ?? []).length >= 5) return { ok: false, reason: '标记至多五处，请先撤去一处分旗' };
        const nodeName = MAP_NODE_MAP[nodeId]?.name ?? nodeId;
        set((st) => ({
          playerMarkers: [
            ...(st.playerMarkers ?? []),
            { id: `marker-${uuidv4()}`, nodeId, label: (label?.trim() || nodeName).slice(0, 12), placedDay: st.day },
          ],
        }));
        return { ok: true };
      },

      /** 撤去自定义标记 */
      removeMarker: (markerId: string): void => {
        set((st) => ({ playerMarkers: (st.playerMarkers ?? []).filter((m) => m.id !== markerId) }));
      },

      /** 快速移动：消耗 10 精力瞬间到达已探访节点；路径经过未探访节点 20% 自动揭示；rng 可注入 */
      quickTravelTo: (
        nodeId: string,
        rng: () => number = Math.random
      ): { ok: boolean; reason?: string; revealedNodeIds?: string[]; interaction?: string } | null => {
        const s = get();
        if (s.phase !== 'playing') return { ok: false, reason: '当前不可出行' };
        if (s.energy < QUICK_TRAVEL_ENERGY_COST) return { ok: false, reason: `精力不足（需 ${QUICK_TRAVEL_ENERGY_COST}）` };
        if (!s.visitedNodes.includes(nodeId)) return { ok: false, reason: '尚未探访该处，不可直奔' };
        const node = MAP_NODE_MAP[nodeId];
        if (!node) return { ok: false, reason: '点位不存在' };
        // 自本店（陆记老店）出发的路径节点（途经未探访节点 20% 揭示）
        const plan = planOptimalRoute({ from: 'luji-laodian', to: nodeId, mode: 'shortest', state: buildTradeContext(s) });
        const pathNodeIds = plan.ok && plan.plan ? [...plan.plan.nodeIds, nodeId] : [nodeId];
        const reveal = maybeRevealPathOnTravel({ fogOfWar: s.fogOfWar, nodeIds: pathNodeIds, rng });
        const newVisited = Array.from(new Set([...s.visitedNodes, ...pathNodeIds]));
        const patch: Partial<TangManagerStore> = {
          energy: clamp(s.energy - QUICK_TRAVEL_ENERGY_COST, 0, 100),
          dailyEnergyConsumed: s.dailyEnergyConsumed + QUICK_TRAVEL_ENERGY_COST,
          visitedNodes: newVisited,
          eventLog: [...s.eventLog, `quick-travel:${nodeId}:${s.day}`],
        };
        if (reveal.fogOfWar !== s.fogOfWar) {
          patch.fogOfWar = reveal.fogOfWar;
          patch.eventLog = [
            ...(patch.eventLog ?? []),
            ...reveal.revealedNodeIds.map((id) => `fog-travel-reveal:${id}:${s.day}`),
          ];
        }
        set(syncCompat(s, patch));
        return { ok: true, revealedNodeIds: reveal.revealedNodeIds, interaction: nodeInteractionLabel(node) };
      },

      /** 路线规划（最短=天数最少 / 最安全=风险最低优先绿通）；写入 mapRoutePlan */
      setRoutePlan: (from: string, to: string, mode: 'shortest' | 'safest'): { ok: boolean; reason?: string; plan?: MapRoutePlan } => {
        const res = planOptimalRoute({ from, to, mode, state: buildTradeContext(get()) });
        if (!res.ok || !res.plan) return { ok: false, reason: res.reason };
        set({ mapRoutePlan: res.plan });
        return { ok: true, plan: res.plan };
      },

      /** 清除路线规划 */
      clearRoutePlan: (): void => {
        set({ mapRoutePlan: null });
      },

      /** 预填镖队路线并跳转镖队面板（复用 setupCaravanRoute；caravan-panel 挂载消费后清空） */
      prefillCaravanRoute: (from: string, to: string, routeIdHint?: string): void => {
        const route = routeIdHint
          ? TRADE_ROUTE_MAP[routeIdHint]
          : TRADE_ROUTES.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
        set({ mapCaravanPrefill: { from, to, routeId: route?.id ?? '' }, requestedNavPanel: 'caravan' });
      },

      /** 消费镖队预填（caravan-panel 挂载后调用；幂等） */
      consumeMapCaravanPrefill: (): void => {
        set({ mapCaravanPrefill: null });
      },

      /** 面板跳转请求（page.tsx 消费后清空；reception 回经营视图，其余进看板） */
      requestNavPanel: (key: string | null): void => {
        set({ requestedNavPanel: key });
      },

      /** 消费标记节点新动态提示（map-panel 挂载后展示并清空） */
      consumeMapMarkerNotices: (): void => {
        set({ mapMarkerNotices: [] });
      },

      /** 结算当日（不推天数）：应用全部变更后自动 startNewDay；silver≤0 则进入破产（3.6）；
       *  Step 5b：每日打烊结算投资到期（checkInvestmentMaturity）。 */
      settleDay: (): DaySettlement | null => {
        const s = get();
        if (s.phase !== 'playing') {
          return null;
        }
        const result = settleDaySystem(s);
        // 内容深化 TANG-CONT-C 模块五：离场事件（每日结算按当日情况触发；纯函数返回结果，store 应用）
        const departure = rollDepartureEvent(
          {
            shopAtmosphere: s.shopAtmosphere ?? 50,
            todayComplaints: s.todayComplaints ?? 0,
            hasSatisfiedGuest: (s.guests ?? []).some((g) => (g.satisfaction ?? 0) >= 90),
          },
          Math.random
        );
        const departureSilver = departure.silverDelta ?? 0;
        const departureAtmosphere = departure.atmosphereDelta ?? 0;
        const departureExtraGuests = departure.nextDayExtraGuests ?? 0;
        // Step 5b-2：地图事件收益修正（特价助益/涨价受损，clamp 0.5-1.5；见 mapEventIncomeFactor）
        const incomeFactor = mapEventIncomeFactor(s.mapEvents ?? []);
        // TANG-ADD-001 占候接线（结算）：泰卦 收益×1.15 → 净收益；震卦 客消±20% → 客单消费；
        // 离卦 大单+30% → 大单收入；兑卦 夸奖+20% → 声望变动（见下）。
        const rawIncome = result.settlement.netIncome * incomeFactor;
        const hex = s.todayHexagram;
        const hexIncome = applyHexagramEffect(hex, { baseIncome: rawIncome });
        let netIncome = Math.round((hexIncome.baseIncome ?? rawIncome) * 100) / 100;
        const hexGuest = applyHexagramEffect(hex, { guestIncome: result.settlement.guestIncome });
        if (hexGuest.guestIncome !== result.settlement.guestIncome) {
          netIncome = Math.round((netIncome - result.settlement.guestIncome + (hexGuest.guestIncome ?? result.settlement.guestIncome)) * 100) / 100;
        }
        const bigOrderIncome = (s.guests ?? []).filter((g) => g.type === 'big_order' && g.handled).reduce((sum, g) => sum + (g.incomeEarned ?? 0), 0);
        const hexBig = applyHexagramEffect(hex, { bigOrderIncome });
        if (hexBig.bigOrderIncome !== bigOrderIncome) {
          netIncome = Math.round((netIncome - bigOrderIncome + (hexBig.bigOrderIncome ?? bigOrderIncome)) * 100) / 100;
        }
        // 兑卦 夸奖+20%：声望变动 ×1.2（夸奖带来声望；工程定接线，注释）
        const hexPraise = applyHexagramEffect(hex, { praiseChance: 0 });
        const praiseFactor = 1 + (hexPraise.praiseChance ?? 0);
        const newSilver = s.silver + netIncome;
        // Step 5b：投资到期结算（每日打烊；风险/盈亏由 applyInvestmentMaturity 应用；
        // 传入已含当日净收益的 silver，避免到期盈亏覆盖掉当日经营收入）
        const matured = checkInvestmentMaturity({ day: s.day, investments: s.investments ?? [] });
        const investPatch =
          matured.length > 0 ? applyInvestmentMaturity({ ...s, silver: newSilver }, matured) : {};
        const silverAfterInvest = (investPatch.silver as number | undefined) ?? newSilver;
        // 过劳后的员工（2.6 ⑤）
        const afterOverworkEmployees = result.suggestions.employees ?? s.employees;
        // 员工事件（2.5）
        const employeeEvents = checkEmployeeEvents({ ...s, employees: afterOverworkEmployees });
        const empApplied = applyEmployeeEvents(afterOverworkEmployees, employeeEvents, s.day);
        // TANG-SOC-001：社交类员工事件（模块六 6.1）——轻量接入：得当处理才入队（store 提供处理入口）
        const socialEvents = checkSocialEmployeeEvents({ ...s, employees: empApplied.employees });
        // TANG-SOC-001：每日打烊演化内部交情（evolveRelations）
        const relationsRes = evolveRelations(empApplied.employees, {}, Math.random);
        const silverAfterEvents = silverAfterInvest + empApplied.goldDelta;
        // Step 5b-2：active 事件被动效果（gold/reputation 每打烊应用）+ 过期清理（忽略的施加一次性负面）
        const passiveEffects = getActiveMapEventEffects(s.mapEvents ?? []);
        let mapGoldDelta = 0;
        let mapRepDelta = 0;
        for (const eff of passiveEffects) {
          mapGoldDelta += eff.goldChange ?? 0;
          mapRepDelta += eff.reputationChange ?? 0;
        }
        const expired = expireMapEvents({ mapEvents: s.mapEvents ?? [], day: s.day });
        for (const eff of expired.negativeEffects) {
          mapGoldDelta += eff.goldChange ?? 0;
          mapRepDelta += eff.reputationChange ?? 0;
        }
        const silverFinal = silverAfterEvents + mapGoldDelta + departureSilver;
        // 赌瘾（3.3）
        const nextAddiction = s.gamblingAddictionDays > 0 ? Math.max(0, s.gamblingAddictionDays - 1) : 0;
        // 内容深化 TANG-CONT-B 模块六·2：成就解锁即发放微小永久 Buff（一次性声望/评分奖励）
        // （grep 确认原实现只记 unlockedAchievements，奖励纯文案不落账；此处补 applyAchievementReward）
        let rewardRepDelta = 0;
        let rewardScoreDelta = 0;
        for (const id of result.newlyUnlocked) {
          const r = applyAchievementReward(s, id);
          rewardRepDelta += r.reputationDelta;
          rewardScoreDelta += r.scoreDelta;
        }
        const mapLedger: LedgerEntry[] = mapGoldDelta !== 0
          ? [{ day: s.day, project: '地图事件', category: mapGoldDelta < 0 ? '支出' : '经营', amount: Math.round(mapGoldDelta * 100) / 100 }]
          : [];
        // 内容深化 TANG-CONT-C 模块五：离场「遗落物品」入账（钱袋）
        const departureLedger: LedgerEntry[] = departureSilver !== 0
          ? [{ day: s.day, project: '客人遗落', category: '经营', amount: departureSilver }]
          : [];
        set((st) =>
          syncCompat(st, {
            silver: silverFinal,
            score: clamp(st.score + result.scoreChange + rewardScoreDelta, 1.0, 5.0),
            reputation: clamp(st.reputation + Math.round((result.reputationChange * praiseFactor + mapRepDelta + rewardRepDelta) * 100) / 100, 0, 1000),
            xiaoerFavor: clamp(st.xiaoerFavor + result.xiaoerFavorChange, 0, 100),
            ledger: appendLedger(st.ledger, [...result.ledgerEntries, ...mapLedger, ...departureLedger]),
            unlockedAchievements: mergeUnique(st.unlockedAchievements, result.newlyUnlocked),
            todaySettlement: { ...result.settlement, netIncome },
            totalNetProfit: st.totalNetProfit + netIncome,
            // TANG-ADD-001：今日净利（要务/赌约判定输入；startNewDay 重置）
            todayNetProfit: netIncome,
            // TANG-TRF-001 周级要务：本周净利累加（周日打烊结算）
            weeklyTaskProgress: addWeeklyProgressSystem(st.weeklyTaskProgress, 'week-net-profit', netIncome),
            gamblingAddictionDays: nextAddiction,
            employees: relationsRes.employees,
            employeeRelations: flattenRelations(relationsRes.employees),
            employeeBonusRate: empApplied.bonusRate,
            specialEmployeeStoryCompleted:
              st.specialEmployeeStoryCompleted || empApplied.specialStoryCompleted,
            mapEvents: expired.events,
            // TANG-RCP-001 7.2：气氛已影响当日基础收益（settleDay 纯函数），打烊重置 50；
            // 内容深化 TANG-CONT-C 模块五：离场事件「满意而归/摔门而去」在重置基础上叠加（次日生效）
            shopAtmosphere: clamp(50 + departureAtmosphere, 0, 100),
            // 内容深化 TANG-CONT-C 模块五：离场「带新客来」→ 次日 +N 客（startNewDay 消费后清零）
            nextDayExtraGuests: (st.nextDayExtraGuests ?? 0) + departureExtraGuests,
            ...(departure.item
              ? {
                  shopItems: mergeByName(st.shopItems, {
                    id: `dropped-${departure.item.name}-${s.day}`,
                    name: departure.item.name,
                    price: departure.item.price,
                    cost: Math.round(departure.item.price * 0.5 * 100) / 100,
                    stock: 1,
                    category: departure.item.category,
                    volume: 1,
                    expiry: -1,
                    status: 'normal',
                  }),
                }
              : {}),
            eventLog: [
              ...st.eventLog,
              `[第${s.day}日] ${departure.narrative}`,
              ...(result.suggestions.eventLog ?? []),
              ...empApplied.eventLogAdditions,
              ...socialEvents.map((ev) => `emp-social:${ev.type}:${ev.employeeName}:${st.day}`),
              ...result.newlyUnlocked.map((id) => `ach-reward:${id}:${st.day}`),
            ],
            ...investPatch,
            ...(matured.length > 0 ? { lastInvestmentResults: matured } : {}),
          })
        );
        // 内容深化 TANG-CONT-C 模块五：离场「遗落书信」→ 线索落库（sourceType=event）
        if (departure.clue) {
          const clue = generateClueSystem(departure.clue.source, 'event', departure.clue.category, {
            day: s.day,
            clues: s.clues ?? [],
          });
          if (clue) {
            get().addClue(clue);
          }
        }
        // Step 5b-1.5 打烊：陈损递减 → 移除陈损（账本记「陈损」支出；旁白提示）
        const expiryUpdate = updateExpiry(get().shopItems);
        const expiredResult = removeExpiredGoods(expiryUpdate.items);
        if (expiryUpdate.expiredIds.length > 0 || expiryUpdate.nearIds.length > 0 || expiredResult.expiredItems.length > 0) {
          set((st) => {
            const patch: Partial<TangManagerStore> = {
              shopItems: expiredResult.remainingItems,
              ledger: appendLedger(st.ledger, [
                ...(expiredResult.totalLoss > 0
                  ? [{ day: st.day, project: '陈损', category: '支出' as const, amount: -expiredResult.totalLoss }]
                  : []),
              ]),
            };
            if (expiredResult.expiredItems.length > 0) {
              patch.inventoryNarratives = pushNarrative(st.inventoryNarratives, inventoryNarrative('expired'));
            } else if (expiryUpdate.nearIds.length > 0) {
              patch.inventoryNarratives = pushNarrative(st.inventoryNarratives, inventoryNarrative('nearExpiry'));
            }
            return patch;
          });
        }
        // ---- TANG-ADD-001 打烊钩子（结算入账后：今日要务 / 遗命完成 / 赌约 / 稀有事件 / 商阶 / 月度总结）----
        get().checkDailyTasks();
        get().checkLegacyQuestCompletion();
        get().resolveBet();
        get().checkRareEvents();
        get().evaluateRank();
        // TANG-TRF-001 周级要务：周日（day%7===0）打烊结算本周要务奖励（周一 startNewDay 刷新）
        if (s.day % 7 === 0) {
          get().settleWeeklyTasks();
        }
        if (get().day % 30 === 0) {
          get().generateMonthlyReview();
        }
        // ---- 内容深化 TANG-CONT-D：连续盈利天数 + 负反馈 / 被栽赃 / 人情债 打烊钩子 ----
        // 连续盈利天数（树大招风/集体涨薪判定）：netIncome>0 递增，否则归零
        const profitStreak = (s.consecutiveProfitDays ?? 0) + (netIncome > 0 ? 1 : 0);
        if (profitStreak !== (s.consecutiveProfitDays ?? 0)) {
          set({ consecutiveProfitDays: netIncome > 0 ? profitStreak : 0 });
        }
        // 瘟疫：药铺店型收入翻倍（settleDay 已入账 netIncome；此处补差）
        if (s.disasterType === 'plague' && (s.disasterUntil ?? 0) >= s.day && s.shopType === 'yaopu') {
          set((st) =>
            syncCompat(st, {
              silver: st.silver + netIncome,
              ledger: appendLedger(st.ledger, [{ day: st.day, project: '时疫·药铺翻倍', category: '经营', amount: netIncome }]),
              totalNetProfit: st.totalNetProfit + netIncome,
            })
          );
        }
        // 钱庄挤兑：剩余天数递减（当月存款不可取；到期恢复由 withdrawFromBank 判定）
        if ((s.bankRunDays ?? 0) > 0) {
          set({ bankRunDays: Math.max(0, (s.bankRunDays ?? 0) - 1) });
        }
        // 负反馈事件触发（每日打烊；入队 pendingNegativeEvents + eventLog）
        get().checkNegativeFeedback();
        // 被栽赃（评分≥3.0 约 3%/日；置 framedOpen=true）
        get().checkFramedMoment();
        // 沈听澜人情债时机（shenDebt=true 且 15% 概率；置 shenDebtMomentOpen=true）
        get().checkShenDebtMoment();
        // v1.0 功能解锁（TANG-POLISH-001 模块二）：每日打烊检查一次（清晨已查，此处覆盖阶段/声望打烊变化）
        get().checkFeatureUnlock();
        // Step 5b-5：每日打烊线索自动关联（同类别 ≥3 条两两互连）+ 结局检测
        // 结局检测先于破产判定：家道中落（负债500+资金0+评分<2）优先于 enterBankruptcy。
        const clueRes = connectCluesSystem({ day: s.day, clues: get().clues ?? [] });
        if (clueRes.connections.length > 0) {
          set({ clues: clueRes.clues });
        }
        // TANG-MIST-001：每日打烊迷雾批量揭示（按好感度/线索数；线索墙≥3 条 → 势力隐藏目的）
        get().checkFogReveals();
        // TANG-MIST-002：每日打烊六位 NPC 登场检查（声望/评分/地图解锁/负债/阿昭好感）
        get().checkNPCUnlocks();
        // TANG-MIST-002：苏大娘每月主动送情报（好感 ≥60；月终打烊概率）
        get().maybeFreeIntelFromSuDaniang();
        // TANG-MIST-002：阿萤在店天数累计（赎身后）→ 兄妹同心（阿昭 ≥90 且在店 ≥60 日）
        {
          const npcS = get();
          if (npcS.gameNPCs['a_ying']?.status === 'active') {
            const inShop = (npcS.ayingInShopDays ?? 0) + 1;
            if (npcS.xiaoerFavor >= AYING_XIONGMEI_AZHAO_FAVOR && inShop >= AYING_XIONGMEI_DAYS && !npcS.xiongmeiUnlocked) {
              set({
                ayingInShopDays: inShop,
                xiongmeiUnlocked: true,
                eventLog: [
                  ...npcS.eventLog,
                  `[第${npcS.day}日] 阿萤在店里帮衬已满 ${AYING_XIONGMEI_DAYS} 日，与阿昭兄妹同心，做事也利落了许多（阿昭效率 ×1.5，注释）。`,
                ],
              });
            } else {
              set({ ayingInShopDays: inShop });
            }
          }
        }
        const endingHit = get().checkEndingConditions(); // 命中即 triggerEnding（幂等）
        if (endingHit) {
          const def = endingById(endingHit);
          if (def?.forceEnd) {
            return result.settlement; // 强制结束：暂停，不再进入次日（家道中落/权倾朝野/归隐田园/无人问津）
          }
          // 可继续结局（一代商圣/皇商之路/商界教父/执棋者）：仍进入次日，弹窗由 EndingOverlay 呈现
        }
        // 破产保护（3.6）：silver≤0 → 破产；否则打烊自动进入第二天
        if (checkBankruptcy({ silver: silverFinal })) {
          get().enterBankruptcy();
          return result.settlement;
        }
        // K9 修复（2026-08-06）：社交员工事件此前仅 eventLog 记录、无 UI 弹窗；有事件时弹故事窗
        if (socialEvents.length > 0) {
          const firstSocial = socialEvents[0];
          if (firstSocial) {
            set({
              storyNarrative: {
                title: firstSocial.title ?? '伙计间事',
                body: firstSocial.description,
                numbers: [firstSocial.employeeName ?? ''],
                source: 'template',
              },
            });
          }
        }
                // 店员互动提升（模块四/五）：打烊随机员工报告 + 打烊阶段提醒（startNewDay 前，取当日净收益）
        get().generateReminders('closing', { ...buildReminderContext(s, 'closing'), todayNetProfit: netIncome });
        set({
          dailyStaffReport: pickStaffReport({
            employees: s.employees ?? [],
            xiaoerSatisfaction: s.xiaoerSatisfaction,
          }),
        });
        // 行为触发追踪：连续全亲自接待天数（过度劳累判定；全接待 +1，否则归零）
        {
          const gAll = s.guests ?? [];
          const allHandled = gAll.length > 0 && gAll.every((g) => g.handled);
          set({ consecutiveFullReceptionDays: allHandled ? (s.consecutiveFullReceptionDays ?? 0) + 1 : 0 });
        }
        get().startNewDay();
        // 修复（2026-08-06）：startNewDay 清晨钩子会重置 settlementPopupOpen=false 且 todaySettlement=null，
        // 若在其前置开/只置开弹窗，打烊结算面板会立刻被关闭或因 settle=null 不渲染、永不显示。
        // 须在 startNewDay 之后同时恢复弹窗开关与结算数据。
        set({ settlementPopupOpen: true, todaySettlement: { ...result.settlement, netIncome } });
        // 阶段推进（1.1）：settleDay 后判定；seized/破产等非 playing 阶段不推进
        const after = get();
        if (after.phase === 'playing') {
          const nextStage = checkStageUpgrade(after);
          if (nextStage > after.stage) {
            set((st) => ({
              stage: nextStage,
              eventLog: [...st.eventLog, `stage-${nextStage}`],
              pendingEvents: [...st.pendingEvents, buildStageUpgradeEvent(nextStage, after.day)],
            }));
            // Step 5b-5：手札录接线——阶段晋升里程碑自动记录
            const stageEntry = recordMilestoneJournal(journalContext(after), {
              title: `晋入第 ${nextStage} 阶`,
              content: '店铺经营更上层楼，长安商路渐次展开。',
              tags: ['里程碑', '阶段'],
            });
            set((st) => ({ journal: [...(st.journal ?? []), stageEntry] }));
          }
        }
        return result.settlement;
      },

      /** 追加账本条目（上限 50） */
      addLedgerEntry: (entry: LedgerEntry): void => {
        set((s) => ({ ledger: appendLedger(s.ledger, [entry]) }));
      },

      /** 更新货架商品字段（Step 5b-1.5 扩展：stock 归零自动维护 status=out_of_stock） */
      updateShopItem: (itemId: string, changes: Partial<ShopItem>): void => {
        set((s) => ({
          shopItems: s.shopItems.map((it) => {
            if (it.id !== itemId) return it;
            const next = { ...it, ...changes };
            const stock = next.stock ?? 0;
            if (stock <= 0) next.status = 'out_of_stock';
            return next;
          }),
        }));
      },

      /** 加入货架商品（同名合并加库存；否则新增） */
      addShopItem: (item: ShopItem): void => {
        set((s) => ({ shopItems: mergeByName(s.shopItems, item) }));
      },

      /** 下架货架商品（按 id 移除） */
      removeShopItem: (itemId: string): void => {
        set((s) => ({ shopItems: (s.shopItems ?? []).filter((it) => it.id !== itemId) }));
      },

      /** 库房扩建（1→5 级：每级 +50 容量、费 等级×200 两、耗时 等级×3 天；期间容量不增） */
      expandWarehouse: (): { ok: boolean; reason?: string; completionDay?: number } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const level = s.warehouseLevel ?? 1;
        if (level >= 5) return { ok: false, reason: '库房已是五级，无可再扩' };
        if (s.warehouseExpansion) return { ok: false, reason: '库房正在扩建中' };
        const cost = expandWarehouseCost(level);
        if (s.silver < cost) return { ok: false, reason: `扩建需 ${cost} 两，现银不足` };
        const completionDay = s.day + expandWarehouseDuration(level);
        const expansion: WarehouseExpansion = { targetLevel: level + 1, completionDay };
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - cost),
            warehouseExpansion: expansion,
            ledger: appendLedger(st.ledger, [{ day: st.day, project: '库房扩建', category: '支出', amount: -cost }]),
            inventoryNarratives: pushNarrative(st.inventoryNarratives, `库房动工扩建，约 ${expandWarehouseDuration(level)} 日后竣工。`),
          })
        );
        return { ok: true, completionDay };
      },

      /** 订立籴粜契（预付三成定金、预购价=市价×0.7、deliveryDay 在 day+5~10、不可取消退定金） */
      createForwardContract: (
        itemId: string,
        quantity: number,
        deliveryDay: number
      ): { ok: boolean; reason?: string; contract?: ForwardContract } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const item = (s.shopItems ?? []).find((it) => it.id === itemId);
        if (!item) return { ok: false, reason: '商品不存在' };
        const q = Math.max(1, Math.floor(quantity));
        if (deliveryDay < s.day + 5 || deliveryDay > s.day + 10) {
          return { ok: false, reason: '籴粜契约期须在五日之后、十日内' };
        }
        const contract = createForwardContractSystem({
          item,
          quantity: q,
          basePrice: item.price,
          deliveryDay,
          day: s.day,
        });
        if (s.silver < contract.deposit) {
          return { ok: false, reason: `定金需 ${contract.deposit} 两，现银不足` };
        }
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - contract.deposit),
            forwardContracts: [...(st.forwardContracts ?? []), contract],
            ledger: appendLedger(st.ledger, [{ day: st.day, project: '籴粜契定金', category: '支出', amount: -contract.deposit }]),
            inventoryNarratives: pushNarrative(
              st.inventoryNarratives,
              `已与农户立下籴粜契：${contract.itemName} ${contract.quantity} 份，约第 ${contract.deliveryDay} 日送到。`
            ),
          })
        );
        return { ok: true, contract };
      },

      /** 采买市易务挂牌（扣现银、入库、扣 remainingToday；次品风险按难度） */
      purchaseListing: (
        listingId: string,
        quantity: number
      ): { ok: boolean; reason?: string; actualGoodQuantity?: number; cost?: number; loss?: number } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const listing = (s.marketListings ?? []).find((l) => l.id === listingId);
        if (!listing || listing.day !== s.day) return { ok: false, reason: '挂牌已过时' };
        const r = purchaseListingSystem({
          listing,
          quantity,
          silver: s.silver,
          difficulty: s.difficulty,
          employees: s.employees,
        });
        if (!r.ok) return { ok: false, reason: r.reason };
        // 满仓拦截：入库体积超限 → 拒绝并旁白
        const item = (s.shopItems ?? []).find((it) => it.name === listing.itemName);
        const incomingVolume = r.actualGoodQuantity * (item?.volume ?? 1);
        if (storageFullFor(s.shopItems, s.maxStorage, incomingVolume)) {
          set((st) => ({ inventoryNarratives: pushNarrative(st.inventoryNarratives, inventoryNarrative('full')) }));
          return { ok: false, reason: '库房堆得插不进脚' };
        }
        const incoming: ShopItem = {
          id: item?.id ?? `ml-in-${listing.id}`,
          name: listing.itemName,
          price: item?.price ?? listing.originalPrice,
          cost: item?.cost ?? listing.listedPrice,
          stock: r.actualGoodQuantity,
          category: item?.category ?? '食材',
          volume: item?.volume ?? 1,
          expiry: item?.expiry ?? -1,
          status: 'normal',
        };
        // TANG-ADD-001 占候接线（采买）：巽卦 顺风 → 进货价 ×0.9
        const hexCost = applyHexagramEffect(s.todayHexagram, { procurementCost: r.cost });
        // K5 修复（2026-08-06）：程掌柜进价 -10% 接线（此前仅 store 字段 chengDiscountCategory 注释级未生效）
        const chengRatio = s.chengDiscountCategory && incoming.category === s.chengDiscountCategory ? 0.9 : 1;
        const finalCost = Math.round(((hexCost.procurementCost ?? r.cost) * chengRatio) * 100) / 100;
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - finalCost),
            shopItems: mergeByName(st.shopItems, incoming),
            marketListings: (st.marketListings ?? []).map((l) =>
              l.id === listingId ? { ...l, remainingToday: r.listing.remainingToday } : l
            ),
            ledger: appendLedger(st.ledger, [
              { day: st.day, project: '市易务采买', category: '支出', amount: -finalCost },
              ...(r.loss > 0 ? [{ day: st.day, project: '次品损耗', category: '支出' as const, amount: -r.loss * listing.listedPrice }] : []),
            ]),
            inventoryNarratives: pushNarrative(st.inventoryNarratives, inventoryNarrative('procurement')),
            // TANG-ADD-001 今日追踪：市集捡漏触发（要务「市集捡漏」判定输入）
            todayMarketDealTriggered: true,
          })
        );
        return { ok: true, actualGoodQuantity: r.actualGoodQuantity, cost: finalCost, loss: r.loss };
      },

      /** 开始加工（庖制/染织/炮制：扣原料与加工费、虚耗品耗银两、入加工队列） */
      startProcessing: (
        recipeId: string
      ): { ok: boolean; reason?: string; job?: ProcessingJob } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const recipe = getProcessingRecipeById(recipeId);
        if (!recipe) return { ok: false, reason: '配方不存在' };
        const r = startProcessingSystem({
          recipeId,
          shopItems: s.shopItems ?? [],
          silver: s.silver,
          day: s.day,
        });
        if (!r.ok || !r.job) return { ok: false, reason: r.reason };
        // 扣原料（真实原料）
        let shopItems = (s.shopItems ?? []).map((it) => {
          const inp = r.consumed.find((c) => c.itemName === it.name);
          if (!inp) return it;
          return { ...it, stock: Math.round((it.stock - inp.quantity) * 100) / 100, status: it.stock - inp.quantity <= 0 ? ('out_of_stock' as const) : it.status };
        });
        const totalDeduct = Math.round((r.processFee + r.consumablesCost) * 100) / 100;
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - totalDeduct),
            shopItems,
            processingQueue: [...(st.processingQueue ?? []), r.job!],
            ledger: appendLedger(st.ledger, [
              { day: st.day, project: `${recipe.name}加工费`, category: '支出', amount: -totalDeduct },
            ]),
            inventoryNarratives: pushNarrative(
              st.inventoryNarratives,
              `${recipe.name}开工：约 ${recipe.days} 日后出成品「${recipe.output.name}」${recipe.output.quantity} 份。`
            ),
          })
        );
        return { ok: true, job: r.job };
      },

      /** 备料组合（食盒/锦匣/药囊：原料足才可，消耗原料生成组合商品） */
      createAssemble: (
        assembleId: string
      ): { ok: boolean; reason?: string; item?: ShopItem } | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const recipe = getAssembleRecipeById(assembleId);
        if (!recipe) return { ok: false, reason: '配方不存在' };
        const r = createAssembleSystem({ assembleId, shopItems: s.shopItems ?? [], day: s.day });
        if (!r.ok || !r.item) return { ok: false, reason: r.reason };
        // 满仓拦截
        if (storageFullFor(s.shopItems, s.maxStorage, (r.item.stock ?? 1) * (r.item.volume ?? 1))) {
          set((st) => ({ inventoryNarratives: pushNarrative(st.inventoryNarratives, inventoryNarrative('full')) }));
          return { ok: false, reason: '库房堆得插不进脚' };
        }
        // 扣原料（组合原料）
        const shopItems = (s.shopItems ?? []).map((it) => {
          const inp = recipe.inputs.find((c) => c.itemName === it.name);
          if (!inp) return it;
          return { ...it, stock: Math.round((it.stock - inp.quantity) * 100) / 100, status: it.stock - inp.quantity <= 0 ? ('out_of_stock' as const) : it.status };
        });
        set((st) => ({
          shopItems: [...shopItems, r.item!],
          inventoryNarratives: pushNarrative(st.inventoryNarratives, `${recipe.kind}「${recipe.outputName}」备料组合完成。`),
        }));
        return { ok: true, item: r.item };
      },

      /** 调价（售价调整；下限 0.1 两） */
      adjustPrice: (itemId: string, newPrice: number): void => {
        const price = Math.max(0.1, Math.round(newPrice * 100) / 100);
        set((s) => ({
          shopItems: (s.shopItems ?? []).map((it) => (it.id === itemId ? { ...it, price } : it)),
        }));
      },

      /** 清除库存旁白 */
      dismissInventoryNarratives: (): void => {
        set({ inventoryNarratives: [] });
      },

      /** 解锁成就（防重复；Step 5b-5：解锁后自动记入手札录；内容深化 TANG-CONT-B 模块六·2：发放微小永久 Buff） */
      unlockAchievement: (id: string): void => {
        const s = get();
        if (s.unlockedAchievements.includes(id)) {
          return;
        }
        set({ unlockedAchievements: [...s.unlockedAchievements, id] });
        const ach = ACHIEVEMENT_MAP[id];
        if (ach) {
          const entry = recordMilestoneJournal(journalContext(s), {
            title: ach.name,
            content: ach.description,
            tags: ['成就'],
          });
          set((st) => ({ journal: [...(st.journal ?? []), entry] }));
        }
        // 成就奖励：一次性声望/评分 buff（applyAchievementReward 纯函数）
        const reward = applyAchievementReward(s, id);
        if (reward.reputationDelta !== 0 || reward.scoreDelta !== 0) {
          set((st) =>
            syncCompat(st, {
              reputation: clamp(st.reputation + reward.reputationDelta, 0, 1000),
              score: clamp(st.score + reward.scoreDelta, 1.0, 5.0),
              eventLog: [...st.eventLog, `ach-reward:${id}:${st.day}`],
            })
          );
        }
      },

      /** 触发事件（3.1）：登记 eventLog 并入队 pendingEvents（防重复） */
      triggerEvent: (eventId: string): void => {
        const s = get();
        if (s.eventLog.includes(eventId)) {
          return;
        }
        const event = EVENT_MAP[eventId] ?? s.events.find((e) => e.id === eventId);
        if (!event) {
          return;
        }
        set({
          eventLog: [...s.eventLog, eventId],
          pendingEvents: s.pendingEvents.some((e) => e.id === eventId)
            ? s.pendingEvents
            : [...s.pendingEvents, event],
          events: s.events.map((e) => (e.id === eventId ? { ...e, triggered: true } : e)),
        });
      },

      /** 处理事件选项（3.1）：执行 effect + special 处理 + 出队 pendingEvents + 登记 eventLog */
      resolveEventChoice: (eventId: string, choiceId: string): void => {
        const s = get();
        const event = s.pendingEvents.find((e) => e.id === eventId);
        if (!event) {
          return;
        }
        const choice = event.choices.find((c) => c.id === choiceId);
        if (!choice) {
          return;
        }
        const { changes, special } = applyEventEffect(s, choice);
        const next: Partial<TangManagerStore> = { ...changes };

        switch (special) {
          case 'pay_monthly_interest':
            next.silver = Math.max(0, s.silver - s.monthlyInterest);
            next.gold = next.silver;
            break;
          case 'xiaoer_gone':
            next.xiaoerGone = true;
            next.xiaoerFavor = 0;
            next.xiaoerSatisfaction = 0;
            break;
          case 'shen_debt':
            next.shenDebt = true;
            // 内容深化 TANG-CONT-D 模块八：人情债类型标记（沈听澜帮忙后）
            next.shenDebtType = 'favor';
            break;
          case 'shen_partner':
            next.shenPartner = true;
            next.shopCount = (s.shopCount ?? 1) + 1;
            next.maxEmployees = (s.maxEmployees ?? 4) + 2;
            break;
          case 'add_big_order_guest':
            next.guests = [...s.guests, generateSingleGuest(s.shopType ?? 'jiulou', s.difficulty, 'big_order')];
            break;
          case 'add_normal_guest':
            next.guests = [...s.guests, generateSingleGuest(s.shopType ?? 'jiulou', s.difficulty, 'normal')];
            break;
          case 'inv_borrow':
          case 'inv_borrow_refuse':
          case 'inv_requisition_accept':
          case 'inv_requisition_reduce':
          case 'inv_beggar_alms':
          case 'inv_beggar_drive':
          case 'inv_thief_report':
          case 'inv_thief_loss': {
            // Step 5b-1.5：库存事件专属数值应用（纯函数）
            const invChanges = applyInventoryEventSpecial(s, special);
            Object.assign(next, invChanges);
            if (special === 'inv_thief_report' || special === 'inv_thief_loss') {
              next.inventoryNarratives = pushNarrative(s.inventoryNarratives, inventoryNarrative('thief'));
            }
            break;
          }
          default:
            break;
        }

        // 谢七身份揭晓（5a 1.1）：谢七登场事件任意选择后置 true
        if (eventId === 'xie-qi-debt') {
          next.xieQiIdentityRevealed = true;
        }

        next.pendingEvents = s.pendingEvents.filter((e) => e.id !== eventId);
        next.eventLog = s.eventLog.includes(eventId) ? s.eventLog : [...s.eventLog, eventId];
        next.events = s.events.map((e) => (e.id === eventId ? { ...e, triggered: true } : e));
        // 地图与事件深化（模块七）：记录事件选择 + 登记连锁 + 疲劳度
        next.eventHistory = recordEventSystem(s.eventHistory ?? [], eventId, choiceId, s.day, choice.consequence);
        next.pendingConsequences = addPendingConsequenceSystem(s.pendingConsequences ?? [], eventId, choiceId, s.day);
        next.eventFatigue = recordTriggerSystem(s.eventFatigue ?? createEventFatigue(), eventId, 'random', s.day, false);
        set(next);
        // Step 5b-5：手札录接线——事件/抉择自动记录（type='choice'：标题=事件名，正文=所选选项与后果）
        const journalEntry = recordChoiceJournal(journalContext(s), {
          title: event.title,
          content: `${choice.label}：${choice.consequence}`,
          tags: ['抉择'],
          relatedEvent: eventId,
        });
        set((st) => ({ journal: [...(st.journal ?? []), journalEntry] }));
      },

      /** 事件去重登记（3.1） */
      addToEventLog: (eventId: string): void => {
        const s = get();
        if (!s.eventLog.includes(eventId)) {
          set({ eventLog: [...s.eventLog, eventId] });
        }
      },

      /** 小二离开状态（3.1/3.6） */
      setXiaoerGone: (value: boolean): void => {
        set({ xiaoerGone: value });
      },

      /** 沈听澜好感增减（3.1） */
      updateShenFavor: (amount: number): void => {
        set((s) => ({ shenTinglanFavor: clamp(s.shenTinglanFavor + amount, 0, 100) }));
      },

      /** 谢七好感增减（3.1） */
      updateXieQiFavor: (amount: number): void => {
        set((s) => ({ xieQiFavor: clamp(s.xieQiFavor + amount, 0, 100) }));
      },

      /** 福星高照（3.3）：消耗 1 次 luckRemaining，返回结果卡数据；次数不足返回 null */
      playLuckyStar: (): LuckResult | null => {
        const s = get();
        if (s.phase !== 'playing' || s.luckRemaining <= 0) {
          return null;
        }
        const result = useLuckyStar(s);
        const newTotal = s.luckUsedTotal + 1;
        set((st) =>
          syncCompat(st, {
            luckRemaining: st.luckRemaining - 1,
            silver: st.silver + result.netGain,
            maxGamblingWin: Math.max(st.maxGamblingWin, result.netGain),
            luckUsedTotal: newTotal,
          })
        );
        if (checkGamblingAddiction({ difficulty: s.difficulty, luckUsedTotal: newTotal })) {
          const st = get();
          if (st.gamblingAddictionDays <= 0) {
            set({ gamblingAddictionDays: GAMBLING_ADDICTION_DAYS });
          }
        }
        return result;
      },

      /** 处理待处理投诉（3.4）；无待处理投诉返回 null */
      resolveComplaint: (choice: ComplaintChoice): ComplaintResult | null => {
        const s = get();
        const pc = s.pendingComplaint;
        if (!pc) {
          return null;
        }
        const result = handleComplaint({ ...pc, difficulty: s.difficulty, xieQiFavor: s.xieQiFavor }, choice);
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + result.goldDelta),
            score: clamp(st.score + result.scoreDelta, 1.0, 5.0),
            reputation: clamp(st.reputation + result.reputationDelta, 0, 1000),
            pendingComplaint: null,
            // TANG-RCP-001 3.1：解决投诉 → 气氛 +5
            shopAtmosphere: clamp((st.shopAtmosphere ?? 50) + 5, 0, 100),
          })
        );
        return result;
      },

      /** 强制清除待处理投诉（UI 防御） */
      dismissComplaint: (): void => {
        set({ pendingComplaint: null });
      },

      /** 统一还款（5b 模块六）：legacy 还旧债（还清触发谢七登场）/ bank/usury 按 loanId 还贷 */
      repayDebt: (
        amount: number,
        target: 'legacy' | 'bank' | 'usury' = 'legacy',
        loanId?: string
      ): UnifiedRepayResult | null => {
        const s = get();
        if (target === 'legacy') {
          const result = repayLegacyDebt(amount, s);
          if (!result.ok) return result;
          set((st) =>
            syncCompat(st, {
              silver: st.silver - result.paid,
              legacyDebt: Math.max(0, (st.legacyDebt ?? 0) - result.paid),
              eventLog: [...st.eventLog, `repay-legacy:${s.day}`],
            })
          );
          // 还清旧债 → 谢七登场（复用 xie-qi-debt 事件）
          const after = get();
          if (after.legacyDebt <= 0 && !after.eventLog.includes('xie-qi-debt')) {
            get().triggerEvent('xie-qi-debt');
          }
          return result;
        }
        const loan = loanId
          ? (s.loans ?? []).find((l) => l.id === loanId && l.status !== 'paid')
          : (s.loans ?? []).find(
              (l) => l.type === (target === 'usury' ? 'usury' : 'mortgage') && l.status !== 'paid'
            );
        if (!loan) {
          return { ok: false, paid: 0, target, reason: '未找到对应贷款' };
        }
        const r = get().repayLoan(loan.id);
        if (!r || !r.ok) {
          return { ok: false, paid: 0, target, reason: r?.reason ?? '还款失败' };
        }
        return { ok: true, paid: r.total, target };
      },

      /** 破产流程（3.6）：silver≤0 触发；应用破产重置并进入 bankrupt 阶段 */
      enterBankruptcy: (): void => {
        const s = get();
        const outcome = applyBankruptcy(s);
        set({
          phase: 'bankrupt',
          silver: outcome.resetGold,
          gold: outcome.resetGold,
          reputation: outcome.reputation,
          xiaoerGone: outcome.xiaoerGone,
          hasGoneBroke: true,
          bankruptcyStartDay: s.day,
          pendingEvents: [],
          pendingComplaint: null,
          guests: [],
          currentGuestIndex: 0,
          todaySettlement: null,
        });
      },

      /** 破产每日小买卖（3.6）：+1-3 两、day+1（15% 概率「得罪过的人找麻烦」-1 两占位） */
      bankruptcyDailyHustle: (): void => {
        const s = get();
        if (s.phase !== 'bankrupt') {
          return;
        }
        const { goldDelta } = dailyHustle();
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + goldDelta),
            day: st.day + 1,
          })
        );
      },

      /** 破产坚持满 10 天重启（3.6）：score=1.0、silver=难度初始、重载 INITIAL_GOODS、回 playing */
      restartAfterBankruptcy: (): void => {
        const s = get();
        if (s.phase !== 'bankrupt' || bankruptcyDaysSurvived(s) < 10) {
          return;
        }
        const v = bankruptcyRestartValues(s.difficulty);
        const shopType = s.shopType ?? 'jiulou';
        const goods = INITIAL_GOODS[shopType] ?? INITIAL_GOODS.jiulou;
        const guests = generateDailyGuests(shopType, s.difficulty, s.day + 1);
        set({
          phase: 'playing',
          score: v.score,
          silver: v.gold,
          gold: v.gold,
          legacyDebt: v.debt,
          debt: v.debt,
          shopItems: [...goods],
          guests,
          currentGuestIndex: 0,
          dailyEnergyConsumed: 0,
          energy: 100,
          todaySettlement: null,
          dailyActionsRemaining: dailyActionCountFor(s.difficulty),
          afternoonActions: [],
          // 内容深化 TANG-CONT-C：重启后清空午后自由行动/接待随机事件状态
          pendingPatrolHazards: [],
          postponedPatrolHazards: [],
          strollBargain: null,
          nextDayExtraGuests: 0,
          slackingEmployeeIds: [],
        });
      },

      /** 手札叙事（AI）开关（4.4） */
      setAiNarrationEnabled: (value: boolean): void => {
        set({ aiNarrationEnabled: value });
      },

      /** 手札叙事模型（4.4） */
      setAiModel: (model: string): void => {
        set({ aiModel: model });
      },

      /** 雇佣候选人（5a 2.4）：满员拒绝；次日到岗（hireDay=day+1）、满意度 60 */
      hireEmployee: (candidate: EmployeeCandidate): boolean => {
        const s = get();
        if (s.phase !== 'playing' || (s.employees ?? []).length >= s.maxEmployees) {
          return false;
        }
        const emp: Employee = {
          ...candidate,
          satisfaction: 60,
          hireDay: s.day + 1,
          backgroundRevealed: false,
        };
        // TANG-SOC-001：新员工入职 → 初始化内部交情（initializeRelations）
        const withRelations = initializeRelations([...s.employees, emp], Math.random);
        set((st) =>
          syncCompat(st, {
            employees: withRelations,
            employeeRelations: flattenRelations(withRelations),
            silver: Math.max(0, st.silver - candidate.salary),
            eventLog: [...st.eventLog, `emp-hire:${candidate.name}:${s.day}`],
          })
        );
        get().showTutorial('FIRST_HIRE');
        return true;
      },

      /** 解雇员工（5a 2.4）：满意度归零离店，其他员工满意度 -2 */
      fireEmployee: (id: string): boolean => {
        const s = get();
        const target = (s.employees ?? []).find((e) => e.id === id);
        if (!target) {
          return false;
        }
        set((st) => ({
          employees: st.employees
            .filter((e) => e.id !== id)
            .map((e) => ({ ...e, satisfaction: Math.max(0, e.satisfaction - 2) })),
          eventLog: [...st.eventLog, `emp-fire:${target.name}:${s.day}`],
        }));
        return true;
      },

      /** 涨薪（5a 2.4）：满意度 +5~10 随机、月钱 +1~3 */
      raiseSalary: (id: string): boolean => {
        const s = get();
        const target = (s.employees ?? []).find((e) => e.id === id);
        if (!target) {
          return false;
        }
        const satDelta = 5 + Math.floor(Math.random() * 6);
        const salaryDelta = 1 + Math.floor(Math.random() * 3);
        set((st) => ({
          employees: st.employees.map((e) =>
            e.id === id
              ? { ...e, satisfaction: Math.min(100, e.satisfaction + satDelta), salary: e.salary + salaryDelta }
              : e
          ),
          eventLog: [...st.eventLog, `emp-raise:${target.name}:${s.day}`],
        }));
        return true;
      },
      /** 给阿昭加月钱（K6 修复：此前无 UI 入口；花 5 两 → 满意 +10、好感 +5，clamp 0-100） */
      azhaoRaiseSalary: (): boolean => {
        const s = get();
        if (s.phase !== 'playing' || s.silver < 5) {
          return false;
        }
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - 5),
            xiaoerSatisfaction: clamp((st.xiaoerSatisfaction ?? 60) + 10, 0, 100),
            xiaoerFavor: clamp((st.xiaoerFavor ?? 0) + 5, 0, 100),
            eventLog: [...st.eventLog, `azhao-raise:${s.day}`],
          })
        );
        return true;
      },

      /** 安排休假（5a 2.4）：满意度 +3、当日不工作（不贡献技能/满意度/不过劳） */
      arrangeRestDay: (id: string): boolean => {
        const s = get();
        const target = (s.employees ?? []).find((e) => e.id === id);
        if (!target) {
          return false;
        }
        set((st) => ({
          employees: st.employees.map((e) =>
            e.id === id ? { ...e, satisfaction: Math.min(100, e.satisfaction + 3), restToday: true } : e
          ),
        }));
        return true;
      },

      /** 揭露员工背景（5a 2.4/2.5）：backgroundRevealed=true；应用 hiddenFlaw 负面效果（占位：-5 两） */
      revealEmployeeBackground: (id: string): boolean => {
        const s = get();
        const target = (s.employees ?? []).find((e) => e.id === id);
        if (!target || target.backgroundRevealed) {
          return false;
        }
        set((st) =>
          syncCompat(st, {
            employees: st.employees.map((e) => (e.id === id ? { ...e, backgroundRevealed: true } : e)),
            silver: Math.max(0, st.silver - 5),
            specialEmployeeStoryCompleted: true,
            eventLog: [...st.eventLog, `emp-background:${target.name}:${s.day}`],
          })
        );
        return true;
      },

      /** 表扬（5a 5 UI 配套）：满意度 +5；TANG-SOC-001：公开表扬 → 他人竞争+2（evolveRelations 演化） */
      praiseEmployee: (id: string): boolean => {
        const s = get();
        if (!(s.employees ?? []).some((e) => e.id === id)) {
          return false;
        }
        // TANG-SOC-001：公开表扬 → 他人竞争+2（演化规则模块二；praisedId 传入）
        const relationsRes = evolveRelations(s.employees ?? [], { praisedId: id }, Math.random);
        set((st) => ({
          employees: relationsRes.employees.map((e) =>
            e.id === id ? { ...e, satisfaction: Math.min(100, e.satisfaction + 5) } : e
          ),
          employeeRelations: flattenRelations(relationsRes.employees),
        }));
        return true;
      },

      /** 训诫（5a 5 UI 配套）：满意度 -8 */
      reprimandEmployee: (id: string): boolean => {
        const s = get();
        if (!(s.employees ?? []).some((e) => e.id === id)) {
          return false;
        }
        set((st) => ({
          employees: st.employees.map((e) =>
            e.id === id ? { ...e, satisfaction: Math.max(0, e.satisfaction - 8) } : e
          ),
        }));
        return true;
      },

      /** 执行午后自由行动（内容深化 TANG-CONT-C 统一入口）：四行动真实逻辑 + 市场招聘兼容；不可执行返回 null */
      performAfternoonAction: (actionId: string, opts: { npcId?: string } = {}, rng: () => number = Math.random): ActionResult | null => {
        const s = get();
        if (s.phase !== 'playing' || s.dailyActionsRemaining <= 0 || s.afternoonActions.includes(actionId)) {
          return null;
        }
        const result = performAfternoonActionCore(
          {
            energy: s.energy,
            difficulty: s.difficulty,
            employees: s.employees,
            maxEmployees: s.maxEmployees,
            dailyActionsRemaining: s.dailyActionsRemaining,
            afternoonActions: s.afternoonActions,
            xieQiFavor: s.xieQiFavor,
            shenTinglanFavor: s.shenTinglanFavor,
            legacyDebt: s.legacyDebt ?? 0,
            shopType: s.shopType,
            day: s.day,
            eventLog: s.eventLog,
            xieQiIdentityRevealed: s.xieQiIdentityRevealed,
            silver: s.silver,
            xiaoerFavor: s.xiaoerFavor,
            xiaoerSatisfaction: s.xiaoerSatisfaction,
            shopItems: s.shopItems,
          },
          actionId,
          opts,
          rng
        );
        if (!result) {
          return null;
        }
        const patch: Partial<TangManagerStore> = {
          energy: clamp(s.energy + result.energyDelta, 0, 100),
          ...(result.goldDelta !== undefined ? { silver: Math.max(0, s.silver + result.goldDelta) } : {}),
          ...(result.reputationDelta !== undefined ? { reputation: clamp(s.reputation + result.reputationDelta, 0, 1000) } : {}),
          ...(result.xiaoerFavorDelta !== undefined || result.azhaoFavorDelta !== undefined
            ? { xiaoerFavor: clamp(s.xiaoerFavor + (result.xiaoerFavorDelta ?? 0) + (result.azhaoFavorDelta ?? 0), 0, 100) }
            : {}),
          ...(result.shenTinglanFavorDelta !== undefined ? { shenTinglanFavor: clamp(s.shenTinglanFavor + result.shenTinglanFavorDelta, 0, 100) } : {}),
          ...(result.xieQiFavorDelta !== undefined ? { xieQiFavor: clamp(s.xieQiFavor + result.xieQiFavorDelta, 0, 100) } : {}),
          ...(result.xiaoerSatisfactionDelta !== undefined ? { xiaoerSatisfaction: clamp(s.xiaoerSatisfaction + result.xiaoerSatisfactionDelta, 0, 100) } : {}),
          dailyActionsRemaining: Math.max(0, s.dailyActionsRemaining - 1),
          afternoonActions: [...s.afternoonActions, actionId],
          dailyEnergyConsumed: s.dailyEnergyConsumed + Math.max(0, -result.energyDelta),
          ...(result.patrolHazards ? { pendingPatrolHazards: result.patrolHazards } : {}),
          ...(result.bargain ? { strollBargain: result.bargain } : {}),
          eventLog: [...s.eventLog, `afternoon:${actionId}:${s.day}`],
        };
        set(syncCompat(s, patch));
        // 情报线索落库（拜访/闲逛 20%→clue；坊间传闻→clue）
        if (result.intel?.kind === 'clue' && result.intel.clueCategory) {
          const npcName = opts.npcId === 'a-zhao' ? '阿昭' : opts.npcId === 'shen-tinglan' ? '沈听澜' : opts.npcId === 'xie-qi' ? '谢七' : '市井闲逛';
          const clue = generateClueSystem(
            npcName,
            result.actionId === 'visit_npc' ? ('npc' as const) : ('rumor' as const),
            result.intel.clueCategory,
            { day: s.day, clues: s.clues ?? [] }
          );
          if (clue) {
            get().addClue(clue);
          }
        }
        // 非线索情报叙事（势力动向/行业预告/坊间传闻）入 eventLog
        if (result.intel && result.intel.kind !== 'clue') {
          set((st) => ({ eventLog: [...st.eventLog, `[第${st.day}日] ${result.intel!.text}`] }));
        }
        return result;
      },

      /** 处置午后巡查隐患（fix/delay/admonish/ignore/lock/guard；不存在返回 null） */
      resolvePatrolHazard: (hazardId: string, choice: string): PatrolChoiceResult | null => {
        const s = get();
        const hazards = s.pendingPatrolHazards ?? [];
        const hazard = hazards.find((h) => h.id === hazardId);
        if (!hazard) {
          return null;
        }
        const res = resolvePatrolHazardChoice(hazard, choice, { day: s.day });
        if (res.resolved) {
          const patch: Partial<TangManagerStore> = {
            pendingPatrolHazards: hazards.filter((h) => h.id !== hazardId),
            ...(res.goldDelta !== undefined ? { silver: Math.max(0, s.silver + res.goldDelta) } : {}),
            ...(res.reputationDelta !== undefined ? { reputation: clamp(s.reputation + res.reputationDelta, 0, 1000) } : {}),
            ...(res.scoreDelta !== undefined ? { score: clamp(s.score + res.scoreDelta, 1.0, 5.0) } : {}),
            ...(res.employeeDelta
              ? {
                  employees: s.employees.map((e) =>
                    e.id === res.employeeDelta!.employeeId
                      ? { ...e, satisfaction: clamp(e.satisfaction + res.employeeDelta!.satisfactionChange, 0, 100) }
                      : e
                  ),
                }
              : {}),
            ...(res.clearSlack
              ? { slackingEmployeeIds: (s.slackingEmployeeIds ?? []).filter((id) => id !== (hazard.employeeId ?? '')) }
              : {}),
            ...(res.addSlack && hazard.employeeId
              ? { slackingEmployeeIds: [...(s.slackingEmployeeIds ?? []), hazard.employeeId] }
              : {}),
            eventLog: [...s.eventLog, `[第${s.day}日] ${res.narrative}`],
          };
          set(syncCompat(s, patch));
        } else {
          // 延后修缮：从 pending 移入 postponed（带 deadlineDay；逾期坍塌由 startNewDay 检查）
          set((st) => ({
            pendingPatrolHazards: (st.pendingPatrolHazards ?? []).filter((h) => h.id !== hazardId),
            postponedPatrolHazards: [...(st.postponedPatrolHazards ?? []), { ...hazard, deadlineDay: res.deadlineDay ?? st.day + 10 }],
            eventLog: [...st.eventLog, `[第${st.day}日] ${res.narrative}`],
          }));
        }
        return res;
      },

      /** 购入市井闲逛捡漏商品（限当日七折；扣现银入货架；已购/过期/银两不足返回 false） */
      buyStrollBargain: (): boolean => {
        const s = get();
        const bargain = s.strollBargain;
        if (!bargain || bargain.day !== s.day || s.silver < bargain.price) {
          return false;
        }
        set(
          syncCompat(s, {
            silver: Math.max(0, s.silver - bargain.price),
            shopItems: mergeByName(s.shopItems, {
              id: `bargain-${bargain.itemName}-${s.day}`,
              name: bargain.itemName,
              price: bargain.price,
              cost: Math.round(bargain.price * 0.6 * 100) / 100,
              stock: 1,
              category: '杂项',
              volume: 1,
              expiry: -1,
              status: 'normal',
            }),
            strollBargain: null,
            eventLog: [...s.eventLog, `stroll-bargain:${bargain.itemName}:${s.day}`],
          })
        );
        return true;
      },

      // ============================================================
      // Step 5b-2：商业地图系统 actions
      // ============================================================

      /** 解锁地图层（校验 MAP_LAYER_UNLOCK_RULES；L2 声望≥200 或分店≥2；L3 声望≥700 且阶段≥3） */
      unlockMapLayer: (layer: MapLayer): boolean => {
        const s = get();
        if (s.unlockedLayers.includes(layer)) return true;
        const rule = getLayerUnlockRule(layer);
        if (!rule.isUnlocked({ reputation: s.reputation, shopCount: s.shopCount ?? 1, stage: s.stage })) {
          return false;
        }
        set((st) => ({ unlockedLayers: [...st.unlockedLayers, layer] }));
        return true;
      },

      /** 记录点位访问（防重复）；TANG-MIST-001：快速移动经过未探访节点 20% 自动揭示（纯函数判定） */
      visitNode: (nodeId: string): void => {
        const s = get();
        if (s.visitedNodes.includes(nodeId)) return;
        const patch: Partial<TangManagerStore> = { visitedNodes: [...s.visitedNodes, nodeId] };
        const travel = maybeRevealRegionOnTravel(regionRevealState(s), nodeId);
        if (travel.changed) {
          patch.fogOfWar = travel.fogOfWar;
          patch.eventLog = [...s.eventLog, `fog-travel-reveal:${nodeId}:${s.day}`];
        }
        set(syncCompat(s, patch));
      },

      /** 每日清晨生成 1-2 个地图事件（复用纯函数；返回新增事件供 UI 展示） */
      generateDailyMapEvents: (): MapEvent[] => {
        const s = get();
        const activeTemplates = new Set(
          (s.mapEvents ?? []).filter((e) => e.status === 'active').map((e) => e.id.replace(/-\d+$/, ''))
        );
        const fresh = generateMapEvents({
          day: s.day,
          unlockedLayers: s.unlockedLayers,
          activeEventIds: [...activeTemplates],
        });
        if (fresh.length > 0) {
          set((st) => ({ mapEvents: [...(st.mapEvents ?? []), ...fresh] }));
        }
        return fresh;
      },

      /** 处理地图事件（respond 应用效果置 resolved；ignore 保持 active 自然过期） */
      handleMapEvent: (eventId: string, action: 'respond' | 'ignore'): { ok: boolean; reason?: string } | null => {
        const s = get();
        const event = (s.mapEvents ?? []).find((e) => e.id === eventId);
        if (!event) return null;
        const guardPresent = (s.employees ?? []).some((e) => e.type === 'guard' && !e.restToday);
        const result = handleMapEventSystem(event, action, {
          energy: s.energy,
          silver: s.silver,
          hasGuard: guardPresent,
        });
        if (!result.ok) return { ok: false, reason: result.reason };
        let silver = s.silver;
        let energy = s.energy;
        let reputation = s.reputation;
        let unlockNode: string | undefined;
        for (const eff of result.effects ?? []) {
          silver += eff.goldChange ?? 0;
          energy -= eff.energyCost ?? 0;
          reputation += eff.reputationChange ?? 0;
          if (eff.unlockNode) unlockNode = eff.unlockNode;
        }
        const patch: Partial<TangManagerStore> = {
          silver: Math.max(0, Math.round(silver * 100) / 100),
          gold: Math.max(0, Math.round(silver * 100) / 100),
          energy: clamp(energy, 0, 100),
          reputation: clamp(reputation, 0, 1000),
          mapEvents: (s.mapEvents ?? []).map((e) => (e.id === eventId ? (result.updatedEvent ?? e) : e)),
        };
        if (unlockNode) {
          const node = MAP_NODE_MAP[unlockNode];
          const baseLayers = patch.unlockedLayers ?? s.unlockedLayers;
          if (node && !baseLayers.includes(node.layer)) {
            patch.unlockedLayers = [...baseLayers, node.layer];
          }
          if (!s.visitedNodes.includes(unlockNode)) {
            patch.visitedNodes = [...s.visitedNodes, unlockNode];
          }
        }
        set(syncCompat(s, patch));
        // Step 5b-5：蛛丝马迹轻量接线——地图事件应对后可能获得情报（威胁→政治线 / 商机→商业线）
        const clue = generateClueSystem(
          event.title,
          'map' as const,
          event.type === 'threat' ? ('politics' as const) : ('business' as const),
          { day: s.day, clues: s.clues ?? [] }
        );
        if (clue) {
          get().addClue(clue);
        }
        return { ok: true };
      },

      /** 执行跑商（扣现银与运费、入在途队列；返回结算预估） */
      executeTradeRun: (
        buyNodeId: string,
        sellNodeId: string,
        itemCategory: string,
        quantity: number
      ): TradeRunResult | null => {
        const s = get();
        if (s.phase !== 'playing') return null;
        const result = executeTradeRunSystem(buyNodeId, sellNodeId, itemCategory, quantity, buildTradeContext(s));
        if (!result.ok || !result.goods) return result;
        const cost = Math.round((result.buyPrice! * result.goods.quantity + result.freight!) * 100) / 100;
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver - cost),
            transportingGoods: [...(st.transportingGoods ?? []), result.goods!],
            ledger: appendLedger(st.ledger, [
              { day: st.day, project: `跑商购货·${itemCategory}`, category: '支出', amount: -cost },
            ]),
          })
        );
        // TANG-MIST-003 M3 · 2.1：买点记今日交易（次日清晨繁荣度 +1~3）
        get().noteNodeTrade(buyNodeId);
        get().showTutorial('FIRST_TRADE');
        return result;
      },

      /** 解锁绿色通道（东市线沈听澜≥60 / 西市线谢七≥50 / 官道声望≥500） */
      unlockGreenChannel: (routeId: string): UnlockGreenChannelResult | null => {
        const s = get();
        const result = unlockGreenChannelSystem(routeId, buildTradeContext(s));
        if (!result.ok) return result;
        set((st) => ({ greenChannels: [...(st.greenChannels ?? []), routeId] }));
        return result;
      },

      /** 每日清晨结算到达货物（售得入账；被劫损失） */
      checkTransportArrivals: (): TransportArrivalResult[] => {
        const s = get();
        const results = checkTransportArrivalsSystem(buildTradeContext(s));
        if (results.length === 0) return [];
        let silverDelta = 0;
        const ledgerEntries: LedgerEntry[] = [];
        const arrivedIds = new Set(results.map((r) => r.goodsId));
        for (const r of results) {
          silverDelta += r.gross;
          ledgerEntries.push({
            day: s.day,
            project: r.status === 'arrived' ? `跑商售货·${r.itemCategory}` : `跑商被劫·${r.itemCategory}`,
            category: r.status === 'arrived' ? '经营' : '支出',
            amount: r.status === 'arrived' ? r.gross : -r.robbedLoss,
          });
        }
        set((st) =>
          syncCompat(st, {
            silver: Math.max(0, st.silver + silverDelta),
            transportingGoods: (st.transportingGoods ?? []).map((g) =>
              arrivedIds.has(g.id)
                ? { ...g, status: (results.find((r) => r.goodsId === g.id)?.status ?? 'arrived') as 'arrived' | 'robbed' }
                : g
            ),
            ledger: appendLedger(st.ledger, ledgerEntries),
          })
        );
        // TANG-MIST-003 M3 · 2.1：到达卖点记今日交易（次日清晨繁荣度 +1~3）
        for (const g of s.transportingGoods ?? []) {
          if (arrivedIds.has(g.id)) get().noteNodeTrade(g.sellNodeId);
        }
        return results;
      },

      // ============================================================
      // 新手引导（TANG-TUT-001 模块一）：家传手札引导状态 actions
      // （与功能解锁 unlockedFeatures / 迷雾 fogOfWar 等并存，互不影响）
      // ============================================================

      /** 标记引导已读（tutorialFlags[id]=true；若为当前引导同时关闭 currentTutorial） */
      markTutorialRead: (guideId: string): void => {
        const s = get();
        const flags = { ...(s.tutorialFlags ?? {}) };
        flags[guideId] = true;
        const patch: Partial<TangManagerStore> = { tutorialFlags: flags };
        if (s.currentTutorial === guideId) patch.currentTutorial = null;
        set(patch);
      },

      /** 重置全部引导（tutorialFlags 清空 + currentTutorial=null；调试/重开用） */
      resetAllTutorials: (): void => {
        set({ tutorialFlags: {}, currentTutorial: null });
      },

      /** 弹出引导（currentTutorial=guideId；已读或未知 id 忽略，防重复/防越权） */
      showTutorial: (guideId: string): void => {
        const s = get();
        if (!isTangTutorialId(guideId)) return;
        if (s.tutorialFlags?.[guideId]) return;
        set({ currentTutorial: guideId });
      },

      /** 关闭当前引导（currentTutorial=null；不标记已读，可再次弹出） */
      dismissTutorial: (): void => {
        set({ currentTutorial: null });
      },

      /** 追加对话消息（dialogueHistory；模块六） */
      appendDialogue: (role, content): void => {
        const s = get();
        set({ dialogueHistory: [...(s.dialogueHistory ?? []), { role, content, source: 'template' }] });
      },

      /** 清空当前对话历史（换客/打烊时） */
      clearDialogue: (): void => {
        set({ dialogueHistory: [] });
      },

      /** 记录客人心情 */
      setGuestMood: (guestId, mood): void => {
        set({ guestMood: { ...(get().guestMood ?? {}), [guestId]: mood } });
      },

      /** 对话式接待完成：应用店型流程结果（模块一/二；经 buildReceptionPatch 落账 + 故事弹窗） */
      completeDialogueReception: (result, rng = Math.random): void => {
        const s = get();
        if (s.phase !== 'playing') return;
        const guest = result.guestId ? s.guests.find((g) => g.id === result.guestId) : s.guests[s.currentGuestIndex];
        if (!guest || guest.handled) return;

        // P1 修复（2026-08-05）：对话式接待结算接入接待策略（delegate/priority → 伙计代劳）
        const strategy = s.receptionStrategy ?? 'all';
        const strat = applyReceptionStrategy(guest, strategy, rng);
        if (strat.mode === 'delegated') {
          const delegatedIncome = strat.delegatedIncome ?? 0;
          const delegatedPatch = buildReceptionPatch(
            s,
            { guestId: guest.id, income: delegatedIncome, energyConsumed: 0, review: 'good', handledNote: '伙计代劳，入账 ' + delegatedIncome + ' 两' },
            rng
          );
          set({ ...delegatedPatch, storyNarrative: { title: '伙计代劳', body: '（伙计替你招呼了这位客官，成单入账。你歇在柜台后，听了一耳朵热闹。）', numbers: ['入账 ' + Math.round(delegatedIncome) + ' 两'], source: 'template' } });
          if (guest.type === 'big_order') {
            set({ weeklyTaskProgress: addWeeklyProgressSystem(get().weeklyTaskProgress, 'week-big-orders', 1) });
          }
          return;
        }

        // P1 修复：接入大单预购（big_order 20% 与现货互斥）
        if (result.ok && guest.type === 'big_order') {
          const factionRelationships = Object.fromEntries((s.factions ?? []).map((f) => [f.id, f.relationship]));
          const preorder = checkPreOrderTriggerSystem(
            guest,
            { shopType: s.shopType ?? 'jiulou', day: s.day, preOrders: s.preOrders ?? [], shopItems: s.shopItems ?? [], factionRelationships },
            rng
          );
          if (preorder) {
            const offerPatch = buildReceptionPatch(
              s,
              { guestId: guest.id, income: 0, energyConsumed: 0, review: 'good', handledNote: '大客下订预购「' + preorder.items.map((it) => it.itemName).join('、') + '」' },
              rng
            );
            set({
              ...offerPatch,
              preOrders: [...(s.preOrders ?? []), preorder],
              storyNarrative: { title: '大客预购', body: '（' + guest.name + '相中了货色，爽快下了定金——' + preorder.items.map((it) => it.itemName).join('、') + '，约定日后取货。）', numbers: ['预购订单已登记'], source: 'template' },
            });
            if (guest.type === 'big_order') {
              set({ weeklyTaskProgress: addWeeklyProgressSystem(get().weeklyTaskProgress, 'week-big-orders', 1) });
            }
            return;
          }
        }

        const patch = buildReceptionPatch(s, {
          guestId: guest.id,
          income: result.income,
          energyConsumed: result.energyConsumed,
          review: result.review,
          reputationChange: result.praised ? 1 : 0,
          scoreChange: 0,
          satisfactionDelta: result.satisfactionDelta,
          favorDelta: result.favorDelta,
          praiseTriggered: !!result.praised,
          complaintTriggered: !!result.complaintTriggered,
          handledNote: result.handledNote,
        }, rng);
        set({
          ...patch,
          storyNarrative: {
            title: result.ok ? (result.shop === 'jiulou' ? '宴席宾主尽欢' : result.shop === 'buzhuang' ? '量身定衣' : '对症开方') : '这单没成',
            body: result.narrative,
            npcLine: result.guestLine,
            numbers: result.summary,
            source: 'template',
          },
        });
        if (guest.type === 'big_order') {
          set({ weeklyTaskProgress: addWeeklyProgressSystem(get().weeklyTaskProgress, 'week-big-orders', 1) });
        }
      },

      /** 弹出故事弹窗（模块四） */
      showStoryNarrative: (narrative): void => {
        set({ storyNarrative: narrative });
      },

      /** 关闭故事弹窗 */
      dismissStoryNarrative: (): void => {
        set({ storyNarrative: null });
      },

      /** 生成当前阶段店员提醒（店员互动提升 模块五） */
      generateReminders: (phase, context): void => {
        set({ staffReminders: generateStaffReminders(context, phase) });
      },

      /** 采纳/忽略提醒（采纳→效果+满意度+2；忽略×3→满意度-5） */
      applyReminder: (reminderId, accepted): void => {
        const s = get();
        const res = applyReminderEffect(s.staffReminders ?? [], reminderId, accepted, s.staffIgnoreCounts ?? {});
        const patch: Partial<TangManagerStore> = {
          staffReminders: res.reminders,
          staffIgnoreCounts: res.ignoreCounts,
        };
        const aZhaoDelta = res.satisfactionDeltas['a_zhao'];
        if (aZhaoDelta) patch.xiaoerSatisfaction = clamp(s.xiaoerSatisfaction + aZhaoDelta, 0, 100);
        const empDeltas = Object.entries(res.satisfactionDeltas).filter(([k]) => k !== 'a_zhao');
        if (empDeltas.length > 0) {
          patch.employees = (s.employees ?? []).map((e) => {
            const d = res.satisfactionDeltas[e.id];
            return d ? { ...e, satisfaction: clamp(e.satisfaction + d, 0, 100) } : e;
          });
        }
        set(patch);
        // 采纳效果落账（轻量：阿昭满意度/好感直接应用；其余记录 eventLog 提示，供后续系统接线）
        if (accepted && res.acceptedEffect) {
          const eff = res.acceptedEffect;
          if (eff.type === 'a_zhao_satisfaction') set((st) => ({ xiaoerSatisfaction: clamp(st.xiaoerSatisfaction + (eff.value ?? 1), 0, 100) }));
          if (eff.type === 'a_zhao_favor') set((st) => ({ xiaoerFavor: clamp(st.xiaoerFavor + (eff.value ?? 1), 0, 100) }));
          set((st) => ({ eventLog: [...st.eventLog, '[第' + st.day + '日] 采纳' + (res.acceptedEffect?.note ?? '店员建议')] }));
        }
      },

      /** 关闭单条提醒 */
      dismissReminder: (reminderId): void => {
        set((s) => ({ staffReminders: (s.staffReminders ?? []).filter((r) => r.id !== reminderId) }));
      },

      /** 清空全部提醒 */
      clearReminders: (): void => {
        set({ staffReminders: [] });
      },

      /** 关闭清晨问候横幅 */
      setDailyStaffGreeting: (g): void => {
        set({ dailyStaffGreeting: g });
      },

      /** 关闭打烊报告横幅 */
      setDailyStaffReport: (r): void => {
        set({ dailyStaffReport: r });
      },

      // ==================== 店铺特色产业系统（模块五） ====================
      tavernStartResearch: (category, chefId): { ok: boolean; reason?: string; job?: TavernResearchJob } => {
        const s = get();
        if (s.silver < 15) return { ok: false, reason: '银两不足' };
        const chef = chefId ? (s.employees ?? []).find((e) => e.id === chefId) : undefined;
        const chefSkill = chef?.type === 'chef' ? 3 + Math.floor((chef.satisfaction ?? 50) / 20) : 1;
        const job = startTavernResearchSystem(category, chefSkill, 2);
        set({
          silver: s.silver - job.cost,
          gold: s.silver - job.cost,
          tavernResearchJobs: [...(s.tavernResearchJobs ?? []), job],
        });
        return { ok: true, job };
      },

      tavernSettleResearch: (jobId): void => {
        const s = get();
        const job = (s.tavernResearchJobs ?? []).find((j) => j.id === jobId);
        if (!job) return;
        const res = settleTavernResearchSystem({ ...job, successRate: applyResearchExperience(job.successRate, s.tavernResearchExp ?? 0) });
        const jobs = (s.tavernResearchJobs ?? []).filter((j) => j.id !== jobId);
        if (res.dish) {
          set({
            tavernResearchJobs: jobs,
            tavernDishes: [...(s.tavernDishes ?? []), res.dish],
            eventLog: [...s.eventLog, '[第' + s.day + '日] 研发成功「' + res.dish.name + '」' + (res.grand ? '（大成功·招牌菜）' : '')],
          });
        } else if (res.experience) {
          set({
            tavernResearchJobs: jobs,
            tavernResearchExp: (s.tavernResearchExp ?? 0) + 1,
            eventLog: [...s.eventLog, '[第' + s.day + '日] 研发失败，积累研发经验（下次成功率 +5%）'],
          });
        }
      },

      tavernSetSignature: (dishId): void => {
        const s = get();
        const dishes = s.tavernDishes ?? [];
        const dish = dishes.find((d) => d.id === dishId);
        if (!dish) return;
        const next = dishes.map((d) => {
          if (d.id !== dishId) return d;
          if (d.isSignature) return { ...d, isSignature: false, price: Math.round(d.price / (1 + 0.3)) };
          if (!canSetSignature(dishes, s.tavernLevel)) return d;
          return { ...d, isSignature: true, price: signaturePrice(d.price) };
        });
        set({ tavernDishes: next });
      },

      tavernAcceptBanquet: (type): void => {
        const s = get();
        const order = generateBanquetOrderSystem(type, s.day, s.tavernLevel);
        set({ tavernBanquets: [...(s.tavernBanquets ?? []), order] });
      },

      tavernPrepareBanquet: (banquetId, dishIds, wineAmount, decor): void => {
        const s = get();
        const order = (s.tavernBanquets ?? []).find((b) => b.id === banquetId);
        if (!order || order.status !== 'preparing') return;
        const required = order.type === 'shou_yan' || order.type === 'shang_hui' ? 7 : 6;
        set({ tavernBanquets: (s.tavernBanquets ?? []).map((b) => (b.id === banquetId ? prepareBanquetSystem(b, dishIds, wineAmount, decor, required) : b)) });
      },

      tavernHoldBanquet: (banquetId): void => {
        const s = get();
        const order = (s.tavernBanquets ?? []).find((b) => b.id === banquetId);
        if (!order || order.status !== 'preparing') return;
        const { result } = settleBanquetSystem(order, order.dishIds.length, s.tavernLevel);
        set({
          tavernBanquets: (s.tavernBanquets ?? []).map((b) => (b.id === banquetId ? { ...b, status: 'held', result } : b)),
          tavernBanquetCount: (s.tavernBanquetCount ?? 0) + 1,
          reputation: clamp(s.reputation + result.reputationGain, 0, 1000),
          silver: s.silver + result.netProfit,
          gold: s.silver + result.netProfit,
          eventLog: [...s.eventLog, '[第' + s.day + '日] 宴席「' + (order.type === 'shou_yan' ? '寿宴' : order.type === 'hun_yan' ? '婚宴' : order.type === 'shang_hui' ? '商会宴' : '宴席') + '」净入 ' + result.netProfit + ' 两' + (result.referral ? '，宾客引荐新客' : '')],
        });
      },

      clothierHireWeaver: (): { ok: boolean; reason?: string; weaver?: Weaver } => {
        const s = get();
        const weavers = s.weavers ?? [];
        if (weavers.filter((w) => w.status === 'active').length >= maxWeaversSystem(s.clothierLevel)) {
          return { ok: false, reason: '合作织工已满' };
        }
        const weaver = generateWeaverSystem();
        set({ weavers: [...weavers, weaver] });
        return { ok: true, weaver };
      },

      clothierSellConsignment: (weaverId, goodsId): void => {
        const s = get();
        const weaver = (s.weavers ?? []).find((w) => w.id === weaverId);
        if (!weaver) return;
        const res = sellConsignmentSystem(weaver, goodsId, s.day);
        if (res.shopIncome > 0) {
          set({
            weavers: (s.weavers ?? []).map((w) => (w.id === weaverId ? res.weaver : w)),
            silver: s.silver + res.shopIncome,
            gold: s.silver + res.shopIncome,
          });
        }
      },

      clothierAcceptCustomOrder: (type, guestName, fabric, style): void => {
        const s = get();
        const order = generateCustomOrderSystem(type, guestName ?? '客官', fabric ?? '丝绸', style ?? '素雅');
        set({ customOrders: [...(s.customOrders ?? []), order] });
      },

      clothierDeliverCustomOrder: (orderId, match): void => {
        const s = get();
        const order = (s.customOrders ?? []).find((o) => o.id === orderId);
        if (!order || order.status !== 'making') return;
        const { result } = deliverCustomOrderSystem(order, match);
        set({
          customOrders: (s.customOrders ?? []).map((o) => (o.id === orderId ? { ...o, status: result.grade === 'reject' ? 'rejected' : 'delivered', result } : o)),
          customOrderCount: (s.customOrderCount ?? 0) + (result.grade === 'reject' ? 0 : 1),
          silver: s.silver + result.income,
          gold: s.silver + result.income,
        });
      },

      herbalistHirePhysician: (): { ok: boolean; reason?: string; physician?: Physician } => {
        const s = get();
        const physicians = s.physicians ?? [];
        if (physicians.filter((p) => p.status === 'active').length >= maxPhysiciansSystem(s.herbalistLevel)) {
          return { ok: false, reason: '坐堂郎中名额已满' };
        }
        const physician = generatePhysicianSystem();
        set({ physicians: [...physicians, physician] });
        return { ok: true, physician };
      },

      herbalistPhysicianDaily: (): void => {
        const s = get();
        const physicians = (s.physicians ?? []).map((p) => {
          if (p.status !== 'active') return p;
          const patients = physicianDailyPatientsSystem(p, s.herbalistLevel);
          const prescription = physicianPrescriptionSystem(p);
          const stock: Record<string, number> = {};
          for (const it of s.shopItems ?? []) stock[it.name] = it.stock;
          const matched = stockMatchesPrescriptionSystem(prescription, stock);
          const sat = clamp(p.satisfaction + (matched ? 2 : -5), 0, 100);
          const next: Physician = { ...p, satisfaction: sat };
          return next;
        });
        const active = physicians.filter((p) => p.status === 'active');
        const patients = active.reduce((sum, p) => sum + physicianDailyPatientsSystem(p, s.herbalistLevel), 0);
        set({
          physicians,
          todayPatients: patients,
          curedPatientCount: (s.curedPatientCount ?? 0) + patients,
        });
      },

      herbalistStartResearch: (category, symptom): { ok: boolean; reason?: string; job?: HerbResearchJob } => {
        const s = get();
        if (s.silver < 15) return { ok: false, reason: '银两不足' };
        const job = startHerbResearchSystem(category, symptom, 2);
        set({
          silver: s.silver - job.cost,
          gold: s.silver - job.cost,
          herbResearchJobs: [...(s.herbResearchJobs ?? []), job],
        });
        return { ok: true, job };
      },

      herbalistSettleResearch: (jobId): void => {
        const s = get();
        const job = (s.herbResearchJobs ?? []).find((j) => j.id === jobId);
        if (!job) return;
        const res = settleHerbResearchSystem(job);
        const jobs = (s.herbResearchJobs ?? []).filter((j) => j.id !== jobId);
        if (res.recipe) {
          set({ herbResearchJobs: jobs, herbRecipes: [...(s.herbRecipes ?? []), res.recipe], eventLog: [...s.eventLog, '[第' + s.day + '日] 药方「' + res.recipe.name + '」研发成功'] });
        } else if (res.improved) {
          set({ herbResearchJobs: jobs, eventLog: [...s.eventLog, '[第' + s.day + '日] 药方改良：品质 +1'] });
        } else {
          set({ herbResearchJobs: jobs, eventLog: [...s.eventLog, '[第' + s.day + '日] 药方研发失败，药材损耗'] });
        }
      },

      herbalistSetPatent: (recipeId): void => {
        const s = get();
        const recipe = (s.herbRecipes ?? []).find((r) => r.id === recipeId);
        if (!recipe) return;
        const res = setPatentSystem(recipe);
        set({ herbRecipes: (s.herbRecipes ?? []).map((r) => (r.id === recipeId ? res.recipe : r)) });
      },

      industryTick: (day): void => {
        const s = get();
        // 研发到期结算
        for (const job of s.tavernResearchJobs ?? []) {
          if (job.remainingDays - 1 <= 0) get().tavernSettleResearch(job.id);
          else set((st) => ({ tavernResearchJobs: (st.tavernResearchJobs ?? []).map((j) => (j.id === job.id ? { ...j, remainingDays: j.remainingDays - 1 } : j)) }));
        }
        for (const job of s.herbResearchJobs ?? []) {
          if (job.remainingDays - 1 <= 0) get().herbalistSettleResearch(job.id);
          else set((st) => ({ herbResearchJobs: (st.herbResearchJobs ?? []).map((j) => (j.id === job.id ? { ...j, remainingDays: j.remainingDays - 1 } : j)) }));
        }
        // 宴席到期举办（筹备满 100 自动结算）
        for (const b of s.tavernBanquets ?? []) {
          if (b.status === 'preparing' && b.holdDay <= day && b.prepProgress >= 100) {
            get().tavernHoldBanquet(b.id);
          }
        }
        // 郎中坐堂一日
        if ((s.physicians ?? []).some((p) => p.status === 'active')) {
          get().herbalistPhysicianDaily();
        }
        // 织工补货（寄卖品全部售出或空 → 每 3-7 天一批）
        const st2 = get();
        set({
          weavers: (st2.weavers ?? []).map((w) => {
            if (w.status !== 'active') return w;
            const allSold = w.currentGoods.length > 0 && w.currentGoods.every((g) => g.sold);
            if (allSold || w.currentGoods.length === 0) {
              return { ...w, currentGoods: consignmentGoodsSystem(w, 10) };
            }
            return w;
          }),
        });
      },

      industryUpgrade: (kind): void => {
        const s = get();
        const level = kind === 'tavern' ? s.tavernLevel : kind === 'clothier' ? s.clothierLevel : s.herbalistLevel;
        const score = s.score;
        const count = kind === 'tavern' ? s.tavernBanquetCount ?? 0 : kind === 'clothier' ? s.customOrderCount ?? 0 : s.curedPatientCount ?? 0;
        const next = industryLevelDef(kind, level + 1);
        if (next.level <= level || score < next.require.score || count < next.require.count) return;
        const blessings = INDUSTRY_BLESSINGS[kind]!;
        const blessing = blessings[Math.min(level, blessings.length - 1)]!;
        const patch: Partial<TangManagerStore> = { lastIndustryBlessing: blessing };
        if (kind === 'tavern') patch.tavernLevel = level + 1;
        if (kind === 'clothier') patch.clothierLevel = level + 1;
        if (kind === 'herbalist') patch.herbalistLevel = level + 1;
        set({ ...patch, eventLog: [...s.eventLog, '[第' + s.day + '日] ' + industryNameDef(kind) + '晋升「' + next.name + '」'] });
      },

      purchaseBranch: (): { ok: boolean; reason?: string } => {
        const s = get();
        const shopCount = s.shopCount ?? 1;
        const cost = 800 * shopCount;
        if (s.silver < cost) return { ok: false, reason: '银两不足（需 ' + cost + ' 两）' };
        const branchLabel = '分店·' + '甲乙丙丁戊己庚辛壬癸'.charAt(shopCount - 1);
        set({
          silver: s.silver - cost,
          gold: s.silver - cost,
          shopCount: shopCount + 1,
          maxEmployees: (s.maxEmployees ?? 4) + 2,
          ledger: appendLedger(s.ledger, [{ day: s.day, project: '购置' + branchLabel, category: '支出' as const, amount: -cost }]),
          eventLog: [...s.eventLog, '[第' + s.day + '日] 购置' + branchLabel + '，耗银 ' + cost + ' 两'],
          storyNarrative: { title: '新店开张', body: '（你在长安另置一铺——' + branchLabel + '开张。伙计名额渐宽，往来货物也周转得更快了。）', numbers: ['支出 ' + cost + ' 两', '可雇佣伙计 +2'], source: 'template' },
        });
        return { ok: true };
      },

      resolvePoliticsDecision: (choiceId): void => {
        const s = get();
        const decision = s.currentPoliticsDecision;
        if (!decision || s.phase !== 'politics') return;
        const choice = decision.choices.find((c) => c.id === choiceId);
        if (!choice) return;
        const patch: Partial<TangManagerStore> = {};
        const eff = choice.effect;
        if (eff.reputation) patch.reputation = clamp(s.reputation + eff.reputation, 0, 1000);
        if (eff.score) patch.score = clamp(s.score + eff.score, 1.0, 5.0);
        if (eff.alignmentDelta) patch.politicalAlignment = Math.max(0, (s.politicalAlignment ?? 0) + eff.alignmentDelta);
        const nextStep = (s.politicsStep ?? 0) + 1;
        if (nextStep >= POLITICS_DECISIONS.length) {
          patch.politicsStep = nextStep;
          patch.politicsDone = true;
          patch.currentPoliticsDecision = null;
          set({ ...patch, storyNarrative: { title: '大业已成', body: '（五道政务一一落定，朝野上下莫不叹服。你立于庙堂之巅，遥望当年长安东市那间老店——恍如隔世。）', numbers: ['权倾朝野'], source: 'template' } });
          get().triggerEnding('quanqing-chaoye');
        } else {
          patch.politicsStep = nextStep;
          patch.currentPoliticsDecision = POLITICS_DECISIONS[nextStep]!;
          set({ ...patch, storyNarrative: { title: '政务落定', body: '（' + choice.consequence + '）', numbers: ['已办 ' + nextStep + '/' + POLITICS_DECISIONS.length], source: 'template' } });
        }
      },

      dismissSettlementPopup: (): void => {
        set({ settlementPopupOpen: false });
      },

      addMessage: (msg): void => {
        const s = get();
        set({ messages: [...(s.messages ?? []), msg].slice(-20) });
      },

      dismissMessage: (messageId): void => {
        const s = get();
        set({ messages: (s.messages ?? []).filter((m) => m.id !== messageId) });
      },

      purchaseShopAsset: (assetId): { ok: boolean; reason?: string } => {
        const s = get();
        const asset = shopAssetById(assetId);
        if (!asset) return { ok: false, reason: '无此物件' };
        if ((s.shopAssets ?? []).includes(assetId)) return { ok: false, reason: '已购置此物' };
        if (s.silver < asset.price) return { ok: false, reason: '银两不足（需 ' + asset.price + ' 两）' };
        const patch: Partial<TangManagerStore> = {
          shopAssets: [...(s.shopAssets ?? []), assetId],
          silver: s.silver - asset.price,
          gold: s.silver - asset.price,
          ledger: appendLedger(s.ledger, [{ day: s.day, project: '购置' + asset.name, category: '支出' as const, amount: -asset.price }]),
        };
        if (asset.effect.reputation) patch.reputation = clamp(s.reputation + asset.effect.reputation, 0, 1000);
        if (asset.effect.score) patch.score = clamp(s.score + asset.effect.score, 1.0, 5.0);
        set({ ...patch, eventLog: [...s.eventLog, '[第' + s.day + '日] 购置「' + asset.name + '」' + (asset.feature ? '（' + asset.feature + '）' : '')] });
        return { ok: true };
      },

      industryOverview: (): IndustryOverview | null => {
        const s = get();
        if (!s.shopType) return null;
        const build = (kind: 'tavern' | 'clothier' | 'herbalist'): IndustryOverview['industries'][number] => {
          const level = kind === 'tavern' ? s.tavernLevel : kind === 'clothier' ? s.clothierLevel : s.herbalistLevel;
          const count = kind === 'tavern' ? s.tavernBanquetCount ?? 0 : kind === 'clothier' ? s.customOrderCount ?? 0 : s.curedPatientCount ?? 0;
          const def = industryLevelDef(kind, level);
          const next = industryLevelDef(kind, level + 1);
          const can = next.level > level && s.score >= next.require.score && count >= next.require.count;
          return {
            kind,
            name: industryNameDef(kind),
            level,
            levelName: def.name,
            count,
            next: next.level > level ? next.require : null,
            canUpgrade: can,
            bless: INDUSTRY_BLESSINGS[kind]![Math.min(level - 1, INDUSTRY_BLESSINGS[kind]!.length - 1)]!,
          };
        };
        return { shopType: s.shopType, industries: [build('tavern'), build('clothier'), build('herbalist')] };
      },

      // ==================== 地图与事件深化（模块七） ====================
      recordEvent: (eventId, choiceId, narrative): void => {
        const s = get();
        set({ eventHistory: recordEventSystem(s.eventHistory ?? [], eventId, choiceId, s.day, narrative) });
      },

      addPendingConsequence: (sourceEventId, choiceId): void => {
        const s = get();
        set({ pendingConsequences: addPendingConsequenceSystem(s.pendingConsequences ?? [], sourceEventId, choiceId, s.day) });
      },

      checkPendingConsequences: (): void => {
        const s = get();
        const { due, remaining } = checkPendingConsequencesSystem(s.pendingConsequences ?? [], s.day);
        if (due.length === 0) return;
        let silverDelta = 0;
        let repDelta = 0;
        for (const d of due) {
          silverDelta += d.effect?.gold ?? 0;
          repDelta += d.effect?.reputation ?? 0;
        }
        const patch: Partial<TangManagerStore> = { pendingConsequences: remaining };
        if (silverDelta !== 0) patch.silver = Math.max(0, s.silver + silverDelta);
        if (repDelta !== 0) patch.reputation = clamp(s.reputation + repDelta, 0, 1000);
        const narrative = due.map((d) => d.narrative).join(' ');
        const numParts: string[] = [];
        if (silverDelta !== 0) numParts.push((silverDelta > 0 ? '+' : '') + silverDelta + ' 两');
        if (repDelta !== 0) numParts.push((repDelta > 0 ? '+' : '') + repDelta + ' 声望');
        if (numParts.length === 0) numParts.push('连锁事件已触发');
        set({
          ...patch,
          storyNarrative: { title: '连锁事至', body: narrative, numbers: numParts, source: 'template' },
        });
      },

      revealNodeStory: (nodeId, nodeName, season): NodeStory | null => {
        const s = get();
        const res = generateNodeStory(nodeId, nodeName, s.nodeStoriesRevealed ?? {}, season ?? '', Math.random);
        if (!res) return null;
        set({ nodeStoriesRevealed: res.revealed });
        return res.story;
      },

      triggerRegionEvent: (region): void => {
        const s = get();
        const pool = region === 'yongle' ? YONGLE_EVENTS : region === 'east_market' ? EAST_MARKET_EVENTS : region === 'west_market' ? WEST_MARKET_EVENTS : CHANGAN_EVENTS;
        const candidates = pool.filter((e) => canTriggerEventSystem(e.id, region, s.eventFatigue ?? createEventFatigue(), s.day, false));
        if (candidates.length === 0) return;
        const ev = candidates[Math.floor(Math.random() * candidates.length)]!;
        set({
          pendingEvents: [...(s.pendingEvents ?? []), ev],
          eventFatigue: recordTriggerSystem(s.eventFatigue ?? createEventFatigue(), ev.id, region, s.day, false),
        });
      },

      checkBehaviorEvents: (day): void => {
        const s = get();
        const inventoryValue = (s.shopItems ?? []).reduce((sum, it) => sum + (it.price ?? 0) * it.stock, 0);
        const maxItemStock = (s.shopItems ?? []).reduce((m, it) => Math.max(m, it.stock), 0);
        const cands = checkBehaviorTriggers({
          day,
          consecutiveFullReceptionDays: s.consecutiveFullReceptionDays ?? 0,
          daysSinceMindRead: (s.lastMindReadDay ?? 0) > 0 ? day - (s.lastMindReadDay ?? 0) : 999,
          usedAllFiveMovesOnce: false,
          inventoryValue,
          maxItemStock,
          noExpiryStreak: s.noExpiryStreak ?? 0,
          xiaoerFavor: s.xiaoerFavor,
          harmonyStreak: 0,
          conflictStreak: 0,
        });
        const fresh: GameEvent[] = [];
        for (const id of cands) {
          const ev = BEHAVIOR_EVENTS[id];
          if (!ev) continue;
          if (!canTriggerEventSystem(id, 'behavior', s.eventFatigue ?? createEventFatigue(), day, true)) continue;
          fresh.push(ev);
        }
        if (fresh.length > 0) {
          const fatigue = fresh.reduce((acc, ev) => recordTriggerSystem(acc, ev.id, 'behavior', day, true), s.eventFatigue ?? createEventFatigue());
          set({ pendingEvents: [...(s.pendingEvents ?? []), ...fresh], eventFatigue: fatigue });
        }
      },

      maybeRegionEvent: (day): void => {
        const s = get();
        if (Math.random() >= 0.25) return;
        const regions: MapRegion[] = ['yongle', 'east_market', 'west_market', 'changan'];
        const region = regions[Math.floor(Math.random() * regions.length)]!;
        get().triggerRegionEvent(region);
      },

      // ==================== AI 全量接入（v1.1 模块五） ====================
      setAiContentToggle: (type, enabled): void => {
        set((st) => ({ aiContentToggles: { ...(st.aiContentToggles ?? {}), [type]: enabled } }));
      },

      recordAiLog: (entry): void => {
        const s = get();
        set({ aiGenerationLog: [...(s.aiGenerationLog ?? []), { ...entry, day: s.day }].slice(-30) });
      },

      clearAiLog: (): void => {
        set({ aiGenerationLog: [] });
      },
    }),
    {
      name: PERSIST_NAME,
      version: 20,
      storage: createJSONStorage(() => createZustandPersistStorage()),
      // v15 → v16：新手引导（TANG-TUT-001 模块一）新增 tutorialFlags/currentTutorial 字段。
      // 迁移策略「丢弃重建」（仅针对引导状态）：旧存档不含引导字段，一律重置为
      // 全未读（tutorialFlags={}）/无当前引导（currentTutorial=null）——老玩家升档后
      // 也能完整走一遍新手手札；其余全部数据字段照旧保留（沿用 v14→v15 策略）。
      // v14 → v15：迷雾系统（TANG-MIST-001 模块一）新增 fogOfWar 字段（区域/势力/人物三类迷雾）。
      // 迁移策略沿用 v14「保留旧存档全部数据字段 + 按状态补齐」：base 已含 fogOfWar 初始态，
      // 旧存档缺失时取 base（L1/L2/L3 初始雾态），已有则保留。
      // v19 → v20：AI 全量接入（v1.1 模块五）新增 aiContentToggles/aiGenerationLog 字段。
      // 迁移策略沿用 v14「保留旧存档全部数据字段 + 按状态补齐」：base 已含新字段初始态，旧存档缺失时取 base。
      // v18 → v19：地图与事件深化（模块七）新增 eventHistory/pendingConsequences/nodeStoriesRevealed/eventFatigue 字段。
      // 迁移策略沿用 v14「保留旧存档全部数据字段 + 按状态补齐」：base 已含新字段初始态，旧存档缺失时取 base。
      // v17 → v18：店铺特色产业系统（模块五）新增 tavern*/weavers/customOrders/physicians/herb*/industry 等级字段。
      // 迁移策略沿用 v14「保留旧存档全部数据字段 + 按状态补齐」：base 已含新字段初始态，旧存档缺失时取 base。
      // v16 → v17：店员互动提升（模块五）新增 staffReminders/staffIgnoreCounts/dailyStaffGreeting/dailyStaffReport 字段。
      // 迁移策略沿用 v14「保留旧存档全部数据字段 + 按状态补齐」：base 已含新字段初始态，旧存档缺失时取 base。
      // v12 → v14：v1.0 功能解锁（TANG-POLISH-001 模块二）新增 unlockedFeatures 字段。
      // 迁移策略（区别于既往「丢弃重建」）：v14 起改为「按当前状态补解锁」——
      // 保留旧存档全部数据字段，仅将缺失的 unlockedFeatures 按旧存档当前状态
      // （day/reputation/employees/stage/achievements）补齐解锁，不重置玩家进度。
      // 兼容 v13 中间态：旧存档若已带 unlockedFeatures 则保留并追加补算。
      migrate: (persisted: unknown) => {
        const base = buildInitialState();
        if (!persisted || typeof persisted !== 'object') return { ...base, unlockedFeatures: {} };
        const old = persisted as Partial<TangManagerStore> & {
          day?: number;
          reputation?: number;
          employees?: unknown[];
          stage?: number;
          unlockedAchievements?: unknown[];
          unlockedFeatures?: Record<string, boolean>;
        };
        const merged: Partial<TangManagerStore> = {
          ...base,
          ...old,
          fogOfWar: old.fogOfWar ?? base.fogOfWar,
          unlockedFeatures: { ...(old.unlockedFeatures ?? {}) },
          // v15 → v16「丢弃重建」：引导状态一律重置（旧存档不含引导字段；老玩家升档重走新手手札）
          tutorialFlags: {},
          currentTutorial: null,
        };
        const newly = checkFeatureUnlockSystem(merged.unlockedFeatures ?? {}, {
          day: old.day ?? base.day,
          reputation: old.reputation ?? base.reputation,
          employeesCount: Array.isArray(old.employees) ? old.employees.length : 0,
          stage: old.stage ?? base.stage,
          unlockedAchievementsCount: Array.isArray(old.unlockedAchievements) ? old.unlockedAchievements.length : 0,
        });
        for (const id of newly) {
          if (merged.unlockedFeatures) merged.unlockedFeatures[id] = true;
        }
        return merged as TangManagerStore;
      },
      // 只持久化数据字段（排除全部 action 函数）；pendingComplaint/inventoryNarratives 为瞬时 UI 状态不持久化
      partialize: (s) => ({
        phase: s.phase,
        viewMode: s.viewMode ?? 'operations',
        player: s.player,
        shopType: s.shopType,
        difficulty: s.difficulty,
        silver: s.silver,
        feiqian: s.feiqian,
        credit: s.credit,
        creditHistory: s.creditHistory,
        creditLocked: s.creditLocked,
        creditBankruptDays: s.creditBankruptDays,
        legacyDebt: s.legacyDebt,
        deposits: s.deposits,
        loans: s.loans,
        investments: s.investments,
        priceIndex: s.priceIndex,
        lastPriceUpdate: s.lastPriceUpdate,
        maxStorage: s.maxStorage,
        inflationModifier: s.inflationModifier,
        depositRateBoostDays: s.depositRateBoostDays,
        monthlyInterest: s.monthlyInterest,
        score: s.score,
        reputation: s.reputation,
        xiaoerFavor: s.xiaoerFavor,
        xiaoerSatisfaction: s.xiaoerSatisfaction,
        energy: s.energy,
        day: s.day,
        insightRemaining: s.insightRemaining,
        luckRemaining: s.luckRemaining,
        guests: s.guests,
        currentGuestIndex: s.currentGuestIndex,
        ledger: s.ledger,
        todaySettlement: s.todaySettlement,
        shopItems: s.shopItems,
        unlockedAchievements: s.unlockedAchievements,
        insightUsedTotal: s.insightUsedTotal,
        dailyEnergyConsumed: s.dailyEnergyConsumed,
        events: s.events,
        pendingEvents: s.pendingEvents,
        eventLog: s.eventLog,
        insightUsedOnNPC: s.insightUsedOnNPC,
        totalNetProfit: s.totalNetProfit,
        maxGamblingWin: s.maxGamblingWin,
        hasGoneBroke: s.hasGoneBroke,
        xiaoerGone: s.xiaoerGone,
        shenDebt: s.shenDebt,
        shenPartner: s.shenPartner,
        xieQiFavor: s.xieQiFavor,
        shenTinglanFavor: s.shenTinglanFavor,
        gamblingAddictionDays: s.gamblingAddictionDays,
        luckUsedTotal: s.luckUsedTotal,
        bankruptcyStartDay: s.bankruptcyStartDay,
        aiNarrationEnabled: s.aiNarrationEnabled,
        aiModel: s.aiModel,
        stage: s.stage,
        employees: s.employees,
        maxEmployees: s.maxEmployees,
        dailyActionsRemaining: s.dailyActionsRemaining,
        afternoonActions: s.afternoonActions,
        shopCount: s.shopCount,
        xieQiIdentityRevealed: s.xieQiIdentityRevealed,
        specialEmployeeStoryCompleted: s.specialEmployeeStoryCompleted,
        employeeBonusRate: s.employeeBonusRate,
        // Step 5b-1.5：库存压力/进货/加工（inventoryNarratives/missingGoodStreak 瞬时不持久化）
        warehouseLevel: s.warehouseLevel,
        storageCostPerDay: s.storageCostPerDay,
        freeStorageLimit: s.freeStorageLimit,
        forwardContracts: s.forwardContracts,
        marketListings: s.marketListings,
        processingQueue: s.processingQueue,
        warehouseExpansion: s.warehouseExpansion,
        // Step 5b-2：商业地图系统（全部持久化；mapEvents 含已过期历史便于展示）
        unlockedLayers: s.unlockedLayers,
        visitedNodes: s.visitedNodes,
        mapEvents: s.mapEvents,
        tradeRoutes: s.tradeRoutes,
        greenChannels: s.greenChannels,
        transportingGoods: s.transportingGoods,
        nodePriceModifiers: s.nodePriceModifiers,
        // TANG-MIST-003 M3：地图功能增强持久化字段（mapMarkerNotices/requestedNavPanel 瞬时不持久化）
        nodeProsperity: s.nodeProsperity,
        playerMarkers: s.playerMarkers,
        todayTradedNodes: s.todayTradedNodes,
        mapRoutePlan: s.mapRoutePlan,
        mapCaravanPrefill: s.mapCaravanPrefill,
        // TANG-RCP-001：接待深度升级（气氛 / 留言簿 / 回头客池 全部持久化）
        shopAtmosphere: s.shopAtmosphere,
        guestBook: s.guestBook,
        knownGuests: s.knownGuests,
        // TANG-SOC-001：名声关系网 / 内部交情（全部持久化）
        factions: s.factions,
        npcFavors: s.npcFavors,
        employeeRelations: s.employeeRelations,
        fuyinFavor: s.fuyinFavor,
        zhaoYuanwaiFavor: s.zhaoYuanwaiFavor,
        azhaoTrait: s.azhaoTrait,
        // Step 5b-5：叙事与后期系统（全部持久化；overlay 开关为瞬时不持久化）
        journal: s.journal,
        clues: s.clues,
        // TANG-MIST-001：迷雾系统（区域/势力/人物三类迷雾全部持久化）
        fogOfWar: s.fogOfWar,
        decrees: s.decrees,
        politicalFaction: s.politicalFaction,
        politicalAlignment: s.politicalAlignment,
        caravans: s.caravans,
        endingTriggered: s.endingTriggered,
        imperialBidCount: s.imperialBidCount,
        courtCooperation: s.courtCooperation,
        soldShops: s.soldShops,
        apprenticeOpenedShop: s.apprenticeOpenedShop,
        retiredDays: s.retiredDays,
        politicalLine: s.politicalLine,
        politicalEndgame: s.politicalEndgame,
        joinedCourt: s.joinedCourt,
        // TANG-ADD-001：成瘾性玩法模块（持久化数据字段；overlay 开关/瞬时展示不持久化）
        todayHexagram: s.todayHexagram?.id ?? null,
        todayTasks: s.todayTasks,
  streetNews: s.streetNews,
  dialogueContexts: s.dialogueContexts,
  medicalKnowledge: s.medicalKnowledge,
  ownedMedicalBooks: s.ownedMedicalBooks,
        todayTasksCompleted: s.todayTasksCompleted,
        todayTaskMindReadBonus: s.todayTaskMindReadBonus,
        completedRareEvents: s.completedRareEvents,
        activeLegacyQuest: s.activeLegacyQuest,
        completedLegacyQuests: s.completedLegacyQuests,
        activeBet: s.activeBet,
        betAccepted: s.betAccepted,
        currentBlindAuction: s.currentBlindAuction,
        blindAuctionBid: s.blindAuctionBid,
        blindAuctionResolved: s.blindAuctionResolved,
        rank: s.rank,
        rankProgress: s.rankProgress,
        monthlyReviews: s.monthlyReviews,
        todayNetProfit: s.todayNetProfit,
        todayMindReadUsed: s.todayMindReadUsed,
        todaySilkSold: s.todaySilkSold,
        todayMarketDealTriggered: s.todayMarketDealTriggered,
        todayChatUsed: s.todayChatUsed,
        todayComplaints: s.todayComplaints,
        todayGuestsHandled: s.todayGuestsHandled,
        todayRejectedGuests: s.todayRejectedGuests,
        todayMindReadBackfired: s.todayMindReadBackfired,
        ancestralEyeActive: s.ancestralEyeActive,
        // TANG-TRF-001：动态客流 + 大单预购 + 周级要务（全部持久化）
        receptionStrategy: s.receptionStrategy,
        // 内容深化 TANG-CONT-B 模块六·1：经营策略持久化
        businessStrategy: s.businessStrategy,
        preOrders: s.preOrders,
        weeklyTasks: s.weeklyTasks,
        weeklyTaskProgress: s.weeklyTaskProgress,
        // v1.0 功能解锁（TANG-POLISH-001 模块二）：持久化已解锁记录
        unlockedFeatures: s.unlockedFeatures ?? {},
        // 新手引导（TANG-TUT-001 模块一）：引导已读标记与当前引导（持久化；手札弹窗展示状态由 UI 层消费）
        tutorialFlags: s.tutorialFlags ?? {},
        currentTutorial: s.currentTutorial ?? null,
        // 店员互动提升（模块五）：提醒/忽略计数/问候/报告持久化
        staffReminders: s.staffReminders ?? [],
        staffIgnoreCounts: s.staffIgnoreCounts ?? {},
        dailyStaffGreeting: s.dailyStaffGreeting ?? null,
        dailyStaffReport: s.dailyStaffReport ?? null,
        // 店铺特色产业系统（模块五）：产业状态持久化
        tavernDishes: s.tavernDishes ?? [],
        tavernBanquets: s.tavernBanquets ?? [],
        tavernLevel: s.tavernLevel ?? 1,
        tavernResearchJobs: s.tavernResearchJobs ?? [],
        tavernBanquetCount: s.tavernBanquetCount ?? 0,
        tavernResearchExp: s.tavernResearchExp ?? 0,
        weavers: s.weavers ?? [],
        customOrders: s.customOrders ?? [],
        clothierLevel: s.clothierLevel ?? 1,
        customOrderCount: s.customOrderCount ?? 0,
        physicians: s.physicians ?? [],
        herbRecipes: s.herbRecipes ?? [],
        herbResearchJobs: s.herbResearchJobs ?? [],
        herbalistLevel: s.herbalistLevel ?? 1,
        curedPatientCount: s.curedPatientCount ?? 0,
        eventHistory: s.eventHistory ?? [],
        pendingConsequences: s.pendingConsequences ?? [],
        nodeStoriesRevealed: s.nodeStoriesRevealed ?? {},
        eventFatigue: s.eventFatigue ?? createEventFatigue(),
        aiContentToggles: s.aiContentToggles ?? {},
        aiGenerationLog: s.aiGenerationLog ?? [],
        lastMindReadDay: s.lastMindReadDay ?? 0,
        noExpiryStreak: s.noExpiryStreak ?? 0,
        consecutiveFullReceptionDays: s.consecutiveFullReceptionDays ?? 0,
        politicsStep: s.politicsStep ?? 0,
        politicsDone: s.politicsDone ?? false,
        currentPoliticsDecision: s.currentPoliticsDecision ?? null,
        messages: s.messages ?? [],
        shopAssets: s.shopAssets ?? [],
      }),
      // 兼容字段兜底同步：rehydrate 后 gold←silver / debt←legacyDebt（持久化只存 silver/legacyDebt）
      onRehydrateStorage: () => (state) => {
        if (state) {
          useTangManagerStore.setState({ gold: state.silver, debt: state.legacyDebt });
        }
      },
    }
  )
);

/**
 * 店铺特色产业面板（产业系统 模块四 4.1 + 各产业操作）
 * 经营之道：三产业等级/进度/升级条件/手札贺词；子标签：酒楼（研发+宴席）/布庄（织工+定制）/药铺（郎中+药方）。
 * 全部 ANCIENT 令牌；只调 store action，不持有游戏状态。
 */
'use client';
import { useState } from 'react';
import { DISH_NAME_POOL, HERB_RECIPE_NAME_POOL } from '@/config/tang-industry-content';
import { AncientCard } from '@/components/ancient-card';
import { ModalContainer } from '@/components/modal-container';
import { DiagnosisPanel } from './diagnosis-panel';
import { BanquetMenuPanel } from './banquet-menu-panel';
import { FabricRecommendPanel } from './fabric-recommend-panel';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { DishCategory, HerbRecipeCategory } from '@/types/tang-industry';

type Tab = 'overview' | 'tavern' | 'clothier' | 'herbalist';

const DISH_CATEGORIES: DishCategory[] = ['荤菜', '素菜', '汤品', '点心', '酒品'];
const HERB_CATEGORIES: HerbRecipeCategory[] = ['汤剂', '丸剂', '散剂', '膏剂'];

/** 店型 → 产业 kind（产业系统按所选店型隔离——选酒楼就不再出现布庄/药铺功能） */
const SHOP_INDUSTRY: Record<'jiulou' | 'buzhuang' | 'yaopu', 'tavern' | 'clothier' | 'herbalist'> = {
  jiulou: 'tavern',
  buzhuang: 'clothier',
  yaopu: 'herbalist',
};
const INDUSTRY_TAB_LABEL: Record<'tavern' | 'clothier' | 'herbalist', string> = {
  tavern: '酒楼·庖厨',
  clothier: '布庄·织造',
  herbalist: '药铺·悬壶',
};

function Btn({ label, onClick, disabled = false, color = ANCIENT.primary }: { label: string; onClick: () => void; disabled?: boolean; color?: string }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: color, color: '#FFFFFF' }}
    >
      {label}
    </button>
  );
}

export function IndustryPanel(): React.ReactElement {
  const s = useTangManagerStore();
  const shopType = s.shopType ?? 'jiulou';
  const industryKind = SHOP_INDUSTRY[shopType];
  const [tab, setTab] = useState<Tab>('overview');
  const [category, setCategory] = useState<DishCategory>('荤菜');
  const [herbCat, setHerbCat] = useState<HerbRecipeCategory>('汤剂');
  const [featurePanel, setFeaturePanel] = useState<'diagnosis' | 'banquet' | 'fabric' | null>(null);
  const [symptom, setSymptom] = useState('失眠盗汗');
  const overview = s.industryOverview();

  return (
    <AncientCard accent={ANCIENT.gold} title="经营之道 · 产业">
      {/* 子标签 */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs tracking-widest">
        {([['overview', '总览'], [industryKind, INDUSTRY_TAB_LABEL[industryKind]]] as Array<[Tab, string]>).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className="rounded-lg px-3 py-1.5 font-bold"
            style={{ backgroundColor: tab === k ? ANCIENT.primary : ANCIENT.card, color: tab === k ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 手札贺词（升级后展示） */}
      {s.lastIndustryBlessing && (
        <p className="mb-3 rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
          {s.lastIndustryBlessing}
        </p>
      )}

      {tab === 'overview' && (
        <div className="flex flex-col gap-2">
          {overview?.industries.filter((ind) => ind.kind === industryKind).map((ind) => (
            <div key={ind.kind} className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold tracking-widest" style={{ color: ANCIENT.text }}>{ind.name}</span>
                <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}>
                  Lv{ind.level} {ind.levelName}
                </span>
              </div>
              <div className="mt-1 text-xs" style={{ color: ANCIENT.secondary }}>
                {ind.next ? (
                  <>下一级：评分 ≥{ind.next.score} · {ind.next.countLabel}（当前 {ind.count}）</>
                ) : (
                  <>已达最高等级</>
                )}
              </div>
              {ind.canUpgrade && (
                <div className="mt-2">
                  <Btn label="晋升下一级" onClick={() => s.industryUpgrade(ind.kind)} color={ANCIENT.gold} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'tavern' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span style={{ color: ANCIENT.secondary }}>研发方向：</span>
            {DISH_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className="rounded px-2 py-1 font-bold" style={{ backgroundColor: category === c ? ANCIENT.primary : 'transparent', color: category === c ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.primary}` }}>
                {c}
              </button>
            ))}
            <Btn label="开始研发（20两+）" onClick={() => s.tavernStartResearch(category)} />
          </div>
          <div className="text-xs" style={{ color: ANCIENT.secondary }}>
            研发中：{s.tavernResearchJobs.length} 项（{s.tavernResearchJobs.map((j) => `${j.dishName}(${j.remainingDays}天)`).join('、') || '无' }）
          </div>
          {s.tavernResearchJobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between text-xs" style={{ color: ANCIENT.text }}>
              <span>{j.dishName} · 剩 {j.remainingDays} 天</span>
              <Btn label="结算" onClick={() => s.tavernSettleResearch(j.id)} />
            </div>
          ))}
          <div className="mt-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>已研发菜品（{s.tavernDishes.length}）</div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {s.tavernDishes.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs" style={{ color: ANCIENT.text }}>
                <span>{d.name}（品质{d.quality}）{d.isSignature ? '★招牌' : ''} {d.bonus}</span>
                <Btn label={d.isSignature ? '取消招牌' : '设为招牌'} onClick={() => s.tavernSetSignature(d.id)} color={d.isSignature ? ANCIENT.border : ANCIENT.gold} />
              </div>
            ))}
          </div>
          <div className="mt-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>宴席（{s.tavernBanquets.length}）· 已承办 {s.tavernBanquetCount} 次</div>
          <Btn label="接一单宴席" onClick={() => s.tavernAcceptBanquet()} />
          <Btn label="宴席定制菜单" onClick={() => setFeaturePanel('banquet')} color={ANCIENT.gold} />
          {s.tavernBanquets.filter((b) => b.status === 'preparing').map((b) => (
            <div key={b.id} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between" style={{ color: ANCIENT.text }}>
                <span>{b.type === 'shou_yan' ? '寿宴' : b.type === 'hun_yan' ? '婚宴' : b.type === 'shang_hui' ? '商会宴' : b.type === 'jian_xing' ? '饯行宴' : '洗尘宴'} · {b.guestCount}人 · 预算{b.budget}两</span>
                <span style={{ color: ANCIENT.secondary }}>{b.holdDay}日举办 · 筹备{b.prepProgress}%</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Btn label="筹备（选菜+酒水+雅间）" onClick={() => s.tavernPrepareBanquet(b.id, b.dishIds.length ? b.dishIds : (s.tavernDishes.slice(0, 6).map((d) => d.id) ?? []), Math.ceil(b.guestCount / 4), 'refined')} />
                <Btn label="立即举办" onClick={() => s.tavernHoldBanquet(b.id)} color={ANCIENT.gold} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'clothier' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>合作织工（{s.weavers.filter((w) => w.status === 'active').length}）</span>
            <Btn label="寻访织工（10精力）" onClick={() => s.clothierHireWeaver()} />
          </div>
          {s.weavers.map((w) => (
            <div key={w.id} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between" style={{ color: ANCIENT.text }}>
                <span>{w.name}（技艺{w.skill} · 抽成{Math.round(w.commission * 100)}%）</span>
                <span style={{ color: ANCIENT.secondary }}>满意度 {w.satisfaction}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {w.currentGoods.filter((g) => !g.sold).map((g) => (
                  <button key={g.id} type="button" onClick={() => s.clothierSellConsignment(w.id, g.id)} className="rounded px-2 py-1" style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>
                    卖「{g.name}」{g.price}两
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>定制订单（{s.customOrders.length}）· 完成 {s.customOrderCount} 单</div>
          <Btn label="接一单定制" onClick={() => s.clothierAcceptCustomOrder()} />
          <Btn label="面料推荐" onClick={() => setFeaturePanel('fabric')} color={ANCIENT.gold} />
          {s.customOrders.filter((o) => o.status === 'making').map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <span style={{ color: ANCIENT.text }}>{o.guestName} · {o.type === 'bridal' ? '嫁衣' : o.type === 'official' ? '官服' : o.type === 'longevity' ? '寿衣' : o.type === 'bulk' ? '批量工服' : '常服'} · {o.reward}两</span>
              <div className="flex gap-1">
                <Btn label="完美交货" onClick={() => s.clothierDeliverCustomOrder(o.id, 0.95)} />
                <Btn label="有瑕交货" onClick={() => s.clothierDeliverCustomOrder(o.id, 0.5)} color={ANCIENT.border} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'herbalist' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>坐堂郎中（{s.physicians.filter((p) => p.status === 'active').length}）</span>
            <Btn label="寻访郎中（10精力）" onClick={() => s.herbalistHirePhysician()} />
          </div>
          {s.physicians.map((p) => (
            <div key={p.id} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between" style={{ color: ANCIENT.text }}>
                <span>{p.name}（{p.specialty} · 医术{p.skill}）</span>
                <span style={{ color: ANCIENT.secondary }}>满意度 {p.satisfaction} · 月薪{p.salary}两</span>
              </div>
              <div className="mt-1" style={{ color: ANCIENT.secondary }}>每日病患 {p.patientsPerDay} 人 · {p.personality}</div>
            </div>
          ))}
          <Btn label="亲自坐诊（望闻问切）" onClick={() => setFeaturePanel('diagnosis')} color={ANCIENT.primary} />
          <Btn label="郎中坐堂一日（结算问诊）" onClick={() => s.herbalistPhysicianDaily()} color={ANCIENT.gold} />
          <div className="mt-1 text-xs" style={{ color: ANCIENT.secondary }}>今日问诊 {s.todayPatients} 人 · 累计治愈 {s.curedPatientCount} 人</div>
          <div className="mt-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>药方研发（{s.herbRecipes.length} 方）</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {HERB_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setHerbCat(c)} className="rounded px-2 py-1 font-bold" style={{ backgroundColor: herbCat === c ? ANCIENT.accent : 'transparent', color: herbCat === c ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.accent}` }}>
                {c}
              </button>
            ))}
            <select value={symptom} onChange={(e) => setSymptom(e.target.value)} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>
              <option>失眠盗汗</option>
              <option>久咳不愈</option>
              <option>跌打损伤</option>
              <option>虚乏体弱</option>
            </select>
            <Btn label="开始研发" onClick={() => s.herbalistStartResearch(herbCat, symptom)} color={ANCIENT.accent} />
          </div>
          {s.herbResearchJobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between text-xs" style={{ color: ANCIENT.text }}>
              <span>{j.recipeName}（{j.category} · 主治{j.targetSymptom}）剩 {j.remainingDays} 天</span>
              <Btn label="结算" onClick={() => s.herbalistSettleResearch(j.id)} />
            </div>
          ))}
          <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
            {s.herbRecipes.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs" style={{ color: ANCIENT.text }}>
                <span>{r.name}（{r.category} · 品质{r.quality}）{r.isPatent ? '·独家秘方' : ''}</span>
                <Btn label={r.isPatent ? '已设秘方' : '设为秘方'} onClick={() => s.herbalistSetPatent(r.id)} disabled={r.isPatent || r.quality < 4} color={ANCIENT.accent} />
              </div>
            ))}
          </div>
        </div>
      )}
      {featurePanel === 'diagnosis' && (
        <ModalContainer title="坐诊 · 望闻问切" onClose={() => setFeaturePanel(null)} showConfirm={false}>
          <DiagnosisPanel />
        </ModalContainer>
      )}
      {featurePanel === 'banquet' && (
        <ModalContainer title="宴席定制 · 菜单" onClose={() => setFeaturePanel(null)} showConfirm={false}>
          <BanquetMenuPanel />
        </ModalContainer>
      )}
      {featurePanel === 'fabric' && (
        <ModalContainer title="面料推荐 · 定制" onClose={() => setFeaturePanel(null)} showConfirm={false}>
          <FabricRecommendPanel />
        </ModalContainer>
      )}
    </AncientCard>
  );
}

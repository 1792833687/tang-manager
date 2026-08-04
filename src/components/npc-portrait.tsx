/**
 * NPC 立绘组件 — 统一文件名映射 + 性别选版
 * 立绘版本与掌柜性别相反：男掌柜 → 女版 NPC；女掌柜 → 男版 NPC（与阿昭规则一致）。
 * 透明底 PNG 优先；缺失自动降级同名 SVG 占位 → 渐变块（不破图）。
 */
'use client';
import { withBase } from '@/lib/utils/base-path';
import { ANCIENT } from '@/theme/tokens';
import type { Gender } from '@/types/tang-manager';
import { TangImage } from './tang-image';

export type NpcId = 'a-zhao' | 'shen-tinglan' | 'xie-qi';

/** NPC 文件名（男/女两版） */
const NPC_FILES: Record<NpcId, { male: string; female: string }> = {
  'a-zhao': { male: 'a-zhao-male', female: 'a-zhao-female' },
  'shen-tinglan': { male: 'shen-tinglan-male', female: 'shen-tinglan-female' },
  'xie-qi': { male: 'xie-qi-male', female: 'xie-qiniang-female' },
};

const NPC_NAMES: Record<NpcId, string> = {
  'a-zhao': '阿昭',
  'shen-tinglan': '沈听澜',
  'xie-qi': '谢七',
};

interface NpcPortraitProps {
  npc: NpcId;
  /** 掌柜性别：决定立绘版本（与掌柜相反） */
  playerGender: Gender;
  className?: string;
}

export function NpcPortrait({
  npc,
  playerGender,
  className = '',
}: NpcPortraitProps): React.ReactElement {
  // 与掌柜性别相反的版本：女掌柜 → 男版；男掌柜 → 女版
  const variant: 'male' | 'female' = playerGender === 'female' ? 'male' : 'female';
  const file = NPC_FILES[npc][variant];
  return (
    <TangImage
      src={withBase(`/images/npcs/${file}.png`)}
      fallbackSrc={withBase(`/images/npcs/${file}.svg`)}
      alt={`${NPC_NAMES[npc]}立绘`}
      className={className}
      fit="cover"
      style={{
        border: `1px solid ${ANCIENT.border}`,
        boxShadow: '0 6px 16px rgba(60,40,20,0.22)',
        backgroundColor: ANCIENT.card,
      }}
    />
  );
}

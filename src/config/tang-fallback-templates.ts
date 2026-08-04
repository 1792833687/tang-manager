/**
 * 《我在唐朝当掌柜》兜底模板库（v1.1 模块五 5.4）
 * 按类型与场景组织的统一出口，随机抽取避免重复，模板变量填充支持。
 * 各场景模板池分散在专门文件，此处聚合导出（单一入口）。
 */
export { OPENING_LINES, GUEST_REPLIES, SUCCESS_NARRATIVES, FAIL_NARRATIVES, GUEST_REVIEWS, pickTemplate } from '@/config/tang-dialogue-templates';
export { STORY_TEMPLATES, RESULT_TEMPLATES, pickStoryTemplate, pickResultTemplate, fillStoryTemplate } from '@/config/tang-story-templates';
export { NODE_STORY_TEMPLATES, GENERIC_NODE_STORIES, RESIDENT_LINES } from '@/config/tang-node-stories-content';

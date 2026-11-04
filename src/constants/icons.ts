/**
 * 图标色板
 *
 * 小程序端的 lucide 图标由 SVG data-uri 渲染，拿不到 CSS 的 currentColor，
 * 所以颜色只能以 props 形式传入。统一在这里维护，避免同一个色值在多处漂移；
 * 取值与 styles/_vars.scss 的文本层级保持一致。
 */
export const ICON_COLOR = {
  /** 强调文字/主要操作 */
  strong: '#1B1F24',
  /** 正文次级 */
  body: '#5F6772',
  /** 弱提示、空状态 */
  muted: '#9AA0A6',
  /** 深色或品牌色底上的图标 */
  white: '#FFFFFF',
  /** 品牌橙 */
  brand: '#F26B3A',
  /** 破坏性操作 */
  danger: '#EF4444'
} as const

/**
 * 图标描边宽度（24 视口下的值）
 *
 * 旧的 PNG 图标是「96px 画布 + 2px 描边」，等效到 24 视口就是 0.5；
 * lucide 组件默认的 2 会让线条粗 4 倍，因此统一按原视觉重量取 0.5。
 * 换算到屏幕：线条 ≈ size / 48（px）。
 */
export const ICON_STROKE = {
  light: 0.5,
  default: 1,
  strong: 2
}

/**
 * 图标生成脚本
 * 图标来源：Lucide（https://lucide.dev，ISC License），本地依赖 lucide-static
 * 用法：npm run icons
 *
 * 产物：
 *   src/assets/icons/cat/{icon}.png      分类图标（彩色）
 *   src/assets/icons/cat/{icon}-on.png   分类图标（白色，选中态）
 *   src/assets/icons/ui/*.png            界面图标
 *   src/assets/tabbar/*.png              tabBar 图标（微信 tabBar 只支持图片）
 *   src/assets/icons/index.ts            图标映射（自动生成，勿手改）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LUCIDE_DIR = path.join(ROOT, 'node_modules', 'lucide-static', 'icons')
const OUT_CAT = path.join(ROOT, 'src', 'assets', 'icons', 'cat')
const OUT_UI = path.join(ROOT, 'src', 'assets', 'icons', 'ui')
const OUT_TAB = path.join(ROOT, 'src', 'assets', 'tabbar')
const INDEX_FILE = path.join(ROOT, 'src', 'assets', 'icons', 'index.ts')

/** 与 src/constants/categories.ts 保持一致 */
const CATEGORY_ICONS = [
  ['utensils', '#F26B3A'],
  ['bus-front', '#3B82F6'],
  ['shopping-bag', '#EC4899'],
  ['house', '#8B5CF6'],
  ['gamepad-2', '#F59E0B'],
  ['heart-pulse', '#EF4444'],
  ['graduation-cap', '#06B6D4'],
  ['smartphone', '#6366F1'],
  ['gift', '#F43F5E'],
  ['shapes', '#94A3B8'],
  ['wallet', '#12A160'],
  ['award', '#F59E0B'],
  ['trending-up', '#0EA5E9'],
  ['briefcase', '#8B5CF6'],
  ['hand-coins', '#EF4444'],
  ['circle-dollar-sign', '#94A3B8']
]

const UI_ICONS = [
  { file: 'plus-white', source: ['plus'], color: '#FFFFFF' },
  { file: 'chevron-left', source: ['chevron-left'], color: '#1B1F24' },
  { file: 'chevron-right', source: ['chevron-right'], color: '#1B1F24' },
  { file: 'calendar', source: ['calendar', 'calendar-days'], color: '#5F6772' },
  { file: 'pencil', source: ['pencil', 'pencil-line'], color: '#5F6772' },
  { file: 'backspace', source: ['delete', 'delete-icon'], color: '#1B1F24' },
  { file: 'receipt', source: ['receipt-text', 'receipt'], color: '#9AA0A6' },
  { file: 'cloud-off', source: ['cloud-off'], color: '#9AA0A6' },
  { file: 'trash', source: ['trash-2', 'trash'], color: '#EF4444' },
  // 侧滑删除按钮底色就是红的，按钮内的垃圾桶必须走白色，否则红底红图等于看不见
  { file: 'trash-white', source: ['trash-2', 'trash'], color: '#FFFFFF' },
  { file: 'clock', source: ['clock'], color: '#5F6772' },
  { file: 'chart', source: ['chart-column-increasing', 'chart-column', 'bar-chart-3'], color: '#F26B3A' },
  { file: 'database', source: ['database'], color: '#F26B3A' },
  { file: 'info', source: ['info'], color: '#F26B3A' },
  { file: 'edit', source: ['pencil-line', 'pencil'], color: '#F26B3A' },
  { file: 'settings', source: ['settings', 'settings-2', 'cog'], color: '#1B1F24' }
]

const TAB_ICONS = [
  { file: 'bill', source: ['list', 'receipt-text'], color: '#9AA0A6' },
  { file: 'bill-active', source: ['list', 'receipt-text'], color: '#F26B3A' },
  { file: 'stat', source: ['chart-column', 'bar-chart-3', 'bar-chart'], color: '#9AA0A6' },
  { file: 'stat-active', source: ['chart-column', 'bar-chart-3', 'bar-chart'], color: '#F26B3A' },
  { file: 'user', source: ['user-round', 'circle-user', 'user'], color: '#9AA0A6' },
  { file: 'user-active', source: ['user-round', 'circle-user', 'user'], color: '#F26B3A' }
]

function resolveIcon (candidates, label) {
  for (const name of candidates) {
    const p = path.join(LUCIDE_DIR, `${name}.svg`)
    if (fs.existsSync(p)) return p
  }
  throw new Error(`找不到图标 ${label}（尝试过 ${candidates.join(', ')}）`)
}

/**
 * 默认头像：品牌暖色渐变底 + Lucide 白色人像描边。
 * 用户在个人中心没设置过头像时显示它，避免用 emoji 或外链图片。
 */
async function renderAvatar (outFile) {
  const raw = fs.readFileSync(resolveIcon(['user-round', 'circle-user', 'user'], 'avatar'), 'utf8')
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/currentColor/g, '#FFFFFF')
  const size = 240
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFCBA8"/>
      <stop offset="0.48" stop-color="#FF9161"/>
      <stop offset="1" stop-color="#DE4C2A"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" fill="url(#bg)"/>
  <circle cx="40" cy="8" r="14" fill="#FFFFFF" opacity="0.16"/>
  <g transform="translate(11 11) scale(1.0833)" fill="none" stroke="#FFFFFF" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outFile)
}

function buildSvg (file, color, size) {
  let svg = fs.readFileSync(file, 'utf8')
  svg = svg.replace(/<!--[\s\S]*?-->/g, '')
  svg = svg.replace(/currentColor/g, color)
  svg = svg.replace(/width="24"/, `width="${size}"`)
  svg = svg.replace(/height="24"/, `height="${size}"`)
  svg = svg.replace(/stroke-width="2"/, `stroke-width="2"`)
  return Buffer.from(svg)
}

async function render (srcFile, outFile, color, size) {
  const buf = buildSvg(srcFile, color, size)
  await sharp(buf, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(outFile)
}

function ensureDir (dir) {
  fs.mkdirSync(dir, { recursive: true })
  // 清掉旧产物，避免残留
  fs.readdirSync(dir).forEach((f) => {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f))
  })
}

function camel (s) {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

async function main () {
  ensureDir(OUT_CAT)
  ensureDir(OUT_UI)
  ensureDir(OUT_TAB)

  let count = 0

  for (const [name, color] of CATEGORY_ICONS) {
    const src = resolveIcon([name], name)
    await render(src, path.join(OUT_CAT, `${name}.png`), color, 96)
    await render(src, path.join(OUT_CAT, `${name}-on.png`), '#FFFFFF', 96)
    count += 2
  }

  for (const item of UI_ICONS) {
    const src = resolveIcon(item.source, item.file)
    await render(src, path.join(OUT_UI, `${item.file}.png`), item.color, 96)
    count += 1
  }

  for (const item of TAB_ICONS) {
    const src = resolveIcon(item.source, item.file)
    await render(src, path.join(OUT_TAB, `${item.file}.png`), item.color, 81)
    count += 1
  }

  // 默认头像（个人中心用）
  await renderAvatar(path.join(OUT_UI, 'avatar.png'))
  count += 1

  // ---------- 生成映射文件 ----------
  const catEntries = CATEGORY_ICONS.map(([name]) => name)
  const uiEntries = [...UI_ICONS.map(i => i.file), 'avatar']

  const catImports = catEntries
    .map(n => `import cat_${camel(n)} from './cat/${n}.png'\nimport cat_${camel(n)}_on from './cat/${n}-on.png'`)
    .join('\n')
  const uiImports = uiEntries
    .map(n => `import ui_${camel(n)} from './ui/${n}.png'`)
    .join('\n')

  const catMap = [
    ...catEntries.map(n => `  '${n}': cat_${camel(n)},`),
    ...catEntries.map(n => `  '${n}-on': cat_${camel(n)}_on,`)
  ].join('\n')

  const uiMap = uiEntries
    .map(n => `  ${camel(n)}: ui_${camel(n)},`)
    .join('\n')

  const content = `// 该文件由 scripts/gen-icons.mjs 自动生成，请勿手动修改。
// 图标来源：Lucide（https://lucide.dev，ISC License）
${catImports}
${uiImports}

/** 分类图标：key 为图标名，'-on' 后缀为选中态（白色） */
export const CAT_ICONS: Record<string, string> = {
${catMap}
}

/** 界面图标 */
export const UI_ICONS: Record<string, string> = {
${uiMap}
}
`

  fs.writeFileSync(INDEX_FILE, content, 'utf8')
  console.log(`[icons] 已生成 ${count} 个 PNG，映射文件：src/assets/icons/index.ts`)
}

main().catch((err) => {
  console.error('[icons] 生成失败：', err.message)
  process.exit(1)
})

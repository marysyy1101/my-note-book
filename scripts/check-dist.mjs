/**
 * 产物语法体检
 *
 * 背景：微信开发者工具「预览 / 上传」阶段会用自己的解析器读取 dist 里的 js，
 * 它只认到 ES2015 左右，遇到可选链 `?.`、空值合并 `??`、class 字段这类
 * ES2020 语法会直接报：
 *     invalid file: common.js, 1:41477 SyntaxError: Unexpected token .
 *
 * 触发条件通常是 package.json 的 browserslist 写得过于现代（Taro 模板默认是
 * "defaults and fully supports es6-module"），导致 Babel 认为不需要降级。
 * 小程序应当使用 ios >= 9 / android >= 4.4 这类目标。
 *
 * 这里在构建后按 ES5 解析全部产物，命中即失败，避免打包上线后才发现。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIST = 'dist'
const ECOSYSTEM = 5

/** Babel 兜底：没有 acorn 时用正则粗筛 */
const FALLBACK_PATTERNS = [
  [/[^?\s]\?\.[A-Za-z_$[(]/, '可选链 ?.'],
  [/\?\?[^=]/, '空值合并 ??'],
  [/[&|]{2}=/, '逻辑赋值 &&= / ||='],
  [/=>/, '箭头函数'],
  [/\bclass\s+[A-Za-z_$]/, 'class 语法']
]

function walk (dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

if (!fs.existsSync(DIST)) {
  console.error(`[check-dist] 找不到 ${DIST}，请先执行构建`)
  process.exit(1)
}

let acorn = null
try {
  acorn = (await import('acorn')).parse ? (await import('acorn')) : (await import('acorn')).default
} catch {
  console.warn('[check-dist] 未找到 acorn，降级为正则检查')
}

const files = walk(DIST)
const failures = []

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8')
  if (acorn) {
    try {
      acorn.parse(code, { ecmaVersion: ECOSYSTEM, sourceType: 'script' })
    } catch (err) {
      const rel = path.relative(DIST, file)
      const at = err.loc ? `:${err.loc.line}:${err.loc.column}` : ''
      failures.push(`${rel}${at} → ${err.message}`)
    }
  } else {
    for (const [re, label] of FALLBACK_PATTERNS) {
      if (re.test(code)) failures.push(`${path.relative(DIST, file)} → 含 ${label}`)
    }
  }
}

if (failures.length) {
  console.error(`\n[check-dist] ✗ ${failures.length} 个文件不兼容小程序端解析：`)
  failures.slice(0, 10).forEach((f) => console.error('  - ' + f))
  console.error('\n检查 package.json 的 browserslist，小程序应使用 ios >= 9 / android >= 4.4')
  process.exit(1)
}

console.log(`[check-dist] ✓ ${files.length} 个产物通过 ES5 解析`)

/**
 * 修补 @tarojs/runtime 4.3.x 的 raf 自引用缺陷
 *
 * 背景：
 *   Taro 的 MiniWebpackPlugin 通过 ProvidePlugin 把 `requestAnimationFrame`
 *   `cancelAnimationFrame` 等全局标识符重定向到 `@tarojs/runtime` 的导出：
 *       requestAnimationFrame: ['@tarojs/runtime', 'requestAnimationFrame']
 *
 *   而 runtime 自身 raf 模块源码里也写了裸标识符：
 *       const _raf = _hasNativeRaf ? requestAnimationFrame : function () {...}
 *
 *   于是打包后变成「模块 A 的初始化语句里读取模块 A 自己的导出 getter」，
 *   该导出此时还没赋值（const 处于 TDZ），运行时直接抛：
 *       ReferenceError: Cannot access 'c' before initialization
 *   表现为小程序白屏、控制台报 app.js / WAServiceMainContext 错误。
 *
 * 处理：
 *   小程序环境本来就没有原生 raf（TARO_PLATFORM = mini，_hasNativeRaf 恒为 false），
 *   所以直接删掉对原生 raf 的引用分支，保留 setTimeout 兜底实现，行为完全等价。
 *
 * 该脚本幂等，可重复执行；在 postinstall 中自动运行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILES = [
  'node_modules/@tarojs/runtime/dist/bom/raf.js',
  'node_modules/@tarojs/runtime/dist/runtime.esm.js',
  'node_modules/@tarojs/runtime/dist/index.cjs.js'
]
const MARK = '/* patched-taro-raf */'

const REPLACEMENTS = [
  [
    /const _hasNativeRaf = process\.env\.TARO_PLATFORM === 'web' &&\s*\n\s*typeof requestAnimationFrame !== 'undefined' &&\s*\n\s*typeof cancelAnimationFrame !== 'undefined';/,
    `${MARK}\nconst _hasNativeRaf = false;`
  ],
  [
    /(const _raf = )_hasNativeRaf\s*\n\s*\? requestAnimationFrame\s*\n\s*: /,
    '$1'
  ],
  [
    /(const _caf = )_hasNativeRaf\s*\n\s*\? cancelAnimationFrame\s*\n\s*: /,
    '$1'
  ]
]

function patchFile (rel) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) {
    console.log(`[patch-taro-raf] 跳过（文件不存在）: ${rel}`)
    return 'skip'
  }
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(MARK)) {
    console.log(`[patch-taro-raf] 已是最新，跳过: ${rel}`)
    return 'already'
  }
  let out = src
  let hit = 0
  for (const [pattern, replacement] of REPLACEMENTS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, replacement)
      hit++
    }
  }
  if (hit === 0) {
    console.log(`[patch-taro-raf] 未匹配到目标代码，可能 Taro 已自行修复: ${rel}`)
    return 'nomatch'
  }
  fs.writeFileSync(file, out, 'utf8')
  console.log(`[patch-taro-raf] 已修补 ${hit}/${REPLACEMENTS.length} 处: ${rel}`)
  return 'patched'
}

let changed = false
for (const rel of FILES) {
  if (patchFile(rel) === 'patched') changed = true
}

// 让 Taro 的预打包缓存失效，否则仍会命中旧的 runtime 产物
const cacheDir = path.join(root, 'node_modules/.taro')
if (changed && fs.existsSync(cacheDir)) {
  fs.rmSync(cacheDir, { recursive: true, force: true })
  console.log('[patch-taro-raf] 已清理预打包缓存 node_modules/.taro')
}

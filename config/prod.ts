import type { UserConfigExport } from '@tarojs/cli'

/**
 * 生产构建配置
 *
 * 这里保持空配置，JS 压缩交给 config/index.ts 里的 jsMinimizer: 'esbuild'。
 * 原因：terser 会起一组并行 worker，每个进程几十 MB 堆，本机 commit 内存偏紧时
 * 构建会直接 OOM；esbuild 是单进程原生实现，内存占用低一个量级，且 target: es5
 * 会把 webpack 生成的简写对象等 ES6 语法降级，产物仍能通过 scripts/check-dist.mjs。
 */
export default {
  mini: {}
} satisfies UserConfigExport<'webpack5'>

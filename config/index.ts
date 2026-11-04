import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'jizhang',
    date: '2026-11-3',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {},
    copy: {
      patterns: [
        // tabBar 图标：小程序端 tabBar 只能读取包内静态图片，这里做一次兜底拷贝
        { from: 'src/assets/tabbar/', to: 'dist/assets/tabbar/' },
        // 站点地图：个人账本不做搜索索引，声明 disallow（app.json 通过 sitemapLocation 指向它）
        { from: 'src/sitemap.json', to: 'dist/sitemap.json' }
      ],
      options: {}
    },
    framework: 'react',
    compiler: 'webpack5',
    // JS 压缩器用 esbuild（单进程原生实现，target: es5 → 会把 webpack 生成的
    // 简写对象等 ES6 语法降级）。terser 的并行 worker 在本机会把 commit 打满 OOM。
    jsMinimizer: 'esbuild',
    cache: {
      enable: false
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      imageUrlLoaderOption: {
        limit: 20480
      },
      webpackChain (chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})

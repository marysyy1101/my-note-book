import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: false,
    stats: false
  },
  mini: {}
} satisfies UserConfigExport<'webpack5'>

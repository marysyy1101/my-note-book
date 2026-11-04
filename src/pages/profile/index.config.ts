export default definePageConfig({
  // 去掉系统默认导航栏，页面自己画渐变头部（状态栏高度由 utils/system.ts 精确计算）
  navigationStyle: 'custom',
  navigationBarTitleText: '我的',
  backgroundColor: '#F4F5F7',
  backgroundColorTop: '#FFE7DA',
  backgroundColorBottom: '#F4F5F7'
})

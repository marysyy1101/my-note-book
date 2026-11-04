export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/profile/index',
    'pages/stats/index',
    'pages/add/index'
  ],
  // 个人账目不参与微信搜索索引（规则见 src/sitemap.json，构建时拷到 dist）
  sitemapLocation: 'sitemap.json',
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: '记账本',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F4F5F7'
  },
  // 自定义 tabBar：明细 / 记一笔（中间凸起）/ 我的
  // 记一笔是普通页面（navigateTo 打开），不属于 tab 页，所以 list 只放两个真实 tab
  tabBar: {
    custom: true,
    color: '#9AA0A6',
    selectedColor: '#F26B3A',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '明细'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的'
      }
    ]
  }
})

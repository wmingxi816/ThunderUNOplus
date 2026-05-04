# Phase 4F：网页端移动端 UI 细节打磨与试玩体验优化

## 阶段目标

把 Phase 4E 已经建立的真实浏览器 E2E 保护利用起来，集中打磨网页端在手机和窄屏窗口下的可读性、可点性和试玩稳定感。

本阶段不新增数据库、登录、排行榜、商城、支付、新玩法规则、正式公网部署，也不重写 UI 架构。

## 本次完成内容

### 1. 窄屏布局收敛

`apps/client-web/src/styles.css` 已补充移动端适配：

- 顶部栏支持换行，避免状态标签和标题在窄屏互相挤压。
- 主容器在小屏下缩小外边距，减少横向浪费。
- 连接区、房间区、表单区在窄屏下稳定切为单列。
- 桌面区在平板和手机宽度下改为更紧凑的两列牌堆/顶牌布局，桌面状态信息单独换行。
- 560px 以下降低桌面区 padding 和图片上限，避免桌面区撑爆首屏。

### 2. 手牌区可读性优化

- 手牌按钮增加稳定 `aspect-ratio`，减少图片加载和选中态造成的布局抖动。
- 手牌横向滚动启用触控惯性滚动与 scroll snap。
- 手机宽度下手牌列宽、间距和手牌区 padding 收紧，保证更多内容留在主视口内。
- 选中态和 focus 态保持明确轮廓，不依赖脆弱文本。

### 3. 交互可点性优化

- 全局按钮最小高度提升到更适合触控的尺寸。
- 按钮、输入框和选择框增加统一 focus-visible 轮廓。
- 连接 / 创建 / 加入 / 离开等按钮在窄屏下自动换行排布。
- 手机宽度下主对局操作按钮改为纵向铺满，避免多个按钮挤成一团。
- 对手操作按钮在超窄屏下切为单列，减少误触。

### 4. 错误提示与状态区优化

- `error-line` 保留独立行高和最小高度，避免错误出现时挤压到按钮。
- 房间号允许安全换行，避免长 room id 或异常输入撑开布局。
- 日志区在手机下限制高度，确保不会把主操作区挤出过远。

## 自动化回归保持情况

未删除或削弱现有 Playwright E2E。现有选择器和 `data-testid` 保持不变，Phase 4E 的三条真实浏览器用例继续通过：

- 三窗口创建 / 加入 / 开局 / 摸牌主链路
- 加入不存在房间时的错误提示
- 对局中刷新后的 reconnect

## 本地验证结果

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm typecheck
corepack pnpm test
```

## 修改文件

- `apps/client-web/src/styles.css`
- `docs/PHASE4F-WEB-MOBILE-POLISH.md`
- `README.md`
- `next-step.md`
- `docs/项目开发文档.md`

## 仍未实现内容

- 真实手机设备上的人工长局试玩记录。
- 更多移动端视觉细节收口，例如横屏模式、极长昵称和极端手牌数量。
- 房内重新开局。
- 正式公网部署、HTTPS / WSS、账号系统、数据库、排行榜、商城和支付。

## 下一阶段建议

进入 Phase 4G：移动端真实设备试玩验收与视觉细节收口。

优先级：

1. 用真实手机和同局域网设备跑完整三人试玩。
2. 记录并修复横屏、极窄屏、极长昵称、极多手牌等边界体验。
3. 继续保持 Playwright E2E、构建和全仓测试稳定通过。
4. 收口 README 中的试玩验收清单。

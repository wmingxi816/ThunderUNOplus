# Phase 4G：移动端真实设备试玩验收与视觉细节收口

## 阶段目标

把 Phase 4F 的移动端布局优化继续收口到更接近真实手机试玩的状态，重点处理横屏、竖屏、极长昵称、极多手牌、错误提示和日志区的可读性问题。

本阶段不新增数据库、登录、排行榜、商城、支付、新玩法规则或正式公网部署。

## 本次完成内容

### 1. 移动端布局收口

`apps/client-web/src/styles.css` 继续补强了移动端表现：

- 长昵称、房间号、玩家名、对手名、结果横幅和日志内容都支持换行收口。
- 对局面板在横屏下改为更紧凑的双列布局，方便同时看到桌面区和手牌区。
- 手牌区、对手区、房间信息区补了 `min-width: 0` 和断词控制，避免文字撑爆布局。
- 日志区维持可滚动，不再无限拉高页面。
- 错误提示保留独立占位，不会和按钮挤在一起。

### 2. 窄屏回归测试

新增 `apps/client-web/e2e/mobile-layout.spec.ts`，覆盖：

- 390x844 竖屏下的大厅与对局可见性
- 横屏切换后的 battle 布局可读性
- 页面无明显横向滚动
- 长昵称在房间列表中的显示稳定性

### 3. 真实手机试玩清单

README 已补充真实手机试玩步骤：

- 同一局域网访问
- 服务端监听 `0.0.0.0`
- 网页端监听 `0.0.0.0`
- 手机用局域网 IP 打开网页
- 三端同房间试玩
- 黑牌颜色选择、错误提示、刷新重连、竖横屏切换都要检查

### 4. 文档同步

同步更新了：

- `README.md`
- `next-step.md`
- `docs/项目开发文档.md`

## 新增测试

- `apps/client-web/e2e/mobile-layout.spec.ts`

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

## 仍未实现内容

- 真实手机长局试玩的人工记录仍建议继续补。
- 更进一步的牌桌动效和头像座位重构还没做。
- 正式公网部署、HTTPS / WSS 和公开试玩环境还没进入。

## 下一阶段建议

进入 Phase 4H：首版公开试玩部署准备。

优先级：

1. 梳理本地、局域网和公开试玩的访问方式。
2. 收口 HTTPS / WSS 和环境变量说明。
3. 继续保持 Playwright E2E、构建和全仓测试稳定通过。
4. 为后续公开试玩留出明确的部署边界。

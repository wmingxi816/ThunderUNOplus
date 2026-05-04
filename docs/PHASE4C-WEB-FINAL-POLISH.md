# Phase 4C：HTML 网页端真实联调收口

## 阶段目标

把 Phase 4B 的“网页端三人本地可玩”推进到更稳定的真实联调状态。

本阶段不做数据库、登录系统、排行榜、商城、支付、正式部署和新玩法规则，只收口网页端试玩链路。

## 本次完成内容

### 1. 断线重连基础流程

网页端现在会保留稳定的 `userId` 和最近一次 `roomId`：

- `thunder-uno.userId`
- `thunder-uno.lastRoomId`

当 WebSocket 重新 open 后，如果本地仍有 roomId，会自动发送 `reconnect` 消息。重连成功后由服务端重新下发 `room-state` 或 `snapshot`，网页端恢复 lobby 或 battle 视图。

### 2. 错误提示收口

页面固定渲染 `#error-line`，用于展示：

- WebSocket 未连接
- 连接断开
- 房间不存在
- 玩家不在房间
- 房间未在对局中
- 服务端 `error`
- 服务端事件里的 `command-rejected`

成功收到 `room-state` 或 `snapshot` 后会清理旧错误。

### 3. 对局结束状态

当玩家视角快照进入 `finished` 状态时，网页端会显示结束横幅：

- 展示“对局结束”
- 展示赢家昵称或 playerId
- 禁用出牌、摸牌、UNO、结算罚抽、结算加牌、抓 UNO、质疑等操作
- 明确提示当前版本暂不支持房内重开
- 提供“返回大厅”的最小入口

### 4. 按钮禁用与空状态

本阶段补齐了更多客户端侧 UI 状态：

- 未连接时禁用创建、加入、离开
- 非房主禁用开始游戏
- 非当前玩家禁用手牌点击、出牌、摸牌和 UNO
- 只有 drawStack 目标玩家可以结算加牌
- 只有 drawUntilColor 目标玩家可以结算罚抽
- 断线、非当前回合、游戏结束时展示明确文案

这些禁用只用于交互体验，权威规则仍由服务端和 `packages/uno-core` 裁定。

### 5. 浏览器冒烟测试

为 `apps/client-web` 增加 jsdom 冒烟测试，覆盖：

- 页面 shell 能启动
- WebSocket 地址输入框存在
- 创建房间按钮存在
- 加入房间输入框存在
- 错误提示区域存在
- 连接状态区域存在
- 本地 roomId 存在时，连接 open 后会发送 `reconnect`

### 6. 协议构造测试

补充 `buildReconnectMessage` 的测试，确保网页端 reconnect 消息包含稳定的 `roomId` 和 `userId`。

## 三窗口联调流程

人工验收建议流程：

```txt
1. 启动 game-server。
2. 启动 client-web。
3. 打开三个浏览器窗口。
4. 窗口 A 创建房间。
5. 窗口 B / C 输入房间号加入。
6. 窗口 A 开始游戏。
7. 当前玩家出牌或摸牌。
8. 非当前玩家确认按钮被禁用，或服务端拒绝事件能展示到页面。
9. 黑牌出牌时确认颜色选择弹层可用。
10. 关闭一个窗口后重新打开，确认 reconnect 消息会发送。
11. 尽量跑到对局结束，确认结束横幅出现。
```

## 局域网联调说明

服务端建议监听所有网卡：

```bash
HOST=0.0.0.0 PORT=8787 corepack pnpm --filter @thunder-uno/game-server dev
```

网页端启动：

```bash
corepack pnpm --filter @thunder-uno/client-web dev
```

手机或其他电脑访问：

```txt
http://电脑局域网IP:5173?ws=电脑局域网IP:8787
```

常见问题：

- 手机和电脑必须在同一个局域网。
- Windows 防火墙可能拦截 5173 或 8787。
- 如果端口占用，换端口后 `?ws=` 也要同步修改。
- 本地开发环境使用 `ws://`，正式 HTTPS 站点通常需要 `wss://`。

## 新增与修改文件

### 新增

- `apps/client-web/src/smoke/appBoot.test.ts`
- `docs/PHASE4C-WEB-FINAL-POLISH.md`

### 修改

- `apps/client-web/package.json`
- `apps/client-web/tsconfig.json`
- `apps/client-web/src/main.ts`
- `apps/client-web/src/styles.css`
- `apps/client-web/src/protocol/clientMessages.ts`
- `apps/client-web/src/protocol/clientMessages.test.ts`
- `pnpm-lock.yaml`
- `README.md`
- `next-step.md`
- `docs/项目开发文档.md`

## 本地验证结果

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm --filter @thunder-uno/protocol test
corepack pnpm typecheck
corepack pnpm test
```

## 仍未实现内容

- Playwright 级真实浏览器 E2E。
- 自动化三窗口完整对局。
- 房内重新开局。
- 正式部署、HTTPS、WSS 和公网房间服务。
- 数据库、账号、排行榜、商城和支付。

## 下一阶段建议

进入 Phase 4D：网页端发布前构建与局域网验收。

优先级：

1. 生产构建与 preview 验证。
2. 局域网手机/电脑实机验收。
3. 静态牌面资源完整性检查。
4. 发布前 README 操作说明收口。

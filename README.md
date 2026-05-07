# 雷霆 UNOplus

《雷霆UNOplus》当前方向是 **HTML 网页端实时多人卡牌游戏**。牌库配置和游戏规则保持不变，继续以服务端权威状态、共享协议和 `uno-core` 规则引擎为核心。

规则与牌库仍以这两份文档为准：

- [GAME-RULES.md](./GAME-RULES.md)
- [CARD-CONFIG.md](./CARD-CONFIG.md)

## 当前阶段

已完成并继续保留：

- Phase 1：monorepo 地基
- Phase 2A：`packages/uno-core` 规则基础层
- Phase 2B：完整对局 reducer
- Phase 2C：共享类型、协议收口、玩家视角快照
- Phase 2D：本地 CLI 连续对局模拟器
- Phase 3A：`apps/game-server` 内存房间容器与命令分发
- Phase 3B：真实 WebSocket 接入、本地联调客户端、集成测试
- Phase 3C：本地多客户端 WebSocket 联调脚本
- Phase 4A：网页端转向与 `apps/client-web` 首版骨架
- Phase 4B：网页端本地三人试玩闭环
- Phase 4C：网页端真实联调收口、断线重连、结束页和浏览器冒烟测试
- Phase 4D：网页端发布前构建与局域网验收
- Phase 4E：真实浏览器 E2E 与三窗口自动化验收
- Phase 4F：网页端移动端 UI 细节打磨与试玩体验优化
- Phase 4G：移动端真实设备试玩验收与视觉细节收口
- Phase 4H：UI-DESIGN 对战界面落地，并完成 next-step2 的界面细化
- Phase 4I：UI 逻辑与算法补完

已放弃：

- `apps/client-wechat`
- `apps/NewProject` Cocos Creator 工程方向
- 微信开发者工具、微信小游戏构建、Cocos prefab/scene 落地计划
- `wx.connectSocket`、`game.json`、`project.config.json` 等微信小游戏专项配置

## 仓库结构

```txt
.
├── apps
│   ├── client-web
│   │   ├── public/cards
│   │   └── src
│   └── game-server
│       └── src
├── docs
├── packages
│   ├── protocol
│   ├── shared-types
│   └── uno-core
├── tools
│   └── simulator
├── CARD-CONFIG.md
├── GAME-RULES.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 目录职责

### `packages/shared-types`

跨端共享领域模型：牌、玩家、房间、命令、事件、快照等类型。

### `packages/protocol`

浏览器客户端和 game-server 之间的 WebSocket 协议。网页端只按协议发送消息，不在客户端裁定规则是否合法。

### `packages/uno-core`

唯一规则归属地，包含牌库生成、开局初始化、出牌结算、摸牌回洗、玩家视角快照裁剪和规则测试。

### `apps/game-server`

当前继续作为权威服务端，已实现：

- 内存房间
- WebSocket 网关
- 创建房间、加入房间、开始游戏、离开房间、断线重连
- 6 位随机房间号和 6 位数字自定义房间号
- 淘汰 / 胜利后的房主重开与继续游戏
- lobby `room-state` 广播
- playing `snapshot` 广播
- 本地多客户端联调脚本

### `apps/client-web`

新的 HTML 网页端入口，当前已实现：

- Vite + 原生 TypeScript 网页应用
- 浏览器 WebSocket 连接
- 生成房间号、自定义 6 位房间号、加入房间、离开房间、开始游戏
- 展示等待房间、玩家列表、对局桌面、顶牌、牌堆、对手、手牌
- 使用 `room-state.playerId` 稳定识别当前玩家
- 支持单牌、顺子、连对、同色丢弃的选牌出牌
- 支持黑牌颜色选择弹层
- 摸牌、结算加牌、结算罚抽、喊 UNO、抓 UNO、质疑
- 基于 `userId + roomId` 的最小断线重连
- 服务端错误和 `command-rejected` 页面提示
- 对局结束横幅，并在结束后禁用对局操作
- 复用 `public/cards` 中的牌面 PNG
- 生产构建与 `vite preview` 验证
- Playwright 真实浏览器 E2E 与三窗口回归
- 手机和窄屏下的基础布局、触控按钮和手牌区优化
- 头像大厅展示、房间内头像不重复分配
- 对战桌环绕式座位、数字手牌数、弃牌堆叠和出牌动效
- 质疑窗口弹层和 5 秒视觉倒计时
- 固定宽度手牌区，极多手牌时自动均匀重叠
- 打出倒数第二张牌后可立即喊 UNO
- 淘汰玩家红色高亮、胜利玩家绿色高亮

## 常用命令

安装依赖：

```bash
corepack pnpm install
```

启动服务端：

```bash
corepack pnpm --filter @thunder-uno/game-server dev
```

启动网页端：

```bash
corepack pnpm --filter @thunder-uno/client-web dev
```

默认访问：

```txt
http://localhost:5173
```

默认 WebSocket：

```txt
ws://localhost:8787
```

也可以通过 URL 参数指定：

```txt
http://localhost:5173/?ws=192.168.1.23:8787
```

大厅房间号输入是 6 个固定数字框：

1. “生成房间号”由服务端自动生成未占用的 6 位房间号。
2. “自定义房间号”必须填满 6 位数字，且不能和已有房间重复。
3. “加入房间”同样从 6 个数字框读取房间号。

生产预览：

```bash
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web preview
```

## 局域网试玩

服务端建议监听所有网卡：

```bash
HOST=0.0.0.0 PORT=8787 corepack pnpm --filter @thunder-uno/game-server dev
```

网页端开发模式也监听所有网卡：

```bash
corepack pnpm --filter @thunder-uno/client-web dev -- --host 0.0.0.0
```

手机或其他电脑在同一局域网内访问：

```txt
http://电脑局域网IP:5173?ws=电脑局域网IP:8787
```

如果使用 `preview`，默认端口通常是 `4173`：

```txt
http://电脑局域网IP:4173?ws=电脑局域网IP:8787
```

常见问题：

1. 手机和电脑必须在同一个局域网。
2. Windows 防火墙可能拦截 5173 或 8787。
3. 如果 8787 被占用，需要同时修改服务端 `PORT` 和网页 `?ws=` 地址。
4. 本地开发使用 `ws://`。
5. HTTPS 页面通常不能连 `ws://`，正式部署要改 `wss://`。

## 移动端试玩验收

真实手机试玩时，建议按这个顺序走一遍：

1. 手机和电脑接入同一局域网。
2. 服务端使用 `HOST=0.0.0.0` 启动。
3. 网页端使用 `--host 0.0.0.0` 启动。
4. 手机打开 `http://电脑局域网IP:5173?ws=电脑局域网IP:8787`。
5. 三个设备或三个浏览器窗口进入同一房间。
6. 房主开始游戏。
7. 每个玩家至少完成一次出牌或摸牌。
8. 测试黑牌颜色选择弹层。
9. 测试错误提示是否清楚可见。
10. 刷新手机页面，确认 reconnect 能回到当前房间。
11. 竖屏和横屏都看一遍，确认桌面区、按钮区和手牌区不互相挤压。
12. 长昵称、极多手牌和日志区滚动都要简单扫一遍。

## 测试与检查

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm typecheck
corepack pnpm test
```

首次运行 Playwright E2E 前，如本机没有浏览器依赖：

```bash
corepack pnpm --filter @thunder-uno/client-web exec playwright install
```

## 开发原则

- 服务端必须是权威状态。
- 客户端只能发送命令，不能自己裁定规则是否合法。
- 所有规则判断必须落在 `packages/uno-core`。
- 所有协议定义必须收口到 `packages/protocol`。
- 所有快照都必须按玩家视角裁剪，不能泄露别人的手牌和隐藏挑战信息。
- 网页端可以做交互、展示、动画、音效和输入体验，但不能复制服务端规则。

## 下一阶段建议

进入 Phase 4J：首版公开试玩部署准备。

重点是开始处理公开试玩部署前的准备工作，包括环境变量、HTTPS / WSS、访问地址和发布前检查，并继续保持构建、E2E 和全仓测试稳定通过。

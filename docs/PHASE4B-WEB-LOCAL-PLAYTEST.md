# Phase 4B：HTML 网页端本地三人试玩闭环

## 本阶段目标

把 `apps/client-web` 从“可连协议”推进到“能在浏览器里真实玩起来”。

本阶段仍然不碰这些内容：

- 数据库
- 登录系统
- 排行榜
- 商城
- 支付
- 正式部署
- 新玩法规则

## 本阶段完成内容

### 1. 网页端身份稳定化

`room-state` 现在会带上 `playerId`，网页端不再靠昵称猜自己是谁。

相关改动：

- `packages/protocol/src/messages.ts`
- `apps/game-server/src/broadcast/broadcastRoomState.ts`
- `apps/client-web/src/main.ts`

### 2. 网页端选牌交互

新增网页端选牌闭环：

- 点击卡牌切换选中状态
- 支持单牌出牌
- 支持顺子出牌
- 支持连对出牌
- 支持同色丢弃
- 支持取消选牌

### 3. 黑牌颜色选择

黑牌不再用 `prompt`，改成页面内颜色选择弹层。

### 4. 牌面资源接入

把 `pictures/卡牌UI/cards_out` 的 PNG 复制到网页端 `public/cards`，让浏览器直接渲染牌面。

### 5. WebSocket 与配置

网页端默认使用：

- `ws://localhost:8787`

也支持通过 `?ws=局域网IP:8787` 覆盖。

## 新增与修改文件

### 新增

- `apps/client-web/package.json`
- `apps/client-web/index.html`
- `apps/client-web/tsconfig.json`
- `apps/client-web/vite.config.ts`
- `apps/client-web/src/main.ts`
- `apps/client-web/src/styles.css`
- `apps/client-web/src/app/config.ts`
- `apps/client-web/src/cards/cardAssets.ts`
- `apps/client-web/src/battle/selection.ts`
- `apps/client-web/src/network/wsClient.ts`
- `apps/client-web/src/protocol/clientMessages.ts`
- `apps/client-web/src/battle/selection.test.ts`
- `apps/client-web/src/app/config.test.ts`
- `apps/client-web/src/cards/cardAssets.test.ts`
- `apps/client-web/src/protocol/clientMessages.test.ts`
- `docs/PHASE4B-WEB-LOCAL-PLAYTEST.md`

### 修改

- `README.md`
- `next-step.md`
- `package.json`
- `tsconfig.json`
- `pnpm-lock.yaml`
- `packages/protocol/src/messages.ts`
- `packages/protocol/src/messages.test.ts`
- `apps/game-server/src/broadcast/broadcastRoomState.ts`
- `docs/项目开发文档.md`

## 测试结果

已通过：

- `corepack pnpm --filter @thunder-uno/client-web typecheck`
- `corepack pnpm --filter @thunder-uno/client-web test`
- `corepack pnpm --filter @thunder-uno/protocol test`
- `corepack pnpm --filter @thunder-uno/game-server test`

## 仍未实现

- 三浏览器窗口完整人工试玩验收
- 断线重连 UI
- 对局结束页
- 移动端细节优化
- 浏览器冒烟测试

## 下一阶段建议

进入 Phase 4C：HTML 网页端真实联调收口。

优先级：

1. 三浏览器窗口真实联调。
2. 断线重连与错误提示收口。
3. 补浏览器冒烟测试。
4. 继续打磨移动端布局。

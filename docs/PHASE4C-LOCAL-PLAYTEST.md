# Phase 4C：本地多端真实试玩与联调修复

## 阶段目标

本阶段目标是在已经完成的客户端骨架、Cocos Controller / Binding 适配层，以及本地 WebSocket 服务端基础上，补齐“本地真实试玩”这一层能力，确保项目可以在开发阶段完成多端连接、创建房间、开始对局、出牌操作、断线提示和手动重连。

本阶段仍然不实现：

- 微信真实登录
- 正式美术资源
- 复杂动画
- 商城、排行榜、支付
- 数据库
- 正式线上 `wss://` 部署

---

## 本阶段完成内容

### 1. 本地地址策略固定下来

客户端开发阶段默认使用：

```txt
ws://localhost:8787
```

同时支持改成局域网地址，例如：

```txt
ws://192.168.1.23:8787
```

这保证了两种开发方式都能覆盖：

- 同机开发：客户端和 `game-server` 在同一台电脑上运行
- 真机联调：手机通过局域网访问电脑上启动的本地服务端

### 2. `game-server` 支持局域网监听

`apps/game-server` 已支持通过环境变量控制监听地址与端口：

```txt
HOST=0.0.0.0
PORT=8787
```

默认监听 `0.0.0.0`，因此本地浏览器 / 模拟器可用，手机局域网联调也可用。

### 3. 客户端连接状态与手动重连

客户端已补齐连接状态流转，覆盖：

- `disconnected`
- `connecting`
- `connected`
- `connect-failed`
- `reconnecting`
- `reconnect-failed`

并提供手动重连入口：

- 登录页可重连
- 房间页可重连
- 对局页可重连

重连时会复用当前 `roomId` 与用户身份，向服务端发送 `reconnect`。

### 4. 本地试玩错误提示与 Toast

以下错误来源都已统一进入 Toast：

- 服务端 `error` 消息
- `command-rejected` 事件
- WebSocket 连接错误
- WebSocket 断开

常见错误文案包括：

- `room-not-found`：房间不存在
- `room-full`：房间已满
- `not-room-owner`：只有房主可以开始
- `invalid-player-count`：人数不足，至少 3 人
- `not-your-turn`：还没轮到你
- `card-not-in-hand`：你没有这张牌
- `illegal-card`：这张牌不能这样出
- `connection-closed`：连接已断开
- `reconnect-failed`：重连失败

### 5. BattleScene 联调按钮逻辑补齐

`BattleScene` 相关按钮显隐和可用条件已经和 snapshot 联动，覆盖：

- 不是自己回合时，摸牌按钮不可用
- 是自己回合时，摸牌按钮可用
- 自己是 `drawStack.targetPlayerId` 时，显示结算加牌按钮
- 自己是 `drawUntilColor.targetPlayerId` 时，显示结算罚抽按钮
- 存在 `challengeWindow` 且自己不是目标玩家时，显示质疑按钮
- 自己手牌只剩 1 张时，显示 UNO 按钮
- 游戏结束后，禁用所有操作按钮

### 6. 黑牌选色联调链路打通

以下黑牌点击后不会立即发 `play-card`：

- 变色
- 罚抽
- 反转变色 +4
- 变色 +6
- 变色 +10

当前流程为：

1. 点击黑牌
2. 打开 `ColorPickerDialog`
3. 选择 `red / yellow / blue / green`
4. 再发送 `play-card + declaredColor`
5. 关闭弹窗

### 7. 本地联调辅助脚本可用

服务端已提供本地多客户端辅助脚本，可用于快速凑人数和跑局：

```bash
corepack pnpm --filter @thunder-uno/game-server dev:scenario --players 3 --mode no-challenge
```

也支持：

- `--players`
- `--mode`
- `--ws-url`
- `--seed`
- `--max-steps`
- `--verbose`
- `--test-reconnect`

---

## 关键修改与相关文件

### 客户端

- `apps/client-wechat/src/app/config.ts`
- `apps/client-wechat/src/app/App.ts`
- `apps/client-wechat/src/network/connectionState.ts`
- `apps/client-wechat/src/network/wsClient.ts`
- `apps/client-wechat/src/network/messageRouter.ts`
- `apps/client-wechat/src/cocos/viewModels/createBattleViewModel.ts`
- `apps/client-wechat/src/cocos/controllers/LoginSceneController.ts`
- `apps/client-wechat/src/cocos/controllers/LobbySceneController.ts`
- `apps/client-wechat/src/cocos/controllers/RoomSceneController.ts`
- `apps/client-wechat/src/cocos/controllers/BattleSceneController.ts`
- `apps/client-wechat/src/scenes/LoginScene/LoginScene.ts`
- `apps/client-wechat/src/scenes/LobbyScene/LobbyScene.ts`
- `apps/client-wechat/src/scenes/RoomScene/RoomScene.ts`
- `apps/client-wechat/src/scenes/BattleScene/BattleScene.ts`

### 服务端与联调脚本

- `apps/game-server/src/dev/runLocalServer.ts`
- `apps/game-server/src/gateway/wsServer.ts`
- `apps/game-server/src/dev/devWsClient.ts`
- `apps/game-server/src/dev/multiClientScenario.ts`

### 测试

- `apps/client-wechat/src/app/config.test.ts`
- `apps/client-wechat/src/app/App.test.ts`
- `apps/client-wechat/src/network/messageRouter.test.ts`
- `apps/client-wechat/src/network/wsClient.test.ts`
- `apps/client-wechat/src/cocos/viewModels/createBattleViewModel.test.ts`
- `apps/client-wechat/src/cocos/controllers/controllers.test.ts`

---

## 本地联调步骤

### 1. 启动本地服务端

```bash
corepack pnpm --filter @thunder-uno/game-server dev
```

### 2. 启动客户端

开发阶段默认连接：

```txt
ws://localhost:8787
```

如果是手机真机联调，改成：

```txt
ws://你的电脑局域网IP:8787
```

例如：

```txt
ws://192.168.1.23:8787
```

### 3. 开 3 个客户端联调

推荐最小流程：

1. A 客户端连接服务端并创建房间
2. B、C 客户端输入房间号加入
3. A 在房间页开始游戏
4. 三端进入 BattleScene
5. 轮流验证出牌、摸牌、UNO、质疑、结算加牌、结算罚抽、断线重连

如果当前不方便同时开 3 个真实客户端，也可以：

- 开 1 个真实客户端
- 配合 `dev:scenario` 补足其他玩家

### 4. 试玩检查清单

- 登录页可以输入昵称
- 登录页可以修改 `WS_URL`
- 能成功连接服务端
- 能创建房间
- 能加入房间
- 房主能开始游戏
- 少于 3 人时开始游戏会收到提示
- 所有客户端都能进入 BattleScene
- 每个客户端只能看到自己的手牌
- 黑牌点击后先弹颜色选择
- 选择颜色后才发送 `play-card + declaredColor`
- UNO、质疑、结算类按钮只在合法条件下出现
- 断线后能看到提示和手动重连入口

---

## 本地验证结果

已通过：

- `corepack pnpm --filter @thunder-uno/client-wechat typecheck`
- `corepack pnpm --filter @thunder-uno/client-wechat test`
- `corepack pnpm --filter @thunder-uno/game-server typecheck`
- `corepack pnpm --filter @thunder-uno/game-server test`
- `corepack pnpm typecheck`
- `corepack pnpm test`

客户端当前关键测试覆盖：

- `WS_URL` 默认值与覆盖逻辑
- `createBattleViewModel` 的按钮显隐规则
- 黑牌选色回调
- `command-rejected` 到 Toast
- 手动重连按钮会调用 `App.reconnect()`

---

## 当前仍未实现

- 真正的 Cocos Creator 序列化 `.scene / .prefab` 资源
- 真机微信小游戏工程实际挂载与点击验证
- 正式美术、动画、音效
- 微信真实登录
- 正式线上 `wss://` 部署

---

## 下一阶段建议

Phase 4C 完成后，下一步进入 Phase 4D：

- 把现有 TypeScript Controller / Binding 真正落成 Cocos Creator 场景和 prefab
- 明确每个场景的节点树
- 明确每个 Controller 的挂载点和 `@property` 绑定点
- 为真实 Creator 手动搭建提供文档和蓝图

# Phase 4A：client-wechat 基础 UI 骨架

## 阶段目标

本阶段完成 `apps/client-wechat` 的最小可玩客户端骨架，只覆盖纯 TypeScript 层，不直接写复杂 Cocos UI、不接微信真实登录、不接数据库。

目标是先把下面这条链路接通：

- 客户端配置
- WebSocket JSON 通信
- `protocol` / `shared-types` 复用
- 本地 store
- Login / Lobby / Room / Battle 四个基础场景骨架
- 手牌点击、摸牌、UNO、质疑、结算命令组装
- 收到 `room-state` / `snapshot` / `events` / `error` 后刷新本地状态

## 本阶段新增的核心目录

```txt
apps/client-wechat/
├─ game.json
├─ project.config.json
└─ src/
   ├─ app/
   ├─ components/
   ├─ network/
   ├─ scenes/
   ├─ store/
   ├─ typecheck/
   ├─ ui/
   └─ utils/
```

## 已实现内容

### 1. app 层

- `app/config.ts`
  - 提供默认 `WS_URL = ws://localhost:8787`
  - 支持通过全局配置覆盖
- `app/App.ts`
  - 组装 `WsClient`、`MessageRouter`、`SessionStore`、`RoomStore`、`BattleStore`
  - 提供 `connect / createRoom / joinRoom / startGame / leaveRoom / playCard / drawCard / sayUno / challengeDraw / resolveDrawStack / resolveDrawUntilColor`
  - 维护当前场景 `login / lobby / room / battle`
- `app/bootstrap.ts`
  - 提供统一客户端启动入口

### 2. network 层

- `network/wsClient.ts`
  - 支持连接 `ws://localhost:8787`
  - 支持发送 `ClientMessage`
  - 支持解析服务端 JSON
  - 收到非法 JSON 时不崩溃，只走错误回调
- `network/messageRouter.ts`
  - 处理 `pong / room-state / snapshot / events / error / room-closed`
  - 把 `room-state` 更新到 `roomStore`
  - 把 `snapshot` 更新到 `battleStore`
  - 把 `command-rejected` 和服务端 `error` 转成 toast
- `network/clientMessages.ts`
  - 统一组装创建房间、加入房间、开局、离房、重连和对局命令消息

### 3. store 层

- `SessionStore`
  - 保存开发态 `userId / nickname / avatarUrl / playerId / connectionState`
- `RoomStore`
  - 保存房间号、房主、玩法模式、玩家列表、当前房间阶段
  - 能从 `PlayerRoomSnapshot` 推断当前客户端自己的 `playerId`
- `BattleStore`
  - 只保存 `PlayerGameSnapshot`
  - 不允许接收完整 `GameState`
  - 保存最近事件日志和快照版本号

### 4. 场景骨架

- `LoginScene`
  - 支持改昵称、连接服务器、进入大厅
- `LobbyScene`
  - 支持模式选择、创建房间、输入房号加入
- `RoomScene`
  - 支持展示房间玩家、开始游戏、离开房间
- `BattleScene`
  - 支持基础牌桌视图模型
  - 支持手牌点击出牌
  - 黑牌先走 `ColorPickerDialog`
  - 支持摸牌、UNO、质疑、结算加牌、结算罚抽
  - 支持对手座位布局和事件日志

### 5. 组件与工具

- `CardView / HandArea / PlayerSeat / OpponentSeat`
- `DrawPileButton / DiscardPileView / UnoButton / ChallengeButton / ColorPickerDialog`
- `Toast / LoadingMask / ConfirmDialog`
- `seatLayout.ts`
  - 支持 3 到 8 人相对座位布局
- `cardDisplay.ts`
  - 统一格式化中文卡牌文案

## 测试

本阶段新增了纯 TypeScript 层测试：

- `network/wsClient.test.ts`
- `network/messageRouter.test.ts`
- `network/clientMessages.test.ts`
- `store/stores.test.ts`
- `utils/seatLayout.test.ts`
- `utils/cardDisplay.test.ts`
- `typecheck/battleStore.typecheck.ts`

覆盖点：

- `wsClient` 发送消息
- `messageRouter` 处理 `room-state / snapshot / error`
- `sessionStore / roomStore / battleStore`
- 消息组装结构
- 座位布局
- 卡牌文案
- `BattleStore` 不能接收完整 `GameState`

## 本地验证结果

已通过：

- `corepack pnpm --filter @thunder-uno/client-wechat typecheck`
- `corepack pnpm --filter @thunder-uno/client-wechat test`

当前 `client-wechat` 共有：

- `6` 个测试文件
- `18` 个测试全部通过

## 本阶段仍未实现

- 真实 Cocos 节点树和 prefab
- 微信真实登录
- 复杂动画与音效
- 断线重连 UI 细节
- 正式卡牌美术资源接入
- 真机微信小游戏联调

## 下一阶段建议

进入 Phase 4B：

- 在 Cocos 场景里挂真实点击事件
- 连接本地 `ws://localhost:8787`
- 实测创建房间、加入房间、开始游戏、点击手牌、摸牌、UNO、质疑、结算命令
- 用真实 `snapshot` 驱动界面刷新

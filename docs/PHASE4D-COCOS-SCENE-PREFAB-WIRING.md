# Phase 4D：Cocos 场景与 Prefab 落地

## 阶段目标

本阶段目标是在已经完成的客户端逻辑、Controller、Binding 和本地联调能力之上，把这些能力真正落到 Cocos Creator 的场景与 prefab 结构里，形成一套可以在 Creator 中手动搭建、挂载和点按验证的最小可玩 UI 蓝图。

需要特别说明：

- 当前仓库提交的是“蓝图型 `.scene / .prefab` 规范文件”
- 不是 Creator 编辑器自动导出的二进制序列化资源
- 目的不是伪造 Creator 工程文件，而是把节点树、组件挂载和属性绑定规则先固定下来

本阶段仍然不实现：

- 微信真实登录
- 正式美术
- 复杂动画
- 商城、排行榜、支付
- 数据库
- 正式线上 `wss://` 部署

---

## 本阶段完成内容

### 1. 场景蓝图文件补齐

已在 `apps/client-wechat/assets/scenes/` 下补齐 4 个场景蓝图：

- `LoginScene.scene`
- `LobbyScene.scene`
- `RoomScene.scene`
- `BattleScene.scene`

这些文件用于固定：

- 场景根节点结构
- 子节点命名
- 控制器挂载位置
- 关键 UI 节点的引用关系

### 2. 基础 prefab 蓝图文件补齐

已在 `apps/client-wechat/assets/prefabs/` 下补齐 4 个基础 prefab 蓝图：

- `CardView.prefab`
- `PlayerSeat.prefab`
- `Toast.prefab`
- `ColorPickerDialog.prefab`

第一版保持最小可用，不接正式美术资源。

### 3. LoginScene 节点结构固定

`LoginScene` 的最小节点树已经固定，包括：

- `TitleLabel`
- `NicknameInput`
- `WsUrlInput`
- `ConnectionStatusLabel`
- `ConnectButton`
- `EnterLobbyButton`
- `ReconnectButton`
- `ToastRoot`

用于支持：

- 输入昵称
- 输入或修改 `WS_URL`
- 连接服务端
- 进入大厅
- 在连接失败或断线时手动重连

### 4. LobbyScene 节点结构固定

`LobbyScene` 的最小节点树已经固定，包括：

- `UserInfoLabel`
- `ConnectionStatusLabel`
- `ModeToggleGroup`
- `NoChallengeToggle`
- `WithChallengeToggle`
- `CreateRoomButton`
- `RoomIdInput`
- `JoinRoomButton`
- `ToastRoot`

用于支持：

- 选择玩法模式
- 创建房间
- 输入房间号加入
- 显示连接状态和提示

### 5. RoomScene 节点结构固定

`RoomScene` 的最小节点树已经固定，包括：

- `RoomCodeLabel`
- `ModeLabel`
- `StatusLabel`
- `ConnectionStatusLabel`
- `PlayerListScrollView`
- `PlayerItemTemplate`
- `StartGameButton`
- `LeaveRoomButton`
- `ReconnectButton`
- `ToastRoot`

用于支持：

- 显示房间号
- 显示模式
- 显示玩家列表与房主状态
- 开始游戏
- 离开房间
- 断线后的手动重连

### 6. BattleScene 节点结构固定

`BattleScene` 的最小节点树已经固定，包括：

- `RoomIdLabel`
- `CurrentColorLabel`
- `CurrentPlayerLabel`
- `DirectionLabel`
- `TopCardRoot`
- `DrawPileButton`
- `DrawPileCountLabel`
- `DrawStackLabel`
- `DrawUntilColorLabel`
- `OpponentSeatsRoot`
- `HandContent`
- `EventLogLabel`
- `UnoButton`
- `ChallengeButton`
- `ResolveDrawStackButton`
- `ResolveDrawUntilColorButton`
- `ReconnectButton`
- `ColorPickerDialog`
- `ToastRoot`

用于支持：

- 显示当前房间和对局信息
- 渲染自己手牌和其他玩家座位
- 点击手牌出牌
- 黑牌弹出选色
- 点击摸牌、UNO、质疑、结算按钮
- 断线后的手动重连

### 7. Controller 挂载与 property 绑定规则补齐

当前已经明确每个 Controller 的挂载位置，以及 `@property` 该拖到哪个节点：

- `LoginSceneController`
- `LobbySceneController`
- `RoomSceneController`
- `BattleSceneController`

这些映射关系已经全部写入本文档，便于你在 Creator 中手动拖拽完成挂载。

### 8. 4D 相关 TypeScript 测试补齐

本阶段补充了和 Cocos 绑定逻辑相关的测试：

- `src/cocos/bindings/bindings.test.ts`
- `src/components/ColorPickerDialog.test.ts`

覆盖点包括：

- `CardViewBinding` 能显示普通数字牌
- `CardViewBinding` 能显示黑牌功能牌
- `PlayerSeatBinding` 能显示其他玩家手牌数量
- `ColorPickerDialog` 选色后会正确回调并关闭

---

## 场景与 prefab 文件

### 场景蓝图

- `apps/client-wechat/assets/scenes/LoginScene.scene`
- `apps/client-wechat/assets/scenes/LobbyScene.scene`
- `apps/client-wechat/assets/scenes/RoomScene.scene`
- `apps/client-wechat/assets/scenes/BattleScene.scene`

### prefab 蓝图

- `apps/client-wechat/assets/prefabs/CardView.prefab`
- `apps/client-wechat/assets/prefabs/PlayerSeat.prefab`
- `apps/client-wechat/assets/prefabs/Toast.prefab`
- `apps/client-wechat/assets/prefabs/ColorPickerDialog.prefab`

---

## 关键节点结构说明

### 1. LoginScene

建议节点树：

```txt
Canvas
└─ SafeArea
   ├─ TitleLabel
   ├─ NicknameInput
   ├─ WsUrlInput
   ├─ ConnectionStatusLabel
   ├─ ButtonGroup
   │  ├─ ConnectButton
   │  ├─ EnterLobbyButton
   │  └─ ReconnectButton
   └─ ToastRoot
```

Controller 挂载：

- `LoginSceneController` 挂到 `Canvas` 或 `SafeArea`

property 绑定：

- `titleLabel` -> `TitleLabel`
- `nicknameInput` -> `NicknameInput`
- `wsUrlInput` -> `WsUrlInput`
- `connectionStateLabel` -> `ConnectionStatusLabel`
- `connectButton` -> `ConnectButton`
- `enterLobbyButton` -> `EnterLobbyButton`
- `reconnectButton` -> `ReconnectButton`
- `toast` -> `ToastRoot`

### 2. LobbyScene

建议节点树：

```txt
Canvas
└─ SafeArea
   ├─ UserInfoLabel
   ├─ ConnectionStatusLabel
   ├─ ModeToggleGroup
   │  ├─ NoChallengeToggle
   │  └─ WithChallengeToggle
   ├─ CreateRoomButton
   ├─ RoomIdInput
   ├─ JoinRoomButton
   └─ ToastRoot
```

Controller 挂载：

- `LobbySceneController` 挂到 `Canvas` 或 `SafeArea`

property 绑定：

- `connectionStateLabel` -> `ConnectionStatusLabel`
- `userLabel` -> `UserInfoLabel`
- `roomIdInput` -> `RoomIdInput`
- `modeToggle` -> `ModeToggleGroup`
- `createRoomButton` -> `CreateRoomButton`
- `joinRoomButton` -> `JoinRoomButton`
- `toast` -> `ToastRoot`

### 3. RoomScene

建议节点树：

```txt
Canvas
└─ SafeArea
   ├─ RoomCodeLabel
   ├─ ModeLabel
   ├─ StatusLabel
   ├─ ConnectionStatusLabel
   ├─ PlayerListScrollView
   │  └─ Viewport
   │     └─ Content
   │        └─ PlayerItemTemplate
   ├─ ButtonGroup
   │  ├─ StartGameButton
   │  ├─ LeaveRoomButton
   │  └─ ReconnectButton
   └─ ToastRoot
```

Controller 挂载：

- `RoomSceneController` 挂到 `Canvas` 或 `SafeArea`

property 绑定：

- `roomCodeLabel` -> `RoomCodeLabel`
- `modeLabel` -> `ModeLabel`
- `statusLabel` -> `StatusLabel`
- `connectionStateLabel` -> `ConnectionStatusLabel`
- `playersList` -> `PlayerListScrollView/Viewport/Content`
- `startGameButton` -> `StartGameButton`
- `leaveRoomButton` -> `LeaveRoomButton`
- `reconnectButton` -> `ReconnectButton`
- `toast` -> `ToastRoot`

### 4. BattleScene

建议节点树：

```txt
Canvas
└─ SafeArea
   ├─ RoomIdLabel
   ├─ CurrentColorLabel
   ├─ CurrentPlayerLabel
   ├─ DirectionLabel
   ├─ TopCardRoot（可直接手工搭建；若想统一复用，也可以改成 `CardViewRoot.prefab` 实例）
   │  ├─ Label
   │  └─ PlayableHint
   ├─ DrawPileButton
   ├─ DrawPileCountLabel
   ├─ DrawStackLabel
   ├─ DrawUntilColorLabel
   ├─ OpponentSeatsRoot
   │  ├─ SelfSeat（`PlayerSeatRoot.prefab` 实例）
   │  ├─ OpponentSeat1（`PlayerSeatRoot.prefab` 实例）
   │  ├─ OpponentSeat2（`PlayerSeatRoot.prefab` 实例）
   │  ├─ OpponentSeat3（`PlayerSeatRoot.prefab` 实例）
   │  ├─ OpponentSeat4（`PlayerSeatRoot.prefab` 实例）
   │  ├─ OpponentSeat5（`PlayerSeatRoot.prefab` 实例）
   │  ├─ OpponentSeat6（`PlayerSeatRoot.prefab` 实例）
   │  └─ OpponentSeat7（`PlayerSeatRoot.prefab` 实例）
   ├─ HandScrollView
   │  └─ Viewport
   │     └─ HandContent（空 Node 容器；只拖给 `handContent` 字段）
   ├─ EventLogLabel
   ├─ ActionButtons
   │  ├─ UnoButton
   │  ├─ ChallengeButton
   │  ├─ ResolveDrawStackButton
   │  ├─ ResolveDrawUntilColorButton
   │  └─ ReconnectButton
   ├─ ColorPickerDialogRoot（`ColorPickerDialogRoot.prefab` 实例）
   │  ├─ DialogTitleLabel
   │  └─ ButtonsRow
   │     ├─ ColorRedButton
   │     ├─ ColorYellowButton
   │     ├─ ColorBlueButton
   │     └─ ColorGreenButton
   └─ ToastRoot（`ToastRoot.prefab` 实例）
```

BattleScene 里需要用 prefab 复用的地方，主要是这几类：

- `SelfSeat` / `OpponentSeat1..7`：统一用 `PlayerSeatRoot.prefab`，这样座位展示、头像占位、手牌数、UNO 状态、回合状态、淘汰状态都能复用同一套结构。
- `HandContent`：不是 prefab 本身，而是手牌列表容器；在 Creator 里只需要创建一个空 Node，并把它拖给 `BattleSceneEntry.handContent`。后续手牌渲染逻辑会把多张 `CardViewRoot.prefab` 实例生成到它下面。
- `ColorPickerDialogRoot`：统一用 `ColorPickerDialogRoot.prefab`，方便弹出黑牌选色框。
- `ToastRoot`：统一用 `ToastRoot.prefab`，方便做提示、断线、返回服务端消息。
- `TopCardRoot`：当前可直接手工搭建；如果你想把桌面顶牌也统一成一套卡牌视图，可以改成 `CardViewRoot.prefab` 的实例。

Controller 挂载：

- `BattleSceneController` 挂到 `Canvas` 或 `SafeArea`

property 绑定：

- `roomIdLabel` -> `RoomIdLabel`（Label）
- `currentColorLabel` -> `CurrentColorLabel`（Label）
- `currentPlayerLabel` -> `CurrentPlayerLabel`（Label）
- `directionLabel` -> `DirectionLabel`（Label）
- `topCardRoot` -> `TopCardRoot`（Node）
- `topCardView` -> `TopCardRoot`（同一节点上的 `CardViewComponent`）
- `drawPileButton` -> `DrawPileButton`（Button）
- `drawPileCountLabel` -> `DrawPileCountLabel`（Label）
- `drawStackLabel` -> `DrawStackLabel`（Label）
- `drawUntilColorLabel` -> `DrawUntilColorLabel`（Label）
- `opponentSeatsRoot` -> `OpponentSeatsRoot`（Node）
- `selfSeat` -> `SelfSeat`（`PlayerSeatComponent`）
- `opponentSeat1` -> `OpponentSeat1`（`PlayerSeatComponent`）
- `opponentSeat2` -> `OpponentSeat2`（`PlayerSeatComponent`）
- `opponentSeat3` -> `OpponentSeat3`（`PlayerSeatComponent`）
- `opponentSeat4` -> `OpponentSeat4`（`PlayerSeatComponent`）
- `opponentSeat5` -> `OpponentSeat5`（`PlayerSeatComponent`）
- `opponentSeat6` -> `OpponentSeat6`（`PlayerSeatComponent`）
- `opponentSeat7` -> `OpponentSeat7`（`PlayerSeatComponent`）
- `handScrollView` -> `HandScrollView`（ScrollView）
- `handContent` -> `HandScrollView/Viewport/HandContent`（Node）
- `eventLogLabel` -> `EventLogLabel`（Label）
- `unoButton` -> `UnoButton`（Button）
- `challengeButton` -> `ChallengeButton`（Button）
- `resolveDrawStackButton` -> `ResolveDrawStackButton`（Button）
- `resolveDrawUntilColorButton` -> `ResolveDrawUntilColorButton`（Button）
- `reconnectButton` -> `ReconnectButton`（Button）
- `colorPickerDialog` -> `ColorPickerDialogRoot`（`ColorPickerDialogComponent`）
- `toastRoot` -> `ToastRoot`（Node）
- `toastComponent` -> `ToastRoot`（`ToastComponent`）

---

## prefab 结构说明

### `CardView.prefab`

```txt
CardViewRoot
├─ Label
└─ PlayableHint
```

用途：

- 手牌区单张牌
- 顶牌展示

### `PlayerSeat.prefab`

```txt
PlayerSeatRoot
├─ AvatarPlaceholder
├─ DisplayNameLabel
├─ HandCountLabel
├─ UnoStateLabel
├─ TurnStateLabel
└─ EliminatedStateLabel
```

用途：

- 自己座位
- 对手座位

### `Toast.prefab`

```txt
ToastRoot
└─ ToastLabel
```

用途：

- 显示错误提示、断线提示、服务端返回提示

### `ColorPickerDialog.prefab`

```txt
ColorPickerDialogRoot
├─ DialogTitleLabel
└─ ButtonsRow
   ├─ ColorRedButton
   ├─ ColorYellowButton
   ├─ ColorBlueButton
   └─ ColorGreenButton
```

用途：

- 黑牌宣色

---

## Creator 手动搭建步骤

1. 打开 `apps/client-wechat` 对应的 Cocos Creator 工程。
2. 在 `assets/scenes` 中创建真实的 `LoginScene / LobbyScene / RoomScene / BattleScene`。
3. 参照本文档和 `assets/scenes/*.scene` 蓝图文件补齐节点树。
4. 在 `assets/prefabs` 中创建真实的 `CardView / PlayerSeat / Toast / ColorPickerDialog`。
5. 为节点添加基础组件：`Label`、`Button`、`EditBox`、`ScrollView`、`Sprite`。
6. 把对应的 `Controller` 脚本挂到场景根节点或 `SafeArea`。
7. 按本文档的 property 映射，把节点逐个拖到脚本字段上。
8. 重点检查 `ToastRoot`、`HandContent`、`OpponentSeat1..7`、`ColorPickerDialogRoot` 是否都已绑定。

---

## 本地联调方式

先启动本地服务端：

```bash
corepack pnpm --filter @thunder-uno/game-server dev
```

开发阶段默认地址：

```txt
ws://localhost:8787
```

手机真机局域网调试地址：

```txt
ws://你的电脑局域网IP:8787
```

例如：

```txt
ws://192.168.1.23:8787
```

验证按钮是否真的发出 WebSocket 消息，建议顺序如下：

1. 点击 `Connect`
2. 点击 `CreateRoom`
3. 输入房间号并点击 `JoinRoom`
4. 点击 `StartGame`
5. 在对局里点击普通手牌
6. 点击黑牌并确认先弹出选色框
7. 选择颜色后确认再发送 `play-card + declaredColor`
8. 点击 `Draw`
9. 点击 `UNO`
10. 点击 `Challenge`
11. 点击 `ResolveDrawStack`
12. 点击 `ResolveDrawUntilColor`
13. 断网后确认出现 `Reconnect`
14. 点击 `Reconnect` 并确认发送 `reconnect`

---

## 本地验证结果

已通过：

- `corepack pnpm --filter @thunder-uno/client-wechat typecheck`
- `corepack pnpm --filter @thunder-uno/client-wechat test`
- `corepack pnpm typecheck`
- `corepack pnpm test`

客户端当前测试结果：

- `12` 个测试文件通过
- `49` 个测试通过

本阶段新增覆盖点：

- `CardViewBinding` 普通牌显示
- `CardViewBinding` 黑牌显示
- `PlayerSeatBinding` 其他玩家手牌数显示
- `ColorPickerDialog` 选色回调

---

## 当前仍未实现

- Creator 编辑器真正导出的序列化 `.scene / .prefab`
- 在 Creator 中实际拖拽完成后的人工点击验证
- 真机微信小游戏预览与设备调试
- 正式美术、动画、音效
- 微信真实登录
- 正式线上 `wss://` 部署

---

## 下一阶段建议

Phase 4D 结束后，建议进入 Phase 5A：

- 准备微信开发者工具工程
- 处理真机预览与局域网网络限制
- 验证 Creator 场景在微信小游戏环境中的运行方式
- 为后续真实 `wss://` 域名与微信登录接入做准备

# Cocos UI Placement Guide

这份文档是给当前 `apps/NewProject` Cocos Creator 工程用的 UI 摆放说明。

目标不是讲玩法，而是解决这几个最实际的问题：

- 每个节点在画面里代表什么 UI
- 这个 UI 建议放在屏幕什么位置
- 这个节点一般要挂什么组件
- 第一版应该先做成什么样，才算“能看、能点、能调试”

当前阶段建议：

- 第一版先追求可用，不追求正式美术
- 优先保证文字不重叠、按钮点得到、输入框看得清
- 所有页面都先按纵向手机屏来排
- 所有弹窗和提示先做最小版，不要先做复杂动画

---

## 1. 通用布局原则

### 1.1 推荐屏幕思路

你现在可以把整个小游戏先当成“竖屏操作页”来摆。

推荐分成 4 个视觉区域：

- 顶部信息区：标题、房间号、连接状态、模式信息
- 中部内容区：输入框、列表、对手座位、顶牌区
- 底部操作区：按钮、手牌、主要交互
- 浮层区：Toast、选色弹窗

### 1.2 第一版控件大小建议

这不是强制值，但很适合现在这个阶段：

- 标题字号：32 到 40
- 普通信息字号：20 到 24
- 次要说明字号：16 到 18
- 按钮高度：44 到 56
- 输入框高度：44 到 52
- 列表项高度：44 到 60
- Toast 高度：40 到 56

### 1.3 第一版颜色建议

先用最简单的占位色就够：

- 页面底色：深蓝灰或深绿色
- 主要按钮：亮蓝或亮绿
- 次要按钮：灰色
- 危险/重连按钮：橙色
- 提示文字：白色或浅灰
- 弹窗底板：深色半透明

### 1.4 通用组件理解

- `Label`：纯文字
- `Button`：可点击按钮
- `EditBox`：输入框
- `Toggle`：可切换选项
- `ScrollView`：滚动列表/滚动区域
- `Node`：普通容器或占位节点

---

## 2. LoginScene

适合做成“中间一张登录卡片”的布局。

推荐视觉顺序：

1. 顶部标题
2. 昵称输入框
3. 服务器地址输入框
4. 连接状态文字
5. 按钮区
6. Toast 浮层

### 节点说明

#### `TitleLabel`

- UI 是什么：页面标题，例如“雷霆 UNOplus”
- 组件建议：`Label`
- 放哪里：屏幕上方偏中间
- 推荐样子：字号最大，居中显示
- 第一版建议：放在 `SafeArea` 顶部下方 60 到 100 像素

#### `NicknameInput`

- UI 是什么：昵称输入框
- 组件建议：`EditBox`
- 放哪里：标题下面
- 推荐样子：横向长条输入框，宽度占屏幕 70% 到 80%
- 第一版建议：和下一个输入框纵向排列，间距 16 到 24

#### `WsUrlInput`

- UI 是什么：服务器地址输入框
- 组件建议：`EditBox`
- 放哪里：昵称输入框下面
- 推荐样子：比昵称框更宽一点也可以
- 第一版建议：默认占位文本写 `ws://localhost:8787`

#### `ConnectionStatusLabel`

- UI 是什么：当前连接状态提示
- 组件建议：`Label`
- 放哪里：输入框下面，按钮上面
- 推荐样子：小一号文字，居中
- 第一版建议：颜色和普通说明区分开，比如浅绿/浅黄

#### `ButtonGroup`

- UI 是什么：登录页按钮容器
- 组件建议：普通 `Node`
- 放哪里：页面中下部
- 推荐样子：竖着排 2 到 3 个按钮最稳

#### `ConnectButton`

- UI 是什么：连接服务端按钮
- 组件建议：`Button`
- 放哪里：按钮组第一位
- 推荐样子：主按钮，颜色最亮

#### `EnterLobbyButton`

- UI 是什么：进入大厅按钮
- 组件建议：`Button`
- 放哪里：`ConnectButton` 下面
- 推荐样子：次主按钮
- 备注：如果你觉得页面太挤，也可以和 `ConnectButton` 同宽纵向排列

#### `ReconnectButton`

- UI 是什么：手动重连按钮
- 组件建议：`Button`
- 放哪里：按钮组最后
- 推荐样子：次要按钮或橙色按钮

#### `ToastRoot`

- UI 是什么：提示浮层
- 组件建议：普通 `Node`，内部挂 `ToastComponent`
- 放哪里：屏幕底部中间，或者屏幕正中偏下
- 推荐样子：一个小的提示条，不要太大

### LoginScene 推荐排版

最稳的第一版可以这样摆：

- `TitleLabel`：顶部居中
- `NicknameInput`：页面中间偏上
- `WsUrlInput`：紧接在昵称框下方
- `ConnectionStatusLabel`：输入区下方
- `ConnectButton / EnterLobbyButton / ReconnectButton`：纵向排列在中间偏下
- `ToastRoot`：底部居中

---

## 3. LobbyScene

这个页面适合做成“上方显示身份，中间选模式，下方建房/进房”的结构。

### 节点说明

#### `UserInfoLabel`

- UI 是什么：当前玩家信息，例如昵称、玩家 ID 简写
- 组件建议：`Label`
- 放哪里：顶部左侧或顶部居中
- 推荐样子：小标题型文字

#### `ConnectionStatusLabel`

- UI 是什么：连接状态文字
- 组件建议：`Label`
- 放哪里：顶部右侧，或者 `UserInfoLabel` 下方
- 推荐样子：比主信息小一号

#### `ModeToggleGroup`

- UI 是什么：玩法模式容器
- 组件建议：普通 `Node` 或 `ToggleContainer`
- 放哪里：页面中上部
- 推荐样子：两项模式上下排或左右排都可以
- 第一版建议：上下排更省事

#### `NoChallengeToggle`

- UI 是什么：无质疑模式选项
- 组件建议：`Toggle`
- 放哪里：模式区第一项
- 推荐样子：左边勾选，右边文字

#### `WithChallengeToggle`

- UI 是什么：有质疑模式选项
- 组件建议：`Toggle`
- 放哪里：模式区第二项
- 推荐样子：和上一项保持相同宽高

#### `CreateRoomButton`

- UI 是什么：创建房间按钮
- 组件建议：`Button`
- 放哪里：模式区下面
- 推荐样子：主按钮
- 第一版建议：可以独占一整行

#### `RoomIdInput`

- UI 是什么：输入房间号的输入框
- 组件建议：`EditBox`
- 放哪里：创建房间按钮下面
- 推荐样子：横向长条输入框

#### `JoinRoomButton`

- UI 是什么：加入房间按钮
- 组件建议：`Button`
- 放哪里：`RoomIdInput` 下面
- 推荐样子：次主按钮

#### `ToastRoot`

- UI 是什么：提示浮层
- 组件建议：普通 `Node`
- 放哪里：底部居中

### LobbyScene 推荐排版

- `UserInfoLabel`：左上
- `ConnectionStatusLabel`：右上
- `ModeToggleGroup`：中上
- `CreateRoomButton`：中间
- `RoomIdInput`：中间偏下
- `JoinRoomButton`：输入框下方
- `ToastRoot`：底部

如果你不想做复杂布局，整个页面直接做成一列也完全可以：

- 个人信息
- 连接状态
- 模式选择
- 创建房间
- 房间号输入
- 加入房间

---

## 4. RoomScene

这个页面适合做成“上面是房间信息，中间是玩家列表，下面是操作按钮”的结构。

### 节点说明

#### `RoomCodeLabel`

- UI 是什么：房间号显示
- 组件建议：`Label`
- 放哪里：顶部最醒目的位置
- 推荐样子：较大的房间号文字

#### `ModeLabel`

- UI 是什么：当前房间玩法模式
- 组件建议：`Label`
- 放哪里：房间号下面
- 推荐样子：次要说明文字

#### `StatusLabel`

- UI 是什么：房间状态，例如“等待开始”“游戏中”
- 组件建议：`Label`
- 放哪里：模式下面
- 推荐样子：简短状态字

#### `ConnectionStatusLabel`

- UI 是什么：网络连接状态
- 组件建议：`Label`
- 放哪里：顶部右侧，或者状态区最下面
- 推荐样子：小号文字

#### `PlayerListScrollView`

- UI 是什么：玩家列表滚动区
- 组件建议：`ScrollView`
- 放哪里：页面正中间，占最大面积
- 推荐样子：一个带底板的长方形区域
- 第一版建议：高度占页面约 35% 到 45%

#### `Viewport`

- UI 是什么：滚动区的可视窗口
- 组件建议：普通 `Node`，通常配 `Mask`
- 放哪里：`PlayerListScrollView` 内部
- 推荐样子：和 `ScrollView` 一样大小

#### `Content`

- UI 是什么：玩家条目的内容容器
- 组件建议：普通 `Node`
- 放哪里：`Viewport` 里面
- 推荐样子：竖向排列容器
- 第一版建议：加 `Layout` 方便自动竖排

#### `PlayerItemTemplate`

- UI 是什么：单个玩家列表项模板
- 组件建议：普通 `Node`
- 放哪里：`Content` 里面
- 推荐样子：一行一个玩家，显示昵称、房主、准备状态之类
- 第一版建议：先做成简单长条，不用复杂头像

#### `ButtonGroup`

- UI 是什么：房间操作按钮容器
- 组件建议：普通 `Node`
- 放哪里：页面底部
- 推荐样子：横向 2 到 3 个按钮

#### `StartGameButton`

- UI 是什么：开始游戏按钮
- 组件建议：`Button`
- 放哪里：底部按钮区左边或中间
- 推荐样子：主按钮

#### `LeaveRoomButton`

- UI 是什么：离开房间按钮
- 组件建议：`Button`
- 放哪里：`StartGameButton` 旁边
- 推荐样子：次要按钮

#### `ReconnectButton`

- UI 是什么：重连按钮
- 组件建议：`Button`
- 放哪里：按钮组最后
- 推荐样子：橙色或灰色按钮

#### `ToastRoot`

- UI 是什么：提示浮层
- 组件建议：普通 `Node`
- 放哪里：底部居中

### RoomScene 推荐排版

- 顶部：`RoomCodeLabel`、`ModeLabel`、`StatusLabel`、`ConnectionStatusLabel`
- 中部大块：`PlayerListScrollView`
- 底部：`StartGameButton`、`LeaveRoomButton`、`ReconnectButton`
- 浮层：`ToastRoot`

---

## 5. BattleScene

这是最复杂的一页。第一版不要追求像正式卡牌游戏 UI，那样很容易越摆越乱。

建议先按“信息在上、对手在中、自己手牌在下、操作按钮靠下”的方式做。

### 顶部信息区

#### `RoomIdLabel`

- UI 是什么：当前房间号
- 组件建议：`Label`
- 放哪里：左上角
- 推荐样子：小号信息文字

#### `CurrentColorLabel`

- UI 是什么：当前生效颜色
- 组件建议：`Label`
- 放哪里：顶部中间
- 推荐样子：醒目一些，可以配颜色文字

#### `CurrentPlayerLabel`

- UI 是什么：当前轮到谁
- 组件建议：`Label`
- 放哪里：`CurrentColorLabel` 下面或旁边
- 推荐样子：中号文字

#### `DirectionLabel`

- UI 是什么：出牌方向，例如顺时针/逆时针
- 组件建议：`Label`
- 放哪里：右上角
- 推荐样子：简短状态字

### 中上部核心区

#### `TopCardRoot`

- UI 是什么：桌面当前顶牌容器
- 组件建议：普通 `Node`
- 放哪里：屏幕中上部正中
- 推荐样子：用于挂一张 `CardView`
- 第一版建议：让它比手牌单张稍大一点

#### `DrawPileButton`

- UI 是什么：摸牌堆按钮
- 组件建议：`Button`
- 放哪里：顶牌左边或右边
- 推荐样子：像一叠牌，或者简单矩形按钮都行

#### `DrawPileCountLabel`

- UI 是什么：剩余牌数
- 组件建议：`Label`
- 放哪里：紧贴 `DrawPileButton`
- 推荐样子：小号文字

#### `DrawStackLabel`

- UI 是什么：当前加牌链状态
- 组件建议：`Label`
- 放哪里：顶牌区下面
- 推荐样子：提示文字

#### `DrawUntilColorLabel`

- UI 是什么：罚抽到指定颜色的状态提示
- 组件建议：`Label`
- 放哪里：`DrawStackLabel` 附近
- 推荐样子：提示文字

### 对手座位区

#### `OpponentSeatsRoot`

- UI 是什么：座位容器
- 组件建议：普通 `Node`
- 放哪里：中部大区域
- 推荐样子：用来摆自己和其他玩家的 `PlayerSeat`

#### `SelfSeat`

- UI 是什么：自己的座位信息块
- 组件建议：`PlayerSeat` prefab 实例
- 放哪里：底部偏左，或者底部中间上方
- 推荐样子：比其他对手座位稍大一点

#### `OpponentSeat1` 到 `OpponentSeat7`

- UI 是什么：其他玩家座位信息块
- 组件建议：`PlayerSeat` prefab 实例
- 放哪里：顶部一排 + 左右两侧
- 推荐样子：尽量围成半圈或一圈

第一版最稳的摆法：

- 2 到 3 个对手：放顶部一排
- 4 到 5 个对手：顶部 3 个，左右各 1 个
- 6 到 7 个对手：顶部 + 左右两列

### 手牌区

#### `HandScrollView`

- UI 是什么：自己手牌的滚动区域
- 组件建议：`ScrollView`
- 放哪里：页面底部最大的一块区域
- 推荐样子：横向滚动区
- 第一版建议：高度占页面约 20% 到 25%

#### `Viewport`

- UI 是什么：手牌区域的可视窗口
- 组件建议：普通 `Node`，通常配 `Mask`
- 放哪里：`HandScrollView` 内

#### `HandContent`

- UI 是什么：手牌牌节点容器
- 组件建议：普通 `Node`
- 放哪里：`Viewport` 内
- 推荐样子：横向排列
- 第一版建议：加 `Layout`，让牌从左到右摆

### 日志和操作区

#### `EventLogLabel`

- UI 是什么：最近事件提示，例如谁出了一张牌
- 组件建议：`Label`
- 放哪里：手牌区上方，或者左下角
- 推荐样子：多行小字
- 第一版建议：给固定高度，避免把别的控件顶开

#### `ActionButtons`

- UI 是什么：战斗操作按钮容器
- 组件建议：普通 `Node`
- 放哪里：手牌区上方或右下角
- 推荐样子：一排或两排小按钮

#### `UnoButton`

- UI 是什么：喊 UNO 按钮
- 组件建议：`Button`
- 放哪里：操作区里
- 推荐样子：亮色按钮

#### `ChallengeButton`

- UI 是什么：质疑按钮
- 组件建议：`Button`
- 放哪里：操作区里
- 推荐样子：次主按钮

#### `ResolveDrawStackButton`

- UI 是什么：结算加牌按钮
- 组件建议：`Button`
- 放哪里：操作区里
- 推荐样子：警示型按钮

#### `ResolveDrawUntilColorButton`

- UI 是什么：结算罚抽按钮
- 组件建议：`Button`
- 放哪里：操作区里
- 推荐样子：警示型按钮

#### `ReconnectButton`

- UI 是什么：战斗页重连按钮
- 组件建议：`Button`
- 放哪里：操作区最末尾，或者右下角单独放
- 推荐样子：橙色小按钮

### 浮层区

#### `ColorPickerDialog`

- UI 是什么：黑牌宣色弹窗
- 组件建议：普通 `Node`，挂 `ColorPickerDialogComponent`
- 放哪里：屏幕正中间
- 推荐样子：一个居中的小弹窗
- 第一版建议：默认隐藏

#### `ColorRedButton`

- UI 是什么：红色选择按钮
- 组件建议：`Button`
- 放哪里：弹窗按钮行里
- 推荐样子：红色方块/圆角按钮

#### `ColorYellowButton`

- UI 是什么：黄色选择按钮
- 组件建议：`Button`
- 放哪里：弹窗按钮行里

#### `ColorBlueButton`

- UI 是什么：蓝色选择按钮
- 组件建议：`Button`
- 放哪里：弹窗按钮行里

#### `ColorGreenButton`

- UI 是什么：绿色选择按钮
- 组件建议：`Button`
- 放哪里：弹窗按钮行里

#### `ToastRoot`

- UI 是什么：错误/状态提示
- 组件建议：普通 `Node`
- 放哪里：底部居中，或者弹窗之上

### BattleScene 推荐排版

第一版可以直接按下面的屏幕区块来摆：

- 顶部一行：`RoomIdLabel` / `CurrentColorLabel` / `DirectionLabel`
- 顶部第二行：`CurrentPlayerLabel`
- 中上部：`TopCardRoot` + `DrawPileButton` + `DrawPileCountLabel`
- 中部：`OpponentSeatsRoot`
- 下半部偏上：`DrawStackLabel`、`DrawUntilColorLabel`、`EventLogLabel`
- 下半部偏右：`ActionButtons`
- 底部：`HandScrollView`
- 正中浮层：`ColorPickerDialog`
- 底部浮层：`ToastRoot`

---

## 6. Prefab 说明

## 6.1 CardView

节点结构：

```txt
CardViewRoot
├─ Label
└─ PlayableHint
```

### `CardViewRoot`

- UI 是什么：一张牌的整体外框
- 挂什么：`CardViewComponent`
- 放哪里：作为 prefab 根节点
- 推荐样子：竖向长方形，带圆角底板

### `Label`

- UI 是什么：牌面文字
- 挂什么：`Label`
- 放哪里：卡牌中间
- 推荐样子：居中大字

### `PlayableHint`

- UI 是什么：这张牌可打出的提示标记
- 挂什么：普通 `Node` 或 `Sprite`
- 放哪里：右上角或外框高亮
- 推荐样子：小圆点、小角标，或者一圈高亮边框

## 6.2 PlayerSeat

节点结构：

```txt
PlayerSeatRoot
├─ AvatarPlaceholder
├─ DisplayNameLabel
├─ HandCountLabel
├─ UnoStateLabel
├─ TurnStateLabel
└─ EliminatedStateLabel
```

### `PlayerSeatRoot`

- UI 是什么：玩家信息块整体
- 挂什么：`PlayerSeatComponent`
- 推荐样子：一个小面板

### `AvatarPlaceholder`

- UI 是什么：头像占位区域
- 挂什么：普通 `Node`
- 放哪里：左侧或上方
- 第一版建议：先做一个圆形底板占位即可

### `DisplayNameLabel`

- UI 是什么：玩家昵称
- 挂什么：`Label`
- 放哪里：头像旁边或头像下方

### `HandCountLabel`

- UI 是什么：剩余手牌数
- 挂什么：`Label`
- 放哪里：昵称下方

### `UnoStateLabel`

- UI 是什么：UNO 状态
- 挂什么：`Label`
- 放哪里：状态区一行
- 推荐样子：短文字，例如 `UNO!`

### `TurnStateLabel`

- UI 是什么：当前是否轮到该玩家
- 挂什么：`Label`
- 放哪里：状态区一行

### `EliminatedStateLabel`

- UI 是什么：淘汰状态
- 挂什么：`Label`
- 放哪里：最后一行

## 6.3 Toast

节点结构：

```txt
ToastRoot
└─ ToastLabel
```

### `ToastRoot`

- UI 是什么：提示条外框
- 挂什么：`ToastComponent`
- 放哪里：做成 prefab 后放在各场景底部
- 推荐样子：短条形深色半透明底板

### `ToastLabel`

- UI 是什么：提示文字
- 挂什么：`Label`
- 放哪里：Toast 中间

## 6.4 ColorPickerDialog

节点结构：

```txt
ColorPickerDialogRoot
├─ DialogTitleLabel
└─ ButtonsRow
   ├─ ColorRedButton
   ├─ ColorYellowButton
   ├─ ColorBlueButton
   └─ ColorGreenButton
```

### `ColorPickerDialogRoot`

- UI 是什么：选色弹窗主体
- 挂什么：`ColorPickerDialogComponent`
- 放哪里：屏幕中央
- 推荐样子：中等大小面板，默认隐藏

### `DialogTitleLabel`

- UI 是什么：弹窗标题
- 挂什么：`Label`
- 放哪里：弹窗顶部居中

### `ButtonsRow`

- UI 是什么：颜色按钮行容器
- 挂什么：普通 `Node`
- 放哪里：标题下方
- 推荐样子：横向一排 4 个按钮

### `ColorRedButton` / `ColorYellowButton` / `ColorBlueButton` / `ColorGreenButton`

- UI 是什么：四种颜色选择按钮
- 挂什么：`Button`
- 放哪里：`ButtonsRow` 内
- 推荐样子：四个等宽按钮，直接用颜色区分

---

## 7. 你现在最适合的摆放顺序

不要一口气从 BattleScene 开始。

推荐顺序：

1. 先把 `LoginScene` 摆顺
2. 再摆 `LobbyScene`
3. 再做 `RoomScene`
4. 最后做 `BattleScene`
5. 中途穿插做 `Toast`、`PlayerSeat`、`CardView`、`ColorPickerDialog`

最小完成标准：

- 每个节点都在合适区域里
- 同类控件宽度统一
- 按钮都能点到
- 列表和手牌区不会跑出屏幕
- `ToastRoot` 和 `ColorPickerDialogRoot` 默认隐藏

---

## 8. 新手最容易摆错的地方

- 把所有节点都堆在 `Canvas` 左上角，没有调整位置
- `ScrollView` 只有外壳，没有 `Viewport` 和 `Content`
- `Content` 没加布局，列表项全叠在一起
- `ToastRoot` 默认显示，进入页面就挡住画面
- `ColorPickerDialog` 默认显示，导致战斗页一打开就有弹窗
- `OpponentSeat1..7` 位置太靠下，和手牌区打架
- `EventLogLabel` 高度不给固定值，文字一多就把下面区域顶乱
- `ReconnectButton` 太显眼，抢了主操作按钮的视觉优先级

---

## 9. 一句实操建议

如果你现在已经把节点树搭好了，下一步最稳的做法不是继续加节点，而是：

1. 先给每个节点加最基础的 `Label / Button / EditBox / Toggle / ScrollView`
2. 先把它们摆到“大致正确的位置”
3. 先保证不重叠
4. 再回头慢慢调字号、颜色、间距

第一版只要做到“像一个能玩的工具 UI”，就已经很成功了。

---

## 10. 需要的 UI 插画与美术资源清单

这一节不是要求你现在一次做完全部正式美术。

目标是先把“这项目到底需要哪些 UI 图”列清楚。

你可以把它理解成两层：

- 最小必需：现在就该准备，不然页面会很空，或者很难分辨
- 后续增强：第一版能先不用，但以后会明显提升观感

### 10.1 最小必需资源

这些资源最值得先准备。

#### 通用底板类

- 页面通用背景图
  - 用途：所有场景的底图
  - 建议：一张低干扰的桌面感背景，比如深绿牌桌、深蓝渐变、轻纹理背景
- 面板底板图
  - 用途：登录卡片、房间信息框、弹窗底板、列表底板
  - 建议：做 1 张可复用圆角面板
- 主按钮底图
  - 用途：`ConnectButton`、`CreateRoomButton`、`StartGameButton`
  - 建议：一张亮色主按钮
- 次按钮底图
  - 用途：`EnterLobbyButton`、`JoinRoomButton`、`LeaveRoomButton`
  - 建议：一张中性色按钮
- 警示按钮底图
  - 用途：`ReconnectButton`、`ResolveDrawStackButton`、`ResolveDrawUntilColorButton`
  - 建议：一张橙色或红橙色按钮
- 输入框底图
  - 用途：`NicknameInput`、`WsUrlInput`、`RoomIdInput`
  - 建议：一张带边框的浅色输入框背景

#### 卡牌相关

- 卡牌正面底图
  - 用途：`CardView`
  - 建议：第一版至少要有 1 张通用卡牌底板
- 卡牌可出提示高亮图
  - 用途：`PlayableHint`
  - 建议：小角标、描边高亮、或发光框 3 选 1
- 摸牌堆底图
  - 用途：`DrawPileButton`
  - 建议：做成牌背样式最直观
- 顶牌展示底板
  - 用途：`TopCardRoot`
  - 建议：如果不单独画，也可以复用卡牌底板

#### 玩家相关

- 默认头像占位图
  - 用途：`AvatarPlaceholder`
  - 建议：简单圆形头像框或剪影头像
- 玩家座位底板
  - 用途：`PlayerSeatRoot`
  - 建议：一张小面板底图
- 玩家列表项底板
  - 用途：`PlayerItemTemplate`
  - 建议：房间页每个玩家一行的小底板

#### 状态提示类

- Toast 底板图
  - 用途：`ToastRoot`
  - 建议：深色半透明短条
- 弹窗底板图
  - 用途：`ColorPickerDialogRoot`
  - 建议：中间弹窗面板，和通用面板共用也可以
- 连接状态小图标
  - 用途：连接成功、连接中、断开连接
  - 建议：如果现在不想画，也可以先只用文字

#### 颜色选择类

- 红色按钮图
  - 用途：`ColorRedButton`
- 黄色按钮图
  - 用途：`ColorYellowButton`
- 蓝色按钮图
  - 用途：`ColorBlueButton`
- 绿色按钮图
  - 用途：`ColorGreenButton`
  - 建议：如果你暂时不单独做图，也可以直接用纯色按钮代替

### 10.2 按场景拆分的资源需求

#### LoginScene

建议准备：

- 登录页背景图
- 标题字样图或 Logo
- 输入框底图
- 主按钮底图
- 次按钮底图
- Toast 底板图

如果你不准备标题插画，也可以只用 `Label` 写标题。

#### LobbyScene

建议准备：

- 大厅背景图
- 模式选择区底板
- Toggle 勾选框素材
- 建房按钮底图
- 加入房间按钮底图
- 房间号输入框底图
- Toast 底板图

#### RoomScene

建议准备：

- 房间页背景图
- 房间信息面板底板
- 玩家列表滚动区底板
- 玩家列表项底板
- 开始游戏按钮底图
- 离开房间按钮底图
- 重连按钮底图
- Toast 底板图

#### BattleScene

建议准备：

- 对局背景图
- 顶牌区底板
- 摸牌堆牌背图
- 卡牌正面底板
- 玩家座位底板
- 默认头像占位图
- 手牌区底板
- 日志区底板
- UNO 按钮底图
- 质疑按钮底图
- 结算加牌按钮底图
- 结算罚抽按钮底图
- 重连按钮底图
- 选色弹窗底板
- 红黄蓝绿四个颜色按钮图
- Toast 底板图

### 10.3 后续增强资源

这些不是现在必须，但以后会很有用。

#### 标识与图标

- 房主图标
- 当前回合箭头图标
- UNO 警示图标
- 淘汰图标
- 连接状态图标
- 方向图标

#### 卡牌精细资源

- 完整数字牌面图
- 每种技能牌专属图标
- 黑牌专属牌面图
- 卡牌背面图
- 卡牌选中高亮图
- 卡牌点击阴影图

#### 动效配套资源

- 按钮按下态
- 弹窗出现特效底图
- Toast 淡入淡出辅助图
- 回合高亮外框

### 10.4 如果你想最省事，先准备这 12 个

如果你现在只想先把画面做得“能看”，优先准备下面这些：

1. 通用背景图
2. 通用面板底板
3. 主按钮底图
4. 次按钮底图
5. 输入框底图
6. 卡牌底板
7. 牌背图
8. 玩家座位底板
9. 默认头像占位图
10. Toast 底板图
11. 弹窗底板图
12. 红黄蓝绿四色按钮图

### 10.5 现在最适合的做法

你不需要现在就找齐所有正式插画。

推荐顺序：

1. 先用纯色块和 `Label` 把所有 UI 摆对
2. 先补通用背景、按钮底图、输入框底图
3. 再补卡牌底板、牌背、玩家座位底板
4. 最后再补 Logo、图标、状态小插画

这样最不容易卡住开发节奏。

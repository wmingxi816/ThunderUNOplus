# Cocos Creator 搭建与构建超详细新手手册

## 这份文档解决什么问题

这份文档是给完全的新手准备的。

如果你现在已经有了一个真实的 Cocos Creator 工程：

`e:\微信开发者工具\uno-plus\apps\NewProject`

但你还不会：

- 在 Creator 里创建真实场景节点
- 在 Creator 里创建真实 prefab 节点
- 调整层级结构
- 挂脚本
- 拖拽 `@property`
- 保存场景
- 保存 prefab
- 看最终 UI 排版效果
- 构建成微信小游戏
- 再用微信开发者工具打开

那你就按这份文档一步一步做。

---

## 你现在已经有了什么

我已经替你在 `NewProject` 工程里准备好了这些目录：

```txt
apps/NewProject/assets/scenes
apps/NewProject/assets/prefabs
apps/NewProject/assets/scripts
apps/NewProject/assets/scripts/controllers
apps/NewProject/assets/scripts/components
apps/NewProject/assets/scripts/bindings
apps/NewProject/assets/resources
```

我也已经放好了 Creator 可挂载脚本骨架：

### 场景入口脚本

- `assets/scripts/controllers/LoginSceneEntry.ts`
- `assets/scripts/controllers/LobbySceneEntry.ts`
- `assets/scripts/controllers/RoomSceneEntry.ts`
- `assets/scripts/controllers/BattleSceneEntry.ts`

### 基础组件脚本

- `assets/scripts/components/CardViewComponent.ts`
- `assets/scripts/components/PlayerSeatComponent.ts`
- `assets/scripts/components/ToastComponent.ts`
- `assets/scripts/components/ColorPickerDialogComponent.ts`

这些脚本的作用是：

- 能在 Creator 里真正挂到节点上
- 能在 Inspector 里显示可拖拽的 `@property`
- 先作为 UI 骨架和挂载壳使用

---

## 你要先明白一件事

现在你不是在“写代码之后自动生成游戏画面”。

你现在是在做两件事：

1. 用 Creator 编辑器手动搭 UI 结构
2. 用我已经生成好的脚本把这些节点接起来

也就是说：

- 脚本我可以替你生成
- 但节点和拖拽必须你在 Creator 里做

---

## 第 1 步：打开 `NewProject`

1. 打开 `Cocos Creator 3.8.8`
2. 打开项目：

```txt
e:\微信开发者工具\uno-plus\apps\NewProject
```

3. 进入以后，左边一般会有：
   - 资源管理器
   - 层级管理器
   - 属性检查器

如果你是第一次用，记住三个最重要区域：

- 左下或左侧：资源管理器
- 中间左侧：层级管理器
- 右侧：属性检查器

---

## 第 2 步：确认脚本已经被 Creator 识别

在资源管理器里展开：

```txt
assets/scripts/controllers
assets/scripts/components
```

你应该能看到：

- `LoginSceneEntry`
- `LobbySceneEntry`
- `RoomSceneEntry`
- `BattleSceneEntry`
- `CardViewComponent`
- `PlayerSeatComponent`
- `ToastComponent`
- `ColorPickerDialogComponent`

如果看到的是文件但有报错：

1. 点击脚本文件
2. 看 Creator 控制台有没有红字
3. 如果有红字，先停下来处理脚本报错

如果没有红字，说明脚本已经可以挂载。

---

## 第 3 步：创建真实场景

你需要创建 4 个真实场景：

- `LoginScene`
- `LobbyScene`
- `RoomScene`
- `BattleScene`

### 创建方法

1. 在资源管理器中选中：

```txt
assets/scenes
```

2. 右键
3. 选择“创建”
4. 选择“场景 / Scene”
5. 输入名字

依次创建：

```txt
LoginScene
LobbyScene
RoomScene
BattleScene
```

创建完成后，双击 `LoginScene`，先从它开始做。

---

## 第 4 步：如何创建真实场景节点

这里先教你最基础的节点创建方法。

### 创建空节点

1. 在层级管理器选中某个父节点
2. 右键
3. 选择“创建空节点”
4. 改名字

### 创建 Label 文本节点

1. 选中父节点
2. 右键
3. 选择“创建 2D 对象”
4. 选择 `Label`
5. 改名字

### 创建 Button 按钮节点

1. 选中父节点
2. 右键
3. 选择“创建 UI”
4. 选择 `Button`
5. 改名字

### 创建 EditBox 输入框

1. 选中父节点
2. 右键
3. 选择“创建 UI”
4. 选择 `EditBox`
5. 改名字

### 创建 ScrollView

1. 选中父节点
2. 右键
3. 选择“创建 UI”
4. 选择 `ScrollView`

ScrollView 一般会自动带一些默认子节点，你再改名整理即可。

---

## 第 5 步：如何调整层级结构

调整层级结构的本质，就是让“谁是父节点，谁是子节点”符合文档要求。

### 调整方法

#### 方法 1：拖拽节点

在层级管理器里，用鼠标把一个节点拖到另一个节点下面。

例如：

- 把 `TitleLabel` 拖到 `SafeArea` 下面
- 把 `ConnectButton` 拖到 `ButtonGroup` 下面

#### 方法 2：先创建父节点，再在父节点下创建子节点

这是最不容易乱的方法。

例如：

1. 先创建 `SafeArea`
2. 选中 `SafeArea`
3. 再创建 `TitleLabel`

这样 `TitleLabel` 就自然会出现在 `SafeArea` 下面。

### 你要特别注意

层级不对，后面拖 `@property` 会很容易混乱。

所以每搭完一个场景，都要回头对照文档里的结构检查一次。

---

## 第 6 步：先搭 LoginScene

双击打开 `LoginScene`，然后把节点搭成这样：

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

### LoginScene 每个节点分别是什么

下面把这棵树里每个节点的“类型”和“用途”全部写清楚。

| 节点名 | 节点类型 | 在 Creator 里怎么创建 | 用途 |
|---|---|---|---|
| `Canvas` | `Canvas` | Creator 新建场景后通常自动生成 | 整个 UI 场景的根画布，所有登录页 UI 都放在它下面 |
| `SafeArea` | 空节点 `Node` | 选中 `Canvas` -> 右键 -> 创建空节点 | 作为登录页内容容器，后面所有登录页控件都挂在它下面 |
| `TitleLabel` | `Label` | 选中 `SafeArea` -> 右键 -> 创建 `Label` | 显示标题，比如“雷霆UNOplus” |
| `NicknameInput` | `EditBox` | 选中 `SafeArea` -> 右键 -> 创建 `EditBox` | 输入玩家昵称 |
| `WsUrlInput` | `EditBox` | 选中 `SafeArea` -> 右键 -> 创建 `EditBox` | 输入 WebSocket 地址，例如 `ws://localhost:8787` |
| `ConnectionStatusLabel` | `Label` | 选中 `SafeArea` -> 右键 -> 创建 `Label` | 显示当前连接状态，例如“未连接”“连接中”“已连接” |
| `ButtonGroup` | 空节点 `Node` | 选中 `SafeArea` -> 右键 -> 创建空节点 | 用来装 3 个按钮，方便统一排版 |
| `ConnectButton` | `Button` | 选中 `ButtonGroup` -> 右键 -> 创建 `Button` | 点击后连接服务端 |
| `EnterLobbyButton` | `Button` | 选中 `ButtonGroup` -> 右键 -> 创建 `Button` | 连接成功后进入大厅页 |
| `ReconnectButton` | `Button` | 选中 `ButtonGroup` -> 右键 -> 创建 `Button` | 断线或连接失败时手动重连 |
| `ToastRoot` | 空节点 `Node` | 选中 `SafeArea` -> 右键 -> 创建空节点 | Toast 提示的挂载点，后面要挂 `ToastComponent` |

### LoginScene 哪些节点要有组件

这里再单独强调一次，哪些节点必须挂什么组件：

| 节点名 | 必须有的组件 |
|---|---|
| `Canvas` | `Canvas` |
| `SafeArea` | 无强制要求，空节点即可 |
| `TitleLabel` | `Label` |
| `NicknameInput` | `EditBox` |
| `WsUrlInput` | `EditBox` |
| `ConnectionStatusLabel` | `Label` |
| `ButtonGroup` | 无强制要求，空节点即可 |
| `ConnectButton` | `Button` |
| `EnterLobbyButton` | `Button` |
| `ReconnectButton` | `Button` |
| `ToastRoot` | 后续要挂 `ToastComponent` |

### LoginScene 哪些节点只是容器

这些节点本身不是文字、按钮或输入框，它们只是“装别的节点”的容器：

- `SafeArea`
- `ButtonGroup`
- `ToastRoot`

容器节点一般用“空节点”创建。

### LoginScene 哪些节点是可见 UI

这些节点是用户能直接看到和操作的：

- `TitleLabel`
- `NicknameInput`
- `WsUrlInput`
- `ConnectionStatusLabel`
- `ConnectButton`
- `EnterLobbyButton`
- `ReconnectButton`

### LoginScene 哪些节点和脚本字段对应

后面你给 `Canvas` 挂 `LoginSceneEntry` 后，右侧要拖这些：

| `LoginSceneEntry` 字段 | 对应节点 |
|---|---|
| `titleLabel` | `TitleLabel` |
| `nicknameInput` | `NicknameInput` |
| `wsUrlInput` | `WsUrlInput` |
| `connectionStateLabel` | `ConnectionStatusLabel` |
| `connectButton` | `ConnectButton` |
| `enterLobbyButton` | `EnterLobbyButton` |
| `reconnectButton` | `ReconnectButton` |
| `toastRoot` | `ToastRoot` |
| `toastComponent` | `ToastRoot` 上挂的 `ToastComponent` |

### 登录场景逐步创建方法

#### 1. 创建 `SafeArea`

1. 选中 `Canvas`
2. 右键
3. 创建空节点
4. 改名为：

```txt
SafeArea
```

#### 2. 创建 `TitleLabel`

1. 选中 `SafeArea`
2. 右键
3. 创建 `Label`
4. 改名为：

```txt
TitleLabel
```

5. 在右边属性里，把文本内容改成：

```txt
雷霆UNOplus
```

#### 3. 创建 `NicknameInput`

1. 选中 `SafeArea`
2. 右键
3. 创建 `EditBox`
4. 改名为：

```txt
NicknameInput
```

#### 4. 创建 `WsUrlInput`

方法同上，改名：

```txt
WsUrlInput
```

默认文本建议填：

```txt
ws://localhost:8787
```

#### 5. 创建 `ConnectionStatusLabel`

创建一个 `Label`，改名为：

```txt
ConnectionStatusLabel
```

#### 6. 创建 `ButtonGroup`

1. 选中 `SafeArea`
2. 创建空节点
3. 改名：

```txt
ButtonGroup
```

#### 7. 在 `ButtonGroup` 下创建 3 个按钮

- `ConnectButton`
- `EnterLobbyButton`
- `ReconnectButton`

#### 8. 创建 `ToastRoot`

1. 选中 `SafeArea`
2. 创建空节点
3. 改名：

```txt
ToastRoot
```

---

## 第 7 步：如何把脚本挂到场景节点上

现在我们把 `LoginSceneEntry.ts` 挂到 `LoginScene` 上。

### 挂脚本的方法

1. 在层级管理器里选中：
   - `Canvas`
   或
   - `SafeArea`

建议先挂到 `Canvas`。

2. 看右侧属性检查器
3. 找到“添加组件”
4. 点开后搜索：

```txt
LoginSceneEntry
```

5. 点击它

如果成功，右侧会出现一组可以拖拽的字段，比如：

- `titleLabel`
- `nicknameInput`
- `wsUrlInput`
- `connectionStateLabel`
- `connectButton`
- `enterLobbyButton`
- `reconnectButton`
- `toastRoot`
- `toastComponent`

---

## 第 8 步：如何拖拽 `@property` 引用

这一步是最关键的。

### 拖拽规则

你要把层级管理器里的真实节点，拖到右侧脚本组件的字段槽位里。

例如：

- 把 `TitleLabel` 拖到 `titleLabel`
- 把 `NicknameInput` 拖到 `nicknameInput`
- 把 `WsUrlInput` 拖到 `wsUrlInput`
- 把 `ConnectionStatusLabel` 拖到 `connectionStateLabel`
- 把 `ConnectButton` 拖到 `connectButton`
- 把 `EnterLobbyButton` 拖到 `enterLobbyButton`
- 把 `ReconnectButton` 拖到 `reconnectButton`
- 把 `ToastRoot` 拖到 `toastRoot`

### 拖拽方法

1. 在层级管理器找到节点
2. 用鼠标左键按住节点
3. 直接拖到右侧脚本字段框中
4. 松开鼠标

如果拖成功，字段会显示对应对象名。

### 什么时候会拖不进去

一般是这几个原因：

- 节点类型不匹配
- 脚本没编译成功
- 你拖的是错误对象

例如：

- `Label` 类型字段必须拖有 `Label` 组件的节点
- `Button` 类型字段必须拖有 `Button` 组件的节点

---

## 第 9 步：如何创建真实 prefab 节点

下面先做一个最简单的 `PlayerSeat.prefab`。

### 第一步：先建一个普通节点树

在任意场景里先创建一个空节点：

```txt
PlayerSeatRoot
```

然后在它下面创建：

```txt
AvatarPlaceholder
DisplayNameLabel
HandCountLabel
UnoStateLabel
TurnStateLabel
EliminatedStateLabel
```

### 第二步：给需要显示文字的节点加 Label

这些节点建议创建成 `Label`：

- `DisplayNameLabel`
- `HandCountLabel`
- `UnoStateLabel`
- `TurnStateLabel`
- `EliminatedStateLabel`

### 第三步：挂脚本

1. 选中 `PlayerSeatRoot`
2. 添加组件
3. 搜索：

```txt
PlayerSeatComponent
```

4. 添加成功后，把对应节点拖进字段：

- `avatarPlaceholder`
- `displayNameLabel`
- `handCountLabel`
- `unoStateLabel`
- `turnStateLabel`
- `eliminatedStateLabel`

---

## 第 10 步：如何保存 prefab

### 保存 prefab 的操作方式

1. 在层级管理器中选中你刚搭好的根节点，比如：

```txt
PlayerSeatRoot
```

2. 用鼠标把这个根节点直接拖到资源管理器里的：

```txt
assets/prefabs
```

3. 松开鼠标

Creator 就会生成一个 prefab 文件。

然后你把它命名为：

```txt
PlayerSeat
```

### 保存完后要做什么

1. 双击这个 prefab
2. 确认里面结构还在
3. 确认脚本和字段没丢

---

## 第 11 步：如何保存场景

保存场景的方法很简单：

1. 确认当前正在编辑某个场景，比如 `LoginScene`
2. 点击菜单：

```txt
文件 -> 保存
```

或者直接按：

```txt
Ctrl + S
```

### 什么时候一定要保存

你每做完下面任意一件事，都建议保存一次：

- 新增一批节点
- 挂完一个脚本
- 拖完一组 `@property`
- 调整完层级

这样出错时不容易全丢。

---

## 第 12 步：如何看最终 UI 排版效果

你搭完节点后，不只是“看层级”，还要看画面是不是正常。

### 你应该怎么看

1. 选中场景
2. 在中间预览区域看布局
3. 检查这些问题：
   - 文字是不是重叠
   - 按钮是不是跑出屏幕
   - 输入框是不是太小
   - ScrollView 是否可见
   - 弹窗节点是不是默认隐藏

### 新手常见误区

很多人只看层级，不看中间画面。

这样会导致：

- 节点都建了
- 名字也对
- 但画面全堆在左上角

所以每搭完一页，你都要看中间的视觉区域。

### 最简单的排版建议

第一版不要追求好看，先追求“看得见、点得到、不会重叠”。

例如：

- 标题放最上方
- 两个输入框纵向排列
- 按钮纵向排列
- Toast 放底部或中间

---

## 第 13 步：剩下 3 个场景怎么做

接下来继续按同样方法做：

### `LobbyScene`

节点结构：

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

挂脚本：

```txt
LobbySceneEntry
```

### `RoomScene`

节点结构：

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

挂脚本：

```txt
RoomSceneEntry
```

### `BattleScene`

节点结构比较复杂，严格按：

[PHASE4D-COCOS-SCENE-PREFAB-WIRING.md](</e:/微信开发者工具/uno-plus/docs/PHASE4D-COCOS-SCENE-PREFAB-WIRING.md>)

挂脚本：

```txt
BattleSceneEntry
```

---

## 第 14 步：你至少要做完的 prefab

你需要至少搭这 4 个：

### `CardView`

```txt
CardViewRoot
├─ Label
└─ PlayableHint
```

挂：

```txt
CardViewComponent
```

### `PlayerSeat`

```txt
PlayerSeatRoot
├─ AvatarPlaceholder
├─ DisplayNameLabel
├─ HandCountLabel
├─ UnoStateLabel
├─ TurnStateLabel
└─ EliminatedStateLabel
```

挂：

```txt
PlayerSeatComponent
```

### `Toast`

```txt
ToastRoot
└─ ToastLabel
```

挂：

```txt
ToastComponent
```

### `ColorPickerDialog`

```txt
ColorPickerDialogRoot
├─ DialogTitleLabel
└─ ButtonsRow
   ├─ ColorRedButton
   ├─ ColorYellowButton
   ├─ ColorBlueButton
   └─ ColorGreenButton
```

挂：

```txt
ColorPickerDialogComponent
```

---

## 第 15 步：构建微信小游戏

当你确认场景和 prefab 已经都能正常打开，并且脚本能挂上以后，再构建。

### 操作步骤

1. 在 Creator 里点击：

```txt
项目 -> 构建发布
```

2. 平台选择：

```txt
微信小游戏
```

3. 输出目录确认在：

```txt
build/wechatgame
```

4. 填 AppID
5. 点击“构建”

构建完成后，去查看：

```txt
apps/NewProject/build/wechatgame
```

确认里面有：

- `game.json`
- `project.config.json`

---

## 第 16 步：用微信开发者工具打开

1. 打开微信开发者工具
2. 选择“导入项目”
3. 项目目录选择：

```txt
e:\微信开发者工具\uno-plus\apps\NewProject\build\wechatgame
```

4. 项目类型选“小游戏”
5. 打开

---

## 第 17 步：本机和真机怎么联调

### 本机联调

服务端启动：

```bash
HOST=0.0.0.0 PORT=8787 corepack pnpm --filter @thunder-uno/game-server dev
```

客户端地址：

```txt
ws://localhost:8787
```

### 真机联调

客户端地址改成：

```txt
ws://你的电脑局域网IP:8787
```

例如：

```txt
ws://192.168.1.23:8787
```

手机上不能使用 `localhost`。

---

## 第 18 步：你现在最推荐的实际顺序

不要一次做完全部内容。

建议顺序：

1. 打开 `NewProject`
2. 确认脚本可见
3. 创建 `LoginScene`
4. 搭 `LoginScene` 节点
5. 挂 `LoginSceneEntry`
6. 拖 `@property`
7. 保存场景
8. 创建 `Toast.prefab`
9. 再做 `LobbyScene`
10. 再做 `RoomScene`
11. 最后做 `BattleScene`
12. 最后构建微信小游戏

---

## 第 19 步：你卡住时最先检查什么

### 场景没显示

检查：

- 你是不是没有双击场景文件
- 你是不是还没保存

### 脚本挂不上

检查：

- 脚本有没有报错
- 是否在 `assets/scripts` 下
- 是否 `extends Component`

### 拖不了 property

检查：

- 字段类型是不是匹配
- 节点上有没有对应组件

### prefab 没保存成功

检查：

- 你是不是没有把根节点拖到 `assets/prefabs`

### UI 看起来很乱

检查：

- 是不是所有节点都堆在默认位置
- 有没有手动调整位置
- 有没有调整父子层级

---

## 第 20 步：你下一步该做什么

你现在最适合立刻做的事情是：

1. 打开 `NewProject`
2. 创建 `LoginScene`
3. 按这份文档把 `LoginScene` 节点搭出来
4. 挂 `LoginSceneEntry`
5. 把字段拖进去
6. 保存场景

只要你先把这一页跑通，后面三页你就会了。

如果你已经把节点树搭完了，但不知道每个节点在画面里该长什么样、该放在哪里，再看这份补充说明：

- [COCOS-UI-PLACEMENT-GUIDE.md](</e:/微信开发者工具/uno-plus/docs/COCOS-UI-PLACEMENT-GUIDE.md>)

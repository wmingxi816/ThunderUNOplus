# Phase 5A 补充说明

## 这份补充文档是做什么的

这份文档用于汇总 Phase 5A 期间，围绕 `Cocos Creator`、`NewProject` 工程、微信小游戏构建，以及你需要手动完成的操作事项。

它不是替代主文档，而是补充说明，主要解决这些问题：

- 当前真实可用的 Creator 工程在哪里
- 我已经替你做了哪些事情
- 哪些事情必须你在 Creator 编辑器里手动完成
- 推荐你按什么顺序做
- 你应该优先看哪些文档

主文档仍然是：

- [PHASE5A-WECHAT-DEVTOOLS-DEBUG.md](</e:/微信开发者工具/uno-plus/docs/PHASE5A-WECHAT-DEVTOOLS-DEBUG.md>)

---

## 当前阶段的真实情况

你现在已经不再只是停留在“仓库里有蓝图文件”的阶段了。

当前工作区里已经存在一个真实的 Cocos Creator 工程：

```txt
apps/NewProject
```

这个目录已经是 Creator 能识别的工程，包含：

- `.creator`
- `assets`
- `library`
- `profiles`
- `settings`
- `temp`
- `package.json`
- `tsconfig.json`

其中最重要的是：

```txt
apps/NewProject/assets
```

后续你在 Creator 里搭建场景、prefab、挂脚本，都是在这个工程里完成，不是继续在旧的蓝图目录里“想象式搭建”。

---

## 我已经替你做了什么

### 1. 创建了 NewProject 下的目录结构

我已经在 `apps/NewProject/assets/` 下创建好了这些目录：

```txt
assets/scenes
assets/prefabs
assets/scripts
assets/scripts/controllers
assets/scripts/components
assets/scripts/bindings
assets/resources
```

### 2. 生成了 Creator 可挂载的场景入口脚本

这些脚本都已经放到正确位置：

- [LoginSceneEntry.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/controllers/LoginSceneEntry.ts>)
- [LobbySceneEntry.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/controllers/LobbySceneEntry.ts>)
- [RoomSceneEntry.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/controllers/RoomSceneEntry.ts>)
- [BattleSceneEntry.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/controllers/BattleSceneEntry.ts>)

这些脚本的作用是：

- 能在 Creator 里挂到节点上
- 能在 Inspector 里显示 `@property`
- 先作为场景 UI 的壳和绑定入口

### 3. 生成了基础组件脚本

这些脚本也已经放好了：

- [CardViewComponent.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/components/CardViewComponent.ts>)
- [PlayerSeatComponent.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/components/PlayerSeatComponent.ts>)
- [ToastComponent.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/components/ToastComponent.ts>)
- [ColorPickerDialogComponent.ts](</e:/微信开发者工具/uno-plus/apps/NewProject/assets/scripts/components/ColorPickerDialogComponent.ts>)

这些组件用于：

- `CardView` prefab
- `PlayerSeat` prefab
- `Toast` prefab
- `ColorPickerDialog` prefab

### 4. 生成了新手版搭建文档

你现在已经有这几份手动操作文档：

- [Cococreater-Build.md](</e:/微信开发者工具/uno-plus/Cococreater-Build.md>)
- [LOGINSCENE-DRAG-REFERENCE.md](</e:/微信开发者工具/uno-plus/docs/LOGINSCENE-DRAG-REFERENCE.md>)
- [PHASE4D-COCOS-SCENE-PREFAB-WIRING.md](</e:/微信开发者工具/uno-plus/docs/PHASE4D-COCOS-SCENE-PREFAB-WIRING.md>)
- [PHASE5A-WECHAT-DEVTOOLS-DEBUG.md](</e:/微信开发者工具/uno-plus/docs/PHASE5A-WECHAT-DEVTOOLS-DEBUG.md>)

---

## 哪些事情必须你手动完成

下面这些事情，我不能替你在 Creator GUI 里自动点完，必须你自己在编辑器里做：

### 1. 创建真实场景

你要在 `apps/NewProject/assets/scenes/` 下手动创建：

- `LoginScene`
- `LobbyScene`
- `RoomScene`
- `BattleScene`

### 2. 创建真实 prefab

你要在 `apps/NewProject/assets/prefabs/` 下手动创建：

- `CardView`
- `PlayerSeat`
- `Toast`
- `ColorPickerDialog`

### 3. 手动搭节点树

你要在每个场景和 prefab 里，用 Creator 编辑器真实创建节点，而不是只看仓库里的蓝图文件。

### 4. 手动挂脚本

你要把这些脚本挂到对应节点上：

- `LoginSceneEntry`
- `LobbySceneEntry`
- `RoomSceneEntry`
- `BattleSceneEntry`
- `CardViewComponent`
- `PlayerSeatComponent`
- `ToastComponent`
- `ColorPickerDialogComponent`

### 5. 手动拖拽 `@property`

你需要在 Inspector 里把节点拖到脚本字段里。

例如：

- `titleLabel` 拖 `TitleLabel`
- `nicknameInput` 拖 `NicknameInput`
- `connectButton` 拖 `ConnectButton`
- `toastComponent` 拖挂了 `ToastComponent` 的 `ToastRoot`

### 6. 手动保存场景和 prefab

你每完成一部分都要：

- 保存场景
- 保存 prefab

否则容易丢改动。

### 7. 手动检查 UI 排版

你要在 Creator 的场景编辑区域里看：

- 文字有没有重叠
- 按钮有没有跑出屏幕
- 输入框有没有太小
- ScrollView 是否可见
- 弹窗是不是默认隐藏

---

## 你现在推荐按什么顺序做

不要一口气全做完。

推荐顺序如下：

### 第 1 步：先确认脚本已经被 Creator 识别

打开 `apps/NewProject` 后，在资源管理器中确认这些脚本可见：

- `assets/scripts/controllers/*`
- `assets/scripts/components/*`

### 第 2 步：先只做 `LoginScene`

建议你第一轮只做登录页，不要先碰 `BattleScene`。

你要做的是：

1. 创建 `LoginScene`
2. 搭节点树
3. 给 `Canvas` 挂 `LoginSceneEntry`
4. 拖好全部字段
5. 保存场景

### 第 3 步：做 `Toast.prefab`

因为 `LoginSceneEntry` 里已经有 `toastRoot` 和 `toastComponent`，所以你做完登录页后，紧接着做 `Toast` prefab 会更顺。

### 第 4 步：再做 `LobbyScene`

登录页通了以后，再做：

- `LobbyScene`
- `RoomScene`
- 最后 `BattleScene`

### 第 5 步：全部场景完成后再构建微信小游戏

不要在场景都还没搭好的时候就急着构建。

---

## LoginScene 现在怎么做

如果你现在只想做眼前这一步，最短路径是：

1. 打开 `apps/NewProject`
2. 创建 `LoginScene`
3. 按 [Cococreater-Build.md](</e:/微信开发者工具/uno-plus/Cococreater-Build.md>) 里的登录页步骤搭节点
4. 按 [LOGINSCENE-DRAG-REFERENCE.md](</e:/微信开发者工具/uno-plus/docs/LOGINSCENE-DRAG-REFERENCE.md>) 把 `LoginSceneEntry` 的字段一个个拖进去
5. 保存场景

只要 `LoginScene` 你能完成，后面几页你就会了。

---

## 你应该优先看的文档顺序

如果你现在不知道先看哪份文档，按这个顺序来：

### 1. 先看总操作手册

[Cococreater-Build.md](</e:/微信开发者工具/uno-plus/Cococreater-Build.md>)

用途：

- 理解整个 Creator 搭建流程
- 学会怎么建场景、建 prefab、挂脚本、保存、构建

### 2. 再看登录页拖拽对照表

[LOGINSCENE-DRAG-REFERENCE.md](</e:/微信开发者工具/uno-plus/docs/LOGINSCENE-DRAG-REFERENCE.md>)

用途：

- 直接照着把 `LoginSceneEntry` 绑定完成

### 3. 再看 Phase 4D 蓝图文档

[PHASE4D-COCOS-SCENE-PREFAB-WIRING.md](</e:/微信开发者工具/uno-plus/docs/PHASE4D-COCOS-SCENE-PREFAB-WIRING.md>)

用途：

- 查完整节点树
- 查四个场景和四个 prefab 的结构

### 4. 最后看 Phase 5A 主文档

[PHASE5A-WECHAT-DEVTOOLS-DEBUG.md](</e:/微信开发者工具/uno-plus/docs/PHASE5A-WECHAT-DEVTOOLS-DEBUG.md>)

用途：

- 等你场景搭得差不多了，再看微信小游戏构建和开发者工具联调部分

---

## 场景和 prefab 搭完后做什么

当你完成场景和 prefab 搭建后，下一步才是：

1. 在 Creator 里执行“构建发布”
2. 目标选择“微信小游戏”
3. 输出到：

```txt
apps/NewProject/build/wechatgame
```

4. 再用微信开发者工具打开：

```txt
apps/NewProject/build/wechatgame
```

5. 本机联调用：

```txt
ws://localhost:8787
```

6. 真机联调用：

```txt
ws://你的电脑局域网IP:8787
```

---

## 当前阶段边界

这一轮你先不要做这些事情：

- 微信真实登录
- 正式公网 `wss://`
- 正式美术资源
- 商城、排行榜、支付
- 数据库
- 大规模重构客户端逻辑

Phase 5A 的核心目标仍然是：

- 把 Cocos 工程搭起来
- 把场景和 prefab 接起来
- 准备进入微信开发者工具和真机调试

---

## 最后一条建议

如果你现在容易被信息量压住，就只记住一句话：

```txt
先把 LoginScene 在 NewProject 里真实搭出来，并把 LoginSceneEntry 全部拖拽完成。
```

只做这一页，做通了再继续下一页。这样最稳。

# 下一轮实现计划

## 总览
本轮按固定顺序推进，不跳步：

1. 先新增测试，锁住目标行为。
2. 用本计划完整覆盖 `next-step.md`。
3. 再按测试驱动修改代码。
4. 最后重写 `README.md` 的规则部分，只保留“和基础 UNO 不同的地方”。

涉及 5 个子系统：

- 房主淘汰/离房后的弹窗与房主顺位
- 罚抽音效与淘汰音乐
- 机器人入口与独立策略层
- 设置里的更新日志入口
- README 规则差异版说明

## 执行顺序
### 阶段 1：先补测试
- 客户端 smoke：
  - `apps/client-web/src/smoke/appBoot.test.ts`
  - 覆盖非房主等待房主决策、房主重开/继续按钮、房主淘汰离房后的新房主切换、更新日志面板、`update-log.md` 成功/失败、bot 类型下拉、罚抽减速音效关闭 `preservesPitch`、淘汰音乐只启动一次并在继续/重开/离房后停止。
- 前端 e2e：
  - `apps/client-web/e2e/round-decision-host-transfer.spec.ts`
  - 覆盖房主顺移后的弹窗控制切换，以及设置里的更新日志按钮与面板。
- 服务端房间测试：
  - `apps/game-server/src/tests/roomManager.test.ts`
  - 覆盖 `leaveRoom()` 的房主转移、房主淘汰后离房的自动继续与不自动继续、`addBot(botType)` 的昵称和策略写入。
- 策略层测试：
  - `apps/game-server/src/tests/dispatchBotStrategy.test.ts`
  - `apps/game-server/src/tests/chaosStrategy.test.ts`
  - `apps/game-server/src/tests/botScheduler.test.ts`

### 阶段 2：覆盖 `next-step.md`
- 直接用本计划覆盖当前文件，不保留旧的“大厅重构”内容。
- 文档结构固定为：总览、执行顺序、五个子系统实现点、测试清单、README 更新要求、验收标准。

### 阶段 3：按顺序改代码
1. 房主顺位与继续逻辑
2. 前端回合决策弹窗
3. 音频通道
4. 机器人协议与大厅 UI
5. 独立策略层和 `混沌bot`
6. 设置日志入口
7. README 差异规则版

## 五个子系统实现点
### 1. 房主顺位与继续逻辑
- 只在房主主动离房时处理顺位，不处理单纯断线。
- 新房主按原始加入顺序/座位顺序顺移到当前仍在房间中的最早玩家。
- 如果当前处于“有人出局/可继续游戏”阶段且活跃玩家至少 2 人，则自动执行一次 `continueGame()`。
- 如果不能自动继续，则只转移房主权限，由新房主独占继续/重开权限。

### 2. 回合决策弹窗
- 房主显示 `重开一把 / 继续游戏`。
- 非房主只显示 `等待房主决定重开/继续游戏`。
- 自动继续成功后，等待弹窗自动关闭。
- 房主顺移后，客户端依据新的 `hostPlayerId` 立即切换弹窗内容。

### 3. 音频与淘汰音乐
- 罚抽减速播放前统一关闭 `preservesPitch` / `webkitPreservesPitch` / `mozPreservesPitch`。
- 自己被罚抽音量调整为 `1.0`，他人被罚抽音量调整为 `0.85`。
- `apps/client-web/public/sounds/see-you-again-2x.mp3` 作为淘汰音乐资源，首次收到本轮 `player-eliminated` 时启动，循环播放，跟随背景音乐音量。
- 继续游戏、重开、离房、自动继续成功时停止并重置。

### 4. 机器人入口与协议
- `ClientAddBotMessage`、`buildAddBotMessage()`、`AddBotParams` 全部接入 `botType: "strong" | "chaos"`。
- 大厅保留一个“添加机器人”按钮，同时增加 `最强bot / 混沌bot` 下拉。
- `strong` 命名为 `最强botN`，策略写入 `greedy-v1`。
- `chaos` 命名为 `混沌botN`，策略写入 `chaos-v1`。

### 5. 独立策略层与更新日志入口
- greedy 保持在独立文件，新增 `chaosStrategy.ts` 和 `dispatchBotStrategy.ts`。
- 所有策略统一返回 `BotDecision { command, score, reasons, willCallUno }`。
- “上家接不了某颜色”只保留在服务端房间私有状态中，不进公共协议。
- 设置面板里新增更新日志按钮，`fetch('/update-log.md')` 后只解析 `##` 和 `-`，失败时显示空状态。

## 测试清单
- `corepack pnpm --filter @thunder-uno/protocol build`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm test:e2e`

重点验收：

- 非房主等待文案与房主按钮权限正确。
- 房主淘汰离房后，顺位、自动继续和弹窗关闭都正确。
- `dispatchBotStrategy()` 正确分发 `greedy-v1` / `chaos-v1`。
- `chaosStrategy` 的关键规则可命中，且无命中时回退到 greedy。
- 更新日志按钮、面板和 `update-log.md` 加载行为正确。
- 淘汰音乐与罚抽减速音效的生命周期正确。

## README 更新要求
- 保留 `快速开始 / 本地启动 / 局域网联机 / 生产预览 / 常见问题` 主结构。
- 规则说明改成差异化玩家导览，只强调本项目和基础 UNO 的不同点。
- `GAME-RULES.md` 继续作为完整规则来源，README 不再系统重复基础 UNO 常识。

## 验收标准
- `next-step.md` 已被本计划完整覆盖。
- README 规则区已改成差异版结构。
- 根级 `typecheck` 通过。
- 全量测试通过。
- 新增的 e2e spec 通过。

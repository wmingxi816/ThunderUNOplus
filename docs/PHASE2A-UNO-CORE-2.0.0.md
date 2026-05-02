# 雷霆UNOplus 第二阶段 A 交付清单 2.0.0

## 阶段目标

本阶段只实现 `packages/uno-core` 的规则引擎基础层，不实现以下内容：

- Cocos UI
- WebSocket
- 数据库
- 微信登录
- `apps/game-server` 房间容器
- 完整对局流程

---

## 本次完成内容

### 1. 牌模型与牌型工厂

已新增：

- `packages/uno-core/src/card.ts`

当前可表达牌型：

- 普通数字牌
- 普通 +2
- 普通 +4
- 禁
- 反转
- 同色丢弃
- 交换手牌
- 变色
- 罚抽
- 反转变色 +4
- 变色 +6
- 变色 +10

已提供：

- `Card`
- `NumberCard`
- `ColoredActionCard`
- `DiscardSameColorCard`
- `BlackCard`
- `createNumberCard()`
- `createColoredActionCard()`
- `createBlackCard()`

---

### 2. 牌库配置与生成

已新增：

- `packages/uno-core/src/cardConfig.ts`
- `packages/uno-core/src/deck.ts`

已实现：

- `createDeck()`
- 每张牌 `id` 唯一
- 牌库分类统计
- 牌库按牌型统计

当前引擎实现采用：

- 数字牌：`120`
- 带颜色技能牌：`64`
- 黑色技能牌：`36`
- 总牌数：`220`

---

### 3. 洗牌能力

已新增：

- `packages/uno-core/src/shuffle.ts`

已实现：

- `shuffleDeck(deck)`
- `shuffleDeck(deck, seed)`
- 无 seed 随机洗牌
- 有 seed 确定性洗牌
- 不修改原数组

---

### 4. 开局初始化

已新增：

- `packages/uno-core/src/gameState.ts`
- `packages/uno-core/src/setup/createInitialGame.ts`

已实现：

- 支持 `3` 到 `8` 人
- 每人发 `7` 张
- 翻开起始牌
- 起始牌如果是黑牌则继续翻
- 起始牌如果是带颜色技能牌，只取其颜色，不触发技能
- 初始化 `currentColor`
- 初始化 `direction`
- 初始化 `currentPlayerId`
- 初始化 `discardPile`
- 初始化 `drawPile`
- 初始化玩家手牌

---

### 5. 基础规则判定

已新增：

- `packages/uno-core/src/rules/cardGuards.ts`
- `packages/uno-core/src/rules/canPlayCard.ts`
- `packages/uno-core/src/rules/canStackDrawCard.ts`
- `packages/uno-core/src/rules/sequence.ts`
- `packages/uno-core/src/rules/multiple.ts`
- `packages/uno-core/src/rules/discardSameColor.ts`

已实现：

- 普通接牌判定 `canPlayCard()`
- 加牌链判定 `canStackDrawCard()`
- 顺子校验 `validateSequencePlay()`
- 连对校验 `validateMultipleNumberPlay()`
- 同色丢弃校验 `validateDiscardSameColorPlay()`

---

### 6. 导出与契约

已更新：

- `packages/uno-core/src/config.ts`
- `packages/uno-core/src/contracts.ts`
- `packages/uno-core/src/index.ts`

当前 `uno-core` 已能作为一个独立规则基础库被后续服务端接入。

---

### 7. 中文注释与可读性增强

已补充：

- 所有当前已实现的 `uno-core` 功能代码中文注释
- 所有当前已编写的 `uno-core` 测试文件中文注释

本次注释补充的目标不是简单解释“代码在做什么”，而是进一步说明：

- 规则为什么这样设计
- 关键分支在防什么问题
- 某条测试在保护哪一条行为
- 哪些结构是为后续 Phase 2B 和服务端接入预留的

已覆盖的主要文件包括：

- `packages/uno-core/src/card.ts`
- `packages/uno-core/src/cardConfig.ts`
- `packages/uno-core/src/deck.ts`
- `packages/uno-core/src/shuffle.ts`
- `packages/uno-core/src/gameState.ts`
- `packages/uno-core/src/config.ts`
- `packages/uno-core/src/contracts.ts`
- `packages/uno-core/src/index.ts`
- `packages/uno-core/src/rules/*.ts`
- `packages/uno-core/src/**/*.test.ts`

---

## 测试覆盖

已新增测试：

- `packages/uno-core/src/deck.test.ts`
- `packages/uno-core/src/shuffle.test.ts`
- `packages/uno-core/src/setup/createInitialGame.test.ts`
- `packages/uno-core/src/rules/canPlayCard.test.ts`
- `packages/uno-core/src/rules/canStackDrawCard.test.ts`
- `packages/uno-core/src/rules/sequence.test.ts`
- `packages/uno-core/src/rules/multiple.test.ts`
- `packages/uno-core/src/rules/discardSameColor.test.ts`

当前测试覆盖点包括：

1. `createDeck` 生成 `220` 张牌
2. 数字牌数量正确
3. 带颜色技能牌数量正确
4. 黑色技能牌数量正确
5. 每张牌 `id` 唯一
6. `3` 人开局每人 `7` 张
7. `8` 人开局每人 `7` 张
8. 初始牌不能是黑色技能牌
9. 红 `3` 可以接红 `5`
10. 红 `3` 可以接绿 `3`
11. 红 `+2` 可以接红 `+4`
12. 红 `+4` 可以接蓝 `+4`
13. 红 `+2` 可以接蓝 `+2`
14. 红 `+2` 不能接蓝 `+4`
15. 黑色 `+6` 可继续接加牌链
16. 黑色 `+6` 后，蓝 `+2` 只有在 `currentColor=蓝` 时可接
17. 顺子 `0-4` 合法
18. 顺子少于 `5` 张非法
19. 顺子包含技能牌非法
20. 连对 `绿6 + 绿6` 合法
21. 连对 `绿6 + 蓝6` 非法
22. 同色丢弃可以附带同色技能牌
23. 同色丢弃不能附带黑牌

---

## 本次修改的关键文件

### 新增

- `packages/uno-core/src/card.ts`
- `packages/uno-core/src/cardConfig.ts`
- `packages/uno-core/src/deck.ts`
- `packages/uno-core/src/shuffle.ts`
- `packages/uno-core/src/gameState.ts`
- `packages/uno-core/src/rules/cardGuards.ts`
- `packages/uno-core/src/rules/canPlayCard.ts`
- `packages/uno-core/src/rules/canStackDrawCard.ts`
- `packages/uno-core/src/rules/sequence.ts`
- `packages/uno-core/src/rules/multiple.ts`
- `packages/uno-core/src/rules/discardSameColor.ts`
- `packages/uno-core/src/setup/createInitialGame.ts`
- `packages/uno-core/src/deck.test.ts`
- `packages/uno-core/src/shuffle.test.ts`
- `packages/uno-core/src/setup/createInitialGame.test.ts`
- `packages/uno-core/src/rules/canPlayCard.test.ts`
- `packages/uno-core/src/rules/canStackDrawCard.test.ts`
- `packages/uno-core/src/rules/sequence.test.ts`
- `packages/uno-core/src/rules/multiple.test.ts`
- `packages/uno-core/src/rules/discardSameColor.test.ts`

### 更新

- `packages/uno-core/src/config.ts`
- `packages/uno-core/src/contracts.ts`
- `packages/uno-core/src/index.ts`
- `packages/uno-core/src/card.ts`
- `packages/uno-core/src/cardConfig.ts`
- `packages/uno-core/src/deck.ts`
- `packages/uno-core/src/shuffle.ts`
- `packages/uno-core/src/gameState.ts`
- `packages/uno-core/src/rules/cardGuards.ts`
- `packages/uno-core/src/rules/canPlayCard.ts`
- `packages/uno-core/src/rules/canStackDrawCard.ts`
- `packages/uno-core/src/rules/sequence.ts`
- `packages/uno-core/src/rules/multiple.ts`
- `packages/uno-core/src/rules/discardSameColor.ts`
- `packages/uno-core/src/setup/createInitialGame.ts`
- `packages/uno-core/src/deck.test.ts`
- `packages/uno-core/src/shuffle.test.ts`
- `packages/uno-core/src/setup/createInitialGame.test.ts`
- `packages/uno-core/src/rules/canPlayCard.test.ts`
- `packages/uno-core/src/rules/canStackDrawCard.test.ts`
- `packages/uno-core/src/rules/sequence.test.ts`
- `packages/uno-core/src/rules/multiple.test.ts`
- `packages/uno-core/src/rules/discardSameColor.test.ts`
- `packages/uno-core/package.json`
- `packages/uno-core/tsconfig.json`
- 根目录 `package.json`

---

## 已知偏差与说明

### 1. GameMode 命名冲突

当前 `shared-types` 使用：

- `with-challenge`
- `no-challenge`

当前 `uno-core` 使用：

- `withChallenge`
- `withoutChallenge`

这是为了先满足本阶段需求，但在接入服务端前必须统一。

---

## 如何运行测试

安装依赖后运行：

```bash
pnpm install
pnpm test
```

或只跑 `uno-core`：

```bash
pnpm --filter @thunder-uno/uno-core test
```

## 本地验证结果

已完成以下验证：

- `pnpm --filter @thunder-uno/uno-core test`
- `pnpm --filter @thunder-uno/uno-core typecheck`
- 中文注释补充后再次执行上述验证

结果：

- `8` 个测试文件通过
- `26` 个测试通过
- `uno-core` TypeScript 类型检查通过

---

## 本阶段未实现内容

- 完整出牌流程 reducer
- 摸牌堆不足时的弃牌堆回洗
- 加牌链的整局状态推进
- 质疑机制结算
- UNO 罚抽与揭发结算
- 手牌超过 25 张淘汰结算
- 对局胜负结算
- 房间状态管理
- 服务端内存房间容器

---

## 下一阶段建议

1. 统一 `shared-types` 与 `uno-core` 的 `GameMode` 命名。
2. 在 `uno-core` 实现 `play-cards` 的单步状态推进。
3. 在 `uno-core` 实现 `draw-card`、`pending draw stack` 和 `nextPlayer` 结算。
4. 再进入 `game-server` 的内存房间与命令分发阶段。

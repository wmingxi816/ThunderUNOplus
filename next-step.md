我建议下一步让 AI 做 **Phase 5A：微信开发者工具与真机调试准备**。
重点不是继续写玩法，而是把现在的 Cocos 工程真正跑进 **微信开发者工具 / 真机预览**，并把会踩坑的配置提前补好。

现在仍然不需要正式服务器，但你会开始需要确认这些本地信息：

```txt id="4rpb65"
1. 你的 Cocos Creator 版本
2. 微信开发者工具是否已安装
3. 是否有微信小游戏 AppID；没有也可以先用测试号 / 游客调试方式
4. 电脑局域网 IP，用于手机真机连接本地服务端
5. 你是先用电脑模拟器调试，还是直接真机预览
```

Cocos 官方文档里，发布微信小游戏一般需要在 Cocos Creator 的构建发布面板选择“微信小游戏”，构建后会生成 `wechatgame` 发布包，并包含 `game.json` 和 `project.config.json`，再通过微信开发者工具运行。([Cocos Creator][1]) 微信小游戏正式或体验环境涉及网络域名配置，WebSocket 需要配置到 socket 合法域名；这也是后续上线前要处理的内容。([Unity 手册][2])

---

## 你接下来让 AI 做什么

让 AI 做一个 **Phase 5A 准备层**，内容包括：

```txt id="r0rpe3"
1. 检查 client-wechat 是否能被 Cocos Creator 正确识别
2. 检查 game.json / project.config.json / 构建配置
3. 增加 wechatgame 构建说明
4. 增加本地调试 / 真机调试网络配置
5. 补 wx.connectSocket 兼容层，如果当前 wsClient 只用了浏览器 WebSocket
6. 补小游戏环境和浏览器环境的网络适配
7. 补微信开发者工具调试文档
8. 补真机预览检查清单
```

这里最关键的是第 5 点：
如果你当前 `wsClient.ts` 用的是浏览器标准：

```ts
new WebSocket(url)
```

那在微信小游戏环境里可能需要适配：

```ts
wx.connectSocket(...)
```

所以 Phase 5A 应该先让 AI 审计并补一个 **SocketAdapter**，不要让业务层直接依赖浏览器 WebSocket。

---

## 直接给 AI 的提示词

你可以复制下面这段：

````md id="4gvb41"
继续开发《雷霆UNOplus》。

目前已经完成：

1. uno-core 规则引擎
2. shared-types / protocol
3. game-server 内存房间、WebSocket、真实多客户端联调
4. client-wechat TypeScript 客户端骨架
5. Cocos Controller / Binding
6. Cocos 场景 / prefab 手动落地说明
7. Phase 4D 已完成，接下来准备进入微信开发者工具和真机调试

现在进入 Phase 5A。

本阶段目标：微信开发者工具与真机调试准备。

重点不是继续写玩法，不是重写客户端逻辑，而是让当前 `apps/client-wechat` 能更稳定地在 Cocos Creator、微信开发者工具、以及真机预览环境中运行。

本阶段仍然不要实现：

- 微信真实登录
- 正式线上服务器
- 数据库
- 商城
- 排行榜
- 支付
- 正式美术
- 复杂动画
- 事件持久化

---

# 一、本阶段目标

请完成以下准备工作：

1. 审计 `apps/client-wechat` 是否具备微信小游戏构建所需文件
2. 检查 `game.json`
3. 检查 `project.config.json`
4. 检查 Cocos Creator 构建微信小游戏所需目录结构
5. 补充微信小游戏环境下 WebSocket 适配
6. 支持浏览器 / Cocos Preview / 微信小游戏三种运行环境
7. 支持 `ws://localhost:8787`
8. 支持 `ws://电脑局域网IP:8787`
9. 预留后续 `wss://正式域名`
10. 新增微信开发者工具和真机调试文档

---

# 二、重要背景

当前开发阶段还没有正式服务器，也没有正式域名。

本机调试使用：

```txt
ws://localhost:8787
````

手机真机连接电脑本地服务端时使用：

```txt
ws://电脑局域网IP:8787
```

例如：

```txt
ws://192.168.1.23:8787
```

正式体验版 / 上线阶段以后再切换为：

```txt
wss://正式域名
```

请不要要求当前必须提供正式域名、SSL 证书或微信 socket 合法域名。

但是文档里要明确说明：

* 开发者工具本地调试可以先用本地地址
* 真机访问电脑服务端不能用 localhost
* 真机要使用电脑局域网 IP
* 正式上线需要 wss 域名
* WebSocket 域名后续需要配置到微信公众平台的 socket 合法域名

---

# 三、先做仓库审计

请先审计当前仓库，不要直接大改。

输出：

1. `apps/client-wechat/game.json` 当前内容和问题
2. `apps/client-wechat/project.config.json` 当前内容和问题
3. `apps/client-wechat/src/network/wsClient.ts` 是否直接依赖浏览器 WebSocket
4. 是否已经存在微信小游戏 socket 适配
5. 是否已经存在运行环境判断
6. 是否已经有 WS_URL 覆盖方案
7. 是否已有微信开发者工具调试文档
8. Phase 5A 需要补哪些最小改动

审计后再实施补丁。

---

# 四、WebSocket 适配要求

如果当前 `wsClient.ts` 直接使用：

```ts
new WebSocket(url)
```

请新增抽象层，不要让业务层直接依赖具体环境。

建议新增：

```txt
apps/client-wechat/src/network/socketAdapter.ts
apps/client-wechat/src/network/browserSocketAdapter.ts
apps/client-wechat/src/network/wechatSocketAdapter.ts
apps/client-wechat/src/network/createSocketAdapter.ts
```

目标接口：

```ts
export interface SocketAdapter {
  connect(url: string): Promise<void>;
  send(data: string): void;
  close(): void;

  onOpen(handler: () => void): void;
  onMessage(handler: (data: string) => void): void;
  onClose(handler: () => void): void;
  onError(handler: (error: unknown) => void): void;
}
```

浏览器 / Cocos Preview 使用：

```ts
BrowserSocketAdapter
```

微信小游戏环境使用：

```ts
WechatSocketAdapter
```

微信小游戏环境中使用：

```ts
wx.connectSocket
```

但请注意：

* 不要在普通浏览器环境直接访问 `wx`
* 需要先判断 `typeof wx !== "undefined"`
* 需要给 `wx` 添加最小类型声明，避免 TypeScript 报错
* 不要引入庞大的微信类型依赖，先做最小声明即可

---

# 五、运行环境判断

请新增或整理：

```txt
apps/client-wechat/src/app/runtimeEnv.ts
```

支持判断：

```ts
export type RuntimeEnv = "browser" | "wechat-minigame" | "unknown";
```

规则：

```ts
if (typeof wx !== "undefined" && typeof wx.connectSocket === "function") {
  return "wechat-minigame";
}
```

其余环境默认 browser 或 unknown。

---

# 六、WS_URL 配置要求

请确认 `app/config.ts` 支持：

1. 默认 `ws://localhost:8787`
2. 手动覆盖成局域网 IP
3. 自动补全缺失协议

例如输入：

```txt
192.168.1.23:8787
```

应该规范成：

```txt
ws://192.168.1.23:8787
```

但如果输入：

```txt
wss://example.com/socket
```

不要改坏。

请补测试：

1. 默认地址是 `ws://localhost:8787`
2. `192.168.1.23:8787` 会变成 `ws://192.168.1.23:8787`
3. `ws://127.0.0.1:8787` 保持不变
4. `wss://example.com` 保持不变

---

# 七、game-server 配合真机调试

请确认 `apps/game-server` 已支持：

```txt
HOST=0.0.0.0
PORT=8787
```

如果还没有，请补齐。

要求：

* 默认本地仍然能跑
* 局域网真机能连接电脑 IP
* 不破坏现有 game-server 测试

启动命令示例：

```bash
HOST=0.0.0.0 PORT=8787 corepack pnpm --filter @thunder-uno/game-server dev
```

---

# 八、微信开发者工具构建文档

请新增或更新：

```txt
docs/PHASE5A-WECHAT-DEVTOOLS-DEBUG.md
```

文档必须包含：

## 1. Cocos Creator 构建步骤

写清楚：

1. 打开 Cocos Creator
2. 打开 `apps/client-wechat`
3. 检查场景是否存在
4. 构建发布
5. 发布平台选择微信小游戏
6. 填写 AppID；没有正式 AppID 时说明可以先用测试/开发方式
7. 构建到 `build/wechatgame`
8. 用微信开发者工具打开构建产物

## 2. 本机调试

使用：

```txt
ws://localhost:8787
```

适用于：

```txt
Cocos Preview
微信开发者工具模拟器中的部分本地调试
```

## 3. 真机调试

使用：

```txt
ws://电脑局域网IP:8787
```

并说明：

* 手机和电脑必须在同一 Wi-Fi
* 电脑防火墙允许 8787
* 服务端监听 `0.0.0.0`
* 手机上不能用 `localhost`

## 4. 开发者工具设置

文档中说明：

* 开发阶段如果遇到域名校验问题，可以在微信开发者工具里查找“不校验合法域名 / TLS / HTTPS 证书”相关开发设置
* 这是开发调试手段，不是上线方案
* 上线前必须配置正式 `wss://` 域名

## 5. 正式上线提醒

说明：

* 正式体验版 / 上线不能依赖 `ws://localhost`
* 需要公网服务器
* 需要 `wss://` 域名
* 需要 SSL 证书
* 需要在微信公众平台配置 socket 合法域名

## 6. 常见问题排查

至少包括：

* 微信开发者工具打不开项目
* Cocos 构建后找不到 `game.json`
* WebSocket 连接失败
* 真机能打开游戏但连不上服务端
* `localhost` 在手机上不可用
* 连接被防火墙拦截
* Cocos Preview 能连，微信工具不能连

---

# 九、测试要求

请新增或补齐测试：

## Runtime / Config

1. runtimeEnv 能识别模拟的微信小游戏环境
2. runtimeEnv 在无 wx 时返回 browser 或 unknown
3. normalizeWsUrl 能补全局域网 IP
4. normalizeWsUrl 不破坏 wss URL

## SocketAdapter

5. WsClient 可以注入 BrowserSocketAdapter
6. WsClient 可以注入 WechatSocketAdapter mock
7. WechatSocketAdapter 调用 wx.connectSocket
8. WechatSocketAdapter 收到 message 后能传给 WsClient
9. WebSocket 错误能进入 onError
10. close 能进入 onClose

## 原有测试

确保这些继续通过：

```bash
corepack pnpm --filter @thunder-uno/client-wechat typecheck
corepack pnpm --filter @thunder-uno/client-wechat test
corepack pnpm --filter @thunder-uno/game-server typecheck
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm typecheck
corepack pnpm test
```

---

# 十、输出要求

请输出：

1. 审计结果
2. 新增和修改文件列表
3. SocketAdapter 设计说明
4. WechatSocketAdapter 核心代码
5. runtimeEnv 核心代码
6. WS_URL 规范化逻辑
7. game-server HOST / PORT 确认
8. 微信开发者工具调试文档
9. 新增测试列表
10. 测试结果
11. 仍未实现内容
12. 下一阶段建议

---

# 十一、严格限制

* 不要重写 uno-core
* 不要重写 game-server 房间逻辑
* 不要重写 protocol
* 不要实现微信真实登录
* 不要接数据库
* 不要做商城 / 排行榜 / 支付
* 不要要求我现在提供正式域名
* 不要强行切换到 wss
* 不要删除现有测试
* 不要大规模重构客户端架构
* 只做微信开发者工具与真机调试准备所需的最小补丁

```

---

## 你需要手动做什么

AI 做完 Phase 5A 代码和文档后，你手动做这些：

1. **确认 Cocos Creator 能打开 `apps/client-wechat`。**
2. **确认微信开发者工具已安装。**
3. **在 Cocos Creator 里构建发布为微信小游戏。** Cocos 3.8 文档显示，构建微信小游戏后默认会在 `build` 目录下生成 `wechatgame` 文件夹，里面包含 `game.json` 和 `project.config.json`。:contentReference[oaicite:2]{index=2}
4. **用微信开发者工具打开 `build/wechatgame`。**
5. **先在开发者工具模拟器里连接 `ws://localhost:8787`。**
6. **再真机测试时，把 `WS_URL` 改成 `ws://你的电脑局域网IP:8787`。**
7. **上线前再准备 `wss://正式域名` 和微信公众平台 socket 合法域名。**

现在这一步，AI 应该帮你把 **环境适配、文档、SocketAdapter、调试配置** 做好；你负责在 Creator 和微信开发者工具里实际点构建、预览和真机测试。
::contentReference[oaicite:3]{index=3}
```

[1]: https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html?utm_source=chatgpt.com "发布到微信小游戏"
[2]: https://docs.unity.cn/cn/tuanjiemanual/Manual/UploadWeixinMiniGame.html?utm_source=chatgpt.com "团结引擎- 手册: 部署微信小游戏"

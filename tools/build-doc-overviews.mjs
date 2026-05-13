import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const docsDir = path.join(rootDir, "docs");

const phaseFiles = fs
  .readdirSync(docsDir)
  .filter((name) => /^PHASE.*\.md$/i.test(name))
  .sort(comparePhaseFiles);

const problemFiles = fs
  .readdirSync(docsDir)
  .filter((name) => /^Problem\d+\.md$/i.test(name))
  .sort(compareProblemFiles);

buildDocsHome();

buildOverview({
  title: "雷霆 UNOplus Phase 总览",
  filename: "phase-overview.html",
  eyebrow: "Development Flow",
  intro:
    "把所有阶段文档收拢到一页里，按演进顺序查看每个阶段做了什么、解决了什么，以及接下来怎么接着推进。",
  groups: [
    {
      title: "基础架构",
      description: "从 monorepo 脚手架、规则核心、协议到服务端与联调基线。",
      files: phaseFiles.filter((name) => /^PHASE[1-3]/i.test(name))
    },
    {
      title: "网页端转向与体验收口",
      description: "从 Web Pivot 到 UI、移动端、E2E 和可试玩体验。",
      files: phaseFiles.filter((name) => /^PHASE[4-5]/i.test(name))
    },
    {
      title: "机器人与对战打磨",
      description: "围绕 Greedy Bot、权重调优、音效和对战沉浸感的阶段记录。",
      files: phaseFiles.filter((name) => /^PHASE[6-9]/i.test(name))
    }
  ]
});

buildOverview({
  title: "雷霆 UNOplus Problem 总览",
  filename: "problem-overview.html",
  eyebrow: "Issue Map",
  intro:
    "把问题文档整理成一张清晰的问题地图，方便按主题回看缺陷、修复方向、验收标准和风险边界。",
  groups: [
    {
      title: "规则与资源修正",
      description: "聚焦规则引擎、牌资源映射、非法出牌与状态约束。",
      files: problemFiles.filter((name) => {
        const no = extractProblemNumber(name);
        return no >= 1 && no <= 3;
      })
    },
    {
      title: "对战反馈与交互",
      description: "聚焦胜负流程、弃牌堆、动画、方向状态和战场表现。",
      files: problemFiles.filter((name) => {
        const no = extractProblemNumber(name);
        return no >= 4 && no <= 6;
      })
    },
    {
      title: "体验优化与规则收紧",
      description: "聚焦退出流程、手牌布局、UNO 时机、加牌链和续局能力。",
      files: problemFiles.filter((name) => extractProblemNumber(name) >= 7)
    }
  ]
});

function buildOverview({ title, filename, eyebrow, intro, groups }) {
  const flatFiles = groups.flatMap((group) => group.files);
  const cards = flatFiles.map((file, index) => buildDocCard(file, index));
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #eef4f8;
        --panel: rgba(255, 255, 255, 0.86);
        --panel-strong: rgba(255, 255, 255, 0.96);
        --line: rgba(15, 53, 86, 0.14);
        --text: #16344c;
        --muted: #537089;
        --accent: #0f7db5;
        --accent-strong: #0a5d88;
        --chip: rgba(15, 125, 181, 0.1);
        --shadow: 0 18px 48px rgba(17, 52, 77, 0.14);
        --radius: 18px;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(108, 189, 232, 0.28), transparent 28%),
          radial-gradient(circle at top right, rgba(19, 108, 173, 0.18), transparent 22%),
          linear-gradient(180deg, #f7fbfd 0%, #edf4f8 42%, #e7eff4 100%);
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }

      a {
        color: var(--accent-strong);
      }

      .page {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 56px;
      }

      .hero {
        padding: 28px;
        border: 1px solid rgba(255, 255, 255, 0.7);
        border-radius: 28px;
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(232, 242, 247, 0.92)),
          linear-gradient(135deg, rgba(12, 98, 144, 0.06), rgba(79, 177, 221, 0.14));
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--chip);
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 14px 0 12px;
        font-size: clamp(32px, 4.2vw, 52px);
        line-height: 1.06;
      }

      .hero p {
        margin: 0;
        max-width: 840px;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.75;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #0f7db5, #1697c7);
        color: white;
        padding: 12px 18px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(15, 125, 181, 0.22);
        transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
      }

      button.secondary {
        background: rgba(255, 255, 255, 0.82);
        color: var(--accent-strong);
        border: 1px solid rgba(15, 125, 181, 0.18);
        box-shadow: none;
      }

      button:hover {
        transform: translateY(-1px);
      }

      .meta-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin: 22px 0 10px;
      }

      .meta-card {
        padding: 16px 18px;
        border-radius: 16px;
        border: 1px solid rgba(15, 53, 86, 0.08);
        background: rgba(255, 255, 255, 0.72);
      }

      .meta-card strong {
        display: block;
        font-size: 13px;
        color: var(--muted);
      }

      .meta-card span {
        display: block;
        margin-top: 6px;
        font-size: 22px;
        font-weight: 800;
      }

      .group {
        margin-top: 28px;
      }

      .group-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-end;
        margin-bottom: 14px;
      }

      .group-head h2 {
        margin: 0;
        font-size: 24px;
      }

      .group-head p {
        margin: 8px 0 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .group-chip {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(22, 136, 184, 0.12);
        color: var(--accent-strong);
        font-size: 13px;
        font-weight: 700;
      }

      .doc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
      }

      .doc-card {
        border-radius: var(--radius);
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.65);
        box-shadow: var(--shadow);
        overflow: hidden;
        backdrop-filter: blur(12px);
      }

      .doc-summary {
        padding: 20px 20px 18px;
      }

      .doc-topline {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .doc-index {
        display: inline-flex;
        min-width: 44px;
        justify-content: center;
        align-items: center;
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(15, 125, 181, 0.1);
        color: var(--accent-strong);
        font-size: 13px;
        font-weight: 800;
      }

      .doc-summary h3 {
        margin: 0;
        font-size: 19px;
        line-height: 1.35;
      }

      .doc-summary p {
        margin: 12px 0 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .doc-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }

      .doc-tag {
        display: inline-flex;
        align-items: center;
        padding: 7px 11px;
        border-radius: 999px;
        background: rgba(15, 53, 86, 0.06);
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .doc-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }

      .doc-actions button {
        flex: 1;
      }

      .doc-actions a {
        flex: 1;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        padding: 12px 16px;
        border-radius: 999px;
        text-decoration: none;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(15, 125, 181, 0.16);
        color: var(--accent-strong);
        font-weight: 700;
      }

      .doc-body {
        padding: 0 20px 20px;
        border-top: 1px solid var(--line);
        background: var(--panel-strong);
      }

      .doc-body[hidden] {
        display: none;
      }

      .doc-body-inner {
        padding-top: 18px;
      }

      .doc-body h1,
      .doc-body h2,
      .doc-body h3,
      .doc-body h4 {
        margin: 20px 0 10px;
        line-height: 1.35;
      }

      .doc-body h1 {
        font-size: 24px;
      }

      .doc-body h2 {
        font-size: 20px;
      }

      .doc-body h3 {
        font-size: 17px;
      }

      .doc-body h4 {
        font-size: 15px;
      }

      .doc-body p,
      .doc-body li,
      .doc-body blockquote {
        line-height: 1.8;
      }

      .doc-body ul,
      .doc-body ol {
        margin: 10px 0 14px 20px;
        padding: 0;
      }

      .doc-body li + li {
        margin-top: 6px;
      }

      .doc-body code {
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(15, 53, 86, 0.08);
        font-family: Consolas, "Courier New", monospace;
        font-size: 0.95em;
      }

      .doc-body pre {
        margin: 14px 0;
        padding: 16px;
        overflow-x: auto;
        border-radius: 16px;
        background: #10283a;
        color: #e8f5ff;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
      }

      .doc-body pre code {
        padding: 0;
        background: transparent;
        color: inherit;
      }

      .doc-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0 18px;
        overflow: hidden;
        border-radius: 14px;
        box-shadow: inset 0 0 0 1px rgba(15, 53, 86, 0.08);
      }

      .doc-body th,
      .doc-body td {
        padding: 12px 12px;
        text-align: left;
        border-bottom: 1px solid rgba(15, 53, 86, 0.08);
        vertical-align: top;
      }

      .doc-body th {
        background: rgba(15, 125, 181, 0.09);
      }

      .doc-body blockquote {
        margin: 14px 0;
        padding: 14px 16px;
        border-left: 4px solid rgba(15, 125, 181, 0.45);
        border-radius: 0 14px 14px 0;
        background: rgba(15, 125, 181, 0.08);
        color: var(--text);
      }

      .footer {
        margin-top: 32px;
        padding: 18px 22px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.78);
        color: var(--muted);
        line-height: 1.7;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100% - 20px, 1180px);
          padding-top: 18px;
          padding-bottom: 36px;
        }

        .hero {
          padding: 22px 18px;
          border-radius: 24px;
        }

        .doc-summary,
        .doc-body {
          padding-left: 16px;
          padding-right: 16px;
        }

        .doc-actions {
          flex-direction: column;
        }

        .doc-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(intro)}</p>
        <div class="toolbar">
          <button type="button" data-action="expand-all">展开全部</button>
          <button type="button" class="secondary" data-action="collapse-all">收起全部</button>
        </div>
        <div class="meta-strip">
          <article class="meta-card">
            <strong>收录文档</strong>
            <span>${cards.length}</span>
          </article>
          <article class="meta-card">
            <strong>分组板块</strong>
            <span>${groups.length}</span>
          </article>
          <article class="meta-card">
            <strong>阅读方式</strong>
            <span>先总览再展开</span>
          </article>
        </div>
      </section>
      ${groups
        .map((group) => {
          const members = cards.filter((card) => group.files.includes(card.file));
          return `<section class="group">
        <div class="group-head">
          <div>
            <h2>${escapeHtml(group.title)}</h2>
            <p>${escapeHtml(group.description)}</p>
          </div>
          <span class="group-chip">${members.length} 份文档</span>
        </div>
        <div class="doc-grid">
          ${members.map((card) => card.html).join("\n")}
        </div>
      </section>`;
        })
        .join("\n")}
      <section class="footer">
        页面由 <code>tools/build-doc-overviews.mjs</code> 生成。每个卡片都保留原始 Markdown 文件入口，便于在总览和原文之间来回切换。
      </section>
    </main>
    <script>
      const detailPanels = Array.from(document.querySelectorAll("[data-detail]"));
      const toggleButtons = Array.from(document.querySelectorAll("[data-toggle]"));

      function setExpanded(id, expanded) {
        const panel = document.querySelector('[data-detail="' + id + '"]');
        const button = document.querySelector('[data-toggle="' + id + '"]');
        if (!panel || !button) return;
        panel.hidden = !expanded;
        button.setAttribute("aria-expanded", String(expanded));
        button.textContent = expanded ? "收起内容" : "展开内容";
      }

      toggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-toggle");
          const expanded = button.getAttribute("aria-expanded") === "true";
          setExpanded(id, !expanded);
        });
      });

      document.querySelector('[data-action="expand-all"]')?.addEventListener("click", () => {
        detailPanels.forEach((panel) => setExpanded(panel.getAttribute("data-detail"), true));
      });

      document.querySelector('[data-action="collapse-all"]')?.addEventListener("click", () => {
        detailPanels.forEach((panel) => setExpanded(panel.getAttribute("data-detail"), false));
      });
    </script>
  </body>
</html>`;

  fs.writeFileSync(path.join(docsDir, filename), html, "utf8");
}

function buildDocsHome() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>雷霆 UNOplus 文档总览</title>
    <style>
      :root {
        --bg-top: #f7fbfd;
        --bg-bottom: #e6eff5;
        --panel: rgba(255, 255, 255, 0.9);
        --panel-strong: rgba(255, 255, 255, 0.96);
        --text: #17344b;
        --muted: #56738a;
        --line: rgba(17, 57, 84, 0.1);
        --accent: #0c79af;
        --accent-strong: #084f76;
        --shadow: 0 22px 54px rgba(16, 49, 74, 0.14);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        color: var(--text);
        background:
          radial-gradient(circle at 15% 18%, rgba(84, 187, 228, 0.24), transparent 26%),
          radial-gradient(circle at 85% 12%, rgba(10, 121, 175, 0.18), transparent 22%),
          linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .page {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 56px;
      }

      .hero {
        padding: 30px;
        border-radius: 30px;
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(232, 242, 247, 0.92)),
          linear-gradient(135deg, rgba(12, 121, 175, 0.06), rgba(78, 178, 223, 0.15));
        border: 1px solid rgba(255, 255, 255, 0.78);
        box-shadow: var(--shadow);
        backdrop-filter: blur(12px);
      }

      .eyebrow {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(12, 121, 175, 0.1);
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 14px 0 12px;
        font-size: clamp(34px, 4.6vw, 56px);
        line-height: 1.04;
      }

      .hero p {
        margin: 0;
        max-width: 860px;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.8;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-top: 22px;
      }

      .stat {
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.76);
        border: 1px solid rgba(17, 57, 84, 0.08);
      }

      .stat strong {
        display: block;
        font-size: 13px;
        color: var(--muted);
      }

      .stat span {
        display: block;
        margin-top: 6px;
        font-size: 24px;
        font-weight: 800;
      }

      .entry-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 18px;
        margin-top: 28px;
      }

      .entry-card {
        display: block;
        padding: 24px;
        border-radius: 24px;
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.75);
        box-shadow: var(--shadow);
        transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
      }

      .entry-card:hover {
        transform: translateY(-4px);
        border-color: rgba(12, 121, 175, 0.2);
        box-shadow: 0 28px 60px rgba(16, 49, 74, 0.16);
      }

      .entry-top {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
      }

      .entry-kicker {
        display: inline-flex;
        align-items: center;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(12, 121, 175, 0.1);
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 800;
      }

      .entry-count {
        font-size: 14px;
        color: var(--muted);
        font-weight: 700;
      }

      .entry-card h2 {
        margin: 16px 0 10px;
        font-size: 28px;
        line-height: 1.12;
      }

      .entry-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.8;
      }

      .entry-points {
        margin: 18px 0 0;
        padding: 0;
        list-style: none;
      }

      .entry-points li {
        position: relative;
        padding-left: 16px;
        color: var(--text);
        line-height: 1.8;
      }

      .entry-points li::before {
        content: "";
        position: absolute;
        left: 0;
        top: 12px;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: linear-gradient(135deg, #0c79af, #4ab5de);
      }

      .entry-action {
        margin-top: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, #0c79af, #1698c8);
        color: white;
        font-weight: 800;
        box-shadow: 0 12px 26px rgba(12, 121, 175, 0.22);
      }

      .sub-links {
        margin-top: 26px;
        padding: 20px 22px;
        border-radius: 20px;
        background: var(--panel-strong);
        box-shadow: var(--shadow);
      }

      .sub-links h3 {
        margin: 0 0 10px;
        font-size: 18px;
      }

      .sub-links p {
        margin: 0 0 14px;
        color: var(--muted);
        line-height: 1.75;
      }

      .sub-links ul {
        margin: 0;
        padding-left: 18px;
      }

      .sub-links li + li {
        margin-top: 8px;
      }

      .sub-links code {
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(17, 57, 84, 0.08);
        font-family: Consolas, "Courier New", monospace;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100% - 20px, 1180px);
          padding-top: 18px;
          padding-bottom: 36px;
        }

        .hero {
          padding: 22px 18px;
          border-radius: 24px;
        }

        .entry-card {
          padding: 20px 18px;
        }

        .entry-card h2 {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <span class="eyebrow">Docs Portal</span>
        <h1>雷霆 UNOplus 文档总览</h1>
        <p>把项目阶段记录和问题拆解放进同一个入口。适合先快速了解项目演进，再按需要进入具体 Phase 或 Problem 页面展开阅读。</p>
        <div class="stats">
          <article class="stat">
            <strong>Phase 文档</strong>
            <span>${phaseFiles.length}</span>
          </article>
          <article class="stat">
            <strong>Problem 文档</strong>
            <span>${problemFiles.length}</span>
          </article>
          <article class="stat">
            <strong>阅读方式</strong>
            <span>总览 + 展开</span>
          </article>
        </div>
      </section>

      <section class="entry-grid">
        <a class="entry-card" href="./phase-overview.html">
          <div class="entry-top">
            <span class="entry-kicker">Development Flow</span>
            <span class="entry-count">${phaseFiles.length} 份</span>
          </div>
          <h2>Phase 总览</h2>
          <p>按开发阶段串起项目脉络，适合快速看每一阶段做了什么、为什么这样做、下一步准备接什么。</p>
          <ul class="entry-points">
            <li>按基础架构、Web 转向、机器人与打磨分板块整理</li>
            <li>每份文档都有摘要、标签、展开内容和原文入口</li>
            <li>适合回看长期演进路线和里程碑成果</li>
          </ul>
          <span class="entry-action">进入 Phase 总览</span>
        </a>

        <a class="entry-card" href="./problem-overview.html">
          <div class="entry-top">
            <span class="entry-kicker">Issue Map</span>
            <span class="entry-count">${problemFiles.length} 份</span>
          </div>
          <h2>Problem 总览</h2>
          <p>按问题主题回看缺陷背景、修复方向和验收重点，适合定位曾经出现过的坑和当前规则边界。</p>
          <ul class="entry-points">
            <li>按规则修正、对战反馈、体验优化三段分组</li>
            <li>快速查看每个 Problem 的核心目标和详细内容</li>
            <li>适合修复回归、试玩复盘和需求核对</li>
          </ul>
          <span class="entry-action">进入 Problem 总览</span>
        </a>
      </section>

      <section class="sub-links">
        <h3>原始入口</h3>
        <p>如果你需要继续维护或重新生成这些页面，可以直接使用现有入口和脚本。</p>
        <ul>
          <li><a href="./项目开发文档.md"><code>docs/项目开发文档.md</code></a></li>
          <li><a href="./phase-overview.html"><code>docs/phase-overview.html</code></a></li>
          <li><a href="./problem-overview.html"><code>docs/problem-overview.html</code></a></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;

  fs.writeFileSync(path.join(docsDir, "index.html"), html, "utf8");
}

function buildDocCard(file, index) {
  const fullPath = path.join(docsDir, file);
  const markdown = fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
  const lines = markdown.split("\n");
  const title = findTitle(lines) || file;
  const summary = findSummary(lines);
  const tags = buildTags(file, markdown);
  const detailHtml = markdownToHtml(markdown);
  const id = `doc-${index + 1}`;

  return {
    file,
    html: `<article class="doc-card">
      <div class="doc-summary">
        <div class="doc-topline">
          <div>
            <div class="doc-index">${String(index + 1).padStart(2, "0")}</div>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <p>${escapeHtml(summary)}</p>
        <div class="doc-tags">
          ${tags.map((tag) => `<span class="doc-tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="doc-actions">
          <button type="button" data-toggle="${id}" aria-expanded="false">展开内容</button>
          <a href="./${encodeURIComponent(file)}">打开原文</a>
        </div>
      </div>
      <div class="doc-body" data-detail="${id}" hidden>
        <div class="doc-body-inner">
          ${detailHtml}
        </div>
      </div>
    </article>`
  };
}

function findTitle(lines) {
  const match = lines.find((line) => line.trim().startsWith("# "));
  return match ? match.replace(/^#\s+/, "").trim() : "";
}

function findSummary(lines) {
  for (const line of lines) {
    const text = line.trim();
    if (!text || text.startsWith("#") || text.startsWith("- ") || text.startsWith("|")) {
      continue;
    }
    return text.length > 120 ? `${text.slice(0, 118)}...` : text;
  }
  return "点击展开查看完整阶段记录、问题拆解和验收细节。";
}

function buildTags(file, markdown) {
  const tags = [];
  if (/^PHASE/i.test(file)) {
    const phaseMatch = file.match(/^(PHASE[0-9A-Z]+)/i);
    if (phaseMatch) {
      tags.push(phaseMatch[1]);
    }
  }
  if (/^Problem/i.test(file)) {
    tags.push(file.replace(".md", ""));
  }
  const lineCount = markdown.split("\n").filter((line) => line.trim() !== "").length;
  tags.push(`${lineCount} 行内容`);

  if (/验收|验证|测试/.test(markdown)) {
    tags.push("含测试/验收");
  }
  if (/下一阶段|后续|next/i.test(markdown)) {
    tags.push("含后续计划");
  }
  return tags.slice(0, 4);
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const fence = trimmed.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      const langClass = fence ? ` class="language-${escapeHtmlAttr(fence)}"` : "";
      html.push(`<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#{1,6}\s+/, "");
      html.push(`<h${level}>${inlineMarkdown(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${quoteLines.map((entry) => inlineMarkdown(entry)).join("<br />")}</blockquote>`);
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }

    if (/^(\-|\*|\+)\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^(\-|\*|\+)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(\-|\*|\+)\s+/, ""));
        i += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraphLines = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith("```") ||
        /^#{1,6}\s+/.test(next) ||
        next.startsWith(">") ||
        next.startsWith("|") ||
        /^(\-|\*|\+)\s+/.test(next) ||
        /^\d+\.\s+/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return html.join("\n");
}

function renderTable(tableLines) {
  const rows = tableLines.map((line) =>
    line
      .slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((cell) => cell.trim())
  );

  const filtered = rows.filter((row, index) => {
    if (index !== 1) {
      return true;
    }
    return !row.every((cell) => /^:?-{3,}:?$/.test(cell));
  });

  if (filtered.length === 0) {
    return "";
  }

  const [head, ...body] = filtered;
  return `<table>
    <thead>
      <tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>`;
}

function inlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safeHref = escapeHtmlAttr(href);
    return `<a href="${safeHref}">${label}</a>`;
  });
  return output;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function comparePhaseFiles(left, right) {
  return comparePhaseTokens(tokenizePhaseFile(left), tokenizePhaseFile(right));
}

function tokenizePhaseFile(name) {
  const match = name.match(/^PHASE(\d+)([A-Z]?)(?:-.*)?(?:-(\d+)\.(\d+)\.(\d+))?\.md$/i);
  if (!match) {
    return { stage: Number.MAX_SAFE_INTEGER, branch: "Z", version: [999, 999, 999], name };
  }
  return {
    stage: Number(match[1]),
    branch: match[2] || "",
    version: [Number(match[3] || 0), Number(match[4] || 0), Number(match[5] || 0)],
    name
  };
}

function comparePhaseTokens(left, right) {
  if (left.stage !== right.stage) {
    return left.stage - right.stage;
  }
  if (left.branch !== right.branch) {
    return left.branch.localeCompare(right.branch);
  }
  for (let index = 0; index < left.version.length; index += 1) {
    if (left.version[index] !== right.version[index]) {
      return left.version[index] - right.version[index];
    }
  }
  return left.name.localeCompare(right.name);
}

function compareProblemFiles(left, right) {
  return extractProblemNumber(left) - extractProblemNumber(right);
}

function extractProblemNumber(name) {
  const match = name.match(/^Problem(\d+)\.md$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

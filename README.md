# 情侣飞行棋

一个本地可运行、可部署到 GitHub Pages 的 React + TypeScript 情侣飞行棋网页游戏。

## 本地运行

```bash
npm install
npm run dev
```

打开终端里显示的本地地址即可游玩。手机和电脑在同一局域网时，可以用电脑局域网 IP 加端口在手机浏览器打开。

## 构建

```bash
npm run build
```

构建产物在 `dist/`。`vite.config.ts` 已设置 `base: "./"`，适合部署到 GitHub Pages 的仓库页面。

## 配置任务

主要任务内容在 `src/tasks.md` 中，每条任务就是一个 Markdown bullet point：

```md
- 面对面抱住 30 秒，过程中不能看手机。
- 亲吻对方手背，并说一句今天最喜欢对方的话。
```

网页会按任务条数生成同样数量的棋格。开局或点击“重新洗牌开局”时，会读取这些任务、随机洗牌，并按格号放入棋盘。

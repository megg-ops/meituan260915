# 周末出发 WeekendGO · 周末城市探索指南

美团 AI Coding 笔试作品。线上地址：**https://megg-ops.github.io/meituan260915/**

## 产品结构

```
周末出发 WeekendGO
├─ 🧭 逛逛（决策层）  城市偏好/预算/同行人数 + 模拟天气 → 匹配度实时排序
├─ 🤝 组队（履约层）  组队大厅、一键加入/退出、从活动发起组队
├─ 📍 打卡（留存层）  心情/感想/花费记录 + 周末统计面板
└─ 📝 攻略（生态层）  攻略广场、点赞、UGC 发布
```

推荐逻辑：匹配度 = 兴趣 35% + 天气 25% + 预算 20% + 同行 20%，每张卡片展示推荐理由。

- 右上角「ℹ️ 说明」：面向评审的产品说明（痛点 / 功能架构 / 推荐逻辑 / 迭代计划）
- 纯前端单文件实现（`index.html`），数据为内置 Mock + localStorage 持久化
- 页签支持 hash 深链：`/#team`、`/#checkin`、`/#guide`

## 48h 迭代流程

修改 `index.html` 后：

```bash
git add index.html && git commit -m "..."
git push origin main main:gh-pages
```

Pages 若未自动重建，手动触发：

```bash
gh api repos/megg-ops/meituan260915/pages/builds -X POST
```

域名固定不变（`megg-ops.github.io/meituan260915/`），可直接继续迭代。

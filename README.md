# 周末出发 WeekendGO · 周末城市探索指南

美团 AI Coding 笔试作品。线上地址：**https://megg-ops.github.io/meituan260915/**

帮大学生找到这周末去哪，并把每一次城市探索变成一张可以收藏的地点票根。

## 核心链路

```
感到周末临近 → 3 个明确推荐 → 地点详情 → 加入周末计划 → 主动确认到访 → 地点票根 → 我的收集
```

## 产品结构

```
周末出发 WeekendGO
├─ 周末  倒计时 + 当前天气（演示）+ 城市探索示意图 + 地点卡 + 3 个推荐
│        地点详情：推荐理由、攻略、结伴入口、加入计划 / 确认打卡
├─ 组队  同城队伍、加入 / 退出、从地点发起组队
├─ 收集  地点票根、重复到访记录、未解锁地点
└─ 我的  出游伙伴（可命名、可关闭）、周末偏好、城市、产品与数据说明
```

- 推荐逻辑：匹配度 = 兴趣 35% + 天气 25% + 预算 20% + 同行 20%，每个推荐写明理由。
- 打卡由用户主动确认，点击地图地点不算到访；伙伴只在打卡后移动到该地点。
- 票根保存打卡时的日期、天气与伙伴；同一地点再次到访记为同一张票根的新记录。
- 天气四态（晴 / 多云 / 雨 / 雪）+ 未知；小雨最多 14 条短雨滴、小雪最多 12 颗柔和雪点，错峰飘落。天气面板可关闭动态，尊重系统减少动态设置，后台暂停动画。
- 杭州、北京、上海、广州、深圳均有 B 稿手绘动画风探索示意图与可点击地点；地图不用于真实导航。
- 橘猫采用正面、身体轻微侧转的自然坐姿。新票根保存对应城市取景与伙伴图片版本，已有票根保留旧素材。
- 除西湖独立插画外，其余地点票根暂取景自城市地图，并非每个地点都已单独绘制。
- 活动、天气、队伍与攻略为演示数据；个人数据只保存在本机 localStorage。

## 文件

```
index.html   页面骨架与共享 SVG 图标
styles.css   设计令牌、布局、票根与天气主题
data.js      城市、活动、队伍、攻略演示数据
app.js       页面状态、推荐、打卡与收集交互
assets/      探索示意图、地点票根插画、伙伴角色
```

纯静态前端，无构建步骤、无第三方依赖。页签支持 hash 深链：`/#team`、`/#collect`、`/#me`。

## 本地运行

```bash
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost python3 -m http.server 8000 --bind 127.0.0.1
```

浏览器访问 `http://localhost:8000/`，修改后刷新即可。语法检查：`node --check app.js`、`node --check data.js`。

本地产品文档位于 `DOCS/PRD.md`，视觉约束见 `DOCS/VISUAL-SPEC.md`，生成提示词见 `DOCS/visual-assets/2026-09-16-generation-prompts.md`。注意：`DOCS/` 当前被 Git 忽略，交接需单独分享，不会随代码推送。

## 48h 迭代流程

修改后：

```bash
git add index.html styles.css data.js app.js assets README.md && git commit -m "..."
git push origin main main:gh-pages
```

Pages 若未自动重建，手动触发：

```bash
gh api repos/megg-ops/meituan260915/pages/builds -X POST
```

域名固定不变（`megg-ops.github.io/meituan260915/`），可直接继续迭代。

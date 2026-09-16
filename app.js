/* ================================================================
   周末拾光 · 页面状态与交互
   核心链路：看地图/推荐 → 地点卡 → 详情 → 主动确认到访 → 出票 → 我的收集
   点击地点只会选中，不会记为到访；伙伴位置只在主动打卡后移动
   ================================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

/* ---------------- 状态（localStorage 键 wg2，与旧版数据隔离） ---------------- */
const KEY = 'wg2';
const DEFAULTS = {
  city: '杭州', weather: 'sunny', weatherMotion: true,
  interests: ['walk', 'hike', 'exhibit', 'market'], budget: 200, crowd: 'solo',
  plan: [], tickets: [], collectSeen: {}, teams: null, joined: [],
  buddy: { on: true, name: '橘子' }, buddyAt: {}, demoProfile: null,
};
const S = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
})();
if (!S.teams) S.teams = JSON.parse(JSON.stringify(SEED_TEAMS));
if (!WEATHERS[S.weather]) S.weather = 'sunny';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 隐私模式下仅本次有效 */ } };

let sel = null;         // 地图上选中的地点，仅界面状态
let userPicked = false; // 选中来自用户点击还是默认推荐
let showAll = false;

/* 城市探索示意图：艺术化位置，不代表真实地理坐标 */
const MAPS = {
  杭州: { img: 'assets/map-hangzhou-sunny-v1.jpg', alt: '杭州周末探索示意图：山间步道、西湖、校园周边与街区', home: { x: 46, y: 40 } },
  北京: { img: 'assets/map-beijing-v1.jpg', alt: '北京探索示意图：香山、798、隆福寺与首钢园', home: { x: 48, y: 47 } },
  上海: { img: 'assets/map-shanghai-v1.jpg', alt: '上海探索示意图：苏州河、滨江美术馆、永康路与安义夜巷', home: { x: 35, y: 55 } },
  广州: { img: 'assets/map-guangzhou-v1.jpg', alt: '广州探索示意图：火炉山、广东省博物馆与珠江江畔', home: { x: 30, y: 57 } },
  深圳: { img: 'assets/map-shenzhen-v1.jpg', alt: '深圳探索示意图：华侨城、海上世界与梧桐山', home: { x: 22, y: 49 } },
};
/* 伙伴在各地点旁的位置（示意图百分比），落在岸上或路上 */
const BUDDY_SPOTS = { 18: { x: 17, y: 67 }, 15: { x: 13, y: 38 }, 19: { x: 58, y: 34 }, 17: { x: 72, y: 70 } };

const CAT_IMG = { idle: 'assets/companion-cat-idle-v2.png', happy: 'assets/companion-cat-happy-v1.png' };
const WX_WORD = { sunny: '晴天', cloudy: '多云', rain: '雨天', snow: '雪天', unknown: '天气未记录' };
const CROWD_WORD = { solo: '独自出发', duo: '两人同行', small: '3-5人同行', big: '大部队出发' };

const act = id => ACTS.find(a => a.id === +id);
const ticketOf = id => S.tickets.find(t => t.actId === +id);
const crowdName = id => CROWDS.find(c => c.id === id)?.name || '';
const placeName = a => a.place?.label || a.label || a.venue.split(/[—→·]/)[0].trim();
const priceText = p => (p === 0 ? '免费' : `¥${p}`);

/* ---------------- 周末倒计时（本地日期） ---------------- */
function weekendState(d = new Date()) {
  const day = d.getDay();
  const mark = '<span class="mark">一点快乐</span>';
  if (day === 0 || day === 6) return { title: `今天，去收集${mark}`, count: '周末进行中', flat: true };
  if (day === 5) return { title: `明天，去收集${mark}`, count: '明天就是周末', flat: true };
  return { title: `周末，去收集${mark}`, count: `距离周末还有<b>${6 - day}</b>天` };
}

/* ---------------- 推荐打分 ----------------
   匹配度 = 兴趣 35% + 天气 25% + 预算 20% + 同行 20%
   weatherFit: sunny 户外 / indoor 室内 / any 皆宜；天气 unknown 时不参与判断 */
function score(a) {
  const r = [];
  const likes = S.interests.includes(a.cat);
  if (likes) r.push({ t: `你喜欢${CATS[a.cat].name}` });
  const w = S.weather;
  let wx = 0.6;
  if (w !== 'unknown') {
    if (a.weatherFit === 'any') { wx = 0.85; r.push({ t: '晴雨都合适' }); }
    else if (a.weatherFit === 'sunny') {
      if (w === 'sunny') { wx = 1; r.push({ t: '晴天去正好' }); }
      else if (w === 'cloudy') { wx = 0.8; r.push({ t: '多云也舒服' }); }
      else { wx = 0.15; r.push({ t: '户外，今天天气不太合适', warn: true }); }
    } else if (w === 'rain' || w === 'snow') { wx = 1; r.push({ t: `室内，不怕${w === 'rain' ? '下雨' : '下雪'}` }); }
  }
  const inBudget = a.price <= S.budget || S.budget >= 500;
  r.push(inBudget ? { t: a.price === 0 ? '免费' : `¥${a.price} 在预算内` } : { t: `超出预算 ¥${a.price - S.budget}`, warn: true });
  const fits = a.crowd.includes(S.crowd);
  if (fits) r.push({ t: `适合${crowdName(S.crowd)}去` });
  const budget = inBudget ? 1 : Math.max(0.15, 1 - (a.price - S.budget) / 300);
  const value = Math.round(((likes ? 1 : 0.2) * 0.35 + wx * 0.25 + budget * 0.2 + (fits ? 1 : 0.3) * 0.2) * 100);
  const good = r.filter(x => !x.warn), bad = r.filter(x => x.warn).slice(0, 2);
  return { value, reasons: [...good.slice(0, 3 - bad.length), ...bad], all: r };
}
const reasonHTML = s => s.reasons.map(x => (x.warn ? `<span class="warn">${esc(x.t)}</span>` : esc(x.t))).join(' · ');
const ranked = () => ACTS.filter(a => a.city === S.city).map(a => ({ a, s: score(a) })).sort((x, y) => y.s.value - x.s.value);

/* ---------------- 插画：专属插画 / 示意图局部 / 通用画面 ---------------- */
function artOf(a) {
  if (a.art) return { type: 'img', src: a.art };
  if (a.place && MAPS[a.city]) return { type: 'map', src: MAPS[a.city].img, x: a.place.x, y: a.place.y };
  return { type: 'generic', cat: a.cat };
}
function artHTML(art, cls = '') {
  if (art.type === 'img') return `<div class="art ${cls}" style="background-image:url('${art.src}')"></div>`;
  if (art.type === 'map') return `<div class="art from-map ${cls}" style="background-image:url('${art.src || MAPS['杭州'].img}');background-position:${art.x}% ${art.y}%"></div>`;
  const hue = { walk: '#77BDB2', hike: '#417C65', exhibit: '#8FAFC2', market: '#DDA46B', cafe: '#BD9A78', show: '#D08C78', night: '#5B7FA0' }[art.cat] || '#77BDB2';
  return `<div class="art generic ${cls}"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="#EEF2EA"/><circle cx="71" cy="30" r="11" fill="#EDC777" opacity=".9"/><path d="M0 68Q24 48 50 61T100 55V100H0z" fill="${hue}" opacity=".5"/><path d="M0 82Q30 66 60 78T100 73V100H0z" fill="${hue}"/></svg></div>`;
}

/* ---------------- 渲染：周末 ---------------- */
function renderHeader() {
  const ws = weekendState();
  $('#heroTitle').innerHTML = ws.title;
  const c = $('#countdown');
  c.innerHTML = ws.count;
  c.classList.toggle('flat', !!ws.flat);
  $('#cityLabel').textContent = S.city;
  const w = WEATHERS[S.weather];
  document.body.dataset.weather = S.weather;
  document.body.dataset.weatherMotion = String(S.weatherMotion);
  $('#wxIcon').innerHTML = `<use href="#i-${S.weather}"/>`;
  $('#wxNow').textContent = `当前天气 · ${w.name}`;
  $('#wxTemp').textContent = w.temp === null ? '--' : `${w.temp}°C`;
}

/* 有限数量、固定错峰；重新选地点也不会随机闪烁。 */
function weatherParticles() {
  if (!['rain', 'snow'].includes(S.weather)) return '';
  const rain = S.weather === 'rain', count = rain ? 14 : 12;
  return Array.from({ length: count }, (_, i) => {
    const duration = rain ? 1.8 + (i % 4) * .3 : 10 + (i % 5) * 1.5;
    const size = rain ? 10 + i % 4 * 2 : 2 + i % 3;
    return `<i class="wx-particle" style="--x:${4 + i * 71 % 92}%;--size:${size}px;--duration:${duration}s;--delay:${-(i * 1.73 % duration).toFixed(2)}s;--drift:${rain ? -35 : (i % 2 ? 22 : -18)}px;--alpha:${rain ? .25 + i % 3 * .08 : .45 + i % 3 * .15}"></i>`;
  }).join('');
}

function renderScene() {
  const map = MAPS[S.city];
  const scene = $('#scene');
  $('#spot').classList.toggle('flat', !map);
  if (!map) {
    scene.innerHTML = `<div class="scene-empty"><p><b>${esc(S.city)}的探索示意图还在绘制中</b>先看看下面为你挑的去处，打卡同样会生成票根。</p>
      <svg class="hills" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 44Q80 12 170 36T400 26V70H0z" fill="#77BDB2" opacity=".35"/><path d="M0 58Q110 36 220 52T400 48V70H0z" fill="#417C65" opacity=".45"/></svg></div>`;
    return;
  }
  const pins = ACTS.filter(a => a.city === S.city && a.place).map(a => {
    const on = a.id === sel, visited = !!ticketOf(a.id);
    return `<button class="pin${on ? ' sel' : ''}${visited ? ' visited' : ''}" style="left:${a.place.x}%;top:${a.place.y}%" data-act="pick" data-id="${a.id}" aria-pressed="${on}" aria-label="${esc(a.place.label)}${visited ? '，已打卡' : ''}">
      <svg class="flag"><use href="#i-pin"/></svg><i class="dot"></i><i class="done"><svg><use href="#i-check"/></svg></i>${esc(a.place.label)}</button>`;
  }).join('');
  let buddy = '';
  if (S.buddy.on) {
    const at = S.buddyAt[S.city];
    const place = act(at)?.place;
    const p = (at && BUDDY_SPOTS[at]) || (place && { x: place.x + 8, y: place.y + 10 }) || map.home;
    const solo = S.crowd === 'solo';
    buddy = `<img class="buddy${solo ? ' solo' : ''}" src="${CAT_IMG.idle}" alt="" style="left:${p.x}%;top:${p.y}%">
      ${solo ? `<span class="buddy-name" style="left:${p.x}%;top:${p.y}%">${esc(S.buddy.name)}</span>` : ''}`;
  }
  scene.innerHTML = `<div class="map-crop"><div class="map-inner">
      <img class="map-img" src="${map.img}" alt="${esc(map.alt)}">
      <div class="wx-layer" aria-hidden="true">${weatherParticles()}</div>${buddy}${pins}
    </div>
    ${S.weather === 'unknown' ? '<span class="wx-off">天气暂不可用</span>' : ''}
    <span class="map-note">探索示意图 · 位置不精确</span></div>`;
}

function renderSpot() {
  const list = ranked();
  if (!list.length) { $('#spot').innerHTML = ''; return; }
  if (!act(sel) || act(sel).city !== S.city) { sel = list[0].a.id; userPicked = false; }
  const a = act(sel), s = score(a), t = ticketOf(a.id);
  const rank = list.slice(0, 3).findIndex(x => x.a.id === a.id);
  const eyebrow = t ? `<span class="stamped">已打卡 · 去过 ${t.visits.length} 次</span>`
    : rank >= 0 ? `本周推荐 · 第 ${rank + 1} 个` : userPicked ? '你选中的地点' : '推荐';
  $('#spot').innerHTML = `<article class="spot-card" aria-live="polite">
    ${artHTML(artOf(a))}
    <div class="spot-body">
      <p class="eyebrow">${eyebrow}</p>
      <h3>${esc(a.title)}</h3>
      <p class="meta">${priceText(a.price)} · ${esc(a.duration || a.time)}</p>
      <p class="reason">${reasonHTML(s)}</p>
    </div>
    <div class="spot-act"><button class="btn primary" data-act="detail" data-id="${a.id}">看看这里</button></div>
  </article>`;
}

function renderPlan() {
  const items = S.plan.map(act).filter(a => a && a.city === S.city && !ticketOf(a.id));
  const el = $('#planBlock');
  el.hidden = !items.length;
  if (!items.length) return;
  el.innerHTML = `<div class="block-head"><h2>我的周末计划</h2><span class="eyebrow">${items.length} 个</span></div>
    <div class="plan-row">${items.map(a => `<button class="plan-item" data-act="detail" data-id="${a.id}">${artHTML(artOf(a))}<span>${esc(placeName(a))}<small>到了记得打卡</small></span></button>`).join('')}</div>`;
}

function renderRecs() {
  const list = ranked();
  const shown = showAll ? list : list.slice(0, 3);
  $('#recNote').textContent = S.weather === 'unknown'
    ? '天气暂不可用，这次推荐不考虑天气'
    : `按你的偏好和当前天气（演示）排序 · 出行日预报暂未接入`;
  $('#recList').innerHTML = shown.map(({ a, s }, i) => `
    <button class="rec" data-act="detail" data-id="${a.id}">
      ${artHTML(artOf(a))}
      <span><span class="rec-t">${i < 3 ? `<span class="rank">${i + 1}</span>` : ''}${esc(a.title)}${ticketOf(a.id) ? '<span class="tag-visited">已打卡</span>' : ''}</span>
      <span class="meta">${priceText(a.price)} · ${esc(a.duration || a.time)}</span>
      <span class="reason">${reasonHTML(s)}</span></span>
      <svg><use href="#i-chev"/></svg>
    </button>`).join('');
  const more = $('#moreBtn');
  more.hidden = list.length <= 3;
  more.textContent = showAll ? '收起' : `再看 ${list.length - 3} 个`;
}

/* ---------------- 渲染：组队 ---------------- */
const FACE_COLORS = ['#417C65', '#5E9E93', '#D87843', '#6F8FA6', '#B8944F', '#8C7AA8'];
function renderTeams() {
  const list = S.teams.filter(t => act(t.actId)?.city === S.city);
  $('#teamSub').innerHTML = `${esc(S.city)} · ${list.length} 支队伍在约周末 <button class="link" data-act="teamForm" style="margin-left:6px">发起组队</button>`;
  $('#teamList').innerHTML = list.map(t => {
    const a = act(t.actId), joined = S.joined.includes(t.id), full = t.members.length >= t.cap;
    const faces = t.members.map((m, i) => `<span class="face" style="background:${FACE_COLORS[i % FACE_COLORS.length]}" title="${esc(m)}">${esc(m.slice(0, 1))}</span>`).join('')
      + Array.from({ length: Math.max(0, t.cap - t.members.length) }, () => '<span class="face empty-seat">+</span>').join('');
    return `<article class="team">
      <div class="team-top"><div><h3>${esc(t.title)}</h3><p class="for">去 ${esc(a.title)}</p></div>
        <span class="slots${full ? ' full' : ''}">${full ? '已满员' : `还差 ${t.cap - t.members.length} 人`}</span></div>
      <div class="team-info"><div><span>集合</span> ${esc(t.time)} · ${esc(t.meet)}</div><div><span>备注</span> ${esc(t.note)}</div></div>
      <div class="team-bottom"><div class="faces">${faces}</div>
        <button class="btn ${joined ? 'joined' : 'primary'}" data-act="join" data-id="${t.id}" ${full && !joined ? 'disabled' : ''}>${joined ? '已加入 · 退出' : full ? '已满员' : '加入'}</button></div>
    </article>`;
  }).join('') || `<p class="team-empty">${esc(S.city)}暂时没有队伍。<br>在地点详情里可以为它发起一支。</p>`;
}

/* ---------------- 渲染：收集 ---------------- */
function renderCollect() {
  const ts = [...S.tickets].sort((x, y) => y.visits.at(-1).ts - x.visits.at(-1).ts);
  const visits = ts.reduce((n, t) => n + t.visits.length, 0);
  const cities = new Set(ts.map(t => t.city)).size;
  $('#collectSub').textContent = ts.length ? `${ts.length} 张周末票根 · 到访 ${visits} 次 · ${cities} 座城市` : '去过的地方，会变成一张张票根';
  const locked = ACTS.filter(a => a.city === S.city && a.place && !ticketOf(a.id));
  const lockedHTML = locked.length ? `<p class="shelf-title">${esc(S.city)}还没收集的地点</p><div class="shelf">${locked.map(a => `
    <button class="mini locked" data-act="detail" data-id="${a.id}">${artHTML(artOf(a))}<b>${esc(a.place.label)}</b><small>未解锁 · 去看看</small></button>`).join('')}</div>` : '';
  const shelf = ts.length ? `<div class="shelf">${ts.map(t => {
    const d = new Date(t.visits.at(-1).ts);
    return `<button class="mini${t.visits.length > 1 ? ' stack' : ''}" data-act="ticket" data-id="${t.actId}">${artHTML(t.art)}
      ${t.visits.length > 1 ? `<span class="times">×${t.visits.length}</span>` : ''}
      <b>${esc(t.place)}</b><small>${esc(t.city)} · ${d.getMonth() + 1}月${d.getDate()}日</small></button>`;
  }).join('')}</div>` : `<div class="empty"><img src="${CAT_IMG.idle}" alt=""><b>还没有票根</b><p>去一个地方，回来主动确认到访，<br>就能收下第一张。</p><button class="btn primary" data-act="tab" data-id="weekend">去找周末去处</button></div>`;
  $('#collectBody').innerHTML = shelf + lockedHTML;
  renderCollectBadge();
}

function renderCollectBadge() {
  const unread = S.tickets.filter(t => t.visits.length > (S.collectSeen?.[t.actId] || 0)).length;
  const badge = document.querySelector('[data-tab="collect"] .badge');
  if (unread && !badge) document.querySelector('[data-tab="collect"]').insertAdjacentHTML('beforeend', `<span class="badge" aria-label="${unread} 张票根有新记录">${unread}</span>`);
  else if (badge) {
    if (!unread) badge.remove();
    else { badge.textContent = unread; badge.setAttribute('aria-label', `${unread} 张票根有新记录`); }
  }
}

/* ---------------- 渲染：我的 ---------------- */
function renderMe() {
  const on = S.buddy.on;
  const ints = S.interests.map(k => CATS[k]?.name).filter(Boolean).join('、') || '未选择';
  const profile = S.demoProfile;
  $('#meBody').innerHTML = `
    <section class="me-card" aria-label="演示身份">
      <div class="profile-heading">
        <span class="profile-avatar" aria-hidden="true"><svg><use href="#i-me"/></svg></span>
        <div><b>${profile ? esc(profile.nickname) : '你好，拾光旅人'}</b>
          <p>${profile ? '已登录 · 本机演示身份' : '游客模式 · 自在探索，无需登录'}</p></div>
      </div>
      <p class="profile-note">${profile ? `${esc(profile.email)}<br>票根和计划仍保存在当前浏览器，不会云端同步。` : '用一个演示身份，体验你的拾光档案。游客也能计划、打卡和收集。'}</p>
      <div class="profile-actions">${profile
        ? '<button class="btn ghost" data-act="demoLogout">退出登录</button>'
        : '<button class="btn primary" data-act="demoAuth" data-id="login">登录</button><button class="btn ghost" data-act="demoAuth" data-id="register">注册</button>'}</div>
    </section>
    <section class="me-card">
      <h3>出游伙伴<button class="switch" role="switch" aria-checked="${on}" aria-label="显示出游伙伴" data-act="toggleBuddy"></button></h3>
      <div class="buddy-row${on ? '' : ' off'}">
        <img src="${CAT_IMG.idle}" alt="橘白小猫">
        <div style="flex:1;min-width:0">
          <input class="input" id="buddyName" maxlength="6" value="${esc(S.buddy.name)}" aria-label="伙伴名字" ${on ? '' : 'disabled'}>
          <p>${on ? '独自出发时它会陪在地图上，打卡时一起出现在票根里。' : '已关闭，所有功能照常可用。以前的票根保留当时的伙伴。'}</p>
        </div>
      </div>
    </section>
    <section class="me-card">
      <h3>周末偏好</h3>
      <button class="me-row" data-act="pref">兴趣<span>${esc(ints)}<svg><use href="#i-chev"/></svg></span></button>
      <button class="me-row" data-act="pref">预算上限<span>${S.budget >= 500 ? '不设上限' : `¥${S.budget}`}<svg><use href="#i-chev"/></svg></span></button>
      <button class="me-row" data-act="pref">同行方式<span>${esc(crowdName(S.crowd))}<svg><use href="#i-chev"/></svg></span></button>
      <button class="me-row" data-act="city">所在城市<span>${esc(S.city)}<svg><use href="#i-chev"/></svg></span></button>
    </section>
    <section class="me-card">
      <h3>关于</h3>
      <button class="me-row" data-act="about">产品说明<span><svg><use href="#i-chev"/></svg></span></button>
      <button class="me-row" data-act="dataNote">数据说明<span>演示数据 · 本机保存<svg><use href="#i-chev"/></svg></span></button>
      <button class="me-row danger" data-act="reset">清空本机数据<span></span></button>
    </section>`;
  const input = $('#buddyName');
  input.addEventListener('change', () => {
    S.buddy.name = input.value.trim() || '橘子';
    input.value = S.buddy.name;
    save(); renderScene();
    toast(`伙伴改名为「${S.buddy.name}」`);
  });
}

/* 仅演示身份切换：密码只做表单校验，不保存、不上传、不验证真实账号。 */
function openDemoAuth(mode = 'login') {
  const register = mode === 'register';
  openSheet(`
    <h2>${register ? '认识一下，拾光旅人' : '欢迎回到周末拾光'}</h2>
    <p class="lead">${register ? '创建一个本机演示身份，继续收集周末。' : '登录你的演示身份，继续这段小旅行。'}</p>
    <p class="honest" id="authNotice">功能演示，不验证真实账号。请勿输入真实密码。填写格式正确的演示邮箱与至少 6 位测试密码即可体验；密码不保存、不发送。记录仅保存在你正在使用的浏览器中，不会上传。仅在同一浏览器内切换演示身份时，票根和计划保持不变。</p>
    <form id="demoAuthForm" class="demo-auth" aria-describedby="authNotice" autocomplete="off">
      ${register ? '<div class="field"><label for="authNickname">怎么称呼你</label><input class="input" id="authNickname" maxlength="12" required placeholder="例如：周末散步员" autocomplete="off"></div>' : ''}
      <div class="field"><label for="authEmail">演示邮箱</label><input class="input" id="authEmail" type="email" maxlength="100" required placeholder="traveler@example.com" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
      <div class="field"><label for="authPassword">测试密码（至少 6 位）</label><input class="input" id="authPassword" type="password" minlength="6" maxlength="72" required placeholder="请勿使用真实密码" autocomplete="new-password"></div>
      <div class="d-actions"><button class="btn primary wide" type="submit">${register ? '注册并进入（演示）' : '登录（演示）'}</button></div>
    </form>
    <div class="auth-links"><button class="link" data-act="demoAuth" data-id="${register ? 'login' : 'register'}">${register ? '已有演示身份？登录' : '还没试过？注册'}</button>
      <button class="link" data-act="close">以游客身份继续</button></div>`, register ? '模拟注册' : '模拟登录');
  const form = $('#demoAuthForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const nickname = $('#authNickname');
    if (nickname) {
      nickname.setCustomValidity(nickname.value.trim() ? '' : '请填写一个昵称');
      nickname.oninput = () => nickname.setCustomValidity('');
    }
    if (!form.reportValidity()) return;
    const email = $('#authEmail').value.trim().toLowerCase();
    const previousName = S.demoProfile?.email === email ? S.demoProfile.nickname : null;
    S.demoProfile = { email, nickname: nickname ? nickname.value.trim() : previousName || email.split('@')[0].slice(0, 12) };
    // 清空密码后才保存身份，存储对象从不包含密码字段。
    $('#authPassword').value = '';
    let persisted = true;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { persisted = false; }
    closeSheet(); renderMe();
    toast(persisted ? '已进入演示身份，原有票根和计划都还在' : '已进入演示身份；浏览器禁用存储，本次关闭后不保留');
  });
}

function renderAll() {
  renderHeader(); renderScene(); renderSpot(); renderPlan(); renderRecs();
  renderTeams(); renderCollect(); renderMe();
}

/* ---------------- 底部面板 ---------------- */
let lastFocus = null;
function openSheet(html, label) {
  window.disposeTicketShare?.();
  lastFocus = document.activeElement;
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="grip"></div><button class="sheet-close" data-act="close" aria-label="关闭"><svg><use href="#i-close"/></svg></button>${html}`;
  sheet.setAttribute('aria-label', label || '详情');
  sheet.scrollTop = 0;
  $('#mask').hidden = false;
  document.body.style.overflow = 'hidden';
  sheet.querySelector('.sheet-close').focus({ preventScroll: true });
}
function closeSheet() {
  window.disposeTicketShare?.();
  const password = $('#authPassword');
  if (password) password.value = '';
  $('#mask').hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus?.({ preventScroll: true });
}

function openDetail(id) {
  const a = act(id), s = score(a), t = ticketOf(id), inPlan = S.plan.includes(a.id);
  const guides = GUIDES.filter(g => g.city === a.city && g.cats.includes(a.cat)).concat(GUIDES.filter(g => !g.city)).slice(0, 2);
  const teams = S.teams.filter(x => x.actId === a.id);
  const fit = { sunny: '户外，晴天更舒服', indoor: '室内，不怕雨雪', any: '晴雨都合适' }[a.weatherFit];
  let actions, hint = '';
  if (t) {
    actions = `<button class="btn ghost" data-act="ticket" data-id="${a.id}">查看票根</button><button class="btn primary" data-act="checkin" data-id="${a.id}">再记录一次到访</button>`;
    hint = `这里已在你的收集中，去过 ${t.visits.length} 次。再次到访不会算作新地点。`;
  } else if (inPlan) {
    actions = `<button class="btn ghost" data-act="plan" data-id="${a.id}">移出计划</button><button class="btn primary" data-act="checkin" data-id="${a.id}">我到了，确认打卡</button>`;
    hint = '已在周末计划里。到了之后回来确认打卡，就能收下这里的票根。';
  } else {
    actions = `<button class="btn ghost" data-act="checkin" data-id="${a.id}">我已到过，打卡</button><button class="btn primary" data-act="plan" data-id="${a.id}">加入周末计划</button>`;
  }
  openSheet(`
    ${artHTML(artOf(a), 'd-hero')}
    <p class="eyebrow">${esc(a.city)} · ${esc(CATS[a.cat].name)}${a.place && MAPS[a.city] ? ' · 示意图上的「' + esc(a.place.label) + '」' : ''}</p>
    <h2>${esc(a.title)}</h2>
    <p class="d-desc">${esc(a.desc)}</p>
    <dl class="facts">
      <div><dt>时间</dt><dd>${esc(a.time)}</dd></div>
      <div><dt>地点</dt><dd>${esc(a.venue)}<small>${esc(a.area)}${a.transit ? ' · ' + esc(a.transit) : ''}</small></dd></div>
      <div><dt>费用</dt><dd>${a.price === 0 ? '免费' : `约 ¥${a.price}/人`}</dd></div>
      <div><dt>适合</dt><dd>${a.crowd.map(crowdName).join(' / ')}</dd></div>
      <div><dt>天气</dt><dd>${fit}<small>按当前天气（演示）判断，出行日预报暂未接入</small></dd></div>
    </dl>
    <div class="d-sec d-why"><h4>为什么推荐给你</h4><ul>${s.all.map(x => `<li class="${x.warn ? 'warn' : ''}">${esc(x.t)}</li>`).join('')}</ul></div>
    ${guides.length ? `<div class="d-sec"><h4>同学写的攻略</h4>${guides.map(g => `<div class="guide"><b>${esc(g.title)}</b><p>${esc(g.body)}</p><small>${esc(g.author)} · ${g.likes} 人觉得有用（演示）</small></div>`).join('')}</div>` : ''}
    <div class="d-sec"><h4>结伴</h4><p class="lead">${teams.length ? `有 ${teams.length} 支队伍在约这里。` : '还没有人为这里组队。'}
      <button class="link" data-act="${teams.length ? 'goTeams' : 'teamForm'}" data-id="${a.id}">${teams.length ? '去看看' : '发起组队'}</button></p></div>
    ${hint ? `<p class="d-hint">${hint}</p>` : ''}
    <div class="d-actions">${actions}</div>`, a.title);
}

function togglePlan(id) {
  const i = S.plan.indexOf(+id);
  if (i >= 0) { S.plan.splice(i, 1); toast('已移出周末计划'); }
  else { S.plan.push(+id); toast('已加入周末计划，到了记得回来打卡'); }
  save(); renderPlan(); openDetail(id);
}

/* ---------------- 打卡：用户主动确认 ---------------- */
function openCheckin(id) {
  const a = act(id), t = ticketOf(id);
  openSheet(`
    <h2>确认你到了${esc(placeName(a))}？</h2>
    <p class="lead">${t ? `这里已在你的收集中。确认后会记下第 ${t.visits.length + 1} 次到访，不会算作新地点。` : '确认后会生成这里的票根，收进「我的收集」。'}</p>
    <p class="honest"><span><b>不读取定位。</b>只有你主动确认，才会记为到访。</span></p>
    <div class="field"><span class="label">这次怎么去的</span>
      <div class="seg" data-group="crowd">${CROWDS.map(c => `<button class="${c.id === S.crowd ? 'on' : ''}" data-val="${c.id}">${c.name}</button>`).join('')}</div></div>
    <div class="field"><label for="ciNote">留一句话 <span class="opt">可选</span></label>
      <input class="input" id="ciNote" maxlength="30" placeholder="好的周末会一直留在心里。"></div>
    <div class="field"><label for="ciCost">花了多少 <span class="opt">可选</span></label>
      <input class="input" id="ciCost" inputmode="numeric" maxlength="5" placeholder="0"></div>
    <div class="d-actions"><button class="btn primary wide" data-act="confirm" data-id="${a.id}">${t ? '确认再次到访' : '确认到访，收下票根'}</button></div>`, '确认到访');
}

function confirmCheckin(id) {
  const a = act(id);
  const crowd = document.querySelector('[data-group="crowd"] .on')?.dataset.val || S.crowd;
  const visit = {
    ts: Date.now(), weather: S.weather, crowd,
    note: $('#ciNote').value.trim(), cost: Math.max(0, parseInt($('#ciCost').value, 10) || 0),
    buddy: S.buddy.on ? { name: S.buddy.name, img: CAT_IMG.idle } : null,   // 新记录保存素材版本，旧票根沿用旧姿态
  };
  let t = ticketOf(id);
  const repeat = !!t;
  if (t) t.visits.push(visit);
  else {
    t = { actId: a.id, no: S.tickets.length + 1, city: a.city, place: placeName(a), tagline: a.tagline || '这个周末，来过这里', art: artOf(a), visits: [visit] };
    S.tickets.push(t);
  }
  S.plan = S.plan.filter(x => x !== a.id);
  S.buddyAt[a.city] = a.id;   // 只有主动打卡后，伙伴才来到这里
  sel = a.id;
  save(); closeSheet(); renderAll();
  showReveal(t, repeat);
}

/* ---------------- 票根 ---------------- */
let stampSeq = 0;
function stampHTML(date, place, again) {
  const id = `ring${++stampSeq}`;
  return `<div class="stamp"><svg viewBox="0 0 120 120" aria-hidden="true">
    <defs><path id="${id}" d="M60,60 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/></defs>
    <g filter="url(#rough)" fill="none" stroke="currentColor"><circle cx="60" cy="60" r="55" stroke-width="3.4"/><circle cx="60" cy="60" r="32" stroke-width="1.6"/></g>
    <g filter="url(#rough)" fill="currentColor"><text font-size="9.5" font-weight="700" letter-spacing="1.4"><textPath href="#${id}">WEEKENDGO · ${date} · ${esc(place.slice(0, 6))} ·</textPath></text>
    <text x="60" y="67" text-anchor="middle" font-size="19" font-weight="900">${again ? '再访' : '已打卡'}</text></g></svg></div>`;
}
function ticketHTML(t, idx = t.visits.length - 1) {
  const v = t.visits[idx], d = new Date(v.ts);
  const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const nth = t.visits.length > 1 ? ` · 第 ${idx + 1} 次` : '';
  const long = (t.city + t.place).length > 7;
  return `<div class="ticket-wrap"><article class="ticket" aria-label="${esc(t.city)}${esc(t.place)}票根">
    <span class="t-brand">WEEKENDGO</span>
    <header class="t-head"><h3${long ? ' class="long"' : ''}>${esc(t.city)}<i>·</i>${esc(t.place)}</h3><p>${esc(t.tagline)}</p></header>
    <div class="t-art">${artHTML(t.art)}${stampHTML(date, t.place, idx > 0)}</div>
    <p class="t-note">${esc(v.note)}</p>
    <div class="t-cut"></div>
    <footer class="t-foot"><div><b>${date} ${pad(d.getHours())}:${pad(d.getMinutes())}</b><span>${WX_WORD[v.weather] || ''} · ${CROWD_WORD[v.crowd] || ''}${nth}</span></div>
      ${v.buddy ? `<img src="${v.buddy.img || 'assets/companion-cat-idle-v1.png'}" alt="伙伴${esc(v.buddy.name)}">` : ''}</footer>
    <p class="t-no">— 第 ${t.no} 张周末票根 · No.${String(t.no).padStart(4, '0')} —</p>
  </article></div>`;
}

function showReveal(t, repeat) {
  const v = t.visits.at(-1);
  const r = $('#reveal');
  lastFocus = document.activeElement;
  r.innerHTML = `<div class="reveal-in">
    <p class="reveal-title">${repeat ? '又来了一次' : '打卡成功'}</p>
    <div style="position:relative">${ticketHTML(t)}${v.buddy ? `<img class="reveal-buddy" src="${CAT_IMG.happy}" alt="">` : ''}</div>
    <p class="reveal-sub">${repeat ? `这里已在收集中，记下第 ${t.visits.length} 次到访` : `已收入「我的收集」· 第 ${t.no} 张周末票根`}${v.buddy && v.crowd === 'solo' ? `<br>${esc(v.buddy.name)}陪你收下了这一张` : ''}</p>
    <div class="reveal-actions"><button class="btn ghost" data-act="closeReveal">继续逛逛</button><button class="btn primary" data-act="goCollect">查看我的收集</button></div>
  </div>`;
  r.hidden = false;
  document.body.style.overflow = 'hidden';
  r.querySelector('.btn.primary').focus({ preventScroll: true });
}
function closeReveal() {
  $('#reveal').hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus?.({ preventScroll: true });
}

function openTicket(id) {
  const t = ticketOf(id);
  const rows = [...t.visits].reverse().map(v => {
    const d = new Date(v.ts);
    return `<li><div>${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}${v.note ? `<br><small style="color:var(--sub)">${esc(v.note)}</small>` : ''}</div>
      <span>${WX_WORD[v.weather]}（演示）· ${CROWD_WORD[v.crowd]}${v.cost ? ` · ¥${v.cost}` : ''}</span></li>`;
  }).join('');
  openSheet(`${ticketHTML(t)}
    <div class="d-sec visits"><h4>到访记录 · ${t.visits.length} 次</h4><ul>${rows}</ul></div>
    <p class="d-hint">票根保存打卡当时的天气与伙伴，之后切换天气或伙伴不会改变它。</p>
    <div class="d-actions"><button class="btn ghost" data-act="detail" data-id="${t.actId}">查看地点</button><button class="btn primary" data-act="shareTicket" data-id="${t.actId}">分享票根</button></div>`, '票根');
}

/* ---------------- 组队 ---------------- */
function toggleJoin(id) {
  const t = S.teams.find(x => x.id === id);
  const i = S.joined.indexOf(id);
  if (i >= 0) { S.joined.splice(i, 1); t.members = t.members.filter(m => m !== '我'); toast('已退出队伍'); }
  else if (t.members.length >= t.cap) return toast('队伍已满员');
  else { S.joined.push(id); t.members.push('我'); toast('已加入，出发前留意集合时间'); }
  save(); renderTeams();
}
function openTeamForm(actId) {
  const acts = ACTS.filter(a => a.city === S.city);
  const cur = act(actId) || acts[0];
  openSheet(`<h2>发起组队</h2><p class="lead">队伍只保存在本机，用于演示。</p>
    <div class="field"><label for="tAct">去哪里</label><select class="input" id="tAct">${acts.map(a => `<option value="${a.id}" ${a.id === cur.id ? 'selected' : ''}>${esc(a.title)}</option>`).join('')}</select></div>
    <div class="field"><label for="tTime">集合时间</label><input class="input" id="tTime" placeholder="周六 10:00"></div>
    <div class="field"><label for="tMeet">集合地点</label><input class="input" id="tMeet" placeholder="${esc(cur.venue)}入口"></div>
    <div class="field"><span class="label">几个人（含你）</span><div class="seg" data-group="cap">${[2, 3, 4, 6, 8].map(n => `<button class="${n === 4 ? 'on' : ''}" data-val="${n}">${n} 人</button>`).join('')}</div></div>
    <div class="field"><label for="tNote">想对队友说 <span class="opt">可选</span></label><input class="input" id="tNote" maxlength="30" placeholder="新手友好，AA 制"></div>
    <div class="d-actions"><button class="btn primary wide" data-act="doTeam">发布队伍</button></div>`, '发起组队');
}
function doTeam() {
  const a = act($('#tAct').value);
  const cap = +(document.querySelector('[data-group="cap"] .on')?.dataset.val || 4);
  const t = {
    id: 't' + Date.now(), actId: a.id, cap, members: ['我'],
    title: `${placeName(a)}搭子，还差 ${cap - 1} 人`,
    time: $('#tTime').value.trim() || '周六 10:00',
    meet: $('#tMeet').value.trim() || `${a.venue}入口`,
    note: $('#tNote').value.trim() || '来了就是队友',
  };
  S.teams.unshift(t); S.joined.push(t.id);
  save(); closeSheet(); renderTeams(); switchTab('team');
  toast('队伍已发布');
}

/* ---------------- 设置面板 ---------------- */
function openWeather() {
  openSheet(`<h2>天气演示</h2>
    <p class="lead">真实天气尚未接入。这里切换的是「${esc(S.city)}此刻天气」的演示，界面氛围和推荐排序会跟着变。</p>
    <div class="wx-grid">${Object.entries(WEATHERS).map(([k, w]) => `<button class="${k === S.weather ? 'on' : ''}" data-act="setWx" data-id="${k}" aria-pressed="${k === S.weather}"><svg><use href="#i-${k}"/></svg>${w.name === '暂不可用' ? '未知' : w.name}</button>`).join('')}</div>
    <button class="me-row" data-act="toggleWeatherMotion" aria-pressed="${S.weatherMotion}">天气动态效果<span>${S.weatherMotion ? '已开启' : '已关闭'}</span></button>
    <p class="honest"><span>出行日天气接入后会单独标注日期与来源，不会用此刻天气冒充预报。已生成的票根保留打卡时的天气。</span></p>`, '天气演示');
}
function setWeather(k) {
  S.weather = k; save();
  renderHeader(); renderScene(); renderSpot(); renderRecs();
  openWeather();
  toast(WEATHERS[k].tip);
}
function openCity() {
  openSheet(`<h2>选择城市</h2><p class="lead">五座城市，五幅手绘探索示意图。位置为艺术化表达，不提供导航。</p>
    <div class="seg" style="margin-top:14px">${CITIES.map(c => `<button class="${c === S.city ? 'on' : ''}" data-act="setCity" data-id="${c}">${c}</button>`).join('')}</div>`, '选择城市');
}
function setCity(c) {
  S.city = c; sel = null; showAll = false; save(); closeSheet(); renderAll();
  toast(`已切换到${c}`);
}
function openPref() {
  openSheet(`<h2>这周想怎么玩</h2><p class="lead">只影响推荐排序，随时可以改。</p>
    <div class="field"><span class="label">感兴趣的（可多选）</span>
      <div class="seg" data-group="interests" data-multi>${Object.entries(CATS).map(([k, c]) => `<button class="${S.interests.includes(k) ? 'on' : ''}" data-val="${k}">${c.name}</button>`).join('')}</div></div>
    <div class="field"><label for="prefBudget">预算上限</label>
      <div class="range-row"><input type="range" id="prefBudget" min="0" max="500" step="50" value="${S.budget}"><output id="prefBudgetOut"></output></div></div>
    <div class="field"><span class="label">和谁一起</span>
      <div class="seg" data-group="crowdPref">${CROWDS.map(c => `<button class="${c.id === S.crowd ? 'on' : ''}" data-val="${c.id}">${c.name}</button>`).join('')}</div></div>
    <div class="d-actions"><button class="btn primary wide" data-act="savePref">按这个重新推荐</button></div>`, '调整偏好');
  const r = $('#prefBudget'), o = $('#prefBudgetOut');
  const show = () => { o.textContent = +r.value >= 500 ? '不设上限' : `¥${r.value} 以内`; };
  r.addEventListener('input', show); show();
}
function savePref() {
  S.interests = [...document.querySelectorAll('[data-group="interests"] .on')].map(b => b.dataset.val);
  S.budget = +$('#prefBudget').value;
  S.crowd = document.querySelector('[data-group="crowdPref"] .on')?.dataset.val || S.crowd;
  sel = null; save(); closeSheet(); renderAll();
  toast('已按新的偏好重新推荐');
}
function openAbout() {
  openSheet(`<div class="about"><h2>周末拾光</h2>
    <p class="lead">帮大学生找到这周末去哪，并把每一次城市探索变成一张可以收藏的票根。</p>
    <h4>核心链路</h4>
    <div class="flow"><span>感到周末临近</span><i>→</i><span>3 个明确推荐</span><i>→</i><span>地点详情</span><i>→</i><span>加入计划</span><i>→</i><span>主动确认到访</span><i>→</i><span>地点票根</span><i>→</i><span>我的收集</span></div>
    <h4>为什么这样设计</h4>
    <ul><li>首页先给周末情绪和唯一主行动，偏好输入收进「调整偏好」，不把筛选工作还给用户。</li>
      <li>推荐只挑 3 个，每个都写明理由：匹配度 = 兴趣 35% + 天气 25% + 预算 20% + 同行 20%。</li>
      <li>打卡由用户主动确认，点地图不算到访；票根保存当时的日期、天气和伙伴，重复到访记为同一张票根的新记录。</li>
      <li>界面跟随城市此刻天气（演示）变化；出行日预报接入后单独标注日期。</li>
      <li>出游伙伴可命名、可关闭，关闭后功能不受影响。</li></ul>
    <h4>数据真实性</h4>
    <ul><li>真实：本地日期、你输入的偏好与打卡内容。</li><li>演示：天气、活动、队伍成员、攻略点赞。</li><li>地图是探索示意图，位置不精确，不提供导航。</li></ul>
    <h4>下一步</h4>
    <ul><li>更多地点专属票根插画（现有五城地图可用作取景）</li><li>接入真实天气与出行日预报</li><li>高校身份与同校组队（候选）</li><li>票根分享图</li></ul></div>`, '产品说明');
}
function openDataNote() {
  openSheet(`<div class="about"><h2>数据说明</h2>
    <ul style="margin-top:10px"><li>活动、天气、队伍与攻略均为演示数据，不代表真实在线信息。</li>
    <li>你的偏好、周末计划、打卡与票根只保存在这台设备的浏览器里，不会上传，也不会跨设备同步。</li>
    <li>WeekendGO 不读取定位。</li></ul></div>`, '数据说明');
}
function resetData() {
  if (!confirm('清空本机的演示身份、偏好、计划、打卡与票根？此操作无法撤销。')) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  location.reload();
}

/* ---------------- 页签与路由 ---------------- */
const TABS = ['weekend', 'team', 'collect', 'me'];
function switchTab(tab) {
  if (!TABS.includes(tab)) tab = 'weekend';
  document.body.dataset.tab = tab;
  if (tab === 'collect') {
    S.collectSeen = Object.fromEntries(S.tickets.map(t => [t.actId, t.visits.length]));
    save();
    renderCollectBadge();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'page-' + tab));
  document.querySelectorAll('.tabbar button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
  });
  history.replaceState(null, '', tab === 'weekend' ? location.pathname + location.search : '#' + tab);
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------------- 事件委托 ---------------- */
const ACTIONS = {
  demoAuth: mode => openDemoAuth(mode),
  demoLogout: () => { S.demoProfile = null; save(); renderMe(); toast('已退出，回到游客模式；票根和计划已保留'); },
  pick: id => { sel = +id; userPicked = true; renderScene(); renderSpot(); },
  detail: id => openDetail(id),
  plan: id => togglePlan(id),
  checkin: id => openCheckin(id),
  confirm: id => confirmCheckin(id),
  ticket: id => openTicket(id),
  shareTicket: id => window.openTicketShare(id),
  close: () => closeSheet(),
  closeReveal: () => closeReveal(),
  goCollect: () => { closeReveal(); switchTab('collect'); },
  goTeams: () => { closeSheet(); switchTab('team'); },
  tab: id => switchTab(id),
  join: id => toggleJoin(id),
  teamForm: id => openTeamForm(id),
  doTeam: () => doTeam(),
  city: () => openCity(),
  setCity: c => setCity(c),
  setWx: k => setWeather(k),
  toggleWeatherMotion: () => { S.weatherMotion = !S.weatherMotion; save(); renderHeader(); openWeather(); },
  pref: () => openPref(),
  savePref: () => savePref(),
  about: () => openAbout(),
  dataNote: () => openDataNote(),
  reset: () => resetData(),
  toggleBuddy: () => {
    S.buddy.on = !S.buddy.on; save(); renderMe(); renderScene();
    toast(S.buddy.on ? `${S.buddy.name}回来了` : '已关闭出游伙伴');
  },
};
document.addEventListener('click', e => {
  const segBtn = e.target.closest('.seg[data-group] button');
  if (segBtn) {
    const group = segBtn.parentElement;
    if (group.hasAttribute('data-multi')) segBtn.classList.toggle('on');
    else group.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === segBtn));
    return;
  }
  const el = e.target.closest('[data-act]');
  if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el.dataset.id);
});
$('#mask').addEventListener('click', e => { if (e.target.id === 'mask') closeSheet(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#reveal').hidden) closeReveal();
  else if (!$('#mask').hidden) closeSheet();
});
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$('#cityBtn').addEventListener('click', openCity);
$('#wxBtn').addEventListener('click', openWeather);
$('#prefBtn').addEventListener('click', openPref);
$('#moreBtn').addEventListener('click', () => { showAll = !showAll; renderRecs(); });

/* ---------------- 启动 ---------------- */
renderAll();
const LEGACY = { checkin: 'collect', guide: 'weekend' };
const routeFromHash = () => { const h = location.hash.slice(1); if (h) switchTab(LEGACY[h] || h); };
routeFromHash();
window.addEventListener('hashchange', routeFromHash);
document.addEventListener('visibilitychange', () => { document.body.dataset.pageHidden = String(document.hidden); });

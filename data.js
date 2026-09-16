/* ================================================================
   周末出发 WeekendGO · 演示数据
   活动、天气、队伍、攻略均为 Mock；打卡与票根只保存在本机浏览器。
   ================================================================ */

const CITIES = ['杭州', '北京', '上海', '广州', '深圳'];

const CATS = {
  walk:    { name: '散步' },
  hike:    { name: '徒步' },
  exhibit: { name: '展览' },
  market:  { name: '市集' },
  cafe:    { name: '咖啡书店' },
  show:    { name: '演出' },
  night:   { name: '夜游' },
};

const CROWDS = [
  { id: 'solo',  name: '独自' },
  { id: 'duo',   name: '两人' },
  { id: 'small', name: '3-5人' },
  { id: 'big',   name: '大部队' },
];

/* 天气语义：当前城市此刻天气（演示）。unknown 表示暂不可用，不默认成晴天 */
const WEATHERS = {
  sunny:   { name: '晴',   temp: 26,   tip: '晴天，户外去处排在前面' },
  cloudy:  { name: '多云', temp: 22,   tip: '多云，户外和室内都合适' },
  rain:    { name: '小雨', temp: 19,   tip: '下雨了，室内去处排在前面' },
  snow:    { name: '小雪', temp: -1,   tip: '下雪了，室内去处排在前面，出门注意路滑' },
  unknown: { name: '暂不可用', temp: null, tip: '天气暂不可用，推荐不考虑天气' },
};

/* weatherFit：sunny=晴天更舒服（户外）/ indoor=室内，不怕雨雪 / any=晴雨皆宜
   place：该地点在城市探索示意图上的位置（百分比），只用于示意，不是地理坐标
   art：地点专属票根插画；没有时用示意图局部或通用画面 */
const ACTS = [
  // 杭州（首轮插画样例城市）
  { id: 18, city: '杭州', cat: 'walk', title: '西湖断桥 · 傍晚散步', venue: '断桥残雪—白堤', area: '西湖区 · 北山街',
    time: '周六日全天，傍晚最舒服', duration: '半日', price: 0, weatherFit: 'sunny', crowd: ['solo', 'duo', 'small', 'big'],
    desc: '从断桥走上白堤，一路是柳树和游船。不用门票，走累了就在湖边坐一会儿，等天色慢慢暗下来。',
    transit: '地铁龙翔桥站步行约 20 分钟',
    place: { label: '西湖', x: 34, y: 52 }, art: 'assets/ticket-westlake-v1.jpg', tagline: '把今天，留在湖边' },
  { id: 15, city: '杭州', cat: 'hike', title: '九溪十八涧 · 溯溪徒步', venue: '九溪烟树—龙井村环线', area: '西湖区 · 九溪',
    time: '周六 09:00 集合', duration: '一日', price: 0, weatherFit: 'sunny', crowd: ['solo', 'duo', 'small'],
    desc: '经典入门溯溪线，全程林荫约 7km，踩着溪石往上走，终点在龙井村喝杯茶，夏天也凉快。',
    transit: '公交至九溪站',
    place: { label: '山间步道', x: 24, y: 26 }, tagline: '走进一整片凉快的绿' },
  { id: 19, city: '杭州', cat: 'cafe', title: '校园周边 · 书店与草坪下午', venue: '学校周边 2km 内', area: '以你的学校为起点',
    time: '周六日 13:00 以后', duration: '半日', price: 30, weatherFit: 'any', crowd: ['solo', 'duo'],
    desc: '不想走远的时候，把学校附近的独立书店、咖啡和草坪串成一个下午。示意地点，不对应某所真实高校。',
    transit: '步行或共享单车',
    place: { label: '校园周边', x: 72, y: 24 }, tagline: '不走远，也算出发' },
  { id: 17, city: '杭州', cat: 'market', title: '夜市小街 · 国潮文创周末场', venue: '武林广场东通道', area: '拱墅区 · 武林门',
    time: '周六日 17:00-22:30', duration: '晚上', price: 0, weatherFit: 'any', crowd: ['duo', 'small', 'big'],
    desc: '国潮手作、非遗小吃和套圈游戏，地铁站直达，适合晚饭后慢慢逛。',
    transit: '地铁武林广场站直达',
    place: { label: '夜市小街', x: 80, y: 57 }, tagline: '灯亮起来，周末才开始' },
  { id: 16, city: '杭州', cat: 'exhibit', label: '民艺博物馆', title: '民艺博物馆 · 「茶事」展', venue: '中国美院民艺博物馆', area: '西湖区 · 转塘',
    time: '周六日 09:00-16:30', duration: '半日', price: 0, weatherFit: 'indoor', crowd: ['solo', 'duo'],
    desc: '建筑本身就值得看，这次茶文化特展含宋代点茶体验课（材料费另计）。雨天也不怕。',
    transit: '地铁转塘站后换乘公交', tagline: '下雨天，也有地方可去' },
  // 北京
  { id: 1, city: '北京', cat: 'exhibit', label: '798', title: '「宇宙考古」沉浸式空间探索展', venue: '798艺术中心', area: '朝阳区 · 798',
    time: '周六周日 10:00-18:00', price: 88, weatherFit: 'indoor', crowd: ['solo', 'duo', 'small'],
    desc: '1200㎡ 星际场景，可预约讲解场，出片率很高。雨天和高温天的好去处。', place: { label: '798', x: 73, y: 30 } },
  { id: 2, city: '北京', cat: 'market', label: '隆福寺', title: '秋季艺术市集', venue: '隆福文创园', area: '东城区 · 隆福寺',
    time: '周六至周日 11:00-21:00', price: 35, weatherFit: 'any', crowd: ['duo', 'small', 'big'],
    desc: '100+ 独立创作者摊位，古着、黑胶、手作，傍晚有露天乐队演出。', place: { label: '隆福寺', x: 72, y: 63 } },
  { id: 3, city: '北京', cat: 'hike', label: '香山', title: '香山入门徒步线', venue: '香山公园—碧云寺环线', area: '海淀区 · 香山',
    time: '周六 08:30 集合', price: 10, weatherFit: 'sunny', crowd: ['solo', 'small', 'big'],
    desc: '经典入门环线，全程约 8km / 3.5h，山顶能看到整座城。适合新手。', place: { label: '香山', x: 25, y: 28 } },
  { id: 4, city: '北京', cat: 'show', label: '首钢园', title: '城市周末户外音乐场', venue: '首钢园户外草坪', area: '石景山区 · 首钢园',
    time: '周六 14:00-22:00', price: 180, weatherFit: 'sunny', crowd: ['duo', 'small', 'big'],
    desc: '独立乐队和电子双舞台，日落场最好看，场内有餐车区。', place: { label: '首钢园', x: 28, y: 68 } },
  // 上海
  { id: 5, city: '上海', cat: 'exhibit', label: '滨江美术馆', title: '沉浸式光影美术馆晨间场', venue: '滨江光影美术馆', area: '黄浦区 · 滨江',
    time: '周日 10:00-12:00 人少场', price: 199, weatherFit: 'indoor', crowd: ['solo', 'duo'],
    desc: '晨间人少，光影花海可以慢慢看。室内恒温，雨天无忧。', place: { label: '滨江美术馆', x: 73, y: 30 } },
  { id: 6, city: '上海', cat: 'market', label: '安义夜巷', title: '安义夜巷 · 周末夜市', venue: '静安嘉里中心外街', area: '静安区 · 静安寺',
    time: '周六日 16:00-23:00', price: 0, weatherFit: 'any', crowd: ['duo', 'small', 'big'],
    desc: '免费入场。花市、街头小吃、黑胶打碟，本地人很多的 citywalk 去处。', place: { label: '安义夜巷', x: 72, y: 64 } },
  { id: 7, city: '上海', cat: 'walk', label: '苏州河', title: '苏州河两岸 citywalk 12km', venue: '四行仓库→外白渡桥', area: '静安→虹口',
    time: '周日 09:00 集合', price: 0, weatherFit: 'sunny', crowd: ['solo', 'duo', 'small'],
    desc: '沿苏州河看工业遗产，途经 M50 和四行仓库，终点外白渡桥看日落。', place: { label: '苏州河', x: 28, y: 32 } },
  { id: 8, city: '上海', cat: 'cafe', label: '永康路', title: '永康路咖啡巡礼 Half-Day', venue: '永康路街区', area: '徐汇区 · 永康路',
    time: '周六日全天', price: 80, weatherFit: 'indoor', crowd: ['solo', 'duo'],
    desc: '一条路 20 多家独立咖啡馆，雨天躲进店里也很好。', place: { label: '永康路', x: 25, y: 67 } },
  // 广州
  { id: 9, city: '广州', cat: 'exhibit', label: '省博物馆', title: '「海上丝绸之路」特展', venue: '广东省博物馆', area: '天河区 · 珠江新城',
    time: '周六日 09:00-17:00', price: 0, weatherFit: 'indoor', crowd: ['solo', 'duo', 'small', 'big'],
    desc: '免费特展（需预约），沉船文物和互动航海装置，雨天也合适。', place: { label: '省博物馆', x: 74, y: 33 } },
  { id: 10, city: '广州', cat: 'night', label: '珠江夜航', title: '珠江夜航 + 江边精酿市集', venue: '琶醍文化创意区', area: '海珠区 · 琶醍',
    time: '周六 19:00-23:30', price: 98, weatherFit: 'any', crowd: ['duo', 'small', 'big'],
    desc: '含珠江游船票，船上看塔的灯光，上岸继续逛江边市集。', place: { label: '珠江夜航', x: 70, y: 66 } },
  { id: 11, city: '广州', cat: 'hike', label: '火炉山', title: '火炉山森林公园轻徒步', venue: '火炉山北门环线', area: '天河区 · 火炉山',
    time: '周日 08:00 集合', price: 0, weatherFit: 'sunny', crowd: ['solo', 'small'],
    desc: '免费，全程 6km 缓坡，2.5 小时登顶，下山正好吃饭。', place: { label: '火炉山', x: 26, y: 30 } },
  // 深圳
  { id: 12, city: '深圳', cat: 'market', label: '华侨城', title: '华侨城创意市集', venue: '华侨城创意文化园', area: '南山区 · 华侨城',
    time: '周六日 14:00-22:00', price: 0, weatherFit: 'any', crowd: ['duo', 'small'],
    desc: '免费入场，原创插画、器物和香薰，园内书店画廊可以顺路逛。', place: { label: '华侨城', x: 27, y: 34 } },
  { id: 13, city: '深圳', cat: 'show', label: '海上世界', title: '海边灯光水秀 + 街头音乐夜', venue: '海上世界广场', area: '南山区 · 海上世界',
    time: '周六 18:30-22:00', price: 0, weatherFit: 'any', crowd: ['duo', 'small', 'big'],
    desc: '免费水幕灯光秀，周边夜景好看，餐厅很多。', place: { label: '海上世界', x: 30, y: 66 } },
  { id: 14, city: '深圳', cat: 'hike', label: '梧桐山', title: '梧桐山登顶线', venue: '梧桐山北路—好汉坡', area: '罗湖区 · 梧桐山',
    time: '周日 07:30 集合', price: 0, weatherFit: 'sunny', crowd: ['solo', 'small', 'big'],
    desc: '深圳最高峰，全程约 9km，强度中等，结伴更安全。', place: { label: '梧桐山', x: 73, y: 29 } },
];

/* 演示队伍：成员为虚构昵称 */
const SEED_TEAMS = [
  { id: 't5', actId: 18, title: '周六傍晚西湖散步搭子', time: '周六 16:30', meet: '地铁龙翔桥站 B 口', cap: 4, members: ['小满', '阿柚'], note: '走白堤看日落，走累了就撤，不赶路' },
  { id: 't6', actId: 15, title: '九溪溯溪新手队', time: '周六 09:00', meet: '九溪公交站', cap: 6, members: ['林间', '周周', '豆豆'], note: '穿能沾水的鞋，带一瓶水和一点零食' },
  { id: 't1', actId: 3, title: '周六香山徒步搭子', time: '周六 08:30', meet: '香山站 A 口', cap: 6, members: ['阿茶', '北北', '木木'], note: '新手友好，下山约火锅' },
  { id: 't2', actId: 6, title: '安义夜巷逛吃小分队', time: '周六 17:30', meet: '静安寺站 2 号口', cap: 4, members: ['Leo', '小鹿'], note: '边走边吃，预算 100 以内' },
  { id: 't3', actId: 1, title: '看展 + 798 一日游', time: '周日 10:00', meet: '798艺术中心北门', cap: 5, members: ['星星', '阿禾', '一一', '小舟'], note: '已约 10:30 讲解场' },
  { id: 't4', actId: 14, title: '周日梧桐山登顶团', time: '周日 07:30', meet: '梧桐山北门公交站', cap: 8, members: ['山山', '大海'], note: '登山鞋 + 2L 水，量力而行' },
];

/* 演示攻略：出现在活动详情里，不再单独占一级页签 */
const GUIDES = [
  { id: 'g5', city: '杭州', cats: ['walk'], title: '西湖不用全走完：2 小时学生版路线', author: '湖边的小满', likes: 142,
    body: '龙翔桥出站 → 断桥 → 白堤 → 孤山脚下坐一会儿。傍晚 5 点出发刚好看到日落，全程不花一分钱。周末人多，想拍断桥建议早上 8 点前。' },
  { id: 'g6', city: '杭州', cats: ['hike'], title: '九溪第一次去要注意的三件事', author: '林间', likes: 88,
    body: '1）穿防滑、能沾水的鞋；2）从九溪烟树往龙井村走是缓上坡，反过来会轻松些；3）龙井村喝茶先问价。' },
  { id: 'g1', city: '北京', cats: ['exhibit'], title: '雨天的 798：室内展馆一日路线', author: '爱看展的阿茶', likes: 128,
    body: '尤伦斯 → 木木美术馆 → 宇宙考古展 → 751 图书馆。雨天人少，讲解场记得提前一天预约。' },
  { id: 'g2', city: '上海', cats: ['walk', 'market'], title: '0 元玩转上海：一条不花钱的周末动线', author: '穷游大学生Leo', likes: 96,
    body: '上午苏州河，下午 M50 免费画廊，傍晚安义夜巷，晚上外白渡桥看日落。全天 0 门票。' },
  { id: 'g3', city: '广州', cats: ['hike'], title: '火炉山新手攻略', author: '爬楼狂魔小蛮', likes: 87,
    body: '北门上，原路下，必带 1.5L 水。全程缓坡，适合第一次徒步。' },
  { id: 'g4', city: '', cats: [], title: '一个人也能玩得很好：solo 周末指南', author: '独立周末研究员', likes: 203,
    body: '优先选有时段预约的展，人少体验好；打卡时写一句话，一个月后回看会很有成就感。' },
];

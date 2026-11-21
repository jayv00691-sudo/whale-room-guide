/* 桃桃生活系统：本地状态、需求驱动行为与房间状态管理
 * 无后端依赖；状态保存在 localStorage。未来可将 chooseAction() 替换为服务端 AI 决策。
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'whale-room-taotao-v1';
  const now = () => Date.now();
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const defaults = {
    version: 1,
    cat: {
      name: '桃桃', hunger: 28, energy: 82, mood: 78, affection: 35,
      hygiene: 88, activity: 'idle', location: 'bed', lastUpdate: now(),
      lastActionAt: 0, message: '喵～今天也想和你待在一起。'
    },
    room: {
      bed: { name: '软软小床', comfort: 82, condition: '整洁' },
      food: { name: '猫咪餐碗', food: 65, water: 80 },
      toy: { name: '鲸鱼玩偶', durability: 92, condition: '完好' },
      window: { name: '窗边', sunlight: 70, view: '晴朗' },
      litter: { name: '猫砂盆', cleanliness: 90 }
    },
    log: [{ at: now(), text: '桃桃搬进了鲸鱼房间。' }]
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && saved.version === 1 && saved.cat && saved.room) {
        return {
          ...defaults, ...saved,
          cat: { ...defaults.cat, ...saved.cat },
          room: { ...defaults.room, ...saved.room },
          log: Array.isArray(saved.log) ? saved.log.slice(0, 12) : defaults.log
        };
      }
    } catch (err) { console.warn('[桃桃] 读取存档失败，将使用新存档。', err); }
    return structuredClone(defaults);
  }

  let state = loadState();
  let paused = false;
  let lastDecisionAt = 0;
  const $ = (selector) => document.querySelector(selector);

  function save() {
    state.cat.lastUpdate = now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (err) { console.warn('[桃桃] 保存失败：', err); }
  }

  function record(text) {
    state.log.unshift({ at: now(), text });
    state.log = state.log.slice(0, 12);
  }

  const activities = {
    idle: { label: '发呆', emoji: '🐈', line: '桃桃正在观察这个房间。', location: 'bed' },
    sleep: { label: '睡觉', emoji: '😴', line: '桃桃蜷成一团，睡得很香。', location: 'bed' },
    eat: { label: '吃饭', emoji: '🐱', line: '桃桃正在认真干饭。', location: 'food' },
    play: { label: '玩耍', emoji: '🐾', line: '桃桃追着鲸鱼玩偶跑来跑去！', location: 'toy' },
    explore: { label: '探索', emoji: '🐈', line: '桃桃发现了房间里的新东西。', location: 'window' },
    cuddle: { label: '求摸摸', emoji: '🥺', line: '桃桃走过来蹭蹭你，想要摸摸。', location: 'bed' },
    groom: { label: '梳理毛发', emoji: '🐈', line: '桃桃正在仔细整理自己的毛毛。', location: 'litter' }
  };

  function setActivity(id, reason, announce = true) {
    const activity = activities[id] || activities.idle;
    const changed = state.cat.activity !== id;
    state.cat.activity = id;
    state.cat.location = activity.location;
    state.cat.message = activity.line;
    if (announce && changed) record(reason || activity.line);
    render();
    save();
  }

  // 可解释的规则型决策器：需求优先级 + 环境状态 + 冷却时间。
  // 以后接入 LLM 时保留输入/输出协议即可替换此函数。
  function chooseAction() {
    const c = state.cat, r = state.room;
    if (c.hunger >= 72 && r.food.food >= 8) return { id: 'eat', why: '桃桃饿了，自己去猫咪餐碗吃东西。' };
    if (c.energy <= 24) return { id: 'sleep', why: '桃桃有点困，决定回小床休息。' };
    if (c.affection <= 25 && c.mood <= 55) return { id: 'cuddle', why: '桃桃想念你了，跑来寻求陪伴。' };
    if (c.hygiene <= 28) return { id: 'groom', why: '桃桃开始整理自己的毛发。' };
    if (c.mood <= 42 && c.energy >= 25) return { id: 'play', why: '桃桃心情有点低落，决定玩一会儿。' };
    if (r.window.sunlight >= 55 && c.energy >= 40 && Math.random() < .42) return { id: 'explore', why: '窗边的光吸引了桃桃，她去看看外面的世界。' };
    if (c.energy >= 45 && c.mood >= 45 && Math.random() < .35) return { id: 'play', why: '桃桃突然有了兴致，开始追鲸鱼玩偶。' };
    if (c.affection < 55 && Math.random() < .22) return { id: 'cuddle', why: '桃桃想和你贴贴。' };
    return { id: 'idle', why: '桃桃巡视了一圈，决定安静待一会儿。' };
  }

  function applyActivityProgress(minutes) {
    const c = state.cat, r = state.room;
    switch (c.activity) {
      case 'sleep':
        c.energy = clamp(c.energy + minutes * 1.15);
        c.hunger = clamp(c.hunger + minutes * .16);
        c.mood = clamp(c.mood + minutes * .12);
        break;
      case 'eat':
        c.hunger = clamp(c.hunger - minutes * 1.6);
        r.food.food = clamp(r.food.food - minutes * .8);
        c.mood = clamp(c.mood + minutes * .12);
        break;
      case 'play':
        c.mood = clamp(c.mood + minutes * .38);
        c.energy = clamp(c.energy - minutes * .48);
        c.hunger = clamp(c.hunger + minutes * .25);
        r.toy.durability = clamp(r.toy.durability - minutes * .08);
        break;
      case 'explore':
        c.mood = clamp(c.mood + minutes * .18);
        c.energy = clamp(c.energy - minutes * .18);
        break;
      case 'cuddle':
        c.affection = clamp(c.affection + minutes * .55);
        c.mood = clamp(c.mood + minutes * .25);
        break;
      case 'groom':
        c.hygiene = clamp(c.hygiene + minutes * .75);
        c.mood = clamp(c.mood + minutes * .08);
        break;
      default:
        c.energy = clamp(c.energy - minutes * .08);
        c.hunger = clamp(c.hunger + minutes * .22);
        c.mood = clamp(c.mood - minutes * .08);
        break;
    }
    c.hunger = clamp(c.hunger + minutes * .12);
    c.affection = clamp(c.affection - minutes * .025);
    c.hygiene = clamp(c.hygiene - minutes * .035);
    r.food.water = clamp(r.food.water - minutes * .06);
  }

  function updateElapsed() {
    const elapsed = Math.max(0, Math.min(180, (now() - state.cat.lastUpdate) / 60000));
    if (elapsed > 0) applyActivityProgress(elapsed);
    state.cat.lastUpdate = now();
  }

  function tick() {
    if (paused) return;
    updateElapsed();
    if (now() - lastDecisionAt > 25000) {
      const decision = chooseAction();
      if (decision.id !== state.cat.activity || now() - state.cat.lastActionAt > 90000) {
        setActivity(decision.id, decision.why, true);
        state.cat.lastActionAt = now();
      }
      lastDecisionAt = now();
    }
    render();
    save();
  }

  function act(action) {
    updateElapsed();
    const c = state.cat, r = state.room;
    if (action === 'feed') {
      if (r.food.food < 8) { c.message = '猫粮不够啦，先给桃桃添一点吧。'; record('猫咪餐碗快空了，需要补充猫粮。'); }
      else {
        r.food.food = clamp(r.food.food - 18);
        c.hunger = clamp(c.hunger - 38);
        c.mood = clamp(c.mood + 8);
        setActivity('eat', '你给桃桃添了猫粮，她开心地吃了起来。', false);
      }
    } else if (action === 'pet') {
      c.affection = clamp(c.affection + 22);
      c.mood = clamp(c.mood + 14);
      setActivity('cuddle', '你摸了摸桃桃的脑袋，她舒服地蹭了蹭你的手。', false);
    } else if (action === 'play') {
      if (r.toy.durability < 5) { c.message = '鲸鱼玩偶需要修补一下，桃桃暂时不想玩。'; }
      else {
        c.mood = clamp(c.mood + 28);
        c.energy = clamp(c.energy - 12);
        c.affection = clamp(c.affection + 8);
        r.toy.durability = clamp(r.toy.durability - 5);
        setActivity('play', '你陪桃桃玩了一会儿，她开心极了！', false);
      }
    } else if (action === 'water') {
      r.food.water = 100;
      c.message = '桃桃喝了几口清水，咕噜咕噜。';
      record('你给桃桃换上了新鲜的饮用水。');
    } else if (action === 'clean') {
      r.litter.cleanliness = 100;
      c.hygiene = clamp(c.hygiene + 10);
      c.message = '猫砂盆清理干净啦，桃桃很满意。';
      record('你清理了猫砂盆。');
    } else if (action === 'restock') {
      r.food.food = 100;
      r.toy.durability = 100;
      record('你补满了猫粮，也把鲸鱼玩偶修好了。');
    }
    save(); render();
  }

  function stat(label, value, tone) {
    return '<div class="tt-stat"><div><span>' + label + '</span><b>' + Math.round(value) + '%</b></div><div class="tt-track"><i class="' + tone + '" style="width:' + value + '%"></i></div></div>';
  }

  function render() {
    const c = state.cat, r = state.room;
    const panel = $('#taotao-panel');
    if (!panel) return;
    panel.querySelector('#tt-status').textContent = c.message;
    panel.querySelector('#tt-activity').textContent = (activities[c.activity] || activities.idle).label;
    panel.querySelector('#tt-stats').innerHTML =
      stat('饥饿', c.hunger, 'hunger') + stat('精力', c.energy, 'energy') +
      stat('心情', c.mood, 'mood') + stat('亲密', c.affection, 'affection') +
      stat('整洁', c.hygiene, 'hygiene');
    panel.querySelector('#tt-room').innerHTML =
      '<div><span>🍚 猫粮</span><b>' + Math.round(r.food.food) + '%</b></div>' +
      '<div><span>💧 饮水</span><b>' + Math.round(r.food.water) + '%</b></div>' +
      '<div><span>🐳 玩偶</span><b>' + Math.round(r.toy.durability) + '%</b></div>' +
      '<div><span>🧹 猫砂盆</span><b>' + Math.round(r.litter.cleanliness) + '%</b></div>';
    panel.querySelector('#tt-log').innerHTML = state.log.slice(0, 5).map(item =>
      '<li><time>' + new Date(item.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '</time>' + item.text + '</li>'
    ).join('');
    const avatar = $('#tt-cat');
    if (avatar) {
      avatar.textContent = (activities[c.activity] || activities.idle).emoji;
      avatar.setAttribute('aria-label', '桃桃正在' + (activities[c.activity] || activities.idle).label);
      const positions = { bed: [19, 68], food: [78, 72], toy: [67, 66], window: [74, 24], litter: [32, 72] };
      const pos = positions[c.location] || positions.bed;
      avatar.style.left = pos[0] + '%'; avatar.style.top = pos[1] + '%';
      avatar.dataset.activity = c.activity;
    }
    const pause = panel.querySelector('#tt-pause');
    pause.textContent = paused ? '继续生活' : '暂停时间';
    pause.classList.toggle('active', paused);
  }

  function mount() {
    const art = $('#art'), bar = $('.bar');
    if (!art || !bar) return;
    const style = document.createElement('style');
    style.textContent = `
      #tt-cat{position:absolute;z-index:4;left:19%;top:68%;transform:translate(-50%,-50%);font-size:clamp(30px,5vw,58px);line-height:1;filter:drop-shadow(0 5px 5px #17203388);pointer-events:none;transition:left 1.2s ease,top 1.2s ease;animation:tt-bob 2.4s ease-in-out infinite}
      #tt-cat[data-activity="sleep"]{animation:tt-sleep 3s ease-in-out infinite}
      #tt-cat[data-activity="play"]{animation:tt-bob .55s ease-in-out infinite}
      @keyframes tt-bob{0%,100%{translate:0 0}50%{translate:0 -8px}}
      @keyframes tt-sleep{0%,100%{rotate:-7deg}50%{rotate:7deg}}
      #taotao-panel{margin-top:18px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(250px,.85fr);gap:14px;color:#e8eefb}
      .tt-card{background:#182235;border:1px solid #34445f;border-radius:14px;padding:16px;min-width:0}
      .tt-card h3{font-size:16px;margin:0 0 12px;color:#f2f6ff}
      .tt-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .tt-pill{font-size:12px;color:#b8d5ff;background:#284267;padding:4px 9px;border-radius:20px}
      #tt-status{color:#b8c9e2;font-size:13px;min-height:42px;margin:8px 0 12px}
      #tt-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}
      .tt-stat>div:first-child{display:flex;justify-content:space-between;font-size:12px;color:#bdcbe0}
      .tt-stat b{color:#eef4ff;font-variant-numeric:tabular-nums}
      .tt-track{height:7px;background:#2b3950;border-radius:9px;margin-top:5px;overflow:hidden}
      .tt-track i{display:block;height:100%;border-radius:9px;background:#7bb7f7}
      .tt-track i.hunger{background:#f0a36c}.tt-track i.energy{background:#86c9a4}.tt-track i.mood{background:#d9a5ef}.tt-track i.affection{background:#ef9eb5}.tt-track i.hygiene{background:#83cbd0}
      .tt-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
      .tt-actions button{border-radius:10px;padding:7px 11px}
      .tt-room{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .tt-room>div{display:flex;justify-content:space-between;background:#202e44;padding:9px;border-radius:9px;font-size:12px;color:#c4d2e7}
      .tt-room b{color:#fff}
      #tt-log{list-style:none;margin:12px 0 0;padding:0}
      #tt-log li{font-size:12px;color:#aebfd8;padding:7px 0;border-top:1px solid #2c3a50;display:flex;gap:9px}
      #tt-log time{color:#7e96b7;flex:none}
      #tt-pause.active{background:#765b38;border-color:#a88758}
      .tt-foot{color:#8298b7;font-size:11px;margin-top:12px}
      @media(max-width:620px){#taotao-panel{grid-template-columns:1fr}#tt-stats{grid-template-columns:1fr 1fr}}
      @media(prefers-reduced-motion:reduce){#tt-cat{animation:none;transition:none}}
    `;
    document.head.appendChild(style);
    const avatar = document.createElement('div');
    avatar.id = 'tt-cat'; avatar.textContent = '🐈'; avatar.title = '小猫桃桃';
    avatar.setAttribute('role', 'img'); avatar.setAttribute('aria-label', '小猫桃桃');
    art.appendChild(avatar);

    const panel = document.createElement('section');
    panel.id = 'taotao-panel';
    panel.innerHTML = `
      <div class="tt-card">
        <div class="tt-head"><h3>🐱 桃桃的状态</h3><span class="tt-pill">正在 <b id="tt-activity">发呆</b></span></div>
        <p id="tt-status" aria-live="polite"></p>
        <div id="tt-stats"></div>
        <div class="tt-actions">
          <button type="button" data-tt-action="feed">🍚 喂食</button>
          <button type="button" data-tt-action="pet">💗 摸摸</button>
          <button type="button" data-tt-action="play">🐳 陪玩</button>
          <button type="button" data-tt-action="water">💧 添水</button>
          <button type="button" data-tt-action="clean">🧹 清猫砂</button>
          <button type="button" data-tt-action="restock">📦 补给与修玩具</button>
        </div>
        <p class="tt-foot">桃桃会根据需求自主行动。所有状态仅保存在当前浏览器。</p>
      </div>
      <div class="tt-card">
        <div class="tt-head"><h3>🏠 房间状态</h3><button id="tt-pause" type="button">暂停时间</button></div>
        <div class="tt-room" id="tt-room"></div>
        <h3 style="margin-top:18px">📖 桃桃的小日记</h3>
        <ul id="tt-log"></ul>
      </div>`;
    bar.insertAdjacentElement('afterend', panel);
    panel.addEventListener('click', (event) => {
      const action = event.target.closest('[data-tt-action]');
      if (action) act(action.dataset.ttAction);
      if (event.target.closest('#tt-pause')) { paused = !paused; render(); }
    });
    render();
  }

  // 将离线期间的需求变化限制在 3 小时，避免长期未打开时数值瞬间归零。
  updateElapsed();
  mount();
  save();
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
})();

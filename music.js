/* 全应用共用一个音频实例：主动开启，跨页签持续播放。 */
(() => {
  const buttons = document.querySelectorAll('[data-music="toggle"]');
  const status = document.querySelector('#musicStatus');
  const audio = new Audio();
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = 0.25;
  const source = 'assets/shiguang-web-v1.mp3';
  let wanted = false;
  let attempt = 0;
  let timeout;
  let state = 'idle';

  function display(next) {
    state = next;
    const states = {
      idle: ['音乐', '播放拾光背景音乐'],
      loading: ['加载中', '音乐加载中，点击取消'],
      playing: ['暂停', '暂停拾光背景音乐'],
      paused: ['音乐', '继续播放拾光背景音乐'],
      error: ['重试', '音乐暂时无法播放，点击重试'],
    };
    const [text, description] = states[next];
    buttons.forEach(button => {
      button.dataset.state = next;
      button.dataset.playing = String(wanted);
      button.setAttribute('aria-label', description);
      button.setAttribute('aria-pressed', String(wanted));
      button.title = description;
      button.querySelector('span').textContent = text;
    });
    status.textContent = description;
  }

  function pause() {
    if (!wanted && audio.paused) return;
    wanted = false;
    attempt++;
    clearTimeout(timeout);
    audio.pause();
    display('paused');
  }

  function fail() {
    if (!wanted) return;
    wanted = false;
    attempt++;
    clearTimeout(timeout);
    audio.pause();
    display('error');
  }

  function waiting() {
    if (!wanted) return;
    display('loading');
    clearTimeout(timeout);
    timeout = setTimeout(fail, 20000);
  }

  async function toggle() {
    if (wanted) { pause(); return; }
    const retry = state === 'error';
    wanted = true;
    const currentAttempt = ++attempt;
    waiting();
    // 不在 HTML 或启动阶段设置 src，确保未点击时没有音频下载。
    if (!audio.getAttribute('src')) audio.src = source;
    else if (retry) audio.load();
    try {
      await audio.play();
    } catch {
      if (currentAttempt === attempt) fail();
    }
  }
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-music]')?.dataset.music;
    if (action === 'toggle') toggle();
  });
  audio.addEventListener('playing', () => {
    if (!wanted) { audio.pause(); return; }
    clearTimeout(timeout);
    display('playing');
  });
  audio.addEventListener('waiting', waiting);
  audio.addEventListener('error', fail);
  audio.addEventListener('pause', () => {
    if (wanted && audio.paused) pause();
  });
})();

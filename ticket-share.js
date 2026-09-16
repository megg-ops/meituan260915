/* 仅使用已存在的插画，原生 Canvas 合成分享图；不截图页面、不上传用户数据。 */
(() => {
  let active = null;
  const font = '"PingFang SC", "Microsoft YaHei", sans-serif';

  window.disposeTicketShare = () => {
    if (!active) return;
    active.cancelled = true;
    if (active.url) {
      const url = active.url;
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    active = null;
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const url = new URL(src, location.href);
      if (url.origin !== location.origin) { reject(new Error('仅支持本站素材')); return; }
      const img = new Image();
      const timer = setTimeout(() => finish(new Error('素材加载超时')), 12000);
      function finish(error) {
        clearTimeout(timer);
        img.onload = img.onerror = null;
        error ? reject(error) : resolve(img);
      }
      img.onload = () => finish();
      img.onerror = () => finish(new Error('素材加载失败'));
      img.src = url.href;
    });
  }

  function text(ctx, value, x, y, maxWidth, size, color = '#183F3B', weight = 600) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    while (ctx.measureText(value).width > maxWidth && size > 14) {
      ctx.font = `${weight} ${--size}px ${font}`;
    }
    ctx.fillText(value, x, y, maxWidth);
  }

  async function draw(data) {
    const art = data.art;
    const [illustration, buddy] = await Promise.all([
      art.type === 'generic' ? null : loadImage(art.src || MAPS['杭州'].img),
      data.buddyImage ? loadImage(data.buddyImage) : null,
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1410;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法生成图片');
    ctx.scale(1.5, 1.5);
    ctx.fillStyle = '#E9ECEA'; ctx.fillRect(0, 0, 600, 940);
    ctx.fillStyle = '#FBF7EE'; ctx.fillRect(12, 12, 576, 916);
    text(ctx, '周末拾光', 40, 55, 520, 18, '#526763');
    text(ctx, `${data.city} · ${data.place}`, 40, 105, 520, 32, '#183F3B', 800);
    text(ctx, '这个周末，来过这里', 40, 139, 520, 18, '#526763', 400);

    const x = 40, y = 165, w = 520, h = 562;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (illustration) {
      const scale = art.type === 'map' ? w * 2.9 / illustration.width : Math.max(w / illustration.width, h / illustration.height);
      const dw = illustration.width * scale, dh = illustration.height * scale;
      const px = art.type === 'map' ? Math.max(0, Math.min(100, Number(art.x) || 0)) / 100 : .5;
      const py = art.type === 'map' ? Math.max(0, Math.min(100, Number(art.y) || 0)) / 100 : .5;
      ctx.drawImage(illustration, x + (w - dw) * px, y + (h - dh) * py, dw, dh);
    } else {
      // 兼容旧票根的通用画面，与现有 artHTML 的太阳、山丘保持一致。
      const hue = { walk: '#77BDB2', hike: '#417C65', exhibit: '#8FAFC2', market: '#DDA46B', cafe: '#BD9A78', show: '#D08C78', night: '#5B7FA0' }[art.cat] || '#77BDB2';
      ctx.fillStyle = '#EEF2EA'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#EDC777'; ctx.beginPath(); ctx.arc(x + w * .71, y + h * .3, 58, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hue;
      for (const [height, alpha] of [[.62, .5], [.79, 1]]) {
        ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(x, y + h * height);
        ctx.quadraticCurveTo(x + w * .3, y + h * (height - .2), x + w * .6, y + h * height);
        ctx.lineTo(x + w, y + h * (height - .06)); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.save(); ctx.translate(481, 663); ctx.rotate(-.18);
    ctx.strokeStyle = '#B95D2D'; ctx.fillStyle = '#FBF7EE'; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 49, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center'; text(ctx, '已打卡', 0, 6, 90, 22); ctx.restore();

    ctx.strokeStyle = '#A6ADA5'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(28, 756); ctx.lineTo(572, 756); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#E9ECEA';
    for (const cx of [12, 588]) { ctx.beginPath(); ctx.arc(cx, 756, 12, 0, Math.PI * 2); ctx.fill(); }
    text(ctx, data.date, 40, 804, 400, 27, '#183F3B', 800);
    text(ctx, `${data.weather}（演示） · 第 ${data.visitNumber} 次到访`, 40, 838, 390, 17, '#526763', 400);
    if (buddy) {
      const scale = Math.min(86 / buddy.width, 112 / buddy.height);
      ctx.drawImage(buddy, 516 - buddy.width * scale / 2, 865 - buddy.height * scale, buddy.width * scale, buddy.height * scale);
    }
    text(ctx, '周末拾光 · 把周末收进回忆里', 40, 898, 520, 17, '#526763', 400);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片导出失败')), 'image/png'));
  }

  window.openTicketShare = async id => {
    const ticket = ticketOf(id);
    if (!ticket?.visits?.length) { toast('还没有可分享的票根'); return; }
    const visit = ticket.visits.at(-1);
    const date = new Date(visit.ts);
    // 白名单快照：不读取邮箱、消费金额、私人留言或其他身份信息。
    const data = {
      city: ticket.city, place: ticket.place, art: { ...ticket.art },
      date: `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`,
      weather: WX_WORD[visit.weather] || '天气未记录', visitNumber: ticket.visits.length,
      buddyImage: visit.buddy ? visit.buddy.img || 'assets/companion-cat-idle-v1.png' : null,
    };
    openSheet(`<h2>分享这张周末票根</h2><p class="lead">按最近一次到访生成，不包含邮箱、花费和私人留言。</p>
      <div class="share-preview" id="sharePreview" role="status" aria-live="polite" aria-busy="true">正在整理你的周末回忆…</div>
      <div id="shareActions"></div><p class="share-feedback">图片仅在你的浏览器中生成，不上传。保存后可自行发送给朋友。</p>`, '分享票根');
    const session = { cancelled: false, url: null };
    active = session;
    try {
      const blob = await draw(data);
      if (session.cancelled) return;
      session.url = URL.createObjectURL(blob);
      const preview = $('#sharePreview');
      preview.replaceChildren();
      const image = new Image();
      image.alt = `${data.city} · ${data.place}，${data.date}的分享票根`;
      image.src = session.url;
      preview.append(image); preview.setAttribute('aria-busy', 'false');
      const link = document.createElement('a');
      link.className = 'btn primary wide share-save';
      link.href = session.url;
      link.download = `周末拾光-${data.city}-${data.place}-${data.date}.png`.replace(/[\\/:*?"<>|]/g, '-');
      link.textContent = '保存图片';
      $('#shareActions').append(link);
      const hint = document.createElement('p'); hint.className = 'share-feedback';
      hint.textContent = '若手机浏览器未直接下载，可长按预览图片保存。';
      $('#shareActions').append(hint);
    } catch {
      if (session.cancelled) return;
      $('#sharePreview').textContent = '图片暂时生成失败，请检查网络后重试。原票根不受影响。';
      $('#sharePreview').setAttribute('aria-busy', 'false');
      $('#shareActions').innerHTML = `<button class="btn primary wide" data-act="shareTicket" data-id="${Number(id)}">重新生成</button>`;
    }
  };
})();

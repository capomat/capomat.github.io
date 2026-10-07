/*
 * Карточка результата «Догони Сармата» для шаринга в Telegram.
 * Рисуется целиком в браузере на <canvas> 1080×1080. Без зависимостей и без сервера:
 * картинка никуда не отправляется, пока игрок сам не поделится ею.
 *
 * Использование:
 *   const canvas = await SarmatCard.render({ place: 1, nick: 'keltaa', score: 1874 });
 *   const blob   = await SarmatCard.toBlob(canvas);
 *   const result = await SarmatCard.share({ blob, text, url }); // 'shared' | 'copied' | 'downloaded' | 'cancelled'
 *
 * Перед первым вызовом можно поменять пути: SarmatCard.config.assetsBase / fontsBase.
 */
(function (global) {
  'use strict';

  const config = {
    assetsBase: 'assets/', // rooster.png, leg.png, crown.svg, silver.svg, bronze.svg
    fontsBase: 'fonts/',   // Unbounded.ttf, JetBrainsMono.ttf
    site: 'capomat.github.io',
  };

  const W = 1080, H = 1080;
  const BG = '#0d0d0d', GREY = '#8a8a8a', WHITE = '#ffffff';

  // Оформление по месту. Места 4–10 — общий стиль без награды.
  const TIERS = {
    1: { accent: '#F5C542', title: 'Лучший ловец петухов', award: 'crown' },
    2: { accent: '#C9CED6', title: 'Второй ловец петухов', award: 'silver' },
    3: { accent: '#D08A4E', title: 'Третий ловец петухов', award: 'bronze' },
  };
  const TOP10 = { accent: '#9a9a9a', title: 'В десятке ловцов петухов', award: null };
  const tierOf = (place) => TIERS[place] || TOP10;

  // Склонение: 1 очко, 2 очка, 5 очков, 11 очков, 1874 очка.
  function pointsWord(n) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return 'очко';
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'очка';
    return 'очков';
  }

  // ---------- загрузка ресурсов (один раз) ----------
  let ready = null;
  function loadImage(src) {
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fail(new Error('Не загрузилась картинка: ' + src));
      img.src = src;
    });
  }
  function prepare() {
    if (ready) return ready;
    const fonts = [
      new FontFace('SarmatUnbounded', `url(${config.fontsBase}Unbounded.ttf)`, { weight: '100 900' }),
      new FontFace('SarmatMono', `url(${config.fontsBase}JetBrainsMono.ttf)`, { weight: '100 800' }),
    ];
    ready = Promise.all([
      ...fonts.map((f) => f.load().then((ff) => document.fonts.add(ff))),
      ...['rooster.png', 'leg.png', 'crown.svg', 'silver.svg', 'bronze.svg'].map((n) => loadImage(config.assetsBase + n)),
    ]).then((res) => {
      const [, , rooster, leg, crown, silver, bronze] = res;
      return { rooster, leg, crown, silver, bronze };
    }).catch((e) => { ready = null; throw e; });
    return ready;
  }

  // ---------- текст ----------
  const UNB = (w, px) => `${w} ${px}px SarmatUnbounded, sans-serif`;
  const MONO = (px) => `500 ${px}px SarmatMono, monospace`;

  // Рисует строку так же, как CSS ставит её в строчный блок высотой boxH, начинающийся с top.
  function textInBox(ctx, text, x, top, boxH) {
    const m = ctx.measureText(text);
    const a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    const baseline = top + (boxH - (a + d)) / 2 + a;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, baseline);
    return baseline;
  }
  // Подбирает кегль, чтобы строка влезла в maxWidth.
  function fitFont(ctx, text, weight, maxPx, minPx, maxWidth) {
    let px = maxPx;
    ctx.font = UNB(weight, px);
    while (px > minPx && ctx.measureText(text).width > maxWidth) {
      px -= 2;
      ctx.font = UNB(weight, px);
    }
    return px;
  }
  // Обрезает строку с «…», если даже минимальный кегль не влез.
  function clip(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  // ---------- рендер ----------
  async function render({ place, nick, score, site }) {
    const a = await prepare();
    const tier = tierOf(place);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    // фон
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // адрес сайта, справа сверху
    ctx.font = MONO(44);
    ctx.fillStyle = GREY;
    ctx.textAlign = 'right';
    textInBox(ctx, site || config.site, 1008, 60, 58);
    ctx.textAlign = 'left';

    // петух (смотрит вправо) + награда; рисуется ДО текста, текст поверх
    drawRooster(ctx, a, tier.award, 572, 431);

    // место: 260 px; «#10» уменьшается, чтобы не наехать на адрес сайта
    ctx.fillStyle = tier.accent;
    fitFont(ctx, '#' + place, 800, 260, 160, 460);
    textInBox(ctx, '#' + place, 72, 68, 234);

    // ник: 64 px, уменьшается до 36 px; не заходит на корону/голову петуха
    const name = String(nick || '').trim() || 'Аноним';
    const nickPx = fitFont(ctx, name, 800, 64, 36, 740);
    ctx.fillStyle = WHITE;
    textInBox(ctx, clip(ctx, name, 740), 72, 320 + (64 - nickPx) / 2, nickPx);

    // статус, одной строкой
    ctx.fillStyle = tier.accent;
    ctx.font = UNB(500, 40);
    textInBox(ctx, tier.title, 72, 402, 46);

    // очки + слово, по общей базовой линии
    const s = String(Math.max(0, Math.floor(score)));
    ctx.fillStyle = WHITE;
    ctx.font = UNB(800, 96);
    const baseline = textInBox(ctx, s, 72, 478, 96);
    const sw = ctx.measureText(s).width;
    ctx.fillStyle = GREY;
    ctx.font = UNB(500, 40);
    ctx.fillText(pointsWord(Number(s)), 72 + sw + 16, baseline);

    // нижняя полоса
    ctx.fillStyle = tier.accent;
    ctx.fillRect(0, 930, W, 150);
    ctx.fillStyle = BG;
    ctx.font = UNB(800, 64);
    textInBox(ctx, 'Догонишь CapMaTa?', 72, 965, 80);

    return c;
  }

  // Координаты внутри «спрайта» петуха шириной 460 (как в макете), потом спрайт отзеркаливается.
  function drawRooster(ctx, a, award, x, y) {
    const SW = 460, SH = SW * a.rooster.naturalHeight / a.rooster.naturalWidth; // 460×429
    const legW = SW * 0.32, legH = legW * a.leg.naturalHeight / a.leg.naturalWidth;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x + SW, y);
    ctx.scale(-1, 1);
    if (award === 'crown') ctx.drawImage(a.crown, SW * 0.04, -92, 168, 98);
    ctx.drawImage(a.rooster, 0, 0, SW, SH);
    ctx.drawImage(a.leg, SW * 0.14, SH * 0.88, legW, legH);
    ctx.drawImage(a.leg, SW * 0.34, SH * 0.88, legW, legH);
    if (award === 'silver') ctx.drawImage(a.silver, SW * 0.20, SH * 0.40, 110, 132);
    if (award === 'bronze') ctx.drawImage(a.bronze, SW * 0.20, SH * 0.40, 110, 132);
    ctx.restore();
  }

  function toBlob(canvas) {
    return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob failed'))), 'image/png'));
  }

  // ---------- отправка ----------
  // 1) системное «Поделиться» с файлом (телефоны, Safari, Chrome на Windows) → Telegram;
  // 2) иначе картинка в буфер обмена (вставить в Telegram Desktop через Ctrl+V);
  // 3) иначе скачивание PNG.
  async function share({ blob, text, url, filename }) {
    const name = filename || 'sarmat.png';
    try {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: [text, url].filter(Boolean).join('\n') });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch (e) { /* дальше — скачивание */ }
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
    return 'downloaded';
  }

  global.SarmatCard = { config, render, toBlob, share, pointsWord, tierOf, prepare };
})(window);

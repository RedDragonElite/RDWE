/* RDE // FRONTLINE — sprite cache: emojis & light blobs pre-rendered once, then blitted */
(function (BW) {
  'use strict';
  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const cache = new Map();
  const SIZES = [12, 16, 20, 24, 32, 48, 64, 96];

  function bucket(px) {
    for (const s of SIZES) if (px <= s) return s;
    return SIZES[SIZES.length - 1];
  }

  /** Returns a canvas with the emoji drawn centred; draw it at (x - c.width/2*scale). */
  function emoji(e, px) {
    const s = bucket(px * (window.devicePixelRatio > 1 ? 2 : 1.4));
    const key = e + '|' + s;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const pad = Math.ceil(s * 0.3);
    c.width = c.height = s + pad * 2;
    const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `${s}px ${EMOJI_FONT}`;
    x.fillText(e, c.width / 2, c.height / 2 + s * 0.06);
    c.base = s;
    cache.set(key, c);
    return c;
  }

  function drawEmoji(ctx, e, x, y, px, alpha = 1) {
    const c = emoji(e, px);
    const sc = px / c.base;
    const w = c.width * sc;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(c, x - w / 2, y - w / 2, w, w);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  let lightSprite = null;
  function light() {
    if (lightSprite) return lightSprite;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,230,160,1)');
    g.addColorStop(0.25, 'rgba(255,190,90,0.55)');
    g.addColorStop(0.6, 'rgba(255,140,40,0.15)');
    g.addColorStop(1, 'rgba(255,120,30,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    lightSprite = c;
    return c;
  }

  BW.Sprites = { emoji, drawEmoji, light, EMOJI_FONT };
})(globalThis.BW = globalThis.BW || {});

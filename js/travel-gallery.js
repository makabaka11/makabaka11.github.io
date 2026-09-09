// Shared gallery runtime: load once in the site footer, including the homepage.
(() => {
  if (window.TripGallery) { window.TripGallery.init(); return; }
  const instances = new Map();
  function mount(root, photos) {
    const controller = new AbortController();
    const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: controller.signal });
  const stage = root.querySelector('.trip-stage');
  const count = root.querySelector('.trip-count');
  const dots = root.querySelector('.trip-dots');
  const live = root.querySelector('.trip-sr');
  const prev = root.querySelector('.trip-prev');
  const next = root.querySelector('.trip-next');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, offset = 0, cards = [], frame = 0, busy = false, queued = 0, drag = null;
  let suppressClickUntil = 0, lightbox = null, opening = false, requestId = 0;
  async function openLightbox(img) {
    if (busy || drag || opening || lightbox || performance.now() < suppressClickUntil) return;
    opening = true;
    const request = ++requestId;
    try {
      if ((!window.PhotoSwipe || !window.PhotoSwipeUI_Default) && window.ensurePhotoSwipeAssets) {
        await window.ensurePhotoSwipeAssets();
      }
      if (!img.complete || !img.naturalWidth) await img.decode();
      if (request !== requestId || !root.isConnected || !img.isConnected || busy || !img.naturalWidth) return;
      const pswp = document.querySelector('.pswp');
      if (!pswp || !window.PhotoSwipe || !window.PhotoSwipeUI_Default) return;
      const rect = img.getBoundingClientRect();
      const gallery = new window.PhotoSwipe(pswp, window.PhotoSwipeUI_Default, [{
        src: img.currentSrc || img.src, msrc: img.src, w: img.naturalWidth, h: img.naturalHeight
      }], {
        index: 0, history: false,
        getThumbBoundsFn: () => ({x: rect.left, y: rect.top + window.scrollY, w: rect.width})
      });
      lightbox = gallery;
      gallery.listen('destroy', () => { if (lightbox === gallery) lightbox = null; });
      if (window.enablePhotoSwipeWebShare) window.enablePhotoSwipeWebShare(gallery);
      gallery.init();
    } catch (error) {
      console.error('[TripGallery lightbox]', error);
    } finally {
      opening = false;
    }
  }
  // Capture stops the site's generic image handlers from opening a second lightbox.
  stage.addEventListener('click', e => {
    e.stopImmediatePropagation();
    e.preventDefault();
    const img = e.target.closest('img[data-trip-main]');
    if (img && stage.contains(img)) openLightbox(img);
  }, {capture: true, signal: controller.signal});
  listen(stage, 'keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('img[data-trip-main]')) {
      e.preventDefault(); e.stopPropagation(); openLightbox(e.target);
    }
  });
  listen(document, 'pjax:send', () => {
    requestId++;
    if (lightbox) lightbox.close();
  });
  const wrap = n => (n % photos.length + photos.length) % photos.length;
  const pad = n => String(n).padStart(2, '0');
  dots.replaceChildren();
  photos.forEach(() => dots.append(document.createElement('i')));
  function build() {
    stage.replaceChildren(); cards = [];
    for (let slot = -2; slot <= 2; slot++) {
      if (photos.length === 1 && slot !== 0) continue;
      const p = wrap(index + slot), photo = photos[p];
      const card = document.createElement('figure'); card.className = 'trip-card';
      const img = document.createElement('img'); img.src = photo.src; img.alt = photo.alt || photo.caption; img.draggable = false; img.decoding = 'async';
      if (slot === 0) {
        img.dataset.tripMain = ''; img.tabIndex = 0; img.setAttribute('role', 'button');
        img.setAttribute('aria-label', `放大图片：${img.alt}`);
      }
      const caption = document.createElement('figcaption');
      const number = document.createElement('small'); number.textContent = pad(p + 1);
      const text = document.createElement('span'); text.className = 'trip-caption'; text.textContent = photo.caption;
      caption.append(number, text); card.append(img, caption); stage.append(card);
      card.setAttribute('aria-hidden', String(slot !== 0)); cards.push({card, slot});
    }
    count.textContent = `${pad(index + 1)} / ${pad(photos.length)}`;
    [...dots.children].forEach((dot, i) => dot.classList.toggle('active', i === index));
    live.textContent = `第 ${index + 1} 张，共 ${photos.length} 张。${photos[index].caption}`;
    draw();
  }
  function draw() {
    const w = stage.clientWidth, mobile = w <= 600;
    cards.forEach(({card, slot}) => {
      const position = slot - offset, distance = Math.abs(position);
      const scale = mobile ? 1 : 1 - Math.min(distance, 1) * .38;
      const x = position * w * (mobile ? 1.04 : .35);
      const y = mobile ? 0 : Math.min(distance, 1) * (position < 0 ? 34 : 49);
      const rotation = mobile ? 0 : Math.max(-1, Math.min(1, position)) * 3;
      card.style.transform = `translateX(-50%) translate3d(${x}px,${y}px,0) rotate(${rotation}deg) scale(${scale})`;
      card.style.opacity = Math.max(0, Math.min(1, 2 - distance));
      card.style.zIndex = String(Math.round(100 - distance * 10));
    });
  }
  function animate(destination) {
    busy = true;
    const start = offset, startTime = performance.now();
    const duration = reduced.matches ? 0 : 620;
    function tick(now) {
      if (!root.isConnected) return;
      const t = duration ? Math.min(1, (now - startTime) / duration) : 1;
      offset = start + (destination - start) * (1 - Math.pow(1 - t, 4)); draw();
      if (t < 1) { frame = requestAnimationFrame(tick); return; }
      index = wrap(index + destination); offset = 0; busy = false; build();
      if (queued) { const direction = Math.sign(queued); queued -= direction; animate(direction); }
    }
    frame = requestAnimationFrame(tick);
  }
  function step(direction) {
    if (photos.length < 2 || drag) return;
    if (busy) { queued = Math.max(-3, Math.min(3, queued + direction)); return; }
    animate(direction);
  }
  listen(prev, 'click', () => step(-1)); listen(next, 'click', () => step(1));
  listen(root, 'keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  listen(stage, 'pointerdown', e => {
    if (busy || !e.isPrimary || e.button !== 0) return;
    drag = { id:e.pointerId, x:e.clientX, y:e.clientY, dx:0, horizontal:false, moved:false };
  });
  listen(stage, 'pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 8) drag.moved = true;
    if (!drag.horizontal && Math.abs(dx) < 7) return;
    if (!drag.horizontal && Math.abs(dy) > Math.abs(dx)) { finish(e, true); return; }
    drag.horizontal = true; drag.dx = dx; stage.classList.add('is-dragging');
    if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
    if (photos.length < 2) return;
    const stride = stage.clientWidth * (stage.clientWidth <= 600 ? 1.04 : .35);
    offset = Math.max(-1, Math.min(1, -dx / stride));
    cancelAnimationFrame(frame); frame = requestAnimationFrame(draw);
  });
  function finish(e, cancelled = false) {
    if (!drag || e.pointerId !== drag.id) return;
    if (cancelled || drag.moved) suppressClickUntil = performance.now() + 600;
    const destination = !cancelled && photos.length > 1 && Math.abs(drag.dx) > Math.min(55, stage.clientWidth * .12) ? (drag.dx < 0 ? 1 : -1) : 0;
    const id = drag.id; drag = null; stage.classList.remove('is-dragging');
    if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    cancelAnimationFrame(frame);
    if (offset || destination) animate(destination);
  }
  listen(stage, 'pointerup', e => finish(e));
  listen(stage, 'pointercancel', e => finish(e, true));
  listen(stage, 'lostpointercapture', e => finish(e, true));
  const observer = new ResizeObserver(draw);
  observer.observe(stage);
  prev.disabled = next.disabled = photos.length < 2;
  if (photos.length) build(); else { count.textContent = '暂无照片'; }

    return () => {
      requestId++;
      if (lightbox) lightbox.close();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controller.abort();
      drag = null;
      queued = 0;
    };
  }
  function init() {
    for (const [root, dispose] of instances) {
      if (!root.isConnected) { dispose(); instances.delete(root); }
    }
    document.querySelectorAll('script.trip-photos[type="application/json"]').forEach(config => {
      let root = config.closest('.trip-gallery');
      if (root && instances.has(root)) return;
      try {
        const photos = JSON.parse(config.textContent);
        if (!Array.isArray(photos) || photos.some(photo => !photo || typeof photo.src !== 'string' || typeof photo.caption !== 'string')) {
          throw new Error('照片配置必须是包含 src 和 caption 的数组');
        }
        if (!root) {
          const template = document.createElement('template');
          template.innerHTML = "<section class=\"trip-gallery\" aria-label=\"旅行照片\" aria-roledescription=\"轮播图\" tabindex=\"0\">\r\n  <div class=\"trip-stage\" aria-label=\"左右拖动切换照片\"></div>\r\n  <div class=\"trip-controls\">\r\n    <button class=\"trip-arrow trip-prev\" type=\"button\" aria-label=\"上一张照片\"><svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"M19 12H5m6-6-6 6 6 6\"/></svg></button>\r\n    <div class=\"trip-pagination\"><span class=\"trip-count\" aria-hidden=\"true\"></span><div class=\"trip-dots\" aria-hidden=\"true\"></div></div>\r\n    <button class=\"trip-arrow trip-next\" type=\"button\" aria-label=\"下一张照片\"><svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><path d=\"M5 12h14m-6-6 6 6-6 6\"/></svg></button>\r\n  </div>\r\n  <p class=\"trip-sr\" aria-live=\"polite\" aria-atomic=\"true\"></p>\r\n  <noscript>请启用 JavaScript 查看旅行相册。</noscript>\r\n\n\n</section>";
          root = template.content.firstElementChild;
          config.before(root);
          root.append(config);
        }
        instances.set(root, mount(root, photos));
      } catch (error) {
        console.error('[TripGallery]', error);
      }
    });
  }

  window.TripGallery = { init };
  document.addEventListener('pjax:complete', init);
  document.addEventListener('DOMContentLoaded', init, { once: true });
  init();
})();

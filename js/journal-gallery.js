(() => {
  if (window.JournalGallery) { window.JournalGallery.init(); return; }
  let dispose = () => {};
  let mounted;
  function init() {
    const root = document.querySelector('[data-journal]');
    if (root === mounted) return;
    dispose(); mounted = root;
    if (!root) return;
    const controller = new AbortController();
    const on = (el, name, handler) => el.addEventListener(name, handler, { signal: controller.signal });
    const detail = root.querySelector('.journal-detail');
    const detailLayer = root.querySelector('.journal-detail-layer');
    let lightbox = null, opening = false, disposed = false;
    const detailImage = detail.querySelector('img');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set();
    const isDetailOpen = () => !detailLayer.hidden;
    function closeDetail() {
      if (!isDetailOpen() || detail.classList.contains('is-closing') || lightbox) return;
      if (reduced.matches) {
        detailLayer.hidden = true;
        detail.classList.remove('is-open');
        return;
      }
      detail.classList.add('is-closing');
      const timer = setTimeout(() => {
        timers.delete(timer);
        detailLayer.hidden = true;
        detail.classList.remove('is-open', 'is-closing');
      }, 180);
      timers.add(timer);
    }
    root.querySelectorAll('.journal-photo-open').forEach(button => {
      on(button, 'click', () => {
        const photo = button.dataset;
        detailImage.src = button.querySelector('img').src;
        detailImage.alt = photo.title;
        detail.querySelector('h2').textContent = photo.title;
        detail.querySelector('.journal-category').textContent = photo.category;
        detail.querySelector('.journal-detail-location').textContent = photo.location;
        detail.querySelector('.journal-detail-date').textContent = photo.date;
        detail.querySelector('.journal-detail-subtitle').textContent = photo.subtitle;
        detailLayer.hidden = false;
        detail.classList.add('is-open');
        detail.querySelector('.journal-close').focus({ preventScroll: true });
      });
    });
    on(detail.querySelector('.journal-detail-image'), 'click', async () => {
      if (opening || lightbox || detail.classList.contains('is-closing')) return;
      opening = true;
      try {
        if ((!window.PhotoSwipe || !window.PhotoSwipeUI_Default) && window.ensurePhotoSwipeAssets) {
          await window.ensurePhotoSwipeAssets();
        }
        if (!detailImage.complete || !detailImage.naturalWidth) await detailImage.decode();
        if (disposed || !root.isConnected || !isDetailOpen() || detail.classList.contains('is-closing')) return;
        const element = document.querySelector('.pswp');
        if (!element || !window.PhotoSwipe || !window.PhotoSwipeUI_Default || !detailImage.naturalWidth) return;
        const gallery = new window.PhotoSwipe(element, window.PhotoSwipeUI_Default, [{
          src: detailImage.currentSrc || detailImage.src, msrc: detailImage.src,
          w: detailImage.naturalWidth, h: detailImage.naturalHeight
        }], {
          index: 0, history: false, returnFocus: false,
          showAnimationDuration: reduced.matches ? 0 : 280,
          hideAnimationDuration: reduced.matches ? 0 : 220
        });
        lightbox = gallery;
        gallery.listen('destroy', () => {
          lightbox = null;
          if (!disposed && root.isConnected) {
            detail.querySelector('.journal-detail-image').focus({ preventScroll: true });
          }
        });
        if (window.enablePhotoSwipeWebShare) window.enablePhotoSwipeWebShare(gallery);
        gallery.init();
      } catch (error) {
        if (lightbox) lightbox.destroy();
        console.error('[JournalGallery PhotoSwipe]', error);
      } finally { opening = false; }
    });
    on(detail.querySelector('.journal-close'), 'click', closeDetail);
    on(detailLayer, 'click', event => { if (event.target === detailLayer) closeDetail(); });
    on(document, 'keydown', event => {
      if (event.key === 'Escape' && isDetailOpen() && !lightbox) {
        event.preventDefault();
        closeDetail();
      }
    });
    const photos = [...root.querySelectorAll('.journal-photo')];
    const filters = root.querySelector('.journal-filters');
    filters.hidden = false;
    root.querySelector('.journal-total').textContent = `${photos.length} 帧记忆`;
    filters.querySelectorAll('button').forEach(button => on(button, 'click', () => {
      filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      let count = 0;
      photos.forEach(photo => {
        photo.hidden = button.dataset.filter !== 'all' && photo.dataset.category !== button.dataset.filter;
        if (!photo.hidden) count++;
      });
      root.querySelectorAll('.journal-chapter').forEach(chapter => {
        const visible = chapter.querySelectorAll('.journal-photo:not([hidden])');
        chapter.hidden = visible.length === 0;
        chapter.querySelector('.journal-chapter-count').textContent = `${visible.length} 帧记忆`;
        if (!reduced.matches && visible.length) chapter.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
      });
      root.querySelector('.journal-total').textContent = `${count} 帧记忆`;
    }));
    dispose = () => {
      disposed = true;
      controller.abort(); timers.forEach(clearTimeout);
      if (lightbox) lightbox.destroy();
      detailLayer.hidden = true;
      detail.classList.remove('is-open', 'is-closing');
    };
  }
  window.JournalGallery = { init };
  document.addEventListener('DOMContentLoaded', init, { once: true });
  document.addEventListener('pjax:complete', init);
  document.addEventListener('pjax:send', () => { dispose(); mounted = null; });
  init();
})();

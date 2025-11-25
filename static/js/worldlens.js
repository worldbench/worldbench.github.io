document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.videogen-compare').forEach(section => {
    const compare      = section.querySelector('.video-compare-split[data-compare]');
    if (!compare) return;

    const handle       = compare.querySelector('[data-role="split-handle"]');
    const videoGT      = compare.querySelector('[data-role="video-gt"]');
    const videoGen     = compare.querySelector('[data-role="video-gen"]');
    const methodLabel  = compare.querySelector('[data-role="method-label"]');
    const thumbs       = section.querySelectorAll('.thumb');

    // 初始分割线
    compare.style.setProperty('--split', '50%');

    /* ===== 1. 拖拽切割线 ===== */

    let dragging = false;

    function updateSplit(clientX) {
      const rect = compare.getBoundingClientRect();
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0.05, Math.min(0.95, ratio));  // 保留 5%~95%
      const percent = (ratio * 100).toFixed(2) + '%';
      compare.style.setProperty('--split', percent);
    }

    function onPointerDown(e) {
      dragging = true;
      section.classList.add('dragging');
      if (e.type === 'mousedown') {
        updateSplit(e.clientX);
      } else if (e.type === 'touchstart' && e.touches[0]) {
        updateSplit(e.touches[0].clientX);
      }
    }

    function onPointerMove(e) {
      if (!dragging) return;
      if (e.type === 'mousemove') {
        updateSplit(e.clientX);
      } else if (e.type === 'touchmove' && e.touches[0]) {
        updateSplit(e.touches[0].clientX);
      }
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      section.classList.remove('dragging');
    }

    handle.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    handle.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);

    /* ===== 2. 封装一个函数：切换一对 (gtSrc, genSrc) 并同步播放 ===== */

    function switchPair(gtSrc, genSrc) {
      // 暂停当前播放
      videoGT.pause();
      videoGen.pause();

      const currentGtSrc  = videoGT.querySelector('source')?.getAttribute('src') || '';
      const currentGenSrc = videoGen.querySelector('source')?.getAttribute('src') || '';

      // 是否需要替换源
      const needChangeGT  = gtSrc && currentGtSrc !== gtSrc;
      const needChangeGen = genSrc && currentGenSrc !== genSrc;

      // helper：重建 <source>
      const setSource = (videoEl, src) => {
        while (videoEl.firstChild) {
          videoEl.removeChild(videoEl.firstChild);
        }
        const s = document.createElement('source');
        s.src = src;
        s.type = 'video/mp4';
        videoEl.appendChild(s);
        videoEl.load();
      };

      if (needChangeGT) {
        setSource(videoGT, gtSrc);
      }
      if (needChangeGen) {
        setSource(videoGen, genSrc);
      }

      // 如果两边都不需要换 src，只是想从头开始同步
      if (!needChangeGT && !needChangeGen) {
        syncPlayBoth();
        return;
      }

      // 等待两边 metadata，都准备好以后再同步播放
      let gtReady = !needChangeGT;   // 如果没换 src，视为已经 ready
      let genReady = !needChangeGen;

      function trySync() {
        if (gtReady && genReady) {
          videoGT.removeEventListener('loadedmetadata', onGtMeta);
          videoGen.removeEventListener('loadedmetadata', onGenMeta);
          syncPlayBoth();
        }
      }

      function onGtMeta() {
        gtReady = true;
        trySync();
      }

      function onGenMeta() {
        genReady = true;
        trySync();
      }

      if (needChangeGT) {
        videoGT.addEventListener('loadedmetadata', onGtMeta);
      }
      if (needChangeGen) {
        videoGen.addEventListener('loadedmetadata', onGenMeta);
      }

      // 兜底：如果浏览器很快 readyState 就绪，也尝试一下
      setTimeout(() => {
        if (!gtReady && videoGT.readyState >= 1) gtReady = true;
        if (!genReady && videoGen.readyState >= 1) genReady = true;
        trySync();
      }, 50);
    }

    // 同步从 0s 播放两边
    function syncPlayBoth() {
      try { videoGT.currentTime = 0; } catch (e) {}
      try { videoGen.currentTime = 0; } catch (e) {}

      videoGT.play().catch(() => {});
      videoGen.play().catch(() => {});
    }

    /* ===== 3. 缩略图点击：读取 data-gt-src & data-gen-src，切换一对 ===== */

    thumbs.forEach(btn => {
      btn.addEventListener('click', () => {
        // 更新选中样式
        thumbs.forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');

        const gtSrc  = btn.getAttribute('data-gt-src');   // 可能为空：兼容“单一GT”模式
        const genSrc = btn.getAttribute('data-gen-src');
        const label  = btn.getAttribute('data-label') || btn.textContent.trim();

        // 同时切换 GT + Gen（或只切 Gen）
        switchPair(gtSrc, genSrc);

        // 更新右下角文案
        methodLabel.textContent = label;
      });
    });
  });
});

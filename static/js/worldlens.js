document.addEventListener('DOMContentLoaded', () => {
  // 支持多个对比 section
  document.querySelectorAll('.videogen-compare').forEach(section => {
    const compare     = section.querySelector('.video-compare-split[data-compare]');
    if (!compare) return;

    const handle      = compare.querySelector('[data-role="split-handle"]');
    const videoGT     = compare.querySelector('[data-role="video-gt"]');
    const videoGen    = compare.querySelector('[data-role="video-gen"]');
    const methodLabel = compare.querySelector('[data-role="method-label"]');
    const thumbs      = section.querySelectorAll('.thumb');

    // 初始切割在 50%
    compare.style.setProperty('--split', '50%');

    /* ===== 1. 拖拽切割线 ===== */

    let dragging = false;

    function updateSplit(clientX) {
      const rect = compare.getBoundingClientRect();
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0.05, Math.min(0.95, ratio));   // 5% ~ 95%
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

    /* ===== 2. 缩略图切换生成方法 + 时间同步 ===== */

    thumbs.forEach(btn => {
      btn.addEventListener('click', () => {
        // 更新 active 状态
        thumbs.forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');

        const genSrc = btn.getAttribute('data-gen-src');
        const label  = btn.getAttribute('data-label') || btn.textContent.trim();

        // 一个小工具函数：让两边从 0 开始同时播放
        const syncPlayBoth = () => {
          try {
            videoGT.currentTime = 0;
          } catch (e) {}
          try {
            videoGen.currentTime = 0;
          } catch (e) {}

          videoGT.play().catch(() => {});
          videoGen.play().catch(() => {});
        };

        if (genSrc) {
          // 如果是新 src：重建 <source> + load，再在 loadedmetadata 后同步播放
          const currentSrc = videoGen.querySelector('source')?.getAttribute('src') || '';
          const needReload = currentSrc !== genSrc;

          if (needReload) {
            while (videoGen.firstChild) {
              videoGen.removeChild(videoGen.firstChild);
            }
            const source = document.createElement('source');
            source.src = genSrc;
            source.type = 'video/mp4';
            videoGen.appendChild(source);

            // 先暂停一下，避免中途画面乱跳
            videoGen.pause();
            videoGT.pause();

            // 重新加载生成视频
            videoGen.load();

            // 等 metadata 出来之后，再 seek 到 0 并同步播放
            const handler = () => {
              videoGen.removeEventListener('loadedmetadata', handler);
              syncPlayBoth();
            };
            videoGen.addEventListener('loadedmetadata', handler);
          } else {
            // 如果已经是同一个 src，只需要从头开始同步播放
            syncPlayBoth();
          }
        } else {
          // 没有 genSrc 的话就只同步当前两个视频
          syncPlayBoth();
        }

        // 更新右下角方法标签
        methodLabel.textContent = label;
      });
    });
  });
});

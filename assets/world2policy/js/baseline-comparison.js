(() => {
  'use strict';

  const cards = [...document.querySelectorAll('.comparison-case')];
  const players = [];

  cards.forEach(card => {
    const videos = [...card.querySelectorAll('video')];
    const button = card.querySelector('.comparison-toggle');
    const seek = card.querySelector('.comparison-seek');
    const timeLabel = card.querySelector('.comparison-time');
    const status = card.querySelector('.comparison-status');
    const name = card.querySelector('h3').textContent;
    let duration = Number(seek.max);
    let master = videos[0];
    let loaded = false;
    let running = false;
    let wanted = false;
    let scrubbing = false;
    let frame = 0;
    let pending = null;

    const setPlaying = playing => {
      card.dataset.playing = String(playing);
      button.querySelector('span').textContent = playing ? 'Pause' : 'Play both';
      button.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + name + ' comparison');
    };
    const updateTimeline = () => {
      const time = Math.min(master.currentTime || 0, duration);
      if (!scrubbing) seek.value = String(time);
      seek.style.setProperty('--progress', (time / duration * 100) + '%');
      seek.setAttribute('aria-valuetext', time.toFixed(1) + ' of ' + duration.toFixed(1) + ' seconds');
      timeLabel.textContent = time.toFixed(1) + ' / ' + duration.toFixed(1) + ' s';
      videos.forEach(video => {
        const ended = Number.isFinite(video.duration) && video.currentTime >= video.duration - .04;
        video.closest('.comparison-method').dataset.ended = String(ended);
      });
    };
    const updateDuration = () => {
      if (!videos.every(video => Number.isFinite(video.duration) && video.duration > 0)) return;
      // Follow the longer rollout so neither method's ending is cut off.
      master = videos.reduce((longest, video) => video.duration > longest.duration ? video : longest);
      duration = master.duration;
      seek.max = String(duration);
      seek.disabled = false;
      videos.forEach(video => {
        video.closest('.comparison-method').querySelector('time').textContent = video.duration.toFixed(1) + ' s';
      });
      updateTimeline();
    };
    const pauseMedia = () => {
      running = false;
      if (pending) pending.abort();
      pending = null;
      cancelAnimationFrame(frame);
      videos.forEach(video => video.pause());
      setPlaying(false);
    };
    const pause = () => {
      wanted = false;
      pauseMedia();
      if (card.dataset.error !== 'true') status.textContent = '';
    };
    const moveTo = time => {
      videos.forEach(video => {
        if (video.readyState > 0) video.currentTime = Math.min(time, video.duration);
      });
      updateTimeline();
    };
    const finish = () => {
      pause();
      moveTo(duration);
      status.textContent = 'Comparison complete. Replay to watch again.';
    };
    const ensureLoaded = () => {
      if (loaded && videos.every(video => !video.error && video.networkState !== 3)) return;
      loaded = true;
      videos.forEach(video => { video.preload = 'auto'; video.load(); });
    };
    const ready = (video, signal) => new Promise((resolve, reject) => {
      const isReady = () => !video.seeking && (video.readyState >= 3 ||
        (video.readyState >= 2 && video.currentTime >= video.duration - .04));
      if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      if (video.error) { reject(new Error('media')); return; }
      if (isReady()) { resolve(); return; }
      const clean = () => {
        clearTimeout(timeout);
        video.removeEventListener('canplay', check);
        video.removeEventListener('seeked', check);
        video.removeEventListener('error', fail);
        signal.removeEventListener('abort', abort);
      };
      const check = () => { if (isReady()) { clean(); resolve(); } };
      const fail = () => { clean(); reject(new Error('media')); };
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      const timeout = setTimeout(fail, 20000);
      video.addEventListener('canplay', check);
      video.addEventListener('seeked', check);
      video.addEventListener('error', fail);
      signal.addEventListener('abort', abort, { once: true });
    });
    const tick = () => {
      if (!running) return;
      const time = master.currentTime;
      if (time >= duration - .04 || master.ended) { finish(); return; }
      videos.forEach(video => {
        if (video === master || video.seeking || time >= video.duration - .04) return;
        if (Math.abs(video.currentTime - time) > .14) video.currentTime = time;
      });
      updateTimeline();
      frame = requestAnimationFrame(tick);
    };
    async function start() {
      if (!wanted || running || pending || document.hidden || scrubbing) return;
      // Keep attention on one comparison at a time.
      players.forEach(player => { if (player.card !== card) player.pause(); });
      ensureLoaded();
      const controller = new AbortController();
      pending = controller;
      card.dataset.error = 'false';
      setPlaying(true);
      status.textContent = 'Loading the paired videos…';
      try {
        await Promise.all(videos.map(video => ready(video, controller.signal)));
        if (controller.signal.aborted) return;
        updateDuration();
        const time = master.currentTime >= duration - .04 ? 0 : master.currentTime;
        moveTo(time);
        await Promise.all(videos.map(video => ready(video, controller.signal)));
        if (controller.signal.aborted) return;
        const activeVideos = videos.filter(video => time < video.duration - .04);
        await Promise.all(activeVideos.map(video => video.play()));
        if (controller.signal.aborted) return;
        pending = null;
        running = true;
        status.textContent = '';
        setPlaying(true);
        frame = requestAnimationFrame(tick);
      } catch (error) {
        if (controller.signal.aborted) return;
        pause();
        card.dataset.error = 'true';
        status.textContent = 'Playback could not start. Press Play both to retry.';
      }
    }

    button.addEventListener('click', () => {
      if (wanted) pause();
      else { wanted = true; start(); }
    });
    card.querySelector('.comparison-replay').addEventListener('click', () => {
      pauseMedia();
      moveTo(0);
      wanted = true;
      start();
    });
    seek.addEventListener('input', () => {
      if (!scrubbing) { scrubbing = true; pauseMedia(); }
      moveTo(Number(seek.value));
    });
    seek.addEventListener('change', () => { scrubbing = false; if (wanted) start(); });
    videos.forEach(video => {
      video.controls = false;
      video.addEventListener('loadedmetadata', updateDuration);
      video.addEventListener('seeked', updateTimeline);
      video.addEventListener('ended', () => {
        if (running && video === master) finish();
        else updateTimeline();
      });
      video.addEventListener('waiting', () => {
        if (!running || scrubbing || video.currentTime >= video.duration - .04) return;
        pauseMedia();
        start();
      });
      video.addEventListener('error', () => {
        // A cancelled preload can dispatch a stale event after load() resets it.
        if (!video.error) return;
        pause();
        loaded = false;
        seek.disabled = true;
        card.dataset.error = 'true';
        status.textContent = 'A video could not be loaded. Press Play both to retry.';
      });
    });
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) pause();
      else ensureLoaded();
    }, { threshold: 0 });
    observer.observe(card);
    card.querySelector('.comparison-controls').hidden = false;
    players.push({ card, pause });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) players.forEach(player => player.pause());
  });
})();

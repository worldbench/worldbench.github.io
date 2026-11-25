(() => {
  'use strict';

  const player = document.querySelector('.results-player');
  if (!player) return;
  const videos = [...player.querySelectorAll('video')];
  const cards = [...document.querySelectorAll('.results-card')];
  const playButton = player.querySelector('.results-play');
  const seek = player.querySelector('.results-seek');
  const speed = player.querySelector('.results-speed');
  const timeLabel = player.querySelector('.results-time');
  const status = player.querySelector('.results-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let duration = Number(seek.max);
  let loaded = false;
  let wanted = false;
  let visible = false;
  let running = false;
  let frame = 0;
  let pending = null;
  let scrubbing = false;

  const number = (value) => String(value + 1).padStart(2, '0');
  const setStatus = (message) => { status.textContent = message; };
  const setPlaying = (playing) => {
    player.dataset.playing = String(playing);
    playButton.querySelector('span').textContent = playing ? 'Pause' : 'Play all';
    playButton.setAttribute('aria-label', playing ? 'Pause all three views' : 'Play all three views');
  };
  const updateTimeline = () => {
    const time = Math.min(videos[0].currentTime || 0, duration);
    if (!scrubbing) seek.value = String(time);
    seek.style.setProperty('--progress', (time / duration * 100) + '%');
    seek.setAttribute('aria-valuetext', time.toFixed(1) + ' of ' + duration.toFixed(1) + ' seconds');
    timeLabel.textContent = time.toFixed(1) + ' / ' + duration.toFixed(1) + ' s';
  };
  const updateDuration = () => {
    if (!videos.every(video => Number.isFinite(video.duration) && video.duration > 0)) return;
    // Stop at the shared endpoint; a few Scene clips contain one extra frame.
    duration = Math.min(...videos.map(video => video.duration));
    seek.max = String(duration);
    seek.disabled = false;
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
    if (player.dataset.error !== 'true') setStatus('');
  };
  const moveTo = (time) => {
    videos.forEach(video => {
      if (video.readyState > 0) video.currentTime = Math.min(time, duration);
    });
    updateTimeline();
  };
  const finish = () => {
    pause();
    moveTo(duration);
    setStatus('Playback complete. Replay to watch again.');
  };
  const ensureLoaded = () => {
    if (loaded) return;
    loaded = true;
    videos.forEach(video => { video.preload = 'auto'; video.load(); });
  };
  const ready = (video, signal) => new Promise((resolve, reject) => {
    if (video.error) { reject(new Error('media')); return; }
    if (video.readyState >= 3 && !video.seeking) { resolve(); return; }
    const clean = () => {
      clearTimeout(timeout);
      video.removeEventListener('canplay', check);
      video.removeEventListener('seeked', check);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const check = () => { if (video.readyState >= 3 && !video.seeking) { clean(); resolve(); } };
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
    const time = videos[0].currentTime;
    if (time >= duration - .04 || videos.some(video => video.ended)) {
      finish();
      return;
    }
    videos.slice(1).forEach(video => {
      if (!video.seeking && Math.abs(video.currentTime - time) > .14) video.currentTime = time;
    });
    updateTimeline();
    frame = requestAnimationFrame(tick);
  };
  async function start() {
    if (pending || running || !wanted || document.hidden || !visible || scrubbing) return;
    ensureLoaded();
    const controller = new AbortController();
    pending = controller;
    player.dataset.error = 'false';
    setPlaying(true);
    setStatus('Loading the three views…');
    try {
      await Promise.all(videos.map(video => ready(video, controller.signal)));
      if (controller.signal.aborted) return;
      updateDuration();
      const time = videos[0].currentTime >= duration - .04 ? 0 : videos[0].currentTime;
      moveTo(time);
      await Promise.all(videos.map(video => ready(video, controller.signal)));
      if (controller.signal.aborted) return;
      videos.forEach(video => { video.playbackRate = Number(speed.value); });
      await Promise.all(videos.map(video => video.play()));
      if (controller.signal.aborted) return;
      pending = null;
      running = true;
      setStatus('');
      setPlaying(true);
      frame = requestAnimationFrame(tick);
    } catch (error) {
      if (controller.signal.aborted) return;
      pause();
      player.dataset.error = 'true';
      setStatus('Playback could not start. Press Play all to retry, or choose another scenario.');
    }
  }

  function selectScenario(nextIndex, play) {
    pauseMedia();
    index = (nextIndex + cards.length) % cards.length;
    // Asset IDs stay with their videos; visible labels follow the current gallery order.
    const scenario = Number(cards[index].dataset.scenario);
    wanted = play;
    loaded = false;
    seek.disabled = true;
    seek.value = '0';
    seek.style.setProperty('--progress', '0%');
    duration = Number(cards[index].querySelector('.results-card-meta span').textContent.replace('s', ''));
    seek.max = String(duration);
    timeLabel.textContent = '0.0 / ' + duration.toFixed(1) + ' s';
    player.dataset.error = 'false';
    cards.forEach((card, i) => {
      if (i === index) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
    player.querySelector('.results-index').textContent = number(index);
    player.querySelector('#results-current-title').textContent = 'Scenario ' + number(index);
    player.querySelector('.results-count').textContent = number(index) + ' / ' + cards.length;
    videos.forEach(video => {
      const view = video.closest('[data-view]').dataset.view;
      const path = 'assets/world2policy/videos/closed_loop/' + scenario + '_' + view + '.mp4';
      video.poster = 'assets/world2policy/posters/closed_loop/' + scenario + '_' + view + '.jpg';
      video.src = path;
      video.querySelector('a').href = path;
      video.setAttribute('aria-label', 'Scenario ' + number(index) + ', ' + view + ' view');
    });
    setStatus('Scenario ' + number(index) + ' selected.');
    ensureLoaded();
    if (play) start();
  }

  playButton.addEventListener('click', () => {
    if (wanted) pause();
    else { wanted = true; start(); }
  });
  player.querySelector('.results-replay').addEventListener('click', () => {
    pauseMedia();
    moveTo(0);
    wanted = true;
    start();
  });
  player.querySelector('.results-previous').addEventListener('click', () => selectScenario(index - 1, wanted));
  player.querySelector('.results-next').addEventListener('click', () => selectScenario(index + 1, wanted));
  cards.forEach((card, i) => card.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectScenario(i, !reducedMotion.matches);
    const bounds = player.getBoundingClientRect();
    if (bounds.top < 100 || bounds.bottom > window.innerHeight) {
      player.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    }
  }));
  seek.addEventListener('input', () => {
    if (!scrubbing) { scrubbing = true; pauseMedia(); }
    const time = Number(seek.value);
    moveTo(time);
  });
  seek.addEventListener('change', () => { scrubbing = false; if (wanted) start(); });
  speed.addEventListener('change', () => videos.forEach(video => { video.playbackRate = Number(speed.value); }));
  videos.forEach(video => {
    video.controls = false;
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('seeked', updateTimeline);
    video.addEventListener('ended', () => { if (running) finish(); });
    video.addEventListener('error', () => {
      pause();
      player.dataset.error = 'true';
      setStatus('A video could not be loaded. Choose another scenario or reload the page to try again.');
    });
    video.addEventListener('waiting', () => {
      if (!running || scrubbing) return;
      if (video.currentTime >= duration - .04) { finish(); return; }
      pauseMedia();
      start();
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseMedia();
    else if (wanted) start();
  });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) {
      ensureLoaded();
      if (wanted) start();
    } else pauseMedia();
  }, { threshold: 0 });
  observer.observe(player);
  player.querySelector('.results-controls').hidden = false;
  player.querySelector('.results-nav').hidden = false;
})();

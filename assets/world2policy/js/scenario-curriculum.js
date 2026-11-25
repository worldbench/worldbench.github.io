(() => {
  'use strict';

  const player = document.querySelector('.curriculum-player');
  const data = window.WORLD2POLICY_CURRICULUM;
  if (!player || !Array.isArray(data) || !data.length) return;
  const videos = [...player.querySelectorAll('video')];
  const stages = [...player.querySelectorAll('.curriculum-stage')];
  const steps = [...player.querySelectorAll('.curriculum-level-step')];
  const sceneButtons = [...document.querySelectorAll('.curriculum-scene-button')];
  const toggle = player.querySelector('.curriculum-main-play');
  const seek = player.querySelector('.curriculum-seek');
  const time = player.querySelector('.curriculum-global-time');
  const status = player.querySelector('.curriculum-loop-status');
  const modeLabel = player.querySelector('.curriculum-play-mode');
  const modeButton = player.querySelector('.curriculum-mode');
  const levelNames = ['Easy', 'Medium', 'Hard', 'Extreme'];
  let sceneIndex = 0;
  let level = 0;
  let mode = 'sequence';
  let wanted = false;
  let running = false;
  let visible = false;
  let pending = null;
  let frame = 0;
  let scrubbing = false;
  let finished = false;
  const pendingTime = new WeakMap();

  const clips = () => data[sceneIndex].stages.map(options => options[0]);
  const durations = () => clips().map(clip => clip.duration);
  const total = () => mode === 'sequence' ? durations().reduce((sum, duration) => sum + duration, 0) : Math.max(...durations());
  const setPlaying = playing => {
    player.dataset.playing = String(playing);
    toggle.querySelector('span').textContent = playing ? 'Pause' : (mode === 'sequence' ? 'Play curriculum' : 'Play together');
    toggle.setAttribute('aria-label', playing ? 'Pause curriculum playback' : (mode === 'sequence' ? 'Play curriculum from easy to extreme' : 'Play all four difficulties together'));
  };
  const setStage = () => {
    steps.forEach((step, index) => {
      if (mode === 'sequence' && index === level) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    stages.forEach((stage, index) => {
      stage.dataset.active = String(mode === 'together' || index === level);
      stage.querySelector('.curriculum-stage-state').textContent = index === level && mode === 'sequence' ? 'Current level' : 'Closed-loop rollout';
    });
    modeLabel.textContent = mode === 'sequence' ? 'Easy → Medium → Hard → Extreme' : 'Four levels · Shared start';
    modeButton.querySelector('span').textContent = mode === 'sequence' ? 'Play together' : 'Play in order';
    modeButton.setAttribute('aria-label', mode === 'sequence' ? 'Switch to simultaneous comparison' : 'Switch to easy-to-extreme playback');
  };
  const timeline = () => {
    const lengths = durations();
    const duration = total();
    const master = mode === 'sequence' ? videos[level] : videos[lengths.indexOf(Math.max(...lengths))];
    const offset = mode === 'sequence' ? lengths.slice(0, level).reduce((sum, value) => sum + value, 0) : 0;
    const current = finished ? duration : Math.min(offset + (master.currentTime || 0), duration);
    seek.max = String(duration);
    if (!scrubbing) seek.value = String(current);
    seek.style.setProperty('--progress', (current / duration * 100) + '%');
    seek.setAttribute('aria-valuetext', current.toFixed(1) + ' of ' + duration.toFixed(1) + ' seconds');
    time.textContent = current.toFixed(1) + ' / ' + duration.toFixed(1) + ' s';
    videos.forEach((video, index) => {
      const localSeek = stages[index].querySelector('.curriculum-mini-seek');
      const localTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      localSeek.max = String(lengths[index]);
      localSeek.value = String(localTime);
      localSeek.style.setProperty('--progress', Math.min(localTime / lengths[index], 1) * 100 + '%');
      stages[index].querySelector('.curriculum-clip-time').textContent = localTime.toFixed(1) + ' s';
      const wrapper = stages[index].querySelector('.curriculum-video-wrap');
      wrapper.dataset.playing = String(!video.paused);
      wrapper.dataset.isPoster = String(localTime === 0 && video.paused);
      stages[index].querySelector('.curriculum-clip-play').setAttribute('aria-label', (video.paused ? 'Play ' : 'Pause ') + levelNames[index] + ' scenario');
    });
  };
  const halt = () => {
    running = false;
    if (pending) pending.abort();
    pending = null;
    cancelAnimationFrame(frame);
    videos.forEach(video => video.pause());
    setPlaying(false);
    timeline();
  };
  const pause = () => {
    wanted = false;
    halt();
    if (!finished) status.textContent = '';
  };
  const ensureLoaded = video => {
    if (video.dataset.loaded === 'true' && !video.error) return;
    video.dataset.loaded = 'true';
    video.preload = 'auto';
    video.load();
  };
  const ready = (video, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    if (video.error) { reject(new Error('media')); return; }
    const available = () => !video.seeking && (video.readyState >= 3 || (video.readyState >= 2 && video.currentTime >= video.duration - .04));
    if (available()) { resolve(); return; }
    const clean = () => {
      clearTimeout(timer);
      video.removeEventListener('canplay', check);
      video.removeEventListener('seeked', check);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const check = () => { if (available()) { clean(); resolve(); } };
    const fail = () => { clean(); reject(new Error('media')); };
    const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(fail, 20000);
    video.addEventListener('canplay', check);
    video.addEventListener('seeked', check);
    video.addEventListener('error', fail);
    signal.addEventListener('abort', abort, { once: true });
  });
  const resetTimes = () => {
    videos.forEach(video => { pendingTime.delete(video); if (video.readyState > 0) video.currentTime = 0; });
    finished = false;
  };
  const complete = () => {
    wanted = false;
    finished = true;
    halt();
    timeline();
    status.textContent = mode === 'sequence' ? 'Curriculum complete. Four difficulty levels, from easy to extreme.' : 'Comparison complete. Replay or select a difficulty to explore again.';
  };
  const nextLevel = () => {
    if (!running || mode !== 'sequence') return;
    if (level === videos.length - 1) { complete(); return; }
    halt();
    level += 1;
    pendingTime.delete(videos[level]);
    if (videos[level].readyState > 0) videos[level].currentTime = 0;
    setStage();
    timeline();
    start();
  };
  const tick = () => {
    if (!running) return;
    const lengths = durations();
    if (mode === 'sequence') {
      const video = videos[level];
      if (video.currentTime >= lengths[level] - .025 || video.ended) { nextLevel(); return; }
    } else {
      const master = videos[lengths.indexOf(Math.max(...lengths))];
      if (master.currentTime >= master.duration - .025 || master.ended) { complete(); return; }
      videos.forEach(video => {
        if (video === master || video.seeking || master.currentTime >= video.duration - .04) return;
        if (Math.abs(video.currentTime - master.currentTime) > .15) video.currentTime = master.currentTime;
      });
    }
    timeline();
    frame = requestAnimationFrame(tick);
  };
  async function start() {
    if (!wanted || running || pending || document.hidden || !visible || scrubbing) return;
    const controller = new AbortController();
    pending = controller;
    setPlaying(true);
    status.textContent = 'Loading ' + (mode === 'sequence' ? levelNames[level] + ' scenario…' : 'the four scenarios…');
    const active = mode === 'sequence' ? [videos[level]] : videos;
    active.forEach(ensureLoaded);
    try {
      await Promise.all(active.map(video => ready(video, controller.signal)));
      if (controller.signal.aborted) return;
      const playable = active.filter(video => video.currentTime < video.duration - .04);
      await Promise.all(playable.map(video => video.play()));
      if (controller.signal.aborted) return;
      pending = null;
      running = true;
      setPlaying(true);
      status.textContent = mode === 'sequence' ? 'Now playing ' + levelNames[level] + ' · ' + (level + 1) + ' of 4' : 'All four levels start together. Shorter clips keep their final frame.';
      // Preload the next stage only after the current one starts playing.
      if (mode === 'sequence' && videos[level + 1]) ensureLoaded(videos[level + 1]);
      timeline();
      frame = requestAnimationFrame(tick);
    } catch (error) {
      if (controller.signal.aborted) return;
      pause();
      status.textContent = 'This video could not start. Press Play to retry, or choose another scene.';
    }
  }
  function selectLevel(index, play) {
    halt();
    mode = 'sequence';
    level = index;
    finished = false;
    if (videos[level].readyState > 0) videos[level].currentTime = 0;
    setStage();
    timeline();
    wanted = play;
    if (play) start();
    else status.textContent = levelNames[level] + ' selected. Press Play to continue in difficulty order.';
  }
  function selectScene(index) {
    pause();
    sceneIndex = (index + data.length) % data.length;
    level = 0;
    finished = false;
    mode = 'sequence';
    setPlaying(false);
    const group = data[sceneIndex];
    player.querySelector('#curriculum-current-title').textContent = group.label;
    player.querySelector('.curriculum-current p').textContent = group.subtitle;
    player.querySelector('.curriculum-dataset-count').textContent = String(sceneIndex + 1).padStart(2, '0') + ' / ' + String(data.length).padStart(2, '0');
    sceneButtons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === sceneIndex));
    });
    stages[1].querySelector('.curriculum-stage-state').hidden = false;
    clips().forEach((clip, index) => {
      const video = videos[index];
      pendingTime.delete(video);
      video.dataset.loaded = 'false';
      video.preload = 'none';
      video.poster = clip.poster;
      video.src = clip.video;
      video.querySelector('a').href = clip.video;
      video.setAttribute('aria-label', group.label + ', ' + levelNames[index] + ' scenario');
      stages[index].querySelector('time').textContent = clip.duration.toFixed(1) + ' s';
    });
    setStage();
    seek.value = '0';
    seek.style.setProperty('--progress', '0%');
    timeline();
    status.textContent = 'Ready to explore ' + group.label + ' from easy to extreme.';
  }

  toggle.addEventListener('click', () => {
    if (wanted) { pause(); return; }
    if (finished) { resetTimes(); level = 0; setStage(); }
    wanted = true;
    start();
  });
  player.querySelector('.curriculum-replay').addEventListener('click', () => {
    halt();
    resetTimes();
    level = 0;
    setStage();
    wanted = true;
    start();
  });
  modeButton.addEventListener('click', () => {
    pause();
    resetTimes();
    level = 0;
    mode = mode === 'sequence' ? 'together' : 'sequence';
    setStage();
    timeline();
    wanted = true;
    start();
  });
  steps.forEach((step, index) => step.addEventListener('click', () => selectLevel(index, true)));
  stages.forEach((stage, index) => {
    stage.querySelector('.curriculum-clip-play').addEventListener('click', () => {
      if (!videos[index].paused) { pause(); return; }
      if (mode !== 'sequence' || level !== index || videos[index].ended) selectLevel(index, true);
      else { wanted = true; start(); }
    });
    const localSeek = stage.querySelector('.curriculum-mini-seek');
    localSeek.addEventListener('input', () => {
      const target = Number(localSeek.value);
      pause();
      mode = 'sequence';
      level = index;
      finished = false;
      ensureLoaded(videos[index]);
      if (videos[index].readyState > 0) videos[index].currentTime = target;
      else pendingTime.set(videos[index], target);
      setStage();
      timeline();
    });
  });
  sceneButtons.forEach((button, index) => button.addEventListener('click', () => selectScene(index)));
  player.querySelector('.curriculum-previous').addEventListener('click', () => selectScene(sceneIndex - 1));
  player.querySelector('.curriculum-next').addEventListener('click', () => selectScene(sceneIndex + 1));
  seek.addEventListener('input', () => {
    if (!scrubbing) { scrubbing = true; halt(); }
    finished = false;
    const target = Number(seek.value);
    const lengths = durations();
    if (mode === 'sequence') {
      let offset = 0;
      level = lengths.length - 1;
      for (let index = 0; index < lengths.length; index++) {
        if (target < offset + lengths[index] || index === lengths.length - 1) { level = index; break; }
        offset += lengths[index];
      }
      ensureLoaded(videos[level]);
      const value = Math.min(target - offset, lengths[level]);
      if (videos[level].readyState > 0) videos[level].currentTime = value;
      else pendingTime.set(videos[level], value);
    } else {
      videos.forEach((video, index) => {
        ensureLoaded(video);
        if (video.readyState > 0) video.currentTime = Math.min(target, lengths[index]);
      });
    }
    setStage();
    timeline();
  });
  seek.addEventListener('change', () => { scrubbing = false; if (wanted) start(); });
  videos.forEach((video, index) => {
    video.controls = false;
    video.loop = false;
    video.addEventListener('loadedmetadata', () => {
      const target = pendingTime.get(video);
      if (target !== undefined) {
        pendingTime.delete(video);
        video.currentTime = Math.min(target, video.duration);
      }
      timeline();
    });
    video.addEventListener('seeked', timeline);
    video.addEventListener('ended', () => {
      if (!running) return;
      if (mode === 'sequence' && level === index) nextLevel();
      else if (mode === 'together' && durations()[index] === Math.max(...durations())) complete();
      else timeline();
    });
    video.addEventListener('error', () => {
      if (!video.error || video.dataset.loaded !== 'true') return;
      pause();
      video.dataset.loaded = 'false';
      status.textContent = 'A video could not be loaded. Press Play to retry or select another scene.';
    });
  });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) pause();
  }, { threshold: 0 });
  observer.observe(player);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  player.querySelector('.curriculum-playback').hidden = false;
  player.querySelector('.curriculum-dataset-nav').hidden = false;
  document.querySelector('.curriculum-scene-picker').hidden = false;
  steps.forEach(step => { step.disabled = false; });
  selectScene(0);
})();

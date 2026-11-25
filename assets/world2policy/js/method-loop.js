(() => {
  'use strict';

  const root = document.querySelector('#method-loop');
  if (!root) return;

  const steps = [
    {
      title: 'Optimize complementary experts',
      description: 'Train the three experts on the current curriculum with constrained PPO. The frozen, risk-aware selector combines their proposals into the current driving policy.',
      equation: 'Π<sub>k</sub> = Train(𝒟<sub>k</sub>)',
      duration: 3200, route: null,
    },
    {
      title: 'Discover what the policy still gets wrong',
      description: 'Roll out the current policy on the failure-mining pool. Extract the interactions preceding failures, retaining cases with a safe, comfortable alternative that makes progress.',
      equation: 'Π<sub>k</sub> + 𝒱 → ℱ<sub>k+1</sub>',
      duration: 3400, route: 'rollout',
    },
    {
      title: 'Turn failures into targeted challenges',
      description: 'CEM perturbs critical actors while keeping the reconstructed background fixed. Accept scenarios near the policy’s capability boundary only after validity and recoverability checks.',
      equation: 'ℱ<sub>k+1</sub> → 𝒢<sub>k+1</sub>',
      duration: 3600, route: null,
    },
    {
      title: 'Expand the training curriculum',
      description: 'Merge accepted scenarios with the existing training pool. The next curriculum keeps previous experience while adding challenges tailored to the current policy’s weaknesses.',
      equation: '𝒟<sub>k+1</sub> = 𝒟<sub>k</sub> ∪ 𝒢<sub>k+1</sub>',
      duration: 2800, route: 'curriculum',
    },
    {
      title: 'Improve the policy. Close the loop.',
      description: 'Update the experts on the expanded curriculum, with the base planner and selector frozen. The resulting policy exposes new residual failures, starting the next round of scenario generation.',
      equation: 'Π<sub>k+1</sub> = Train(𝒟<sub>k+1</sub>)',
      duration: 3400, route: 'return',
    },
  ];

  const board = root.querySelector('.flow-board');
  const policy = root.querySelector('.flow-policy');
  const environment = root.querySelector('.flow-environment');
  const curriculum = root.querySelector('.flow-curriculum');
  const input = root.querySelector('.flow-input');
  const output = root.querySelector('.flow-policy-output');
  const mining = root.querySelector('.flow-mine');
  const svg = root.querySelector('.flow-wires');
  const packets = root.querySelector('.flow-packets');
  const dots = [...packets.querySelectorAll('circle')];
  const routes = new Map([...root.querySelectorAll('[data-route]')].map(path => [path.dataset.route, path]));
  const buttons = [...root.querySelectorAll('[data-step]')];
  const highlights = [...root.querySelectorAll('[data-highlight]')];
  const toggle = root.querySelector('.flow-toggle');
  const announcement = root.querySelector('.flow-announcement');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileLayout = window.matchMedia('(max-width: 900px)');
  let currentStep = 0;
  let elapsed = 0;
  let previousTime = null;
  let frame = null;
  let inView = false;
  let playing = !motionPreference.matches;
  let activePath = null;
  let activeLength = 0;
  let routeLengths = new Map();

  const getBox = (element, origin) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left - origin.left, right: box.right - origin.left,
      top: box.top - origin.top, bottom: box.bottom - origin.top,
      x: box.left + box.width / 2 - origin.left,
      y: box.top + box.height / 2 - origin.top,
    };
  };

  // Round every turn, keeping routes in the gutters between HTML panels.
  const roundedRoute = (points, radius = 13) => {
    let path = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i += 1) {
      const [x, y] = points[i];
      const previous = points[i - 1];
      const next = points[i + 1];
      const before = Math.hypot(x - previous[0], y - previous[1]);
      const after = Math.hypot(next[0] - x, next[1] - y);
      const r = Math.min(radius, before / 2, after / 2);
      if (!before || !after) continue;
      path += ` L ${x + (previous[0] - x) * r / before} ${y + (previous[1] - y) * r / before}`;
      path += ` Q ${x} ${y} ${x + (next[0] - x) * r / after} ${y + (next[1] - y) * r / after}`;
    }
    return `${path} L ${points.at(-1)[0]} ${points.at(-1)[1]}`;
  };

  const updateActiveRoute = () => {
    const route = steps[currentStep].route;
    activePath = routes.get(route) || null;
    activeLength = routeLengths.get(route) || 0;
    routes.forEach((path, name) => path.classList.toggle('is-active', name === route));
    packets.style.fill = route === 'rollout' ? 'var(--policy)' : 'var(--environment)';
  };

  const drawPackets = () => {
    if (!activePath || !activeLength || motionPreference.matches) {
      packets.style.visibility = 'hidden';
      return;
    }
    packets.style.visibility = 'visible';
    const progress = (elapsed % 2100) / 2100;
    dots.forEach((dot, index) => {
      const offset = index === 2 ? .07 : 0;
      const point = activePath.getPointAtLength(((progress - offset + 1) % 1) * activeLength);
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
    });
  };

  const drawRoutes = () => {
    const origin = board.getBoundingClientRect();
    const p = getBox(policy, origin);
    const e = getBox(environment, origin);
    const c = getBox(curriculum, origin);
    const training = getBox(input, origin);
    const result = getBox(output, origin);
    const failure = getBox(mining, origin);
    svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);

    if (mobileLayout.matches) {
      routes.get('rollout').setAttribute('d', roundedRoute([[p.x,p.bottom],[e.x,e.top - 3]]));
      routes.get('curriculum').setAttribute('d', roundedRoute([[e.x,e.bottom],[c.x,c.top - 3]]));
      routes.get('return').setAttribute('d', roundedRoute([[c.left,c.y],[8,c.y],[8,training.y],[p.left - 3,training.y]], 10));
    } else {
      const gutter = (p.right + e.left) / 2;
      routes.get('rollout').setAttribute('d', roundedRoute([[p.right,result.y],[gutter,result.y],[gutter,failure.y],[e.left - 3,failure.y]]));
      routes.get('curriculum').setAttribute('d', roundedRoute([[e.x,e.bottom],[e.x,e.bottom + 24],[origin.width - 8,e.bottom + 24],[origin.width - 8,c.y],[c.right + 3,c.y]]));
      routes.get('return').setAttribute('d', roundedRoute([[c.left,c.y],[8,c.y],[8,training.y],[p.left - 3,training.y]]));
    }
    routeLengths = new Map([...routes].map(([key,path]) => [key,path.getTotalLength()]));
    updateActiveRoute();
    drawPackets();
  };

  const renderStep = (notify = false) => {
    const step = steps[currentStep];
    root.dataset.step = currentStep;
    root.style.setProperty('--step-progress', elapsed / step.duration);
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === currentStep)));
    highlights.forEach(element => element.classList.toggle('is-highlighted', element.dataset.highlight.split(' ').includes(String(currentStep))));
    root.querySelector('.flow-step-count').textContent = `STEP ${currentStep + 1} / ${steps.length}`;
    root.querySelector('.flow-step-title').textContent = step.title;
    root.querySelector('.flow-step-description').textContent = step.description;
    // Only trusted, local equations from the constant table above use markup.
    root.querySelector('.flow-step-equation').innerHTML = step.equation;
    const nextRound = currentStep === 4;
    root.querySelector('.flow-training-symbol').innerHTML = `𝒟<sub>${nextRound ? 'k+1' : 'k'}</sub>`;
    output.querySelector('span').textContent = nextRound ? 'Next driving policy' : 'Current driving policy';
    output.querySelector('strong').innerHTML = `Π<sub>${nextRound ? 'k+1' : 'k'}</sub>`;
    updateActiveRoute();
    drawPackets();
    if (notify) announcement.textContent = `Step ${currentStep + 1} of ${steps.length}. ${step.title}. ${step.description}`;
  };

  const shouldRun = () => playing && inView && !document.hidden;
  const tick = (now) => {
    frame = null;
    if (!shouldRun()) { previousTime = null; return; }
    if (previousTime !== null) elapsed += Math.min(now - previousTime, 100);
    previousTime = now;
    if (elapsed >= steps[currentStep].duration) {
      elapsed = 0;
      currentStep = (currentStep + 1) % steps.length;
      renderStep();
    }
    root.style.setProperty('--step-progress', elapsed / steps[currentStep].duration);
    drawPackets();
    frame = window.requestAnimationFrame(tick);
  };

  const syncPlayback = () => {
    root.dataset.playing = String(playing);
    toggle.querySelector('span').textContent = playing ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} the method animation`);
    root.querySelector('.flow-state').textContent = playing ? 'Playing' : 'Paused';
    if (shouldRun() && frame === null) frame = window.requestAnimationFrame(tick);
    if (!shouldRun()) {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      previousTime = null;
    }
  };

  toggle.addEventListener('click', () => {
    playing = !playing;
    syncPlayback();
  });
  root.querySelector('.flow-replay').addEventListener('click', () => {
    currentStep = 0;
    elapsed = 0;
    previousTime = null;
    playing = !motionPreference.matches;
    renderStep(true);
    syncPlayback();
  });
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    currentStep = index;
    elapsed = 0;
    playing = false;
    renderStep(true);
    syncPlayback();
  }));
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) playing = false;
    syncPlayback();
    drawPackets();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0 }).observe(root);
  } else {
    inView = true;
  }
  if ('ResizeObserver' in window) new ResizeObserver(drawRoutes).observe(board);
  else window.addEventListener('resize', drawRoutes);
  if (document.fonts) document.fonts.ready.then(drawRoutes);

  root.querySelector('.flow-controls').hidden = false;
  root.querySelector('.flow-player').hidden = false;
  drawRoutes();
  renderStep();
  syncPlayback();
})();

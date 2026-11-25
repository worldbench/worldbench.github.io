(() => {
  'use strict';

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const engines = [...document.querySelectorAll('.engine-block, .continual-panel')].map(element => ({
    element,
    button: element.querySelector('.engine-motion-toggle'),
    name: element.querySelector('h3').textContent,
    enabled: true,
    visible: false,
  })).filter(engine => engine.button);

  const sync = engine => {
    const { element, button, enabled, visible, name } = engine;
    element.dataset.flowRunning = String(enabled && visible && !document.hidden && !motionPreference.matches);
    element.dataset.flowPaused = String(!enabled);
    button.hidden = motionPreference.matches;
    button.setAttribute('aria-label', `${enabled ? 'Pause' : 'Play'} ${name} flow`);
    button.title = `${enabled ? 'Pause' : 'Play'} flow`;
  };
  const syncAll = () => engines.forEach(sync);

  engines.forEach(engine => {
    engine.element.dataset.engineFlow = '';
    engine.button.addEventListener('click', () => {
      engine.enabled = !engine.enabled;
      sync(engine);
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const engine = engines.find(item => item.element === entry.target);
        engine.visible = entry.isIntersecting;
        sync(engine);
      });
    });
    engines.forEach(engine => observer.observe(engine.element));
  } else {
    engines.forEach(engine => { engine.visible = true; });
  }
  document.addEventListener('visibilitychange', syncAll);
  motionPreference.addEventListener('change', syncAll);
  syncAll();

  const policyBoard = document.querySelector('.policy-flow-board');
  if (policyBoard) {
    const policySvg = policyBoard.querySelector('.policy-flow-wires');
    const expertCards = [...policyBoard.querySelectorAll('.expert-card')];
    const training = policyBoard.querySelector('.training-detail');
    const selection = policyBoard.querySelector('.selector-detail');
    const policyMobileLayout = window.matchMedia('(max-width: 760px)');
    const drawPolicyRoutes = () => {
      const origin = policyBoard.getBoundingClientRect();
      const boxOf = element => {
        const box = element.getBoundingClientRect();
        return { left: box.left - origin.left, right: box.right - origin.left,
          top: box.top - origin.top, bottom: box.bottom - origin.top,
          x: box.left + box.width / 2 - origin.left,
          y: box.top + box.height / 2 - origin.top };
      };
      const setRoute = (name, path) => policySvg.querySelectorAll(`[data-policy-route="${name}"]`).forEach(element => element.setAttribute('d', path));
      const target = boxOf(training);
      const next = boxOf(selection);
      const fromLabel = boxOf(training.querySelector('.policy-stage-label'));
      const toLabel = boxOf(selection.querySelector('.policy-stage-label'));
      const joinX = policyMobileLayout.matches ? -8 : target.x;
      const joinY = target.top - 16;
      policySvg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);

      expertCards.forEach((card, index) => {
        const from = boxOf(card);
        const path = policyMobileLayout.matches
          ? `M ${from.left - 2} ${from.y} H -4 Q -8 ${from.y} -8 ${from.y + 4} V ${joinY}`
          : `M ${from.x} ${from.bottom + 2} C ${from.x} ${from.bottom + 18} ${joinX} ${joinY - 12} ${joinX} ${joinY}`;
        setRoute(`expert-${index}`, path);
      });
      if (policyMobileLayout.matches) {
        setRoute('merge', `M ${joinX} ${joinY} V ${fromLabel.y - 4} Q ${joinX} ${fromLabel.y} ${joinX + 4} ${fromLabel.y} H ${target.left - 3}`);
        const gutter = origin.width + 8;
        setRoute('selection', `M ${target.right + 2} ${fromLabel.y} H ${gutter - 4} Q ${gutter} ${fromLabel.y} ${gutter} ${fromLabel.y + 4} V ${toLabel.y - 4} Q ${gutter} ${toLabel.y} ${gutter - 4} ${toLabel.y} H ${next.right + 3}`);
      } else {
        setRoute('merge', `M ${joinX} ${joinY} V ${target.top - 3}`);
        const start = fromLabel.right + 12;
        const end = toLabel.left - 10;
        setRoute('selection', `M ${start} ${fromLabel.y} C ${(start + end) / 2} ${fromLabel.y} ${(start + end) / 2} ${toLabel.y} ${end} ${toLabel.y}`);
      }
      const junction = policySvg.querySelector('.policy-merge-point');
      junction.setAttribute('cx', joinX);
      junction.setAttribute('cy', joinY);
    };
    if ('ResizeObserver' in window) new ResizeObserver(drawPolicyRoutes).observe(policyBoard);
    else window.addEventListener('resize', drawPolicyRoutes);
    if (document.fonts) document.fonts.ready.then(drawPolicyRoutes);
    drawPolicyRoutes();
  }

  const process = document.querySelector('.environment-block .curriculum-process');
  if (!process) return;
  const svg = process.querySelector('.engine-flow-wires');
  const symbols = [...process.querySelectorAll('.process-symbol')];
  const mobileLayout = window.matchMedia('(max-width: 760px)');
  const drawRoutes = () => {
    const origin = process.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
    const boxes = symbols.map(symbol => {
      const box = symbol.getBoundingClientRect();
      return { left: box.left - origin.left, right: box.right - origin.left,
        bottom: box.bottom - origin.top, x: box.left + box.width / 2 - origin.left,
        y: box.top + box.height / 2 - origin.top };
    });
    boxes.slice(0, -1).forEach((from, index) => {
      const to = boxes[index + 1];
      const route = mobileLayout.matches
        ? `M ${from.x} ${from.bottom + 4} V ${from.bottom + 7} Q ${from.x} ${from.bottom + 11} ${from.x - 4} ${from.bottom + 11} H 14 Q 10 ${from.bottom + 11} 10 ${from.bottom + 15} V ${to.y - 4} Q 10 ${to.y} 14 ${to.y} H ${to.left - 4}`
        : `M ${from.right + 8} ${from.y} H ${to.left - 8}`;
      svg.querySelectorAll(`[data-engine-route="${index}"]`).forEach(path => path.setAttribute('d', route));
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(drawRoutes).observe(process);
  else window.addEventListener('resize', drawRoutes);
  if (document.fonts) document.fonts.ready.then(drawRoutes);
  drawRoutes();
})();

(() => {
  const steps = [...document.querySelectorAll('.journey-step')];
  if (!steps.length) return;
  const get = id => document.getElementById(id);
  let current = -1;
  function activate(index) {
    if (index === current) return;
    current = index;
    const step = steps[index];
    steps.forEach((item, i) => {
      item.classList.toggle('active', i === index);
      item.setAttribute('aria-pressed', String(i === index));
    });
    get('journey-image').src = step.dataset.image;
    get('journey-image').alt = step.dataset.title;
    get('journey-number').textContent = String(index + 1).padStart(2, '0');
    get('journey-kicker').textContent = step.dataset.kicker;
    get('journey-title').textContent = step.dataset.title;
    get('journey-copy').textContent = step.dataset.copy;
    get('journey-progress').style.width = `${(index + 1) / steps.length * 100}%`;
  }
  document.querySelector('.journey-steps').removeAttribute('role');
  steps.forEach((step, index) => {
    step.setAttribute('role', 'button');
    step.addEventListener('click', () => activate(index));
    step.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); activate(index);
      }
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (visible.length) activate(Number(visible[visible.length - 1].target.dataset.step));
    }, { rootMargin:'-38% 0px -45% 0px', threshold:0 });
    steps.forEach(step => observer.observe(step));
  }
  activate(0);
})();

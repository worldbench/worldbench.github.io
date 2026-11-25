(() => {
  'use strict';

  const dialog = document.querySelector('.image-dialog');
  const dialogImage = document.querySelector('.dialog-image');
  const dialogCaption = document.querySelector('.dialog-caption');
  const closeButton = document.querySelector('.close-dialog');
  let previouslyFocused = null;

  // Direct image links keep figures usable when JavaScript is disabled.
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-lightbox]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        previouslyFocused = document.activeElement;
        dialogImage.src = link.href;
        dialogImage.alt = link.querySelector('img').alt;
        dialogCaption.textContent = link.dataset.caption;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        const imageArea = dialog.querySelector('.dialog-image-area');
        imageArea.scrollTop = 0;
        imageArea.scrollLeft = 0;
        closeButton.focus();
      });
    });

    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        dialog.close();
      }
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = '';
      if (previouslyFocused) previouslyFocused.focus({ preventScroll: true });
    });
  }

  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let updateScheduled = false;
  const updateNavigation = () => {
    const readingLine = Math.min(window.innerHeight * 0.32, 260);
    let current = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= readingLine) current = section;
    });
    navLinks.forEach((link) => {
      if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    updateScheduled = false;
  };
  const scheduleUpdate = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    window.requestAnimationFrame(updateNavigation);
  };
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  updateNavigation();
})();

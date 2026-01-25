// highlight-on-scroll.js
// Automatically highlights cards (feature, stat, highlight, contact) when they are centered in the viewport on mobile

document.addEventListener('DOMContentLoaded', function () {
  // Only activate on mobile
  if (window.innerWidth > 900) return;

  // All card selectors
  const selectors = [
    '.feature-card-new',
    '.stat-card-new',
    '.highlight-item-new',
    '.contact-card-new'
  ];
  const cards = Array.from(document.querySelectorAll(selectors.join(',')));
  if (!cards.length) return;

  // Helper: is element centered in viewport (threshold = 40% of viewport height)
  function isCentered(el) {
    const rect = el.getBoundingClientRect();
    const centerY = window.innerHeight / 2;
    return (
      rect.top < centerY + rect.height * 0.3 &&
      rect.bottom > centerY - rect.height * 0.3
    );
  }

  function updateHighlight() {
    cards.forEach(card => {
      if (isCentered(card)) {
        card.classList.add('auto-highlight');
      } else {
        card.classList.remove('auto-highlight');
      }
    });
  }

  // Initial + on scroll/resize
  updateHighlight();
  window.addEventListener('scroll', updateHighlight, { passive: true });
  window.addEventListener('resize', updateHighlight);
});

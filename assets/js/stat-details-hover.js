// stat-details-hover.js
// Zeigt die Details der aktuell gehovten Stat-Karte im separaten Feld an (nur Desktop)
document.addEventListener('DOMContentLoaded', function () {
  if (window.innerWidth <= 700) return;
  const statCards = Array.from(document.querySelectorAll('.stat-card-new'));
  if (!statCards.length) return;

  // Details-Box dynamisch erzeugen
  let detailsBox = document.createElement('div');
  detailsBox.className = 'stat-details-box';
  document.body.appendChild(detailsBox);

  function showDetails(card) {
    const details = card.querySelector('.stat-details-new');
    if (details) {
      detailsBox.innerHTML = details.innerHTML;
      detailsBox.classList.add('active');
      // Positioniere Box direkt unter der Karte
      const rect = card.getBoundingClientRect();
      detailsBox.style.position = 'absolute';
      detailsBox.style.left = rect.left + window.scrollX + 'px';
      detailsBox.style.top = rect.bottom + window.scrollY + 8 + 'px';
      detailsBox.style.width = rect.width + 'px';
      detailsBox.style.zIndex = 1000;
    }
  }
  function clearDetails() {
    detailsBox.innerHTML = '';
    detailsBox.classList.remove('active');
    detailsBox.style.left = '';
    detailsBox.style.top = '';
    detailsBox.style.width = '';
  }

  statCards.forEach(card => {
    card.addEventListener('mouseenter', () => showDetails(card));
    card.addEventListener('focus', () => showDetails(card));
    card.addEventListener('mouseleave', clearDetails);
    card.addEventListener('blur', clearDetails);
  });
});

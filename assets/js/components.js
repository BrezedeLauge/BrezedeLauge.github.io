// Modern JavaScript Template System for LineIQ Website
// Header and Footer Components

class WebsiteComponents {
  static getHeader(currentPage = '') {
    return `
      <div class="aurora"></div>
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="Zur Startseite">
            <div class="brand-logo">
              <img src="assets/pictures/logo.png" alt="LineIQ Dashboard powered by Sontheimer Werkzeugmaschinen" class="brand-logo-image" width="160" height="83" decoding="async" loading="eager">
            </div>
          </a>

          <nav class="nav" role="navigation" aria-label="Hauptnavigation">
            <a class="nav-link ${currentPage === 'index' ? 'active' : ''}" href="index.html" ${currentPage === 'index' ? 'aria-current="page"' : ''}>
              <span class="nav-indicator"></span>
              Start
            </a>
            <a class="nav-link ${currentPage === 'project' ? 'active' : ''}" href="project.html" ${currentPage === 'project' ? 'aria-current="page"' : ''}>
              <span class="nav-indicator"></span>
              Projekt
            </a>
            <a class="nav-link" href="index.html#contact">
              <span class="nav-indicator"></span>
              Kontakt
            </a>
          </nav>
        </div>
      </header>
    `;
  }

  static getFooter(currentPage = '') {
    return `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-content">
            <div class="footer-brand">
              <div class="brand-logo">
                <img src="assets/pictures/logo.png" alt="LineIQ Dashboard powered by Sontheimer Werkzeugmaschinen" class="footer-logo-image" width="160" height="83" decoding="async" loading="lazy">
              </div>
              <p>Moderne Dashboard-Lösung für Industrieanwendungen</p>
            </div>
            <div class="footer-links">
              <a href="index.html" ${currentPage === 'index' ? 'aria-current="page"' : ''}>Start</a>
              <a href="project.html" ${currentPage === 'project' ? 'aria-current="page"' : ''}>Projekt</a>
              <a href="index.html#contact">Kontakt</a>
              <a href="impressum.html" ${currentPage === 'impressum' ? 'aria-current="page"' : ''}>Impressum</a>
              <a href="datenschutz.html" ${currentPage === 'datenschutz' ? 'aria-current="page"' : ''}>Datenschutz</a>
            </div>
          </div>
          <div class="footer-bottom">
            <p>&copy; 2026 LineIQ Dashboard Projekt. Entwickelt mit Flutter & FastAPI.</p>
          </div>
        </div>
      </footer>
    `;
  }

  static loadComponents(currentPage = '') {
    // Load Header
    const headerContainer = document.getElementById('header');
    if (headerContainer) {
      headerContainer.innerHTML = this.getHeader(currentPage);
    }

    // Load Footer
    const footerContainer = document.getElementById('footer');
    if (footerContainer) {
      footerContainer.innerHTML = this.getFooter(currentPage);
    }

    // Initialize smooth scrolling for anchor links
    this.initSmoothScrolling();
  }

  static initSmoothScrolling() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }
}

// Auto-load when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('LineIQ Template System loading...');
  
  // Debug: Check if containers exist
  const headerContainer = document.getElementById('header');
  const footerContainer = document.getElementById('footer');
  
  console.log('Header container found:', !!headerContainer);
  console.log('Footer container found:', !!footerContainer);
  
  // Detect current page from URL
  const path = window.location.pathname;
  let currentPage = '';
  
  if (path.includes('index.html') || path === '/' || path === '') {
    currentPage = 'index';
  } else if (path.includes('project.html')) {
    currentPage = 'project';
  } else if (path.includes('impressum.html')) {
    currentPage = 'impressum';
  } else if (path.includes('datenschutz.html')) {
    currentPage = 'datenschutz';
  }

  console.log('Detected page:', currentPage);
  
  WebsiteComponents.loadComponents(currentPage);
  
  console.log('LineIQ Template System loaded successfully!');
});
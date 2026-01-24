# LineIQ Website Development Rules

Diese Datei enthält wichtige Regeln und Standards, die bei allen Änderungen an der LineIQ Website automatisch beachtet werden müssen.

## 🔒 Suchmaschinen & Privacy

### Meta-Tags (IMMER anwenden):
```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
```

### robots.txt (muss existieren):
```
User-agent: *
Disallow: /
```

### Tracking & Analytics:
- ❌ NIEMALS Google Analytics, Facebook Pixel oder andere Tracking-Tools
- ❌ KEINE Cookies setzen
- ❌ KEINE externen Tracking-Skripte
- ✅ 100% Cookie-frei und Privacy-freundlich

## 🎨 Design & Branding Standards

### Logo-Integration (immer konsistent):
```html
<div class="brand-logo">
  <img src="assets/pictures/lineiqlogo.png" alt="LineIQ Dashboard" class="lineiq-logo">
  <div class="powered-by">
    <span class="powered-text">powered by</span>
    <img src="assets/pictures/sontheimerlogo.png" alt="Sontheimer Werkzeugmaschinen" class="sontheimer-logo">
  </div>
</div>
```

### Farbschema (CSS Custom Properties):
- Primary: `--accent-primary: #7C5CFF`
- Secondary: `--accent-secondary: #35D0FF`  
- Success: `--accent-success: #00D4AA`
- Background: `--bg-primary: #0F1114`
- Text: `--text-primary: rgba(255, 255, 255, 0.95)`

### Typografie:
- Font-Family: `'Inter'` (immer von Google Fonts laden)
- Weights: 300, 400, 500, 600, 700, 800

## 📱 Responsive Design

### Breakpoints:
- Mobile: `@media (max-width: 768px)`
- Tablet: `@media (max-width: 1024px)`

### Layout-Prinzipien:
- ✅ Mobile-First Approach
- ✅ Flexbox und CSS Grid für Layouts
- ✅ Clamp() für responsive Typografie
- ✅ Alle Inhalte müssen zentriert sein

## 🌟 User Experience

### Navigation:
```html
<nav class="nav" role="navigation" aria-label="Hauptnavigation">
  <a class="nav-link" href="index.html">Start</a>
  <a class="nav-link" href="project.html">Projekt</a>
  <a class="nav-link" href="#contact">Kontakt</a>
</nav>
```

### Buttons (Standard-Klassen):
- Primary: `class="btn btn-primary"`
- Secondary: `class="btn btn-secondary"`

### Cards (Glassmorphism):
```css
background: var(--glass-bg);
border: 1px solid var(--glass-border);
border-radius: var(--radius-lg);
backdrop-filter: blur(var(--blur-md));
```

## ♿ Accessibility Standards

### HTML-Struktur:
- ✅ Semantische HTML5-Elemente verwenden
- ✅ Alt-Texte für alle Bilder
- ✅ ARIA-Labels für Navigation
- ✅ Proper heading hierarchy (h1 → h2 → h3)

### Beispiel:
```html
<header class="site-header">
  <a class="brand" href="index.html" aria-label="Zur Startseite">
```

## ⚡ Performance Standards

### CSS:
- ✅ CSS Custom Properties nutzen
- ✅ Moderne CSS Features (clamp, grid, flexbox)
- ✅ Effiziente Selektoren

### Bilder:
- ✅ Optimierte PNG-Dateien
- ✅ Responsive Images mit korrekten Alt-Texten

### Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

## 📄 Seiten-Standards

### Alle HTML-Dateien müssen enthalten:
1. **Favicon**: `<link rel="icon" type="image/png" href="assets/pictures/lineiqsymbol.png">`
2. **Apple Touch Icon**: `<link rel="apple-touch-icon" href="assets/pictures/lineiqsymbol.png">`
3. **Meta Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1" />`
4. **CSS Files**: Main Style + Browser Compatibility CSS
5. **Template System**: `<script src="assets/js/components.js"></script>`
6. **Aurora Background**: Wird automatisch über Template-System geladen

### Footer (Standard):
```html
<footer class="site-footer">
  <div class="container">
    <div class="footer-content">
      <!-- Logo + Links Structure -->
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 LineIQ Dashboard Projekt. Entwickelt mit Flutter & FastAPI.</p>
    </div>
  </div>
</footer>
```

## 📝 Content-Richtlinien

### Projekt-Beschreibung (Standard-Text):
- "LineIQ ist ein innovatives Schulprojekt"
- "Nicht-kommerzielles Schulprojekt"
- "Powered by Sontheimer Werkzeugmaschinen"

### Technologie-Stack:
- Frontend: Flutter (Cross-Platform)
- Backend: FastAPI (Python API)
- Integration: IoT (Raspberry Pi)

### Kontakt-Informationen:
- E-Mail: info@lineiq.de
- Schulprojekt im Rahmen der Ausbildung
- Keine persönlichen Daten wie "Projektleiter" etc.

## 🚨 Verbotene Elemente

### NIEMALS verwenden:
- ❌ Google Analytics oder andere Tracking-Tools
- ❌ Cookies oder Local Storage
- ❌ Social Media Plugins mit Tracking
- ❌ externe CDNs außer Google Fonts
- ❌ Persönliche Daten in öffentlichen Bereichen
- ❌ "index, follow" in Meta-Robots-Tags
- ❌ Links zum GitHub Repository oder Source Code
- ❌ Verweise auf Code-Repositories

## 🔧 Deployment Standards

### GitHub Pages Konfiguration:
- robots.txt im Root-Verzeichnis
- CNAME-Datei (falls Custom Domain)
- Alle Assets in /assets/ Struktur

### Datei-Struktur:
```
/
├── index.html
├── project.html  
├── impressum.html
├── datenschutz.html
├── robots.txt
├── CNAME
└── assets/
    ├── css/style.css
    └── pictures/
        ├── lineiqlogo.png
        ├── lineiqsymbol.png
        └── sontheimerlogo.png
```

---

## 📋 Checkliste für jede Änderung:

- [ ] Meta robots auf "noindex" gesetzt
- [ ] Logos korrekt eingebunden
- [ ] Responsive Design getestet
- [ ] Accessibility Standards erfüllt  
- [ ] Glassmorphism Design konsistent
- [ ] Keine Tracking-Tools hinzugefügt
- [ ] Footer mit korrektem Jahr
- [ ] Smooth Scrolling implementiert
- [ ] Aurora Animation vorhanden

---

**Version:** 1.0  
**Letzte Aktualisierung:** 24.01.2026  
**Gültig für:** Alle LineIQ Website Änderungen
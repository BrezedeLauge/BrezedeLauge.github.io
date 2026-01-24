/**
 * Liquid Aurora WebGL Background System (Uniform Edition)
 * - Consistent effect across ALL interactive elements
 * - No special-cases (mailto etc.)
 * - No selector overlap stacking
 * - Attractor count clamped to shader limit (8)
 * - No external dependencies
 */

class LiquidAurora {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.uniformLocations = {};
    this.dprCap = 2.0;

    // Attractors: { element, x, y, strength, targetStrength, fadeSpeed, isPermanent, isGlowing }
    this.attractors = [];
    this.maxAttractors = 8;

    this.time = 0;
    this.animationId = null;
    this.reducedMotion = false;
    this.isInitialized = false;
    this.forceStatic = false;

    // Uniform, consistent behavior tuning (same for every element)
    this.behavior = {
      baseStrength: 0.06,
      hoverStrength: 0.30,
      riseSpeed: 0.020,
      fallSpeed: 0.060,      // faster decay to avoid lingering
      removeSpeed: 0.140     // aggressive removal for temporary attractors
    };

    // Visual tuning (WebGL shader)
    this.config = {
      baseDriftSpeed: 0.0002,
      viscosity: 0.00000978,
      attractionStrength: 50,
      attractionFalloff: 3.9,
      glowStrength: 0.5,
      resolutionScale: 0.35,
      colorIntensity: 0.3,
      threshold: 0.086,

      // Canvas compositing
      canvasOpacity: 0.5,
      fallbackOpacity: 0.26
    };

    // Delay init to ensure DOM is present
    setTimeout(() => this.init(), 50);
  }

  init() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches || /Mobi|Android/i.test(navigator.userAgent || '');
    if (isMobile) {
      this.applyMobileTuning();
      this.forceStatic = true; // prefer static fallback on phones for speed
    }

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reducedMotion || this.forceStatic) {
      this.ensureGlassLayer();
      this.initStaticFallback();
      return;
    }

    if (!this.setupCanvas()) return;
    this.ensureGlassLayer();
    if (!this.initWebGL()) return;
    if (!this.setupShaders()) return;

    this.registerUniformAttractors();
    // Hover interactions are intentionally disabled for a calmer, filigree aurora

    this.animate();
    this.isInitialized = true;

    // If you also have a CSS aurora container, keep it subtle
    const auroraContainer = document.querySelector('.aurora');
    if (auroraContainer) auroraContainer.style.opacity = String(this.config.fallbackOpacity);

    console.log('LiquidAurora: initialized (uniform mode)');
  }

  ensureGlassLayer() {
    if (document.getElementById('aurora-glass')) return;
    const glass = document.createElement('div');
    glass.id = 'aurora-glass';
    glass.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glass);
  }

  applyMobileTuning() {
    this.dprCap = 1.5;
    this.config.resolutionScale = Math.min(this.config.resolutionScale, 0.6);
    this.config.canvasOpacity = Math.min(this.config.canvasOpacity, 0.32);
    this.config.baseDriftSpeed = Math.min(this.config.baseDriftSpeed, 0.00012);
    this.config.glowStrength = Math.min(this.config.glowStrength, 0.32);
    this.config.colorIntensity = Math.min(this.config.colorIntensity, 0.26);
    this.maxAttractors = Math.min(this.maxAttractors, 6);
  }

  initStaticFallback() {
    const canvas = document.getElementById('liquid-aurora');
    if (!canvas) return;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.zIndex = '-2';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = String(this.config.canvasOpacity);
    canvas.style.background = `
      radial-gradient(ellipse 820px 420px at 28% 38%,
        rgba(211,47,47,0.12) 0%,
        rgba(153,199,255,0.10) 36%,
        rgba(0,170,0,0.06) 64%,
        transparent 84%
      )
    `;
    canvas.style.filter = 'blur(48px)';
  }

  setupCanvas() {
    this.canvas = document.getElementById('liquid-aurora');
    if (!this.canvas) {
      console.error('LiquidAurora: canvas #liquid-aurora not found');
      return false;
    }

    // Style: behind content, does not intercept input
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '-2',
      pointerEvents: 'none',
      opacity: String(this.config.canvasOpacity)
    });

    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false })
          || this.canvas.getContext('experimental-webgl');
    if (!this.gl) {
      console.error('LiquidAurora: WebGL not supported');
      return false;
    }

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas(), { passive: true });

    return true;
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = Math.max(1, Math.floor(w * dpr * this.config.resolutionScale));
    this.canvas.height = Math.max(1, Math.floor(h * dpr * this.config.resolutionScale));

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  initWebGL() {
    const gl = this.gl;
    try {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Fullscreen quad buffer
      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      return true;
    } catch (e) {
      console.error('LiquidAurora: initWebGL error', e);
      return false;
    }
  }

  setupShaders() {
    const gl = this.gl;
    try {
      const vertexShaderSource = `
        attribute vec2 position;
        varying vec2 uv;
        void main() {
          uv = (position + 1.0) * 0.5;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;

      // Fragment shader: metaball field + attractors (max 8)
      const fragmentShaderSource = `
        #ifdef GL_ES
        precision highp float;
        #endif

        uniform float time;
        uniform vec2 resolution;

        uniform vec3 attractors[8]; // x, y, strength
        uniform int numAttractors;

        uniform vec3 glowAttractors[8]; // x, y, strength
        uniform int numGlowAttractors;

        uniform float baseDriftSpeed;
        uniform float viscosity;
        uniform float attractionStrength;
        uniform float attractionFalloff;
        uniform float glowStrength;
        uniform float colorIntensity;
        uniform float threshold;

        uniform vec4 maskRects[8]; // x, y, halfWidth, halfHeight
        uniform int numMaskRects;

        varying vec2 uv;

        float noise(vec2 p) {
          return sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453;
        }

        float smoothNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = noise(i);
          float b = noise(i + vec2(1.0, 0.0));
          float c = noise(i + vec2(0.0, 1.0));
          float d = noise(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fractalNoise(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          value += amplitude * smoothNoise(p * frequency);
          amplitude *= 0.5; frequency *= 2.0;
          value += amplitude * smoothNoise(p * frequency);
          return value;
        }

        float rectMask(vec2 p, vec4 rect) {
          vec2 h = rect.zw * 1.08; // slight padding so long text stays covered
          vec2 d = abs(p - rect.xy) - h;
          float dist = max(d.x, d.y);
          return smoothstep(0.05, -0.02, dist);
        }

        float metaballField(vec2 p) {
          float field = 0.0;

          vec2 driftOffset = vec2(
            sin(time * baseDriftSpeed * 0.8) * 0.08 + cos(time * baseDriftSpeed * 0.3) * 0.05,
            cos(time * baseDriftSpeed * 0.5) * 0.10 + sin(time * baseDriftSpeed * 0.4) * 0.04
          );

          vec2 q = (p + driftOffset * 0.16) * vec2(1.75, 0.58);
          vec2 p1 = q + vec2(0.05, -0.02);
          vec2 p2 = q + vec2(0.18, 0.05);
          vec2 p3 = q + vec2(-0.10, 0.16);

          float n = fractalNoise(p * 2.6 + time * baseDriftSpeed * 3.8);

          field += 0.018 / (distance(p1, vec2(0.35, 0.45)) + 0.08);
          field += 0.014 / (distance(p2, vec2(0.55, 0.35)) + 0.07);
          field += 0.012 / (distance(p3, vec2(0.45, 0.65)) + 0.10);

          // Unrolled attractor influence (0..7)
          if (numAttractors >= 1) {
            vec2 a = attractors[0].xy; float s = attractors[0].z;
            float d = distance(p, a);
            float m = numMaskRects >= 1 ? rectMask(p, maskRects[0]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 2) {
            vec2 a = attractors[1].xy; float s = attractors[1].z;
            float d = distance(p, a);
            float m = numMaskRects >= 2 ? rectMask(p, maskRects[1]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 3) {
            vec2 a = attractors[2].xy; float s = attractors[2].z;
            float d = distance(p, a);
            float m = numMaskRects >= 3 ? rectMask(p, maskRects[2]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 4) {
            vec2 a = attractors[3].xy; float s = attractors[3].z;
            float d = distance(p, a);
            float m = numMaskRects >= 4 ? rectMask(p, maskRects[3]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 5) {
            vec2 a = attractors[4].xy; float s = attractors[4].z;
            float d = distance(p, a);
            float m = numMaskRects >= 5 ? rectMask(p, maskRects[4]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 6) {
            vec2 a = attractors[5].xy; float s = attractors[5].z;
            float d = distance(p, a);
            float m = numMaskRects >= 6 ? rectMask(p, maskRects[5]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 7) {
            vec2 a = attractors[6].xy; float s = attractors[6].z;
            float d = distance(p, a);
            float m = numMaskRects >= 7 ? rectMask(p, maskRects[6]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }
          if (numAttractors >= 8) {
            vec2 a = attractors[7].xy; float s = attractors[7].z;
            float d = distance(p, a);
            float m = numMaskRects >= 8 ? rectMask(p, maskRects[7]) : 1.0;
            field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m;
          }

          field += n * 0.35;
          return field;
        }

        vec3 auroraColor(float field, vec2 p) {
          vec3 green      = vec3(0.26, 0.95, 0.65);
          vec3 purple     = vec3(0.64, 0.36, 0.96);
          vec3 tealEdge   = vec3(0.22, 0.78, 0.90);
          vec3 darkEdge   = vec3(0.02, 0.03, 0.05);

          float curtain = 0.5 + 0.5 * sin(p.x * 9.0 + time * baseDriftSpeed * 18.0 + fractalNoise(p * 4.0) * 2.5);
          float vertical = smoothstep(0.10, 0.55, p.y) * (1.0 - smoothstep(0.58, 0.98, p.y));
          float radialEdge = smoothstep(0.70, 0.96, distance(p, vec2(0.5, 0.5)));

          vec3 band = mix(green, purple, clamp(curtain * 0.75 + field * 0.20, 0.0, 1.0));
          vec3 baseColor = mix(tealEdge, band, vertical);
          baseColor = mix(baseColor, darkEdge, radialEdge * 0.70);

          float shimmer = sin(field * 2.8 + time * 0.0018) * 0.015 + 0.992;
          float micro = cos(field * 5.6 + time * 0.0012) * 0.011 + 0.994;
          vec3 light = baseColor * shimmer * micro;

          float depth = sin(field * 1.35 + time * baseDriftSpeed * 0.12) * 0.022 + 0.986;
          return light * depth * colorIntensity;
        }

        void main() {
          vec2 p = uv;

          float field = metaballField(p);
          float alpha = smoothstep(threshold - 0.05, threshold + 0.05, field);

          vec3 color = auroraColor(field, p);

          // Cheap glow sampling
          float glow = 0.0;
          float r = 0.02;
          glow += metaballField(p + vec2( 1.0,  0.0) * r);
          glow += metaballField(p + vec2(-1.0,  0.0) * r);
          glow += metaballField(p + vec2( 0.0,  1.0) * r);
          glow += metaballField(p + vec2( 0.0, -1.0) * r);
          glow *= 0.25;

          float glowAlpha = smoothstep(threshold * 0.3, threshold * 0.7, glow);
          color += color * glowAlpha * glowStrength * 0.3;

          // Hover glow (optional)
          float hoverGlow = 0.0;
          for (int i = 0; i < 8; i++) {
            if (i >= numGlowAttractors) break;
            vec3 g = glowAttractors[i];
            float d = distance(p, g.xy);
            hoverGlow += (g.z / (d * d + 0.01)) * 0.25;
          }

          color += color * hoverGlow * 0.22;

          alpha = max(alpha, glowAlpha * 0.4);
          alpha = max(alpha, hoverGlow * 0.10);

          gl_FragColor = vec4(color, alpha * 0.8);
        }
      `;

      const vs = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
      const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
      if (!vs || !fs) return false;

      this.program = gl.createProgram();
      gl.attachShader(this.program, vs);
      gl.attachShader(this.program, fs);
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.error('LiquidAurora: link failed:', gl.getProgramInfoLog(this.program));
        return false;
      }

      gl.useProgram(this.program);

      this.uniformLocations = {
        time: gl.getUniformLocation(this.program, 'time'),
        resolution: gl.getUniformLocation(this.program, 'resolution'),
        attractors: gl.getUniformLocation(this.program, 'attractors'),
        numAttractors: gl.getUniformLocation(this.program, 'numAttractors'),
        glowAttractors: gl.getUniformLocation(this.program, 'glowAttractors'),
        numGlowAttractors: gl.getUniformLocation(this.program, 'numGlowAttractors'),
        maskRects: gl.getUniformLocation(this.program, 'maskRects'),
        numMaskRects: gl.getUniformLocation(this.program, 'numMaskRects'),
        baseDriftSpeed: gl.getUniformLocation(this.program, 'baseDriftSpeed'),
        viscosity: gl.getUniformLocation(this.program, 'viscosity'),
        attractionStrength: gl.getUniformLocation(this.program, 'attractionStrength'),
        attractionFalloff: gl.getUniformLocation(this.program, 'attractionFalloff'),
        glowStrength: gl.getUniformLocation(this.program, 'glowStrength'),
        colorIntensity: gl.getUniformLocation(this.program, 'colorIntensity'),
        threshold: gl.getUniformLocation(this.program, 'threshold')
      };

      const positionLocation = gl.getAttribLocation(this.program, 'position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      return true;
    } catch (e) {
      console.error('LiquidAurora: shader setup error', e);
      return false;
    }
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('LiquidAurora: compile failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * UNIFORM ATTRACTOR REGISTRATION
   * Rule: only elements explicitly selected here get a base attractor.
   * No overlaps, no nth-child rules, no special cases.
   */
  registerUniformAttractors() {
    const selector = [
      '.btn',
      'button',
      '.nav-link',
      'a[href]',
      'h1, h2, h3',
      '[data-liquid="1"]',
      '.card',
      '.kpi'
    ].join(',');

    const elements = Array.from(document.querySelectorAll(selector))
      .filter(el => el.offsetWidth > 8 && el.offsetHeight > 8);

    const candidates = [];
    const toNorm = (px, py) => ({
      x: px / window.innerWidth,
      y: 1 - py / window.innerHeight
    });

    const addCandidate = (el, point, priority, strengthScale = 1.0, halfW = 0.05, halfH = 0.05) => {
      candidates.push({ el, x: point.x, y: point.y, priority, strengthScale, halfW, halfH });
    };

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const center = toNorm(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
      const halfW = (rect.width * 0.55) / window.innerWidth;
      const halfH = (rect.height * 0.55) / window.innerHeight;

      addCandidate(el, center, area, 1.0, halfW, halfH);

      const isWide = rect.width > rect.height * 1.15;
      const isTall = rect.height > rect.width * 1.15;

      if (isWide) {
        const left = toNorm(rect.left + rect.width * 0.32, rect.top + rect.height * 0.5);
        const right = toNorm(rect.left + rect.width * 0.68, rect.top + rect.height * 0.5);
        addCandidate(el, left, area * 0.65, 0.88, halfW, halfH);
        addCandidate(el, right, area * 0.65, 0.88, halfW, halfH);
      } else if (isTall) {
        const top = toNorm(rect.left + rect.width * 0.5, rect.top + rect.height * 0.32);
        const bottom = toNorm(rect.left + rect.width * 0.5, rect.top + rect.height * 0.68);
        addCandidate(el, top, area * 0.65, 0.88, halfW, halfH);
        addCandidate(el, bottom, area * 0.65, 0.88, halfW, halfH);
      }
    });

    candidates.sort((a, b) => b.priority - a.priority);
    const chosen = candidates.slice(0, this.maxAttractors);

    this.attractors = chosen.map(c => ({
      element: c.el,
      x: c.x,
      y: c.y,
      halfW: c.halfW,
      halfH: c.halfH,
      strength: this.behavior.baseStrength * c.strengthScale,
      targetStrength: this.behavior.baseStrength * c.strengthScale,
      fadeSpeed: this.behavior.fallSpeed,
      isPermanent: true,
      isGlowing: false
    }));

    console.log(`LiquidAurora: registered ${this.attractors.length}/${candidates.length} shape-aware permanent attractors`);
  }

  setupHoverHandlers() {
    // Use same selector set for hover. Additionally, allow opt-in elements via data-liquid="1"
    const selector = [
      '.btn',
      'button',
      '.nav-link',
      'a[href]',
      'h1, h2, h3',
      '[data-liquid="1"]',
      '.card',
      '.kpi'
    ].join(',');

    const elements = Array.from(document.querySelectorAll(selector))
      .filter(el => el.offsetWidth > 8 && el.offsetHeight > 8);

    // One unified handler for all elements:
    elements.forEach(el => {
      el.addEventListener('mouseenter', () => this.onHover(el), { passive: true });
      el.addEventListener('mouseleave', () => this.onLeave(el), { passive: true });
      el.addEventListener('focus', () => this.onHover(el), { passive: true });
      el.addEventListener('blur', () => this.onLeave(el), { passive: true });

      // Touch: quick “pulse”
      el.addEventListener('touchstart', () => this.onHover(el), { passive: true });
      el.addEventListener('touchend', () => this.onLeave(el), { passive: true });
    });
  }

  onHover(element) {
    // If element already has a permanent attractor: boost it
    const a = this.attractors.find(x => x.isPermanent && x.element === element);
    if (a) {
      a.targetStrength = this.behavior.hoverStrength;
      a.fadeSpeed = this.behavior.riseSpeed;
      a.isGlowing = true;
      return;
    }

    // If not present (because it wasn't in the top 8), we temporarily replace the least important one
    // to keep exactly 8 and remain uniform.
    const { x, y, halfW, halfH } = this.getElementCenter(element);

    // Choose a victim: the one with lowest current strength and not glowing
    let idx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.attractors.length; i++) {
      const score = this.attractors[i].strength + (this.attractors[i].isGlowing ? 1 : 0);
      if (score < bestScore) {
        bestScore = score;
        idx = i;
      }
    }

    if (idx >= 0) {
      // Replace in-place to keep maxAttractors stable
      this.attractors[idx] = {
        element,
        x,
        y,
        halfW,
        halfH,
        strength: this.behavior.baseStrength,
        targetStrength: this.behavior.hoverStrength,
        fadeSpeed: this.behavior.riseSpeed,
        isPermanent: false,
        isGlowing: true
      };
    }
  }

  onLeave(element) {
    const a = this.attractors.find(x => x.element === element);
    if (!a) return;

    if (a.isPermanent) {
      a.targetStrength = this.behavior.baseStrength;
      a.fadeSpeed = this.behavior.fallSpeed;
      a.isGlowing = false;
    } else {
      // Fade temporary one back down, then it will be removed/normalized by updateAttractors
      a.targetStrength = 0.0;
      a.fadeSpeed = this.behavior.removeSpeed;
      a.isGlowing = false;
    }
  }

  getElementCenter(el) {
    const rect = el.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / window.innerWidth;
    const cy = 1.0 - (rect.top + rect.height / 2) / window.innerHeight;
    const halfW = (rect.width * 0.55) / window.innerWidth;
    const halfH = (rect.height * 0.55) / window.innerHeight;
    return { x: cx, y: cy, halfW, halfH };
  }

  updateAttractors() {
    // Smoothly move strengths + update positions
    for (let i = this.attractors.length - 1; i >= 0; i--) {
      const a = this.attractors[i];

      // Update position continuously (layout can shift)
      if (a.element) {
        const rect = a.element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const c = this.getElementCenter(a.element);
          a.x = c.x;
          a.y = c.y;
          a.halfW = c.halfW;
          a.halfH = c.halfH;
        }
      }

      // Smooth strength
      a.strength += (a.targetStrength - a.strength) * a.fadeSpeed;

      // Remove temporary if faded out
      if (!a.isPermanent && a.targetStrength === 0.0 && a.strength < 0.01) {
        // Remove it; keep array length <= maxAttractors but not necessarily exactly max
        this.attractors.splice(i, 1);
      }
    }

    // Hard cap, never exceed 8 (shader limit)
    if (this.attractors.length > this.maxAttractors) {
      this.attractors.length = this.maxAttractors;
    }
  }

  render() {
    if (!this.gl || !this.program) return;

    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(this.uniformLocations.time, this.time);
    gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height);

    gl.uniform1f(this.uniformLocations.baseDriftSpeed, this.config.baseDriftSpeed);
    gl.uniform1f(this.uniformLocations.viscosity, this.config.viscosity);
    gl.uniform1f(this.uniformLocations.attractionStrength, this.config.attractionStrength);
    gl.uniform1f(this.uniformLocations.attractionFalloff, this.config.attractionFalloff);
    gl.uniform1f(this.uniformLocations.glowStrength, this.config.glowStrength);
    gl.uniform1f(this.uniformLocations.colorIntensity, this.config.colorIntensity);
    gl.uniform1f(this.uniformLocations.threshold, this.config.threshold);

    this.updateAttractors();

    const activeCount = Math.min(this.attractors.length, this.maxAttractors);

    const attractorData = new Float32Array(this.maxAttractors * 3);
    const maskData = new Float32Array(this.maxAttractors * 4);
    const glowData = new Float32Array(this.maxAttractors * 3);
    let glowCount = 0;

    for (let i = 0; i < activeCount; i++) {
      const a = this.attractors[i];
      attractorData[i * 3 + 0] = a.x;
      attractorData[i * 3 + 1] = a.y;
      attractorData[i * 3 + 2] = a.strength;

      maskData[i * 4 + 0] = a.x;
      maskData[i * 4 + 1] = a.y;
      maskData[i * 4 + 2] = a.halfW || 0.05;
      maskData[i * 4 + 3] = a.halfH || 0.05;

      if (a.isGlowing && glowCount < this.maxAttractors) {
        glowData[glowCount * 3 + 0] = a.x;
        glowData[glowCount * 3 + 1] = a.y;
        glowData[glowCount * 3 + 2] = a.strength;
        glowCount++;
      }
    }

    gl.uniform3fv(this.uniformLocations.attractors, attractorData);
    gl.uniform1i(this.uniformLocations.numAttractors, activeCount);

    gl.uniform4fv(this.uniformLocations.maskRects, maskData);
    gl.uniform1i(this.uniformLocations.numMaskRects, activeCount);

    gl.uniform3fv(this.uniformLocations.glowAttractors, glowData);
    gl.uniform1i(this.uniformLocations.numGlowAttractors, glowCount);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  animate() {
    if (this.reducedMotion) return;
    this.time += 1.0;
    this.render();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
  }
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  window.liquidAurora = new LiquidAurora();
});

// Optional: live tuning during development
window.tuneLiquidAurora = (patch) => {
  if (!window.liquidAurora) return;
  Object.assign(window.liquidAurora.config, patch);
  console.log('LiquidAurora config updated:', window.liquidAurora.config);
};

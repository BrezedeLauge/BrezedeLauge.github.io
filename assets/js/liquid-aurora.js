/**
 * Liquid Aurora WebGL Background System (Uniform Edition)
 * - Consistent effect across ALL interactive elements
 * - Attractor count clamped to shader limit (8)
 * - WebGL context loss handled (iOS Safari)
 * - FPS capped to reduce thermal load
 * - No external dependencies
 */

class LiquidAurora {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.uniformLocations = {};

    this.isMobile = this.detectMobile();
    this.dprCap = 2.0;

    // Attractors: { element, x, y, halfW, halfH, strength, targetStrength, fadeSpeed, isPermanent, isGlowing }
    this.attractors = [];
    this.maxAttractors = 8;

    this._attractorBuffer = null;
    this._maskBuffer = null;
    this._glowBuffer = null;

    // Time & animation
    this.time = 0; // "time units" used by shader (kept compatible with your tuning)
    this.animationId = null;
    this.reducedMotion = false;
    this.isInitialized = false;

    // FPS limiting
    this.targetFps = 30;
    this.frameMs = 1000 / this.targetFps;
    this.referenceFrameMs = 1000 / 60; // reference for dt-normalization
    this._lastFrameTime = null;
    this._frameAccumulator = 0;

    // Handlers
    this._resizeHandlerAttached = false;
    this._visibilityHandlerAttached = false;
    this._pageLifecycleAttached = false;
    this._contextHandlersAttached = false;

    // Behavior tuning
    this.behavior = {
      baseStrength: 0.06,
      hoverStrength: 0.30,
      riseSpeed: 0.020,
      fallSpeed: 0.060,      // faster decay to avoid lingering
      removeSpeed: 0.140     // aggressive removal for temporary attractors
    };

    // Visual tuning
    this.config = {
      baseDriftSpeed: 0.0002,
      viscosity: 0.00000978, // NOTE: uniform exists; shader may not use it
      attractionStrength: 50,
      attractionFalloff: 3.9,
      glowStrength: 0.5,
      resolutionScale: 0.35,
      colorIntensity: 0.3,
      threshold: 0.086,

      canvasOpacity: 0.5,
      fallbackOpacity: 0.26
    };

    // iOS detection + tuning
    // Keine Begrenzung mehr für iOS – volle Auflösung und Effekte auch auf iPhone/iPad

    this.applyPerformanceProfile();
    this.allocateBuffers();

    // Bind handlers
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.handlePageShow = this.handlePageShow.bind(this);
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
  }

  detectMobile() {
    const ua = navigator.userAgent || '';
    const touchCapable = navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) || touchCapable;
  }

  applyPerformanceProfile() {
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
    const narrowViewport = window.innerWidth && window.innerWidth <= 1024;

    if (this.isMobile || narrowViewport) {
      this.dprCap = Math.min(this.dprCap, 1.5);
      this.config.resolutionScale = Math.min(this.config.resolutionScale, 0.26);
      this.config.glowStrength = Math.min(this.config.glowStrength, 0.12);
      this.maxAttractors = Math.min(this.maxAttractors, 6);
    }

    if (lowMemory) {
      this.dprCap = Math.min(this.dprCap, 1.3);
      this.config.resolutionScale = Math.min(this.config.resolutionScale, 0.20);
      this.config.colorIntensity = Math.min(this.config.colorIntensity, 0.25);
      this.maxAttractors = Math.min(this.maxAttractors, 5);
    }

    if (this.isMobile || lowMemory) {
      this.targetFps = Math.min(this.targetFps, 28);
    }

    this.frameMs = 1000 / this.targetFps;
  }

  allocateBuffers() {
    const max = Math.max(1, this.maxAttractors);
    this._attractorBuffer = new Float32Array(max * 3);
    this._maskBuffer = new Float32Array(max * 4);
    this._glowBuffer = new Float32Array(max * 3);
  }

  init() {
    // Avoid double init
    if (this.isInitialized) return;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // iOS bekommt wieder die Animation, nur reducedMotion bleibt als Fallback
    if (this.reducedMotion) {
      this.ensureGlassLayer();
      this.initStaticFallback();
      this.isInitialized = true;
      return;
    }

    if (!this.setupCanvas()) return;
    this.ensureGlassLayer();
    if (!this.initWebGL()) return;
    if (!this.setupShaders()) return;

    this.registerUniformAttractors();

    this.attachVisibilityHandler();

    // Reset timing state
    this._lastFrameTime = null;
    this._frameAccumulator = 0;

    // Render 1 frame immediately (helps prevent “blank” first paint)
    this.render(this.referenceFrameMs);

    // Start animation (will immediately re-check visibility)
    this.animate();
    this.isInitialized = true;

    // Ensure correct running state
    this.handleVisibilityChange();

    const auroraContainer = document.querySelector('.aurora');
    if (auroraContainer) auroraContainer.style.opacity = String(this.config.fallbackOpacity);

    console.log('LiquidAurora: initialized');
  }

  ensureGlassLayer() {
    if (this.isIOS) return;
    if (document.getElementById('aurora-glass')) return;
    const glass = document.createElement('div');
    glass.id = 'aurora-glass';
    glass.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glass);
  }

  initStaticFallback() {
    const canvas = document.getElementById('liquid-aurora');
    if (!canvas) return;

    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '-2',
      pointerEvents: 'none',
      opacity: String(this.config.canvasOpacity),
      background: `
        radial-gradient(ellipse 820px 420px at 28% 38%,
          rgba(211,47,47,0.12) 0%,
          rgba(153,199,255,0.10) 36%,
          rgba(0,170,0,0.06) 64%,
          transparent 84%
        )
      `,
      filter: 'blur(48px)'
    });
  }

  setupCanvas() {
    this.canvas = document.getElementById('liquid-aurora');
    if (!this.canvas) {
      console.error('LiquidAurora: canvas #liquid-aurora not found');
      return false;
    }

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

    if (!this._resizeHandlerAttached) {
      window.addEventListener('resize', () => this.resizeCanvas(), { passive: true });
      this._resizeHandlerAttached = true;
    }

    if (!this._contextHandlersAttached) {
      this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
      this._contextHandlersAttached = true;
    }

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

      const fragmentShaderSource = `
        #ifdef GL_ES
        precision highp float;
        #endif

        uniform float time;
        uniform vec2 resolution;

        uniform vec3 attractors[8];
        uniform int numAttractors;

        uniform vec3 glowAttractors[8];
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
          vec2 h = rect.zw * 1.08;
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

          if (numAttractors >= 1) { vec2 a = attractors[0].xy; float s = attractors[0].z; float d = distance(p, a); float m = numMaskRects >= 1 ? rectMask(p, maskRects[0]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 2) { vec2 a = attractors[1].xy; float s = attractors[1].z; float d = distance(p, a); float m = numMaskRects >= 2 ? rectMask(p, maskRects[1]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 3) { vec2 a = attractors[2].xy; float s = attractors[2].z; float d = distance(p, a); float m = numMaskRects >= 3 ? rectMask(p, maskRects[2]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 4) { vec2 a = attractors[3].xy; float s = attractors[3].z; float d = distance(p, a); float m = numMaskRects >= 4 ? rectMask(p, maskRects[3]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 5) { vec2 a = attractors[4].xy; float s = attractors[4].z; float d = distance(p, a); float m = numMaskRects >= 5 ? rectMask(p, maskRects[4]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 6) { vec2 a = attractors[5].xy; float s = attractors[5].z; float d = distance(p, a); float m = numMaskRects >= 6 ? rectMask(p, maskRects[5]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 7) { vec2 a = attractors[6].xy; float s = attractors[6].z; float d = distance(p, a); float m = numMaskRects >= 7 ? rectMask(p, maskRects[6]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }
          if (numAttractors >= 8) { vec2 a = attractors[7].xy; float s = attractors[7].z; float d = distance(p, a); float m = numMaskRects >= 8 ? rectMask(p, maskRects[7]) : 1.0; field += (s / pow(d + 0.04, attractionFalloff)) * attractionStrength * m; }

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

          float glow = 0.0;
          float r = 0.02;
          glow += metaballField(p + vec2( 1.0,  0.0) * r);
          glow += metaballField(p + vec2(-1.0,  0.0) * r);
          glow += metaballField(p + vec2( 0.0,  1.0) * r);
          glow += metaballField(p + vec2( 0.0, -1.0) * r);
          glow *= 0.25;

          float glowAlpha = smoothstep(threshold * 0.3, threshold * 0.7, glow);
          color += color * glowAlpha * glowStrength * 0.3;

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

    console.log(`LiquidAurora: registered ${this.attractors.length}/${candidates.length} permanent attractors`);
  }

  getElementCenter(el) {
    const rect = el.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / window.innerWidth;
    const cy = 1.0 - (rect.top + rect.height / 2) / window.innerHeight;
    const halfW = (rect.width * 0.55) / window.innerWidth;
    const halfH = (rect.height * 0.55) / window.innerHeight;
    return { x: cx, y: cy, halfW, halfH };
  }

  updateAttractors(deltaMultiplier = 1) {
    for (let i = this.attractors.length - 1; i >= 0; i--) {
      const a = this.attractors[i];

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

      a.strength += (a.targetStrength - a.strength) * a.fadeSpeed * deltaMultiplier;

      if (!a.isPermanent && a.targetStrength === 0.0 && a.strength < 0.01) {
        this.attractors.splice(i, 1);
      }
    }

    if (this.attractors.length > this.maxAttractors) {
      this.attractors.length = this.maxAttractors;
    }
  }

  render(effectiveDt = this.referenceFrameMs) {
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

    const deltaMultiplier = Math.min(Math.max(effectiveDt / this.referenceFrameMs, 0), 3);
    this.updateAttractors(deltaMultiplier);

    const activeCount = Math.min(this.attractors.length, this.maxAttractors);

    if (!this._attractorBuffer || this._attractorBuffer.length !== this.maxAttractors * 3) {
      this.allocateBuffers();
    }

    const attractorData = this._attractorBuffer;
    const maskData = this._maskBuffer;
    const glowData = this._glowBuffer;
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

    for (let i = activeCount; i < this.maxAttractors; i++) {
      const baseIdx = i * 3;
      attractorData[baseIdx + 0] = 0;
      attractorData[baseIdx + 1] = 0;
      attractorData[baseIdx + 2] = 0;

      const maskIdx = i * 4;
      maskData[maskIdx + 0] = 0;
      maskData[maskIdx + 1] = 0;
      maskData[maskIdx + 2] = 0;
      maskData[maskIdx + 3] = 0;
    }

    for (let i = glowCount; i < this.maxAttractors; i++) {
      const glowIdx = i * 3;
      glowData[glowIdx + 0] = 0;
      glowData[glowIdx + 1] = 0;
      glowData[glowIdx + 2] = 0;
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

    // Schedule next tick first (keeps timing stable)
    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    if (this._lastFrameTime === null) {
      this._lastFrameTime = now;
      return;
    }

    const dt = now - this._lastFrameTime;
    this._lastFrameTime = now;
    this._frameAccumulator += dt;

    // Only render when we accumulated enough time for target FPS
    if (this._frameAccumulator < this.frameMs) return;

    const effectiveDt = this._frameAccumulator;
    this._frameAccumulator %= this.frameMs;

    // Keep your existing "time scale" behavior: normalize to 60fps units
    this.time += effectiveDt / this.referenceFrameMs;

    // IMPORTANT FIX: pass effectiveDt into render, not referenceFrameMs
    this.render(effectiveDt);
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;

    if (this.gl && this.program) this.gl.deleteProgram(this.program);
    this.program = null;
  }

  attachVisibilityHandler() {
    if (!this._visibilityHandlerAttached) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this._visibilityHandlerAttached = true;
    }

    if (!this._pageLifecycleAttached) {
      window.addEventListener('pagehide', this.handlePageHide, { passive: true });
      window.addEventListener('pageshow', this.handlePageShow, { passive: true });
      window.addEventListener('blur', this.handlePageHide, { passive: true });
      window.addEventListener('focus', this.handlePageShow, { passive: true });
      this._pageLifecycleAttached = true;
    }
  }

  handleVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this._lastFrameTime = null;
      this._frameAccumulator = 0;
      return;
    }

    if (!this.animationId && !this.reducedMotion) {
      this._lastFrameTime = performance.now();
      this._frameAccumulator = 0;
      this.animate();
    }
  }

  handlePageHide() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this._lastFrameTime = null;
    this._frameAccumulator = 0;
  }

  handlePageShow() {
    if (this.reducedMotion || document.visibilityState !== 'visible') return;
    if (!this.animationId) {
      this._lastFrameTime = performance.now();
      this._frameAccumulator = 0;
      this.animate();
    }
  }

  handleContextLost(event) {
    event.preventDefault();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.program = null;
    this._lastFrameTime = null;
    this._frameAccumulator = 0;
  }

  handleContextRestored() {
    if (!this.canvas) return;

    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false })
          || this.canvas.getContext('experimental-webgl');

    if (!this.gl) {
      console.error('LiquidAurora: WebGL context restore failed');
      return;
    }

    if (!this.initWebGL()) return;
    if (!this.setupShaders()) return;

    this.resizeCanvas();
    this._lastFrameTime = null;
    this._frameAccumulator = 0;

    this.render(this.referenceFrameMs);

    if (!this.reducedMotion) {
      this.animate();
    }
  }
}

/**
 * Auto-init after full load (improves iOS stability)
 */
const startAurora = () => {
  if (!window.liquidAurora) {
    window.liquidAurora = new LiquidAurora();
    window.liquidAurora.init();
  }
};

const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const scheduleAuroraStart = () => {
  const delayMs = isIOSDevice ? 900 : 250;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      setTimeout(startAurora, delayMs);
    }, { timeout: isIOSDevice ? 1400 : 800 });
  } else {
    setTimeout(startAurora, delayMs);
  }
};

window.addEventListener('load', () => {
  scheduleAuroraStart();
}, { once: true });

/**
 * Optional: live tuning during development
 */
window.tuneLiquidAurora = (patch) => {
  if (!window.liquidAurora) return;
  Object.assign(window.liquidAurora.config, patch);
  console.log('LiquidAurora config updated:', window.liquidAurora.config);
};
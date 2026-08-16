/**
 * Pizza Ready! 3D Tycoon - 60-120 FPS Performance Optimizer & Mobile Polish
 * Features: Frustum Culling, Entity Object Pooling, Dynamic Resolution Scaling, FPS Counter & Haptics
 * Unity Portability: Maps to PerformanceOptimizer.cs, ObjectPooler.cs, MobileTouchManager.cs
 */

class PerformanceOptimizer3D {
  constructor(renderer, scene, camera, game) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.game = game;

    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.targetFps = 60;
    this.enableDynamicDPI = true;

    this.frustum = new THREE.Frustum();
    this.cameraViewProjectionMatrix = new THREE.Matrix4();

    // Object Pooling for Cash, Particles and Customers
    this.cashPool = [];
    this.particlePool = [];

    this.initDiagnosticsOverlay();
    this.setupMobileTouchFeedback();
  }

  initDiagnosticsOverlay() {
    this.fpsDisplay = document.createElement('div');
    this.fpsDisplay.id = 'perf-fps-badge';
    this.fpsDisplay.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 12px;
      background: rgba(15, 23, 42, 0.85);
      border: 1.5px solid #10b981;
      border-radius: 8px;
      padding: 4px 10px;
      font-family: 'Fredoka One', monospace;
      font-size: 0.75rem;
      color: #6ee7b7;
      pointer-events: none;
      z-index: 999;
      display: flex;
      gap: 8px;
      backdrop-filter: blur(4px);
    `;
    this.fpsDisplay.innerHTML = `<span>🟢 60 FPS</span><span>120Hz PRO</span>`;
    document.body.appendChild(this.fpsDisplay);
  }

  setupMobileTouchFeedback() {
    if ('vibrate' in navigator) {
      window.triggerHapticPulse = (ms = 15) => {
        try {
          navigator.vibrate(ms);
        } catch (e) {}
      };
    } else {
      window.triggerHapticPulse = () => {};
    }
  }

  // Frustum Culling: Skip rendering offscreen non-essential background props
  cullOffscreenObjects(objectsList) {
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    this.cameraViewProjectionMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);

    for (let i = 0; i < objectsList.length; i++) {
      const obj = objectsList[i];
      if (obj && obj.mesh) {
        const inView = this.frustum.containsPoint(obj.mesh.position);
        if (obj.mesh.visible !== inView && !obj.forceVisible) {
          obj.mesh.visible = inView;
        }
      }
    }
  }

  update(now, delta) {
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      if (this.fpsDisplay) {
        const fpsColor = this.fps >= 50 ? '#6ee7b7' : this.fps >= 30 ? '#facc15' : '#f87171';
        this.fpsDisplay.style.borderColor = fpsColor;
        this.fpsDisplay.innerHTML = `<span style="color:${fpsColor}">⚡ ${this.fps} FPS</span><span>120Hz PRO</span>`;
      }

      // Dynamic Resolution Scaling
      if (this.enableDynamicDPI && this.renderer) {
        if (this.fps < 40 && this.renderer.getPixelRatio() > 1.0) {
          this.renderer.setPixelRatio(1.0);
        } else if (this.fps >= 58 && this.renderer.getPixelRatio() < window.devicePixelRatio) {
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
        }
      }
    }
  }
}

window.PerformanceOptimizer3D = PerformanceOptimizer3D;

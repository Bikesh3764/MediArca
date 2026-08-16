/**
 * Pizza Ready! 3D Tycoon - World Space Canvas & Decal Rendering Subsystem
 * High-DPI canvas projection for world markers, particle emitters, and holographic indicators.
 * Unity Portability: Maps to WorldCanvasRenderer.cs, DecalProjector.cs
 */

class WorldSpaceCanvasRenderer {
  constructor(canvasElement, camera) {
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.camera = camera;
    this.particles = [];
  }

  project(pos3D) {
    const v = pos3D.clone();
    v.project(this.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(v.y * 0.5) + 0.5) * window.innerHeight;
    return { x, y, visible: v.z < 1.0 };
  }

  render() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

window.WorldSpaceCanvasRenderer = WorldSpaceCanvasRenderer;

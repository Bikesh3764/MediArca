/**
 * Pizza Ready! 3D Tycoon - Ultra-High-Definition Canvas PBR Texture Atlas Engine
 * Generates bright sunny blonde birch floors, pastel tiles, green cash bill grids, branded box lids, and white unlock squares.
 * Unity Portability: Maps to TextureAtlasSO, PBRShaderGenerator.cs, DecalSystem.cs
 */

class ProceduralTextureAtlas {
  constructor() {
    this.cache = {};
  }

  /** 1. Bright Sunny Blonde Birch Vertical Wood Plank Flooring (1:1 with Reference Game) */
  createBirchPlankFloorTexture() {
    if (this.cache['birch_floor_sunny']) return this.cache['birch_floor_sunny'];

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Vibrant sunny golden blonde base
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(0, 0, 512, 512);

    // Vertical Wood Planks
    const plankWidth = 64;
    for (let x = 0; x < 512; x += plankWidth) {
      const isAlt = ((x / plankWidth) % 2 === 0);
      
      // Warm glowing honey tones
      ctx.fillStyle = isAlt ? '#ffedd5' : '#fde68a';
      ctx.fillRect(x + 2, 0, plankWidth - 4, 512);

      // Clean plank separator groove
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(x + 1, 0, plankWidth - 2, 512);

      // Subtle light wood grain
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.15)';
      ctx.lineWidth = 1;
      for (let g = 12; g < plankWidth - 12; g += 16) {
        ctx.beginPath();
        ctx.moveTo(x + g, 0);
        ctx.lineTo(x + g, 512);
        ctx.stroke();
      }

      // Horizontal staggered joints
      for (let y = (isAlt ? 128 : 256); y < 512; y += 256) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + plankWidth - 1, y);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    this.cache['birch_floor_sunny'] = tex;
    return tex;
  }

  /** 2. Clean Kitchen Pastel White Checkered Tile Flooring */
  createKitchenPastelTileTexture() {
    if (this.cache['kitchen_tile_clean']) return this.cache['kitchen_tile_clean'];

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 256, 256);

    const tileSize = 64;
    for (let x = 0; x < 256; x += tileSize) {
      for (let y = 0; y < 256; y += tileSize) {
        const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isAlt ? '#ffffff' : '#f8fafc';
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache['kitchen_tile_clean'] = tex;
    return tex;
  }

  /** 3. Authentic Green Dollar Cash Bill Grid Texture */
  createCashBillTexture() {
    if (this.cache['cash_bill_grid']) return this.cache['cash_bill_grid'];

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Vibrant Green Base
    const grad = ctx.createLinearGradient(0, 0, 256, 128);
    grad.addColorStop(0, '#22c55e');
    grad.addColorStop(1, '#16a34a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Light Green Inner Border
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 240, 112);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 228, 100);

    // White Center Oval
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.ellipse(128, 64, 48, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark Green Dollar Symbol
    ctx.fillStyle = '#15803d';
    ctx.font = '900 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 128, 64);

    // Corner Numbers
    ctx.font = '900 16px sans-serif';
    ctx.fillText('100', 32, 30);
    ctx.fillText('100', 224, 30);
    ctx.fillText('100', 32, 98);
    ctx.fillText('100', 224, 98);

    const tex = new THREE.CanvasTexture(canvas);
    this.cache['cash_bill_grid'] = tex;
    return tex;
  }

  /** 4. Official Pizza Hut Branded Box Lid */
  createPizzaBoxLidTexture(pizzaType = 'pepperoni') {
    const key = `box_lid_${pizzaType}`;
    if (this.cache[key]) return this.cache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const colors = {
      pepperoni: '#d32323',
      veggie: '#15803d',
      stuffed: '#d97706',
      supreme: '#991b1b',
      meatlovers: '#7f1d1d',
      lavacake: '#451a03'
    };

    ctx.fillStyle = colors[pizzaType] || '#d32323';
    ctx.fillRect(0, 0, 256, 256);

    // White Center Circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.fill();

    // Red Roof Silhouette Logo
    ctx.fillStyle = colors[pizzaType] || '#d32323';
    ctx.beginPath();
    ctx.moveTo(70, 110);
    ctx.lineTo(128, 70);
    ctx.lineTo(186, 110);
    ctx.lineTo(170, 118);
    ctx.lineTo(128, 90);
    ctx.lineTo(86, 118);
    ctx.closePath();
    ctx.fill();

    // Typography
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIZZA HUT', 128, 148);

    ctx.fillStyle = colors[pizzaType] || '#d32323';
    ctx.font = '800 13px sans-serif';
    ctx.fillText(pizzaType.toUpperCase() + " LOVER'S", 128, 168);

    const tex = new THREE.CanvasTexture(canvas);
    this.cache[key] = tex;
    return tex;
  }

  /** 5. White Rounded Square Unlock Pad Floor Decal (1:1 with Reference Game) */
  createUnlockSquareDecal(cost = 10) {
    const key = `unlock_sq_${cost}`;
    if (this.cache[key]) return this.cache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);

    // White Outer Rounded Box Outline
    const r = 32;
    const x = 14, y = 14, w = 228, h = 228;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Center Green Cash Bill Icon
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(68, 55, 120, 68, 12) : ctx.rect(68, 55, 120, 68);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 128, 89);

    // Cost Number Below Icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(`${cost}`, 128, 185);

    const tex = new THREE.CanvasTexture(canvas);
    this.cache[key] = tex;
    return tex;
  }
}

window.textureAtlas = new ProceduralTextureAtlas();

/**
 * Pizza Ready! 3D Tycoon - Supercent Master Screen-Space UI & Interaction Engine
 * World 3D-to-2D UI projection, particle physics, fortune wheel, and dough toss mini-game.
 * Unity Portability: Maps to MasterUIController.cs, MiniGameManager.cs, FortuneWheelController.cs
 */

class SupercentUIEngine {
  constructor(game, camera, worldUiLayer, floatersLayer) {
    this.game = game;
    this.camera = camera;
    this.worldUi = worldUiLayer;
    this.floaters = floatersLayer;
    this.flyingCoins = [];
    this.isSpinningWheel = false;
    this.wheelRotation = 0;
    this.wheelVelocity = 0;
    this.doughTossActive = false;
    this.doughBarPos = 0;
    this.doughBarDir = 1;
    this.initEventListeners();
  }

  initEventListeners() {
    const btnSpin = document.getElementById('btn-spin');
    if (btnSpin) {
      btnSpin.addEventListener('click', () => this.openSpinWheelModal());
    }

    const btnDough = document.getElementById('btn-dough');
    if (btnDough) {
      btnDough.addEventListener('click', () => this.openDoughTossModal());
    }
  }

  toScreenXY(pos3D) {
    const v = pos3D.clone();
    v.project(this.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(v.y * 0.5) + 0.5) * window.innerHeight;
    return { x, y, visible: v.z < 1.0 && v.x >= -1.2 && v.x <= 1.2 && v.y >= -1.2 && v.y <= 1.2 };
  }

  /** Render Customer Order Bubbles with Crisp Clean Mobile Styling */
  renderCustomerBubbles(customers, currentFloor) {
    customers.filter(c => c.state === 'WAITING' && !c.isOrderFulfilled()).forEach(cust => {
      const is2FCust = cust.targetData && cust.targetData.is2F;
      const sameFloor = (is2FCust && currentFloor === 2) || (!is2FCust && currentFloor === 1) || cust.type === 'counter';

      if (sameFloor) {
        const headPos = cust.mesh.position.clone().add(new THREE.Vector3(0, 2.4, 0));
        const screen = this.toScreenXY(headPos);

        if (screen.visible) {
          const bubble = document.createElement('div');
          bubble.className = 'world-order-bubble';
          if (cust.isCritic) bubble.style.borderColor = '#a855f7';
          bubble.innerHTML = cust.getOrderHtml();
          bubble.style.left = `${screen.x}px`;
          bubble.style.top = `${screen.y}px`;
          this.worldUi.appendChild(bubble);
        }
      }
    });
  }

  /** Render White Rounded Step-On Unlock Badges */
  renderUnlockPadBadges(unlockZones, currentFloor) {
    unlockZones.filter(z => z.isActive && !z.isUnlocked).forEach(zone => {
      const is2FZone = (zone.position.y && zone.position.y > 3.0);
      const sameFloor = (is2FZone && currentFloor === 2) || (!is2FZone && currentFloor === 1);

      if (sameFloor) {
        const zonePos = new THREE.Vector3(zone.position.x, (zone.position.y || 0) + 1.2, zone.position.z);
        const screen = this.toScreenXY(zonePos);

        if (screen.visible) {
          const tag = document.createElement('div');
          tag.className = 'world-unlock-tag';
          tag.innerHTML = `🟢 <strong>${zone.title}</strong><br><strong>$${zone.remainingCost}</strong>`;
          tag.style.left = `${screen.x}px`;
          tag.style.top = `${screen.y}px`;
          this.worldUi.appendChild(tag);
        }
      }
    });
  }

  /** Spawn Heart-Eyes Emote on Customer Meal Satisfaction */
  spawnHeartEyesEmote(worldX, worldY, worldZ) {
    const pos = new THREE.Vector3(worldX, worldY + 2.2, worldZ);
    const screen = this.toScreenXY(pos);
    if (!screen.visible) return;

    const emote = document.createElement('div');
    emote.className = 'heart-eyes-emote';
    emote.textContent = '😍';
    emote.style.position = 'fixed';
    emote.style.left = `${screen.x}px`;
    emote.style.top = `${screen.y}px`;
    emote.style.fontSize = '2.4rem';
    emote.style.pointerEvents = 'none';
    emote.style.zIndex = '150';
    emote.style.transform = 'translate(-50%, -50%) scale(0.5)';
    emote.style.transition = 'all 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
    document.body.appendChild(emote);

    requestAnimationFrame(() => {
      emote.style.transform = 'translate(-50%, -120px) scale(1.4)';
      emote.style.opacity = '0';
    });

    setTimeout(() => emote.remove(), 1200);
  }

  /** Lucky Fortune Spin Wheel Modal Logic */
  openSpinWheelModal() {
    const modal = document.getElementById('modal-spin');
    if (modal) modal.classList.add('active');
  }

  /** Golden Dough Toss Mini-Game Modal Logic */
  openDoughTossModal() {
    const modal = document.getElementById('modal-dough');
    if (modal) modal.classList.add('active');
  }
}

window.SupercentUIEngine = SupercentUIEngine;

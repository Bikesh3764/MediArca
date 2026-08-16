/**
 * Pizza Ready! 3D Tycoon - Commercial Screen-Space UI Controller & Modal System
 * World 3D-to-2D UI projection, modal managers, particle physics, and virtual touch joypad.
 * Unity Portability: Maps to CommercialUIController.cs, TouchInputSystem.cs
 */

class CommercialUIController {
  constructor(game, camera, worldUiLayer, floatersLayer) {
    this.game = game;
    this.camera = camera;
    this.worldUi = worldUiLayer;
    this.floaters = floatersLayer;
    this.flyingCoins = [];
    this.initEventListeners();
  }

  initEventListeners() {
    const btnRoadmap = document.getElementById('btn-open-roadmap');
    if (btnRoadmap) btnRoadmap.addEventListener('click', () => this.openRoadmapModal());

    const btnCloseRoadmap = document.getElementById('btn-close-roadmap');
    if (btnCloseRoadmap) btnCloseRoadmap.addEventListener('click', () => this.closeModal('modal-roadmap'));

    const btnUpgrade = document.getElementById('btn-hr');
    if (btnUpgrade) btnUpgrade.addEventListener('click', () => this.openUpgradeModal());

    const btnCloseUpgrade = document.getElementById('btn-close-upgrade');
    if (btnCloseUpgrade) btnCloseUpgrade.addEventListener('click', () => this.closeModal('modal-upgrade'));
  }

  toScreenXY(pos3D) {
    const v = pos3D.clone();
    v.project(this.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(v.y * 0.5) + 0.5) * window.innerHeight;
    return { x, y, visible: v.z < 1.0 && v.x >= -1.2 && v.x <= 1.2 && v.y >= -1.2 && v.y <= 1.2 };
  }

  openRoadmapModal() {
    const modal = document.getElementById('modal-roadmap');
    if (modal) modal.classList.add('active');
  }

  openUpgradeModal() {
    const modal = document.getElementById('modal-upgrade');
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

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
}

window.CommercialUIController = CommercialUIController;

/**
 * Pizza Ready! 3D Tycoon - Commercial Staff AI (Cashier, Master Chef, Dedicated Busboy Cleaner, Helper)
 * Unity Portability: Maps to CashierAI.cs, ChefAI.cs, CleanerAI.cs, WorkerAI.cs
 */

/** 1. Dedicated Front Counter Cashier */
class Cashier3D {
  constructor(scene, restaurant) {
    this.scene = scene;
    this.restaurant = restaurant;
    this.mesh = new THREE.Group();
    this.serviceTimer = 0;

    this.createCuteMesh();
    this.mesh.position.set(0, 0, 6.2);
    this.mesh.rotation.y = 0;
    this.scene.add(this.mesh);
  }

  createCuteMesh() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5d0a9 });

    const torsoGeo = new THREE.CylinderGeometry(0.42, 0.35, 0.9, 12);
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0x831843 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    this.mesh.add(torso);

    const headGeo = new THREE.SphereGeometry(0.36, 14, 14);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.68;
    this.mesh.add(head);

    // Cute Cashier Red Visor
    const visorGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12);
    const visorMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.y = 0.22;
    head.add(visor);

    // Animated Cash Register Arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.55, 8);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x831843 });

    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.42, 1.15, 0.25);
    this.leftArm.rotation.x = Math.PI / 2.5;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.42, 1.15, 0.25);
    this.rightArm.rotation.x = Math.PI / 2.5;
    this.mesh.add(this.rightArm);
  }

  update(delta) {
    this.serviceTimer += delta;
    this.leftArm.rotation.x = Math.PI / 2.5 + Math.sin(Date.now() * 0.015) * 0.15;
    this.rightArm.rotation.x = Math.PI / 2.5 - Math.sin(Date.now() * 0.015) * 0.15;

    // Automatic Checkout Assistance
    if (this.serviceTimer > 2.0) {
      this.serviceTimer = 0;
      const frontCust = this.restaurant.customers.find(c => c.type === 'counter' && c.state === 'WAITING' && c.queueIndex === 0);
      if (frontCust) {
        window.arcadeAudio.playRegisterBell();
        if (window.tycoonGame) {
          window.tycoonGame.showFloatingText('🛎️ REGISTER RING!', 0, 7.8);
        }
      }
    }
  }
}

/** 2. Kitchen Master Chef */
class Chef3D {
  constructor(scene, restaurant) {
    this.scene = scene;
    this.restaurant = restaurant;
    this.mesh = new THREE.Group();
    this.chopTimer = 0;
    this.cookBoostTimer = 0;

    this.createCuteMesh();
    this.mesh.position.set(-7, 0, -2);
    this.scene.add(this.mesh);
  }

  createCuteMesh() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5d0a9 });

    const torsoGeo = new THREE.CylinderGeometry(0.46, 0.4, 0.95, 12);
    const coatMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const torso = new THREE.Mesh(torsoGeo, coatMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    this.mesh.add(torso);

    const headGeo = new THREE.SphereGeometry(0.36, 14, 14);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.7;
    this.mesh.add(head);

    // Tall White Master Chef Hat (Toque Blanche)
    const hatGeo = new THREE.CylinderGeometry(0.44, 0.38, 0.7, 16);
    const hatMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 0.55;
    head.add(hat);

    const hatTopGeo = new THREE.SphereGeometry(0.46, 12, 12);
    const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
    hatTop.position.y = 0.9;
    head.add(hatTop);

    // Golden Rolling Pin
    const pinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
    const pinMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    this.tool = new THREE.Mesh(pinGeo, pinMat);
    this.tool.position.set(0.45, 1.1, 0.3);
    this.tool.rotation.x = Math.PI / 3;
    this.mesh.add(this.tool);
  }

  update(delta) {
    this.chopTimer += delta * 6.0;
    this.tool.rotation.x = (Math.PI / 3) + Math.sin(this.chopTimer) * 0.35;
    this.mesh.position.y = Math.abs(Math.sin(this.chopTimer * 0.5)) * 0.08;

    // Turbo Cook Boost (Accelerates all unlocked kitchen ovens)
    this.cookBoostTimer += delta;
    if (this.cookBoostTimer >= 1.2) {
      this.cookBoostTimer = 0;
      this.restaurant.ovensData.forEach(o => {
        if (o.config.unlocked && o.boxes.length < o.config.maxCapacity) {
          o.timer += 0.5;
        }
      });
    }
  }
}

/** 3. Dedicated Busboy Cleaner */
class Cleaner3D {
  constructor(scene, restaurant) {
    this.scene = scene;
    this.restaurant = restaurant;
    this.mesh = new THREE.Group();
    this.speed = window.TYCOON_CONFIG.specializedStaff.cleaner.speed || 8.5;
    this.holdingTrash = false;
    this.targetTable = null;
    this.scrubTimer = 0;

    this.createCuteMesh();
    this.mesh.position.set(8, 0, 0);
    this.scene.add(this.mesh);
  }

  createCuteMesh() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5d0a9 });

    const torsoGeo = new THREE.CylinderGeometry(0.42, 0.36, 0.9, 12);
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x059669 });
    const torso = new THREE.Mesh(torsoGeo, vestMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    this.mesh.add(torso);

    const headGeo = new THREE.SphereGeometry(0.35, 14, 14);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.65;
    this.mesh.add(head);

    // Cleaner Green Bandana
    const bandGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 12);
    const bandMat = new THREE.MeshLambertMaterial({ color: 0x10b981 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.22;
    head.add(band);

    // Mop & Bucket Rig
    const mopHandleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6);
    const mopHandleMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
    this.mopHandle = new THREE.Mesh(mopHandleGeo, mopHandleMat);
    this.mopHandle.position.set(0.4, 0.9, 0.3);
    this.mopHandle.rotation.x = -Math.PI / 8;
    this.mesh.add(this.mopHandle);

    const mopHeadGeo = new THREE.BoxGeometry(0.3, 0.15, 0.5);
    const mopHeadMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const mopHead = new THREE.Mesh(mopHeadGeo, mopHeadMat);
    mopHead.position.set(0.4, 0.1, 0.7);
    this.mesh.add(mopHead);

    // Trash Box Rig
    this.trashBoxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), new THREE.MeshLambertMaterial({ color: 0x78553d }));
    this.trashBoxMesh.position.set(0, 1.15, 0.5);
    this.trashBoxMesh.visible = false;
    this.mesh.add(this.trashBoxMesh);
  }

  update(delta) {
    if (!this.holdingTrash) {
      const dirty = window.TYCOON_CONFIG.tables.find(t => t.unlocked && t.isDirty);
      if (dirty) {
        this.targetTable = dirty;
        const dx = dirty.position.x - this.mesh.position.x;
        const dz = dirty.position.z - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.2) {
          const step = this.speed * delta;
          this.mesh.position.x += (dx / dist) * step;
          this.mesh.position.z += (dz / dist) * step;
          this.mesh.rotation.y = Math.atan2(dx, dz);
        } else {
          // Animated Mop Scrubbing
          this.scrubTimer += delta;
          this.mopHandle.rotation.z = Math.sin(Date.now() * 0.02) * 0.35;
          if (this.scrubTimer > 0.8) {
            this.scrubTimer = 0;
            this.restaurant.cleanTable(dirty, null);
            this.holdingTrash = true;
            this.trashBoxMesh.visible = true;
            this.targetTable = null;
          }
        }
      } else {
        const homeX = 8, homeZ = 0;
        const dx = homeX - this.mesh.position.x;
        const dz = homeZ - this.mesh.position.z;
        if (Math.hypot(dx, dz) > 0.5) {
          this.mesh.position.x += dx * 2.0 * delta;
          this.mesh.position.z += dz * 2.0 * delta;
        }
      }
    } else {
      const binPos = window.TYCOON_CONFIG.trashBin.position;
      const dx = binPos.x - this.mesh.position.x;
      const dz = (binPos.z + 1.8) - this.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.5) {
        const step = this.speed * delta;
        this.mesh.position.x += (dx / dist) * step;
        this.mesh.position.z += (dz / dist) * step;
        this.mesh.rotation.y = Math.atan2(dx, dz);
      } else {
        this.holdingTrash = false;
        this.trashBoxMesh.visible = false;
        window.arcadeAudio.playTrashDump();
      }
    }
  }
}

/** 4. General Helper Staff with Obstacle Avoidance */
class Worker3D {
  constructor(scene, restaurant, id) {
    this.scene = scene;
    this.restaurant = restaurant;
    this.id = id;
    this.mesh = new THREE.Group();

    this.speed = window.TYCOON_CONFIG.worker.baseSpeed;
    this.maxCapacity = window.TYCOON_CONFIG.worker.baseCapacity;
    this.stack = [];
    this.state = 'FETCHING';

    this.createCuteMesh();
    this.mesh.position.set(4, 0, -2);
    this.scene.add(this.mesh);
  }

  createCuteMesh() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5d0a9 });

    const torsoGeo = new THREE.CylinderGeometry(0.44, 0.38, 0.95, 12);
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    this.mesh.add(torso);

    const headGeo = new THREE.SphereGeometry(0.35, 14, 14);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.65;
    this.mesh.add(head);

    this.stackAnchor = new THREE.Group();
    this.stackAnchor.position.set(0, 0.85, 0.65);
    this.mesh.add(this.stackAnchor);
  }

  addPizzaBox(pizzaType = 'pepperoni') {
    if (this.stack.length >= this.maxCapacity) return;

    const boxGeo = new THREE.BoxGeometry(0.85, 0.22, 0.85);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = this.stack.length * 0.24;
    box.castShadow = true;

    this.stackAnchor.add(box);
    this.stack.push({ mesh: box, type: pizzaType, category: 'pizza' });
  }

  removePizzaBox() {
    if (this.stack.length === 0) return null;
    const item = this.stack.pop();
    this.stackAnchor.remove(item.mesh);
    return item;
  }

  update(delta) {
    if (this.state === 'FETCHING') {
      const activeOven = this.restaurant.ovensData.find(o => o.config.unlocked && o.boxes.length > 0);
      if (activeOven && this.stack.length < this.maxCapacity) {
        const tx = activeOven.config.position.x;
        const tz = activeOven.config.position.z + 3.8;
        const dx = tx - this.mesh.position.x;
        const dz = tz - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.5) {
          const step = this.speed * delta;
          this.mesh.position.x += (dx / dist) * step;
          this.mesh.position.z += (dz / dist) * step;
          this.mesh.rotation.y = Math.atan2(dx, dz);
        } else {
          const box = activeOven.boxes.pop();
          if (box) {
            activeOven.mesh.remove(box.mesh);
            this.addPizzaBox(activeOven.config.type);
          }
          if (this.stack.length >= this.maxCapacity || activeOven.boxes.length === 0) {
            this.state = 'SERVING';
          }
        }
      } else if (this.stack.length > 0) {
        this.state = 'SERVING';
      }
    } else if (this.state === 'SERVING') {
      const cust = this.restaurant.customers.find(c => c.state === 'WAITING' && !c.isOrderFulfilled());
      if (cust && this.stack.length > 0) {
        const tx = (cust.type === 'counter') ? 0 : cust.mesh.position.x;
        const tz = (cust.type === 'counter') ? 7.2 : cust.mesh.position.z;
        const dx = tx - this.mesh.position.x;
        const dz = tz - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.8) {
          const step = this.speed * delta;
          this.mesh.position.x += (dx / dist) * step;
          this.mesh.position.z += (dz / dist) * step;
          this.mesh.rotation.y = Math.atan2(dx, dz);
        } else {
          const served = this.removePizzaBox();
          if (served) {
            const finished = cust.receivePizzaBox(served.type);
            if (finished) {
              if (cust.type === 'counter') this.restaurant.completeCounterCustomer(cust, window.tycoonGame);
              else this.restaurant.completeTableCustomer(cust, window.tycoonGame);
            }
          }
        }
      } else {
        this.state = 'FETCHING';
      }
    }
  }
}

window.Cashier3D = Cashier3D;
window.Chef3D = Chef3D;
window.Cleaner3D = Cleaner3D;
window.Worker3D = Worker3D;

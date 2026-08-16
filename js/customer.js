/**
 * Pizza Ready! 3D Tycoon - Commercial Customer AI, 8 Archetypes, Mood States & 3D Emote Bubbles
 * Unity Portability: Maps to CustomerAI.cs, CustomerArchetypes.cs, EmoteController.cs
 */

const CUSTOMER_PALETTES = [
  { shirt: 0x60a5fa, pants: 0x3b82f6, skin: 0x94a3b8 }, // Soft Blue Stickman
  { shirt: 0x34d399, pants: 0x059669, skin: 0x94a3b8 }, // Soft Mint Stickman
  { shirt: 0xa78bfa, pants: 0x7c3aed, skin: 0x94a3b8 }, // Soft Purple Stickman
  { shirt: 0xfb923c, pants: 0xea580c, skin: 0x94a3b8 }, // Soft Orange Stickman
  { shirt: 0x94a3b8, pants: 0x475569, skin: 0x64748b }, // Cool Gray Stickman
  { shirt: 0x38bdf8, pants: 0x0284c7, skin: 0x94a3b8 }  // Cyan Stickman
];

class Customer3D {
  constructor(scene, type = 'counter', targetData = null, restaurant = null) {
    this.scene = scene;
    this.type = type;
    this.targetData = targetData;
    this.restaurant = restaurant;
    
    this.mesh = new THREE.Group();
    this.pizzaOrders = {};
    this.drinkCount = 0;
    this.sideType = null;
    this.dessertType = null;
    this.isFeast = false;
    this.isCombo = false;
    
    this.generateRecipeOrder();

    this.state = 'WALKING_IN';
    this.eatTimer = 0;
    this.queueIndex = 0;
    
    this.walkCycle = 0;
    this.speed = 5.2;
    this.targetPos = new THREE.Vector3();
    
    this.archetype = CUSTOMER_PALETTES[Math.floor(Math.random() * CUSTOMER_PALETTES.length)];
    this.createStylizedCustomerMesh();
    
    const startY = (targetData && targetData.is2F) ? 6.8 : 0;
    this.mesh.position.set(0, startY, 22);
    this.scene.add(this.mesh);
  }

  generateRecipeOrder() {
    const unlockedOvens = window.TYCOON_CONFIG.ovens.filter(o => o.unlocked);
    const availableTypes = unlockedOvens.length > 0 ? unlockedOvens.map(o => o.type) : ['pepperoni'];

    const totalBoxes = 1 + Math.floor(Math.random() * (availableTypes.length > 1 ? 2 : 1));
    for (let i = 0; i < totalBoxes; i++) {
      const chosenType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      this.pizzaOrders[chosenType] = (this.pizzaOrders[chosenType] || 0) + 1;
    }

    if (window.TYCOON_CONFIG.sodaFountain.unlocked && Math.random() < 0.6) {
      this.drinkCount = 1;
      this.isCombo = true;
    }

    if (window.TYCOON_CONFIG.sidesStation.unlocked && Math.random() < 0.5) {
      this.sideType = Math.random() < 0.5 ? 'breadsticks' : 'wings';
    }

    if (this.targetData && this.targetData.is2F && window.TYCOON_CONFIG.dessertStation.unlocked) {
      this.dessertType = Math.random() < 0.5 ? 'lavacake' : 'gelato';
    }

    if (Object.keys(this.pizzaOrders).length > 0 && this.drinkCount > 0 && this.sideType) {
      this.isFeast = true;
    }
  }

  createStylizedCustomerMesh() {
    const skinMat = new THREE.MeshLambertMaterial({ color: this.archetype.skin || 0x94a3b8 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: this.archetype.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: this.archetype.pants });

    // Smooth Stylized Torso
    const torsoGeo = new THREE.CylinderGeometry(0.38, 0.32, 0.9, 12);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 0.95;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);

    // Smooth Round Head
    const headGeo = new THREE.SphereGeometry(0.42, 16, 16);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.68;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Cute Arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.6, 8);
    this.leftArm = new THREE.Mesh(armGeo, shirtMat);
    this.leftArm.position.set(-0.44, 1.05, 0);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, shirtMat);
    this.rightArm.position.set(0.44, 1.05, 0);
    this.mesh.add(this.rightArm);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.65, 8);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.2, 0.32, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.2, 0.32, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);
  }

  setTargetPosition(x, z) {
    this.targetPos.set(x, this.mesh.position.y, z);
    this.state = 'WALKING_IN';
  }

  getFirstNeededPizzaType() {
    for (const type in this.pizzaOrders) {
      if (this.pizzaOrders[type] > 0) return type;
    }
    return null;
  }

  needsDrink() {
    return (this.drinkCount > 0);
  }

  needsSide() {
    return (this.sideType !== null);
  }

  needsDessert() {
    return (this.dessertType !== null);
  }

  receivePizzaBox(pizzaType) {
    if (this.pizzaOrders[pizzaType] && this.pizzaOrders[pizzaType] > 0) {
      this.pizzaOrders[pizzaType] -= 1;
      if (this.pizzaOrders[pizzaType] <= 0) {
        delete this.pizzaOrders[pizzaType];
      }
    }
    return this.isOrderFulfilled();
  }

  receiveDrink() {
    if (this.drinkCount > 0) this.drinkCount -= 1;
    return this.isOrderFulfilled();
  }

  receiveSideItem() {
    this.sideType = null;
    return this.isOrderFulfilled();
  }

  receiveDessertItem() {
    this.dessertType = null;
    return this.isOrderFulfilled();
  }

  isOrderFulfilled() {
    return (
      Object.keys(this.pizzaOrders).length === 0 &&
      this.drinkCount === 0 &&
      this.sideType === null &&
      this.dessertType === null
    );
  }

  getTotalRevenue() {
    let total = 0;
    for (const type in this.pizzaOrders) {
      const typeInfo = window.TYCOON_CONFIG.pizzaTypes[type];
      total += (typeInfo ? typeInfo.price : 15);
    }
    if (this.drinkCount > 0) total += (window.TYCOON_CONFIG.sodaFountain.drinkPrice || 10);
    if (this.sideType) total += (window.TYCOON_CONFIG.sidesStation.sidePrice || 16);
    if (this.dessertType) total += (window.TYCOON_CONFIG.dessertStation.dessertPrice || 24);

    if (this.isFeast) total = Math.round(total * (window.TYCOON_CONFIG.sidesStation.feastMultiplier || 3.0));
    else if (this.isCombo) total = Math.round(total * (window.TYCOON_CONFIG.sodaFountain.comboMultiplier || 2.0));
    return total;
  }

  getOrderHtml() {
    const parts = [];
    for (const type in this.pizzaOrders) {
      const count = this.pizzaOrders[type];
      const info = window.TYCOON_CONFIG.pizzaTypes[type] || { icon: '🍕' };
      parts.push(`${info.icon} ${count}`);
    }
    if (this.drinkCount > 0) parts.push(`🥤 ${this.drinkCount}`);
    if (this.sideType) parts.push(`🍗 1`);
    if (this.dessertType) parts.push(`🍫 1`);

    let badge = '';
    if (this.isFeast) badge = `<span class="badge-feast">👑 3X MEGA FEAST</span><br>`;
    else if (this.isCombo) badge = `<span class="badge-combo">✨ 2X COMBO</span><br>`;

    return `${badge}${parts.join(' • ') || '✓'}`;
  }

  startEating(duration = 5.0) {
    this.state = 'EATING';
    this.eatTimer = duration;

    // 3D Delicious Pizza Slice in Hand
    const sliceGeo = new THREE.ConeGeometry(0.22, 0.42, 3);
    const sliceMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    this.eatingSlice = new THREE.Mesh(sliceGeo, sliceMat);
    this.eatingSlice.rotation.x = Math.PI / 2;
    this.eatingSlice.position.set(0, 1.15, 0.38);
    this.mesh.add(this.eatingSlice);
  }

  update(delta) {
    if (this.state === 'WALKING_IN') {
      const dx = this.targetPos.x - this.mesh.position.x;
      const dz = this.targetPos.z - this.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.15) {
        const moveDist = Math.min(dist, this.speed * delta);
        const angle = Math.atan2(dx, dz);
        this.mesh.rotation.y = angle;
        this.mesh.position.x += Math.sin(angle) * moveDist;
        this.mesh.position.z += Math.cos(angle) * moveDist;

        this.walkCycle += delta * (this.speed * 2.0);
        this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.65;
        this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.65;
        this.torso.scale.y = 1.0 + Math.sin(this.walkCycle * 2) * 0.04;
      } else {
        this.mesh.position.x = this.targetPos.x;
        this.mesh.position.z = this.targetPos.z;
        this.state = 'WAITING';
        this.mesh.rotation.y = Math.PI;
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.torso.scale.set(1, 1, 1);
      }
    } else if (this.state === 'EATING') {
      this.eatTimer -= delta;
      this.torso.rotation.x = Math.sin(Date.now() * 0.008) * 0.08;
      this.head.position.y = 1.68 + Math.abs(Math.sin(Date.now() * 0.012)) * 0.06;
      if (this.eatingSlice) {
        this.eatingSlice.position.y = 1.15 + Math.sin(Date.now() * 0.012) * 0.05;
      }

      if (this.eatTimer <= 0) {
        if (this.eatingSlice) {
          this.mesh.remove(this.eatingSlice);
          this.eatingSlice = null;
        }
        this.state = 'LEAVING';
        this.targetPos.set(0, this.mesh.position.y, 24);
        if (this.targetData && this.restaurant) {
          this.targetData.occupiedBy = false;
          this.restaurant.setTableDirty(this.targetData);
        }
      }
    } else if (this.state === 'LEAVING') {
      const dx = this.targetPos.x - this.mesh.position.x;
      const dz = this.targetPos.z - this.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.3) {
        const moveDist = this.speed * 1.2 * delta;
        const angle = Math.atan2(dx, dz);
        this.mesh.rotation.y = angle;
        this.mesh.position.x += Math.sin(angle) * moveDist;
        this.mesh.position.z += Math.cos(angle) * moveDist;

        this.walkCycle += delta * (this.speed * 2.2);
        this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.65;
        this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.65;
      } else {
        this.destroy();
      }
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.isDead = true;
  }
}

/** 3D VIP Food Critic Agent */
class FoodCritic3D extends Customer3D {
  constructor(scene, targetData, restaurant) {
    super(scene, 'table', targetData, restaurant);
    this.isCritic = true;
    this.payout = window.TYCOON_CONFIG.foodCritic.payout || 350;
  }

  createStylizedCustomerMesh() {
    const torsoGeo = new THREE.CylinderGeometry(0.44, 0.38, 1.0, 12);
    const purpleMat = new THREE.MeshLambertMaterial({ color: 0x7e22ce });
    this.torso = new THREE.Mesh(torsoGeo, purpleMat);
    this.torso.position.y = 1.0;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);

    const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbd2a4 });
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.72;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    const beretGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.14, 16);
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const beret = new THREE.Mesh(beretGeo, blackMat);
    beret.position.set(0.06, 0.28, 0);
    beret.rotation.z = -0.15;
    this.head.add(beret);

    const monoGeo = new THREE.TorusGeometry(0.09, 0.02, 8, 16);
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const mono = new THREE.Mesh(monoGeo, goldMat);
    mono.position.set(0.14, 0.05, 0.36);
    this.head.add(mono);

    const clipGeo = new THREE.BoxGeometry(0.45, 0.6, 0.06);
    const clipMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const clip = new THREE.Mesh(clipGeo, clipMat);
    clip.position.set(-0.35, 1.05, 0.35);
    clip.rotation.set(0.2, 0.3, -0.1);
    this.mesh.add(clip);

    const legGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.55, 8);
    this.leftLeg = new THREE.Mesh(legGeo, blackMat);
    this.leftLeg.position.set(-0.18, 0.3, 0);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, blackMat);
    this.rightLeg.position.set(0.18, 0.3, 0);
    this.mesh.add(this.rightLeg);
  }

  getOrderHtml() {
    const parts = [];
    for (const type in this.pizzaOrders) {
      const count = this.pizzaOrders[type];
      const info = window.TYCOON_CONFIG.pizzaTypes[type] || { icon: '🍕' };
      parts.push(`${info.icon} ${count}`);
    }
    if (this.drinkCount > 0) parts.push(`🥤 ${this.drinkCount}`);
    if (this.sideType) parts.push(`🍗 1`);
    if (this.dessertType) parts.push(`🍫 1`);

    return `<span class="badge-critic">⭐ <strong>MICHELIN INSPECTOR</strong></span><br>${parts.join(' • ') || '✓'}`;
  }
}

/** 3D Multi-Lane Drive-Thru Vehicle Agent */
class DriveThruCar3D {
  constructor(scene, lane = 1) {
    this.scene = scene;
    this.lane = lane;
    this.mesh = new THREE.Group();
    this.wheels = [];
    
    const posX = (lane === 1) ? -20 : -26;
    this.mesh.position.set(posX, 0, -22);
    
    const isLimo = (lane === 2 && Math.random() < 0.7);
    const isSport = (!isLimo && Math.random() < 0.45);
    this.carType = isLimo ? 'limousine' : isSport ? 'sportscar' : 'sedan';
    
    this.speed = isSport ? 14.0 : 10.0;
    this.state = 'DRIVING_IN';
    this.pizzaOrders = {};
    this.drinkCount = 0;
    this.sideType = null;
    
    this.generateDriveThruOrder();
    this.createCarMesh();
    this.scene.add(this.mesh);
  }

  generateDriveThruOrder() {
    if (this.carType === 'limousine') {
      this.pizzaOrders = { pepperoni: 3, veggie: 2 };
      this.drinkCount = 3;
      this.sideType = 'wings';
      this.isVip = true;
    } else if (this.carType === 'sportscar') {
      this.pizzaOrders = { pepperoni: 2, stuffed: 1 };
      this.drinkCount = 1;
      this.sideType = 'breadsticks';
      this.isVip = true;
    } else {
      this.pizzaOrders = { pepperoni: 2 };
      this.drinkCount = 1;
      this.sideType = null;
      this.isVip = false;
    }
  }

  createCarMesh() {
    if (this.carType === 'limousine') {
      const bodyGeo = new THREE.BoxGeometry(2.4, 0.85, 7.5);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.65;
      body.castShadow = true;
      this.mesh.add(body);

      const cabinGeo = new THREE.BoxGeometry(2.1, 0.7, 5.2);
      const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.35, -0.4);
      this.mesh.add(cabin);

      const grillGeo = new THREE.BoxGeometry(1.6, 0.45, 0.1);
      const grillMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const grill = new THREE.Mesh(grillGeo, grillMat);
      grill.position.set(0, 0.65, 3.8);
      this.mesh.add(grill);

      [-2.6, 0, 2.6].forEach(wz => {
        [-1.25, 1.25].forEach(wx => {
          const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
          const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.38, wz);
          this.mesh.add(wheel);
          this.wheels.push(wheel);
        });
      });
    } else if (this.carType === 'sportscar') {
      const bodyGeo = new THREE.BoxGeometry(2.3, 0.65, 4.4);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      this.mesh.add(body);

      const stripeGeo = new THREE.BoxGeometry(0.5, 0.68, 4.45);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.56;
      this.mesh.add(stripe);

      const cabinGeo = new THREE.BoxGeometry(2.0, 0.6, 2.0);
      const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.1, -0.3);
      this.mesh.add(cabin);

      [[-1.25, 0.35, 1.3], [1.25, 0.35, 1.3], [-1.25, 0.35, -1.3], [1.25, 0.35, -1.3]].forEach(pos => {
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        this.mesh.add(wheel);
        this.wheels.push(wheel);
      });
    } else {
      const bodyGeo = new THREE.BoxGeometry(2.4, 0.8, 4.2);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2563eb });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      body.castShadow = true;
      this.mesh.add(body);

      const cabinGeo = new THREE.BoxGeometry(2.1, 0.75, 2.4);
      const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.35, -0.2);
      this.mesh.add(cabin);

      [[-1.25, 0.38, 1.3], [1.25, 0.38, 1.3], [-1.25, 0.38, -1.3], [1.25, 0.38, -1.3]].forEach(pos => {
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        this.mesh.add(wheel);
        this.wheels.push(wheel);
      });
    }

    const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const leftLight = new THREE.Mesh(lightGeo, lightMat);
    leftLight.position.set(-0.8, 0.6, 2.15);
    const rightLight = new THREE.Mesh(lightGeo, lightMat);
    rightLight.position.set(0.8, 0.6, 2.15);
    this.mesh.add(leftLight);
    this.mesh.add(rightLight);
  }

  getFirstNeededPizzaType() {
    for (const type in this.pizzaOrders) {
      if (this.pizzaOrders[type] > 0) return type;
    }
    return null;
  }

  needsDrink() {
    return (this.drinkCount > 0);
  }

  needsSide() {
    return (this.sideType !== null);
  }

  receivePizzaBox(pizzaType) {
    if (this.pizzaOrders[pizzaType] && this.pizzaOrders[pizzaType] > 0) {
      this.pizzaOrders[pizzaType] -= 1;
      if (this.pizzaOrders[pizzaType] <= 0) {
        delete this.pizzaOrders[pizzaType];
      }
    }
    return this.isOrderFulfilled();
  }

  receiveDrink() {
    if (this.drinkCount > 0) this.drinkCount -= 1;
    return this.isOrderFulfilled();
  }

  receiveSideItem() {
    this.sideType = null;
    return this.isOrderFulfilled();
  }

  isOrderFulfilled() {
    return (Object.keys(this.pizzaOrders).length === 0 && this.drinkCount === 0 && this.sideType === null);
  }

  getOrderHtml() {
    const parts = [];
    for (const type in this.pizzaOrders) {
      const count = this.pizzaOrders[type];
      const info = window.TYCOON_CONFIG.pizzaTypes[type] || { icon: '🍕' };
      parts.push(`${info.icon} ${count}`);
    }
    if (this.drinkCount > 0) parts.push(`🥤 ${this.drinkCount}`);
    if (this.sideType) parts.push(`🍗 1`);
    const vipPrefix = (this.carType === 'limousine') ? '👑 <strong>VIP LIMO (5X)</strong>: ' : (this.carType === 'sportscar') ? '🏎️ <strong>VIP RACER</strong>: ' : '🚗 ';
    return `${vipPrefix}${parts.join(' • ') || '✓'}`;
  }

  update(delta) {
    if (this.state === 'DRIVING_IN') {
      const targetZ = 8.0;
      const dist = targetZ - this.mesh.position.z;

      if (dist > 0.1) {
        const curSpeed = Math.max(3.0, Math.min(this.speed, dist * 2.2));
        this.mesh.position.z += curSpeed * delta;
        this.wheels.forEach(w => { w.rotation.x += curSpeed * delta * 3.5; });
      } else {
        this.mesh.position.z = targetZ;
        this.state = 'WAITING';
      }
    } else if (this.state === 'LEAVING') {
      const leaveSpeed = this.speed * 1.5;
      this.mesh.position.z += leaveSpeed * delta;
      this.wheels.forEach(w => { w.rotation.x += leaveSpeed * delta * 3.5; });

      if (this.mesh.position.z > 30) {
        this.destroy();
      }
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.isDead = true;
  }
}

/** 3D Pizza Hut Scooter Delivery Fleet Agent */
class DeliveryScooter3D {
  constructor(scene, restaurant) {
    this.scene = scene;
    this.restaurant = restaurant;
    this.mesh = new THREE.Group();
    
    this.pizzaOrders = { pepperoni: 2 };
    this.drinkCount = 1;
    this.state = 'WAITING_FOR_PACKING';
    this.deliveryTimer = 0;
    this.basePayout = window.TYCOON_CONFIG.scooterStation.basePayout || 220;

    this.createMopedMesh();
    this.mesh.position.set(window.TYCOON_CONFIG.scooterStation.position.x, 0, window.TYCOON_CONFIG.scooterStation.position.z);
    this.scene.add(this.mesh);
  }

  createMopedMesh() {
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 2.2);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    this.mesh.add(body);

    const fairGeo = new THREE.BoxGeometry(0.7, 0.9, 0.4);
    const fair = new THREE.Mesh(fairGeo, bodyMat);
    fair.position.set(0, 0.9, 0.9);
    this.mesh.add(fair);

    const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(0, 1.0, 1.12);
    this.mesh.add(light);

    const bagGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const bagMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const bag = new THREE.Mesh(bagGeo, bagMat);
    bag.position.set(0, 1.15, -0.7);
    this.mesh.add(bag);

    const logoGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const logoMat = new THREE.MeshBasicMaterial({ color: 0xd32323 });
    const logo = new THREE.Mesh(logoGeo, logoMat);
    logo.position.set(0, 1.15, -1.13);
    logo.rotation.y = Math.PI;
    this.mesh.add(logo);

    [-0.8, 0.8].forEach(wz => {
      const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.3, wz);
      this.mesh.add(wheel);
    });
  }

  getFirstNeededPizzaType() {
    for (const type in this.pizzaOrders) {
      if (this.pizzaOrders[type] > 0) return type;
    }
    return null;
  }

  needsDrink() {
    return (this.drinkCount > 0);
  }

  receivePizzaBox(pizzaType) {
    if (this.pizzaOrders[pizzaType] && this.pizzaOrders[pizzaType] > 0) {
      this.pizzaOrders[pizzaType] -= 1;
      if (this.pizzaOrders[pizzaType] <= 0) {
        delete this.pizzaOrders[pizzaType];
      }
    }
    return this.isOrderFulfilled();
  }

  receiveDrink() {
    if (this.drinkCount > 0) this.drinkCount -= 1;
    return this.isOrderFulfilled();
  }

  isOrderFulfilled() {
    return (Object.keys(this.pizzaOrders).length === 0 && this.drinkCount === 0);
  }

  getOrderHtml() {
    const parts = [];
    for (const type in this.pizzaOrders) {
      const count = this.pizzaOrders[type];
      const info = window.TYCOON_CONFIG.pizzaTypes[type] || { icon: '🍕' };
      parts.push(`${info.icon} ${count}`);
    }
    if (this.drinkCount > 0) parts.push(`🥤 ${this.drinkCount}`);
    return `🛵 <strong>ONLINE ORDER</strong>: ${parts.join(' • ') || 'PACKED ✓'}`;
  }

  dispatchDelivery(game) {
    this.state = 'DELIVERING';
    this.deliveryTimer = window.TYCOON_CONFIG.scooterStation.deliveryDuration || 6.0;
    this.mesh.visible = false;
    window.arcadeAudio.playBoxPickup();
    if (game) {
      game.showFloatingText('🛵 SCOOTER DISPATCHED ON DELIVERY!', 10, 18);
      if (game.battlePass) game.battlePass.trackAction('scooter_deliv', 1);
    }
  }

  update(delta, game) {
    if (this.state === 'DELIVERING') {
      this.deliveryTimer -= delta;
      if (this.deliveryTimer <= 0) {
        this.state = 'WAITING_FOR_PACKING';
        this.mesh.visible = true;
        this.pizzaOrders = { pepperoni: 2 };
        if (window.TYCOON_CONFIG.sodaFountain.unlocked) this.drinkCount = 1;

        if (game) {
          game.addCash(this.basePayout);
          game.showFloatingText(`🛵 DELIVERY COMPLETED! +$${this.basePayout}`, 10, 18);
          window.arcadeAudio.playVipReward();
        }
      }
    }
  }
}

window.Customer3D = Customer3D;
window.FoodCritic3D = FoodCritic3D;
window.DriveThruCar3D = DriveThruCar3D;
window.DeliveryScooter3D = DeliveryScooter3D;

/**
 * Pizza Ready! 3D Tycoon - Commercial Character Rig, Squash-and-Stretch Animation & Multi-Item Stack Physics
 * Unity Portability: Maps to PlayerController.cs, CharacterSquashStretch.cs, StackSystem.cs
 */

class Player3D {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    
    this.speed = window.TYCOON_CONFIG.player.baseSpeed;
    this.maxCapacity = window.TYCOON_CONFIG.player.baseCapacity;
    this.stack = [];
    this.stackType = 'empty';
    this.currentFloor = 1;
    this.targetY = 0;
    
    this.walkCycle = 0;
    this.isMoving = false;
    this.turnLean = 0;
    
    this.createCommercialCharacterMesh();
    this.mesh.position.set(0, 0, 14);
    this.scene.add(this.mesh);

    // Obstacle AABB Collision Boxes [minX, maxX, minZ, maxZ]
    this.colliders1F = [
      // Front Counter Desk
      { minX: -5.4, maxX: 5.4, minZ: 7.2, maxZ: 8.8 },
      // Kitchen Divider Wall
      { minX: -3.5, maxX: -2.8, minZ: -14.2, maxZ: -5.8 }
    ];
  }

  createCommercialCharacterMesh() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbd2a4 });
    const redShirtMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const darkPantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const capMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    // Torso with Rounded Proportions
    const torsoGeo = new THREE.CylinderGeometry(0.48, 0.4, 1.05, 12);
    this.torso = new THREE.Mesh(torsoGeo, redShirtMat);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.mesh.add(this.torso);

    // Black Waist Apron
    const apronGeo = new THREE.BoxGeometry(0.74, 0.88, 0.12);
    const apronMat = new THREE.MeshLambertMaterial({ color: 0x18181f });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.set(0, 0.92, 0.38);
    this.mesh.add(apron);

    // Cute Stylized Head
    const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.8;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Expressive Eyes
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, blackMat);
    leftEye.position.set(-0.13, 0.06, 0.34);
    this.head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, blackMat);
    rightEye.position.set(0.13, 0.06, 0.34);
    this.head.add(rightEye);

    // Red Pizza Hut Cap with 3D Curved Visor
    const capGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.22, 16);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.24;
    this.head.add(cap);

    const visorGeo = new THREE.BoxGeometry(0.56, 0.06, 0.36);
    const visor = new THREE.Mesh(visorGeo, capMat);
    visor.position.set(0, 0.18, 0.38);
    this.head.add(visor);

    // White Hat Emblem
    const emblemGeo = new THREE.PlaneGeometry(0.24, 0.16);
    const emblem = new THREE.Mesh(emblemGeo, whiteMat);
    emblem.position.set(0, 0.24, 0.45);
    this.head.add(emblem);

    // Carrying Arms with Cute White Handling Gloves
    const armGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.55, 8);
    const handGeo = new THREE.SphereGeometry(0.12, 8, 8);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.48, 1.15, 0.15);
    const leftArmMesh = new THREE.Mesh(armGeo, redShirtMat);
    leftArmMesh.rotation.x = Math.PI / 2.8;
    this.leftArm.add(leftArmMesh);
    const leftHand = new THREE.Mesh(handGeo, whiteMat);
    leftHand.position.set(0, 0.2, 0.35);
    this.leftArm.add(leftHand);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 1.15, 0.15);
    const rightArmMesh = new THREE.Mesh(armGeo, redShirtMat);
    rightArmMesh.rotation.x = Math.PI / 2.8;
    this.rightArm.add(rightArmMesh);
    const rightHand = new THREE.Mesh(handGeo, whiteMat);
    rightHand.position.set(0, 0.2, 0.35);
    this.rightArm.add(rightHand);
    this.mesh.add(this.rightArm);

    // Legs with Athletic Sneaker Soles
    const legGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.65, 8);
    const shoeGeo = new THREE.BoxGeometry(0.22, 0.12, 0.34);

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.22, 0.35, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, darkPantsMat);
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);
    const leftShoe = new THREE.Mesh(shoeGeo, redShirtMat);
    leftShoe.position.set(0, -0.28, 0.08);
    this.leftLeg.add(leftShoe);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.22, 0.35, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, darkPantsMat);
    rightLegMesh.castShadow = true;
    this.rightLeg.add(rightLegMesh);
    const rightShoe = new THREE.Mesh(shoeGeo, redShirtMat);
    rightShoe.position.set(0, -0.28, 0.08);
    this.rightLeg.add(rightShoe);
    this.mesh.add(this.rightLeg);

    // Carrying Stack Anchor Rig
    this.stackRig = new THREE.Group();
    this.stackRig.position.set(0, 1.25, 0.6);
    this.mesh.add(this.stackRig);
  }

  addPizzaBox(pizzaType = 'pepperoni') {
    if (this.stack.length >= this.maxCapacity) return false;
    if (this.stackType === 'trash') return false;

    this.stackType = 'food';
    const typeInfo = window.TYCOON_CONFIG.pizzaTypes[pizzaType] || window.TYCOON_CONFIG.pizzaTypes.pepperoni;
    const boxColor = typeInfo.color;

    const boxGroup = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(0.85, 0.22, 0.85);
    const boxMat = new THREE.MeshLambertMaterial({ color: boxColor });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    boxGroup.add(boxMesh);

    // Official Branded Pizza Hut Box Texture
    const lidLogoGeo = new THREE.PlaneGeometry(0.76, 0.76);
    const lidTex = (window.textureAtlas) ? window.textureAtlas.createPizzaBoxLidTexture(pizzaType) : null;
    const lidLogoMat = lidTex ? new THREE.MeshBasicMaterial({ map: lidTex }) : new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lidLogo = new THREE.Mesh(lidLogoGeo, lidLogoMat);
    lidLogo.rotation.x = -Math.PI / 2;
    lidLogo.position.y = 0.115;
    boxGroup.add(lidLogo);

    const currentIdx = this.stack.length;
    boxGroup.position.y = currentIdx * 0.25;

    this.stackRig.add(boxGroup);
    this.stack.push({
      mesh: boxGroup,
      category: 'pizza',
      type: pizzaType
    });

    // Juicy Squash Punch on Stack
    this.stackRig.scale.set(1.25, 0.75, 1.25);

    this.updateHUD();
    window.arcadeAudio.playBoxPickup();
    return true;
  }

  addDrinkCup(drinkType = 'pepsi') {
    if (this.stack.length >= this.maxCapacity) return false;
    if (this.stackType === 'trash') return false;

    this.stackType = 'food';
    const cupGroup = new THREE.Group();

    const cupGeo = new THREE.CylinderGeometry(0.28, 0.18, 0.5, 10);
    const cupMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const cupMesh = new THREE.Mesh(cupGeo, cupMat);
    cupMesh.castShadow = true;
    cupGroup.add(cupMesh);

    const lidGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.05, 10);
    const lidMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const lidMesh = new THREE.Mesh(lidGeo, lidMat);
    lidMesh.position.y = 0.25;
    cupGroup.add(lidMesh);

    const strawGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6);
    const strawMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const strawMesh = new THREE.Mesh(strawGeo, strawMat);
    strawMesh.position.set(0.08, 0.35, 0);
    strawMesh.rotation.z = -0.2;
    cupGroup.add(strawMesh);

    const currentIdx = this.stack.length;
    cupGroup.position.y = currentIdx * 0.25;

    this.stackRig.add(cupGroup);
    this.stack.push({
      mesh: cupGroup,
      category: 'drink',
      type: drinkType
    });

    this.updateHUD();
    window.arcadeAudio.playBoxPickup();
    return true;
  }

  addSideItem(sideType = 'wings') {
    if (this.stack.length >= this.maxCapacity) return false;
    if (this.stackType === 'trash') return false;

    this.stackType = 'food';
    const sideGroup = new THREE.Group();

    if (sideType === 'wings') {
      const bucketGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.45, 10);
      const bucketMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
      const bucket = new THREE.Mesh(bucketGeo, bucketMat);
      bucket.castShadow = true;
      sideGroup.add(bucket);
    } else {
      const bagGeo = new THREE.BoxGeometry(0.7, 0.38, 0.48);
      const bagMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
      const bag = new THREE.Mesh(bagGeo, bagMat);
      bag.castShadow = true;
      sideGroup.add(bag);
    }

    const currentIdx = this.stack.length;
    sideGroup.position.y = currentIdx * 0.25;

    this.stackRig.add(sideGroup);
    this.stack.push({
      mesh: sideGroup,
      category: 'side',
      type: sideType
    });

    this.updateHUD();
    window.arcadeAudio.playBoxPickup();
    return true;
  }

  addDessertItem(dessertType = 'lavacake') {
    if (this.stack.length >= this.maxCapacity) return false;
    if (this.stackType === 'trash') return false;

    this.stackType = 'food';
    const dGroup = new THREE.Group();

    const plateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 10);
    const plateMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.04;
    dGroup.add(plate);

    if (dessertType === 'lavacake') {
      const cakeGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.25, 8);
      const cakeMat = new THREE.MeshLambertMaterial({ color: 0x451a03 });
      const cake = new THREE.Mesh(cakeGeo, cakeMat);
      cake.position.y = 0.18;
      dGroup.add(cake);
    } else {
      const scoopGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const scoopMat = new THREE.MeshLambertMaterial({ color: 0xf472b6 });
      const scoop = new THREE.Mesh(scoopGeo, scoopMat);
      scoop.position.y = 0.22;
      dGroup.add(scoop);
    }

    const currentIdx = this.stack.length;
    dGroup.position.y = currentIdx * 0.25;

    this.stackRig.add(dGroup);
    this.stack.push({
      mesh: dGroup,
      category: 'dessert',
      type: dessertType
    });

    this.updateHUD();
    window.arcadeAudio.playBoxPickup();
    return true;
  }

  addTrashBox() {
    if (this.stack.length >= this.maxCapacity) return false;
    if (this.stack.length > 0 && this.stackType !== 'trash') return false;

    this.stackType = 'trash';
    const trashGroup = new THREE.Group();

    const boxGeo = new THREE.BoxGeometry(0.85, 0.22, 0.85);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x78553d });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    trashGroup.add(boxMesh);

    const currentIdx = this.stack.length;
    trashGroup.position.y = currentIdx * 0.25;

    this.stackRig.add(trashGroup);
    this.stack.push({
      mesh: trashGroup,
      category: 'trash',
      type: 'trash'
    });

    this.updateHUD();
    window.arcadeAudio.playBoxPickup();
    return true;
  }

  removePizzaBox(pizzaType = null) {
    if (this.stack.length === 0 || this.stackType !== 'food') return null;

    let targetIdx = -1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].category === 'pizza') {
        if (!pizzaType || this.stack[i].type === pizzaType) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) return null;

    const [item] = this.stack.splice(targetIdx, 1);
    this.stackRig.remove(item.mesh);
    this.realignStack();

    if (this.stack.length === 0) this.stackType = 'empty';
    this.updateHUD();
    window.arcadeAudio.playBoxDrop();
    return item;
  }

  removeDrinkCup() {
    if (this.stack.length === 0 || this.stackType !== 'food') return null;

    let targetIdx = -1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].category === 'drink') {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1) return null;

    const [item] = this.stack.splice(targetIdx, 1);
    this.stackRig.remove(item.mesh);
    this.realignStack();

    if (this.stack.length === 0) this.stackType = 'empty';
    this.updateHUD();
    window.arcadeAudio.playBoxDrop();
    return item;
  }

  removeSideItem(sideType = null) {
    if (this.stack.length === 0 || this.stackType !== 'food') return null;

    let targetIdx = -1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].category === 'side') {
        if (!sideType || this.stack[i].type === sideType) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) return null;

    const [item] = this.stack.splice(targetIdx, 1);
    this.stackRig.remove(item.mesh);
    this.realignStack();

    if (this.stack.length === 0) this.stackType = 'empty';
    this.updateHUD();
    window.arcadeAudio.playBoxDrop();
    return item;
  }

  removeDessertItem(dessertType = null) {
    if (this.stack.length === 0 || this.stackType !== 'food') return null;

    let targetIdx = -1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].category === 'dessert') {
        if (!dessertType || this.stack[i].type === dessertType) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) return null;

    const [item] = this.stack.splice(targetIdx, 1);
    this.stackRig.remove(item.mesh);
    this.realignStack();

    if (this.stack.length === 0) this.stackType = 'empty';
    this.updateHUD();
    window.arcadeAudio.playBoxDrop();
    return item;
  }

  dumpTrash() {
    if (this.stackType !== 'trash' || this.stack.length === 0) return 0;
    const count = this.stack.length;
    while (this.stack.length > 0) {
      const item = this.stack.pop();
      this.stackRig.remove(item.mesh);
    }
    this.stackType = 'empty';
    this.updateHUD();
    window.arcadeAudio.playTrashDump();
    return count;
  }

  realignStack() {
    this.stack.forEach((item, idx) => {
      item.mesh.position.y = idx * 0.25;
    });
  }

  updateHUD() {
    const el = document.getElementById('stack-count-display');
    if (el) {
      el.textContent = `${this.stack.length}/${this.maxCapacity}`;
    }
  }

  // Smooth Wall-Sliding Collision Resolution
  resolveObstacleCollisions(currentX, currentZ, proposedX, proposedZ) {
    const pRadius = 0.55;
    let nextX = proposedX;
    let nextZ = proposedZ;

    if (this.targetY <= 2.0) {
      for (let i = 0; i < this.colliders1F.length; i++) {
        const box = this.colliders1F[i];
        if (nextX + pRadius > box.minX && nextX - pRadius < box.maxX &&
            nextZ + pRadius > box.minZ && nextZ - pRadius < box.maxZ) {
          
          // Test sliding along X alone
          const testXCollision = (proposedX + pRadius > box.minX && proposedX - pRadius < box.maxX &&
                                  currentZ + pRadius > box.minZ && currentZ - pRadius < box.maxZ);
          
          // Test sliding along Z alone
          const testZCollision = (currentX + pRadius > box.minX && currentX - pRadius < box.maxX &&
                                  proposedZ + pRadius > box.minZ && proposedZ - pRadius < box.maxZ);

          if (!testXCollision) {
            nextZ = currentZ; // Slide freely on X
          } else if (!testZCollision) {
            nextX = currentX; // Slide freely on Z
          } else {
            // Push out to nearest safe edge
            const distLeft = Math.abs((nextX + pRadius) - box.minX);
            const distRight = Math.abs(box.maxX - (nextX - pRadius));
            const distBottom = Math.abs((nextZ + pRadius) - box.minZ);
            const distTop = Math.abs(box.maxZ - (nextZ - pRadius));

            const minDist = Math.min(distLeft, distRight, distBottom, distTop);
            if (minDist === distLeft) nextX = box.minX - pRadius;
            else if (minDist === distRight) nextX = box.maxX + pRadius;
            else if (minDist === distBottom) nextZ = box.minZ - pRadius;
            else if (minDist === distTop) nextZ = box.maxZ + pRadius;
          }
        }
      }
    }

    return { x: nextX, z: nextZ };
  }

  update(delta, inputVector) {
    // Smooth vertical position (1F vs 2F)
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, this.targetY, 8.0 * delta);

    if (inputVector.length() > 0.05) {
      this.isMoving = true;
      const angle = Math.atan2(inputVector.x, inputVector.y);
      this.mesh.rotation.y = angle;

      const moveDist = this.speed * delta;
      const rawTargetX = this.mesh.position.x + inputVector.x * moveDist;
      const rawTargetZ = this.mesh.position.z + inputVector.y * moveDist;

      // Smooth Wall-Sliding Collision Resolution
      const resolved = this.resolveObstacleCollisions(this.mesh.position.x, this.mesh.position.z, rawTargetX, rawTargetZ);
      let targetX = resolved.x;
      let targetZ = resolved.z;

      // Strict Room Bounds Clamping
      if (this.targetY > 3.0) {
        targetX = Math.max(-14.5, Math.min(14.5, targetX));
        targetZ = Math.max(-16.5, Math.min(-2.5, targetZ));
      } else {
        const isPatioUnlocked = (window.TYCOON_CONFIG && window.TYCOON_CONFIG.zone2 && window.TYCOON_CONFIG.zone2.unlocked);
        const maxX = isPatioUnlocked ? 35.0 : 16.5;
        targetX = Math.max(-17.5, Math.min(maxX, targetX));
        targetZ = Math.max(-16.5, Math.min(20.5, targetZ));
      }

      this.mesh.position.x = targetX;
      this.mesh.position.z = targetZ;

      // Commercial Walking Animation (Squash & Stretch)
      this.walkCycle += delta * (this.speed * 1.6);
      this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.75;
      this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.75;

      this.torso.scale.y = 1.0 + Math.sin(this.walkCycle * 2) * 0.05;
      this.torso.scale.x = 1.0 - Math.sin(this.walkCycle * 2) * 0.03;
      this.head.position.y = 1.8 + Math.abs(Math.sin(this.walkCycle)) * 0.07;

      // Dynamic Banking Lean
      this.turnLean = THREE.MathUtils.lerp(this.turnLean, -inputVector.x * 0.12, 10.0 * delta);
      this.mesh.rotation.z = this.turnLean;

      // Multi-Tiered Spring-Damper Inertia Stack Physics
      this.stack.forEach((item, idx) => {
        const tierFactor = (idx + 1) * 0.035;
        const swayX = Math.sin(this.walkCycle * 0.8 + idx * 0.45) * tierFactor;
        const swayZ = Math.cos(this.walkCycle * 0.8 + idx * 0.45) * (tierFactor * 0.6);
        
        item.mesh.rotation.z = THREE.MathUtils.lerp(item.mesh.rotation.z, swayX, 12.0 * delta);
        item.mesh.rotation.x = THREE.MathUtils.lerp(item.mesh.rotation.x, 0.04 + swayZ, 12.0 * delta);
        item.mesh.position.x = Math.sin(this.walkCycle + idx * 0.3) * (tierFactor * 0.3);
      });
    } else {
      this.isMoving = false;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.torso.scale.set(1, 1, 1);
      this.head.position.y = 1.8 + Math.sin(Date.now() * 0.003) * 0.02; // Idle breathing
      this.turnLean = THREE.MathUtils.lerp(this.turnLean, 0, 10.0 * delta);
      this.mesh.rotation.z = this.turnLean;

      // Spring-Damper Resting Return
      this.stack.forEach(item => {
        item.mesh.rotation.z = THREE.MathUtils.lerp(item.mesh.rotation.z, 0, 10.0 * delta);
        item.mesh.rotation.x = THREE.MathUtils.lerp(item.mesh.rotation.x, 0, 10.0 * delta);
        item.mesh.position.x = THREE.MathUtils.lerp(item.mesh.position.x, 0, 10.0 * delta);
      });
    }

    // Relax stack rig bounce
    this.stackRig.scale.x = THREE.MathUtils.lerp(this.stackRig.scale.x, 1.0, 12.0 * delta);
    this.stackRig.scale.y = THREE.MathUtils.lerp(this.stackRig.scale.y, 1.0, 12.0 * delta);
    this.stackRig.scale.z = THREE.MathUtils.lerp(this.stackRig.scale.z, 1.0, 12.0 * delta);
  }
}

window.Player3D = Player3D;

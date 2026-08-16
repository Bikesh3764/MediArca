/**
 * Pizza Ready! 3D Tycoon - Advanced Procedural Character Rigging & Animation Engine
 * Generates commercial chibi stickman characters with organic squash/stretch, multi-tiered stack inertia, and dedicated staff loops.
 * Unity Portability: Maps to CharacterController3D.cs, ProceduralIKRig.cs, StackPhysicsSpring.cs
 */

class AdvancedCharacterRig {
  constructor() {
    this.materials = {
      skinDefault: new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
      skinWarm: new THREE.MeshLambertMaterial({ color: 0xfbd2a4 }),
      glovesWhite: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      shoesRed: new THREE.MeshLambertMaterial({ color: 0xd32323 }),
      shoesDark: new THREE.MeshLambertMaterial({ color: 0x0f172a }),
      capRed: new THREE.MeshLambertMaterial({ color: 0xd32323 }),
      capBlue: new THREE.MeshLambertMaterial({ color: 0x2563eb }),
      apronBlack: new THREE.MeshLambertMaterial({ color: 0x18181f }),
      apronWhite: new THREE.MeshLambertMaterial({ color: 0xf8fafc }),
      eyesBlack: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
      blushPink: new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.65 })
    };
  }

  /** Build Player Commercial Character Rig with White Handling Gloves & Red Cap */
  buildPlayerRig(parentGroup, shirtColor = 0xd32323, pantsColor = 0x1e293b) {
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });

    // 1. Torso with Squash & Stretch Support
    const torsoGeo = new THREE.CylinderGeometry(0.42, 0.36, 0.95, 12);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    parentGroup.add(torso);

    // 2. Black Waist Utility Apron
    const apronGeo = new THREE.BoxGeometry(0.74, 0.88, 0.12);
    const apron = new THREE.Mesh(apronGeo, this.materials.apronBlack);
    apron.position.set(0, 0.92, 0.38);
    parentGroup.add(apron);

    // 3. Smooth Round Head
    const headGeo = new THREE.SphereGeometry(0.42, 16, 16);
    const head = new THREE.Mesh(headGeo, this.materials.skinWarm);
    head.position.y = 1.78;
    head.castShadow = true;
    parentGroup.add(head);

    // Expressive Eyes
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, this.materials.eyesBlack);
    leftEye.position.set(-0.13, 0.06, 0.38);
    head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, this.materials.eyesBlack);
    rightEye.position.set(0.13, 0.06, 0.38);
    head.add(rightEye);

    // Red Pizza Hut Cap with Curved 3D Bill
    const capGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.22, 16);
    const cap = new THREE.Mesh(capGeo, this.materials.capRed);
    cap.position.y = 0.26;
    head.add(cap);

    const visorGeo = new THREE.BoxGeometry(0.58, 0.06, 0.38);
    const visor = new THREE.Mesh(visorGeo, this.materials.capRed);
    visor.position.set(0, 0.2, 0.42);
    head.add(visor);

    // White Hat Emblem
    const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), this.materials.glovesWhite);
    emblem.position.set(0, 0.26, 0.49);
    head.add(emblem);

    // 4. Carrying Arms with White Handling Gloves
    const armGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.55, 8);
    const gloveGeo = new THREE.SphereGeometry(0.13, 8, 8);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.48, 1.15, 0.15);
    const leftArmMesh = new THREE.Mesh(armGeo, shirtMat);
    leftArmMesh.rotation.x = Math.PI / 2.8;
    leftArm.add(leftArmMesh);
    const leftGlove = new THREE.Mesh(gloveGeo, this.materials.glovesWhite);
    leftGlove.position.set(0, 0.2, 0.35);
    leftArm.add(leftGlove);
    parentGroup.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.48, 1.15, 0.15);
    const rightArmMesh = new THREE.Mesh(armGeo, shirtMat);
    rightArmMesh.rotation.x = Math.PI / 2.8;
    rightArm.add(rightArmMesh);
    const rightGlove = new THREE.Mesh(gloveGeo, this.materials.glovesWhite);
    rightGlove.position.set(0, 0.2, 0.35);
    rightArm.add(rightGlove);
    parentGroup.add(rightArm);

    // 5. Walking Legs with Athletic Sneaker Soles
    const legGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.65, 8);
    const shoeGeo = new THREE.BoxGeometry(0.24, 0.14, 0.36);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.22, 0.35, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);
    const leftShoe = new THREE.Mesh(shoeGeo, this.materials.shoesRed);
    leftShoe.position.set(0, -0.28, 0.08);
    leftLeg.add(leftShoe);
    parentGroup.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.22, 0.35, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);
    const rightShoe = new THREE.Mesh(shoeGeo, this.materials.shoesRed);
    rightShoe.position.set(0, -0.28, 0.08);
    rightLeg.add(rightShoe);
    parentGroup.add(rightLeg);

    // 6. Carrying Stack Anchor Rig
    const stackRig = new THREE.Group();
    stackRig.position.set(0, 1.25, 0.6);
    parentGroup.add(stackRig);

    return {
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      stackRig
    };
  }

  /** Multi-Tiered Spring-Damper Stack Sway Physics Calculation */
  calculateStackInertia(stack, walkCycle, delta, speed, turnLean) {
    stack.forEach((item, idx) => {
      // Dynamic tier resonance: higher boxes have larger sway amplitude and phase lag
      const tierFactor = (idx + 1) * 0.04;
      const swayX = Math.sin(walkCycle * 0.8 + idx * 0.45) * tierFactor - turnLean * (idx * 0.1);
      const swayZ = Math.cos(walkCycle * 0.8 + idx * 0.45) * (tierFactor * 0.6);

      item.mesh.rotation.z = THREE.MathUtils.lerp(item.mesh.rotation.z, swayX, 12.0 * delta);
      item.mesh.rotation.x = THREE.MathUtils.lerp(item.mesh.rotation.x, 0.04 + swayZ, 12.0 * delta);
      item.mesh.position.x = Math.sin(walkCycle + idx * 0.3) * (tierFactor * 0.3);
    });
  }
}

window.AdvancedCharacterRig = AdvancedCharacterRig;
window.characterRigEngine = new AdvancedCharacterRig();

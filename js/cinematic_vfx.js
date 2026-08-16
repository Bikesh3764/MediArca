/**
 * Pizza Ready! 3D Tycoon - Cinematic VFX, 3D Gold Coin Fountains, Confetti Fireworks & Screen Shake
 * Unity Portability: Maps to CinematicVFXManager.cs, CoinExplosion.cs, ConfettiCannon.cs, ScreenShake.cs
 */

class CinematicVFXManager3D {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.confettiParticles = [];
    this.coinParticles = [];
    this.confettiGroup = new THREE.Group();
    this.scene.add(this.confettiGroup);

    this.shakeDuration = 0;
    this.shakeMagnitude = 0;

    this.confettiColors = [
      0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b,
      0x8b5cf6, 0xec4899, 0x06b6d4, 0xfacc15
    ];
  }

  triggerConfettiBurst(worldPos, count = 120) {
    const pGeo = new THREE.PlaneGeometry(0.28, 0.45);

    for (let i = 0; i < count; i++) {
      const color = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)];
      const pMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
      const pMesh = new THREE.Mesh(pGeo, pMat);

      const spawnX = worldPos ? worldPos.x : 0;
      const spawnY = worldPos ? worldPos.y + 1.5 : 4;
      const spawnZ = worldPos ? worldPos.z : 0;

      pMesh.position.set(spawnX, spawnY, spawnZ);
      this.confettiGroup.add(pMesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 8.0 + Math.random() * 12.0;

      this.confettiParticles.push({
        mesh: pMesh,
        velX: Math.cos(angle) * speed,
        velY: 10.0 + Math.random() * 14.0,
        velZ: Math.sin(angle) * speed,
        rotX: Math.random() * 8,
        rotY: Math.random() * 8,
        rotZ: Math.random() * 8,
        life: 2.2 + Math.random() * 1.0,
        maxLife: 3.2
      });
    }

    this.triggerScreenShake(0.35, 0.4);
    window.arcadeAudio.playVipReward();
  }

  triggerGoldCoinFountain(worldPos, count = 30) {
    const coinGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 12);
    const coinMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });

    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.rotation.x = Math.PI / 2;

      const sx = worldPos ? worldPos.x : 0;
      const sy = worldPos ? worldPos.y + 1.0 : 2;
      const sz = worldPos ? worldPos.z : 0;

      coin.position.set(sx, sy, sz);
      this.confettiGroup.add(coin);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 8.0;

      this.coinParticles.push({
        mesh: coin,
        velX: Math.cos(angle) * speed,
        velY: 8.0 + Math.random() * 10.0,
        velZ: Math.sin(angle) * speed,
        rotX: Math.random() * 10,
        rotY: Math.random() * 10,
        life: 1.5 + Math.random() * 0.8
      });
    }

    this.triggerScreenShake(0.2, 0.25);
    window.arcadeAudio.playCash();
  }

  triggerScreenShake(duration = 0.3, magnitude = 0.35) {
    this.shakeDuration = duration;
    this.shakeMagnitude = magnitude;
  }

  update(delta) {
    // 1. Confetti Physics (Gravity + Air Drag + Flutter)
    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const cp = this.confettiParticles[i];
      cp.life -= delta;

      cp.velY -= 22.0 * delta; // Gravity
      cp.velX *= 0.96; // Air drag
      cp.velZ *= 0.96;

      cp.mesh.position.x += cp.velX * delta;
      cp.mesh.position.y += cp.velY * delta;
      cp.mesh.position.z += cp.velZ * delta;

      cp.mesh.rotation.x += cp.rotX * delta;
      cp.mesh.rotation.y += cp.rotY * delta;
      cp.mesh.rotation.z += cp.rotZ * delta;

      if (cp.life <= 0 || cp.mesh.position.y < 0.05) {
        this.confettiGroup.remove(cp.mesh);
        this.confettiParticles.splice(i, 1);
      }
    }

    // 2. Gold Coin Physics
    for (let i = this.coinParticles.length - 1; i >= 0; i--) {
      const gp = this.coinParticles[i];
      gp.life -= delta;

      gp.velY -= 28.0 * delta; // Coin gravity
      gp.mesh.position.x += gp.velX * delta;
      gp.mesh.position.y += gp.velY * delta;
      gp.mesh.position.z += gp.velZ * delta;

      gp.mesh.rotation.x += gp.rotX * delta;
      gp.mesh.rotation.y += gp.rotY * delta;

      if (gp.life <= 0 || gp.mesh.position.y < 0.05) {
        this.confettiGroup.remove(gp.mesh);
        this.coinParticles.splice(i, 1);
      }
    }

    // 3. Camera Screen Shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= delta;
      const offsetX = (Math.random() - 0.5) * this.shakeMagnitude;
      const offsetY = (Math.random() - 0.5) * this.shakeMagnitude;
      const offsetZ = (Math.random() - 0.5) * this.shakeMagnitude;
      this.camera.position.add(new THREE.Vector3(offsetX, offsetY, offsetZ));
    }
  }
}

window.CinematicVFXManager3D = CinematicVFXManager3D;

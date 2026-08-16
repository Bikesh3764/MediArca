/**
 * Pizza Ready! 3D Tycoon - Multi-City Franchise Expansion & Prestige System
 * Supported Maps: Chicago Classic, New York Times Square Flagship, Tokyo Akihabara Cyber Pizzeria
 * Unity Portability: Maps to CityManager.cs, PrestigeSystem.cs, LandmarkProps.cs
 */

class CityManager3D {
  constructor(scene, restaurant, game) {
    this.scene = scene;
    this.restaurant = restaurant;
    this.game = game;
    this.currentCityId = 'chicago';
    this.goldenTrophies = 0;
    this.cityLandmarksGroup = new THREE.Group();
    this.scene.add(this.cityLandmarksGroup);

    this.sakuraPetals = [];
    this.isSakuraActive = false;

    this.initCityData();
  }

  initCityData() {
    this.cities = [
      {
        id: 'chicago',
        name: 'Chicago Original HQ',
        icon: '🍕',
        tagline: 'The birthplace of deep dish & iconic red roof pizzerias.',
        requiredCost: 0,
        unlocked: true,
        multiplier: 1.0,
        specialty: 'Deep Dish Supreme',
        themePreset: 'classic',
        skyColor: 0x1e293b
      },
      {
        id: 'newyork',
        name: 'New York Times Square',
        icon: '🗽',
        tagline: 'Fast-paced giant slices with yellow cabs & Broadway neon billboards!',
        requiredCost: 1500,
        unlocked: false,
        multiplier: 2.5,
        specialty: 'NY Giant Pepperoni Fold',
        themePreset: 'retro',
        skyColor: 0x0f172a
      },
      {
        id: 'tokyo',
        name: 'Tokyo Akihabara Cyber',
        icon: '⛩️',
        tagline: 'Cyberpunk neon lights, falling sakura petals & teriyaki wasabi pizzas!',
        requiredCost: 3500,
        unlocked: false,
        multiplier: 5.0,
        specialty: 'Teriyaki Salmon Deluxe',
        themePreset: 'cyber',
        skyColor: 0x180b26
      }
    ];
  }

  getMultiplier() {
    const city = this.cities.find(c => c.id === this.currentCityId);
    const cityMult = city ? city.multiplier : 1.0;
    const trophyMult = 1.0 + (this.goldenTrophies * 0.25); // +25% per trophy
    return cityMult * trophyMult;
  }

  switchCity(cityId) {
    const city = this.cities.find(c => c.id === cityId);
    if (!city || !city.unlocked) return;

    this.currentCityId = cityId;
    this.clearLandmarks();

    if (cityId === 'newyork') {
      this.buildNewYorkLandmarks();
      this.isSakuraActive = false;
      window.arcadeAudio.playUnlock();
    } else if (cityId === 'tokyo') {
      this.buildTokyoLandmarks();
      this.isSakuraActive = true;
      window.arcadeAudio.playUnlock();
    } else {
      this.buildChicagoLandmarks();
      this.isSakuraActive = false;
      window.arcadeAudio.playUnlock();
    }

    if (this.restaurant) {
      this.restaurant.applyStoreTheme(city.themePreset);
    }
  }

  clearLandmarks() {
    while (this.cityLandmarksGroup.children.length > 0) {
      const obj = this.cityLandmarksGroup.children[0];
      this.cityLandmarksGroup.remove(obj);
    }
    this.sakuraPetals = [];
  }

  buildChicagoLandmarks() {
    // Street light poles with Chicago banners
    [[-20, 20], [20, 20]].forEach(pos => {
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6.0, 8);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(pos[0], 3.0, pos[1]);
      this.cityLandmarksGroup.add(pole);

      const bannerGeo = new THREE.BoxGeometry(0.8, 1.8, 0.05);
      const bannerMat = new THREE.MeshBasicMaterial({ color: 0xd32323 });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(pos[0] + 0.4, 4.5, pos[1]);
      this.cityLandmarksGroup.add(banner);
    });
  }

  buildNewYorkLandmarks() {
    // 1. Statue of Liberty Mini-Replica
    const statueGroup = new THREE.Group();
    statueGroup.position.set(28, 0, -16);

    const pedGeo = new THREE.BoxGeometry(3.0, 2.5, 3.0);
    const pedMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.y = 1.25;
    statueGroup.add(ped);

    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.9, 3.5, 10);
    const statueMat = new THREE.MeshLambertMaterial({ color: 0x34d399 });
    const body = new THREE.Mesh(bodyGeo, statueMat);
    body.position.y = 4.25;
    statueGroup.add(body);

    const crownGeo = new THREE.ConeGeometry(0.8, 0.6, 7);
    const crown = new THREE.Mesh(crownGeo, statueMat);
    crown.position.y = 6.2;
    statueGroup.add(crown);

    const torchArmGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6);
    const torchArm = new THREE.Mesh(torchArmGeo, statueMat);
    torchArm.position.set(0.6, 5.2, 0.4);
    torchArm.rotation.z = -Math.PI / 4;
    statueGroup.add(torchArm);

    const flameGeo = new THREE.OctahedronGeometry(0.3);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(1.2, 5.8, 0.4);
    statueGroup.add(flame);

    this.cityLandmarksGroup.add(statueGroup);

    // 2. Yellow NYC Taxi on the Road
    const cabGeo = new THREE.BoxGeometry(2.3, 0.8, 4.2);
    const cabMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(-23, 0.6, 22);
    this.cityLandmarksGroup.add(cab);

    const taxiSignGeo = new THREE.BoxGeometry(0.8, 0.3, 0.4);
    const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const taxiSign = new THREE.Mesh(taxiSignGeo, taxiSignMat);
    taxiSign.position.set(-23, 1.35, 22);
    this.cityLandmarksGroup.add(taxiSign);

    // 3. Broadway Neon Billboard
    const bBoardGeo = new THREE.BoxGeometry(10.0, 3.5, 0.3);
    const bBoardMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const bBoard = new THREE.Mesh(bBoardGeo, bBoardMat);
    bBoard.position.set(0, 10.0, -19.0);
    this.cityLandmarksGroup.add(bBoard);
  }

  buildTokyoLandmarks() {
    // 1. Red Japanese Torii Gate at entrance
    const toriiGroup = new THREE.Group();
    toriiGroup.position.set(0, 0, 24);

    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
    const p1Geo = new THREE.CylinderGeometry(0.35, 0.35, 7.0, 10);
    const p1 = new THREE.Mesh(p1Geo, pillarMat);
    p1.position.set(-5.0, 3.5, 0);
    toriiGroup.add(p1);

    const p2 = new THREE.Mesh(p1Geo, pillarMat);
    p2.position.set(5.0, 3.5, 0);
    toriiGroup.add(p2);

    const lintelGeo = new THREE.BoxGeometry(12.5, 0.7, 0.9);
    const lintel = new THREE.Mesh(lintelGeo, pillarMat);
    lintel.position.set(0, 6.8, 0);
    toriiGroup.add(lintel);

    const topRoofGeo = new THREE.BoxGeometry(13.5, 0.45, 1.2);
    const topRoofMat = new THREE.MeshLambertMaterial({ color: 0x18181b });
    const topRoof = new THREE.Mesh(topRoofGeo, topRoofMat);
    topRoof.position.set(0, 7.3, 0);
    toriiGroup.add(topRoof);

    this.cityLandmarksGroup.add(toriiGroup);

    // 2. Sakura Cherry Blossom Trees with falling petals
    [[26, -12], [26, 12], [-16, 22]].forEach(pos => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(pos[0], 0, pos[1]);

      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.5, 8);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3d2e });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.75;
      treeGroup.add(trunk);

      const folGeo = new THREE.DodecahedronGeometry(2.2);
      const folMat = new THREE.MeshLambertMaterial({ color: 0xf472b6 });
      const fol = new THREE.Mesh(folGeo, folMat);
      fol.position.y = 4.2;
      treeGroup.add(fol);

      this.cityLandmarksGroup.add(treeGroup);
    });

    // 3. Falling Sakura Petal Particles
    const petalGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const petalMat = new THREE.MeshBasicMaterial({ color: 0xfbcfe8, side: THREE.DoubleSide });

    for (let i = 0; i < 60; i++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set((Math.random() - 0.5) * 40, Math.random() * 12 + 1, (Math.random() - 0.5) * 40);
      petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.cityLandmarksGroup.add(petal);
      this.sakuraPetals.push({
        mesh: petal,
        speedY: 1.2 + Math.random() * 1.0,
        speedX: 0.8 + Math.random() * 0.6,
        rotSpeed: 2.0 + Math.random() * 3.0
      });
    }
  }

  // Prestige Reset: Sell Franchise for Golden Trophies
  calculatePrestigeTrophies(cash) {
    if (cash < 1000) return 0;
    return Math.floor(Math.sqrt(cash / 250));
  }

  executePrestige(game) {
    const earnedTrophies = this.calculatePrestigeTrophies(game.cash);
    if (earnedTrophies <= 0) return false;

    this.goldenTrophies += earnedTrophies;
    game.cash = 100;

    // Reset unlocks back to start while retaining upgrades and trophies
    window.TYCOON_CONFIG.unlockChain.forEach(item => {
      const zone = this.restaurant.unlockZones.find(z => z.id === item.id);
      if (zone) {
        zone.isUnlocked = false;
        zone.remainingCost = zone.totalCost;
      }
    });

    // Reset station unlocks
    window.TYCOON_CONFIG.sodaFountain.unlocked = false;
    window.TYCOON_CONFIG.sidesStation.unlocked = false;
    window.TYCOON_CONFIG.floor2.unlocked = false;
    window.TYCOON_CONFIG.dessertStation.unlocked = false;
    window.TYCOON_CONFIG.drivethru.lane1.unlocked = false;
    window.TYCOON_CONFIG.drivethru.lane2.unlocked = false;
    window.TYCOON_CONFIG.scooterStation.unlocked = false;
    window.TYCOON_CONFIG.zone2.unlocked = false;

    // Reset tables
    window.TYCOON_CONFIG.tables.forEach(t => {
      if (t.id !== 'table_1') t.unlocked = false;
    });

    this.restaurant.refreshUnlockProgression();
    if (this.restaurant.floor2Group) this.restaurant.floor2Group.visible = false;
    if (this.restaurant.zone2Group) this.restaurant.zone2Group.visible = false;
    if (this.restaurant.sodaFountainMesh) this.restaurant.sodaFountainMesh.visible = false;
    if (this.restaurant.sidesStationMesh) this.restaurant.sidesStationMesh.visible = false;

    window.arcadeAudio.playVipReward();
    game.showFloatingText(`🏆 PRESTIGE! +${earnedTrophies} GOLD TROPHIES!`, 0, 0);
    game.updateHUD();
    return true;
  }

  update(delta) {
    if (this.isSakuraActive) {
      this.sakuraPetals.forEach(p => {
        p.mesh.position.y -= p.speedY * delta;
        p.mesh.position.x += Math.sin(Date.now() * 0.003) * p.speedX * delta;
        p.mesh.rotation.x += p.rotSpeed * delta;
        p.mesh.rotation.y += p.rotSpeed * delta;

        if (p.mesh.position.y < 0.1) {
          p.mesh.position.y = 12;
          p.mesh.position.x = (Math.random() - 0.5) * 40;
        }
      });
    }
  }
}

window.CityManager3D = CityManager3D;

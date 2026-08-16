/**
 * Pizza Ready! 3D Tycoon - Hyper-Dense Commercial Pizzeria Simulation Engine
 * 1:1 match with top-charting Supercent/Voodoo arcade idle games.
 * Unity Portability: Maps to RestaurantManager.cs, StationPrefabs.cs, NPCStaffController.cs, DecalGrid.cs
 */

class Restaurant3D {
  constructor(scene) {
    this.scene = scene;
    
    // Multi-Oven Cooking Pipeline
    this.ovensData = [];
    this.smokeParticles = [];
    this.smokeTimer = 0;
    
    // Soda Fountain System
    this.sodaCups = [];
    this.sodaTimer = 0;

    // Sides Station System
    this.sideItems = [];
    this.sidesTimer = 0;

    // 2nd Floor Dessert Station System
    this.dessertItems = [];
    this.dessertTimer = 0;

    // Storage Rack / Buffer Stash System (Drop-off & Retrieve)
    this.storageRackItems = [];
    this.storageCooldown = 0;
    
    // Sparkles & Rain Particles
    this.sparkleParticles = [];
    this.rainParticles = [];
    this.isRaining = false;
    
    // Queues & Entities
    this.customers = [];
    this.driveThruCars = [];
    this.scooter = null;
    this.workers = [];
    this.cashier = null;
    this.chef = null;
    this.cleaner = null;
    this.cashBundles = [];
    
    // Customization & Wall Meshes
    this.wallMeshes = [];
    this.floorMesh = null;

    // Unlock System
    this.unlockZones = [];
    this.tableMeshes = {};
    this.tableTrashMeshes = {};
    
    this.buildSupercentEnvironment();
    this.buildMultiOvens();
    this.buildSodaFountain();
    this.buildSidesStation();
    this.buildStorageRack();
    this.buildHROffice();
    this.buildJukeboxAndArcade();
    this.buildWasteBinStation();
    this.buildFrontCounter();
    this.buildDiningTables();
    this.buildZone2Patio();
    this.buildDriveThruStructure();
    this.buildSecondFloorAndEscalator();
    this.buildSequentialUnlockZones();
    this.buildDecorations();
    this.buildRainParticles();

    // Spawn Starting Dedicated Staff (Chef, Cashier, Cleaner)
    this.initDedicatedStaff();
  }

  initDedicatedStaff() {
    if (window.TYCOON_CONFIG.specializedStaff.cashier.unlocked) {
      this.cashier = new Cashier3D(this.scene, this);
    }
    if (window.TYCOON_CONFIG.specializedStaff.chef.unlocked) {
      this.chef = new Chef3D(this.scene, this);
    }
    if (window.TYCOON_CONFIG.specializedStaff.cleaner.unlocked) {
      this.cleaner = new Cleaner3D(this.scene, this);
    }
  }

  buildSupercentEnvironment() {
    // 1. Bright Sunny Blonde Birch Main Floor (Warm luminous honey blonde)
    const floorGeo = new THREE.PlaneGeometry(44, 44);
    this.floorMat = new THREE.MeshLambertMaterial({ color: 0xffedd5 });
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // 2. Kitchen Clean Pastel White Tile Area
    const kitchenGeo = new THREE.PlaneGeometry(16, 28);
    const kitchenMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const kitchen = new THREE.Mesh(kitchenGeo, kitchenMat);
    kitchen.rotation.x = -Math.PI / 2;
    kitchen.position.set(-11, 0.02, -5);
    kitchen.receiveShadow = true;
    this.scene.add(kitchen);

    // Kitchen Blue Divider Border
    const kBorderGeo = new THREE.BoxGeometry(0.3, 0.1, 28);
    const kBorder = new THREE.Mesh(kBorderGeo, new THREE.MeshLambertMaterial({ color: 0x3b82f6 }));
    kBorder.position.set(-3.0, 0.05, -5);
    this.scene.add(kBorder);

    // 3. Drive-Thru Asphalt Road
    const roadGeo = new THREE.PlaneGeometry(14, 60);
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(-23, 0.01, 0);
    road.receiveShadow = true;
    this.scene.add(road);

    // White Highway Lane Stripes
    for (let lz = -25; lz <= 25; lz += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4.0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(-23, 0.02, lz);
      this.scene.add(dash);
    }

    // 4. Pastel White Walls with Royal Blue Accent Kickboards
    this.wallMeshes.push(this.buildSupercentWall(0, 1.8, -18, 42, 3.6, 0.8, 0xffffff, 0x2563eb));
    this.wallMeshes.push(this.buildSupercentWall(-18, 1.8, 0, 0.8, 3.6, 40, 0xffffff, 0x2563eb));
    this.wallMeshes.push(this.buildSupercentWall(19, 1.8, -10, 0.8, 3.6, 18, 0xffffff, 0x2563eb));

    // 5. Iconic Yellow / Red Roof Storefront Entry Portal
    const entryPortal = new THREE.Group();
    entryPortal.position.set(0, 0, -18);

    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    const leftP = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 1.0), pillarMat);
    leftP.position.set(-3.2, 2.1, 0.2);
    entryPortal.add(leftP);

    const rightP = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 1.0), pillarMat);
    rightP.position.set(3.2, 2.1, 0.2);
    entryPortal.add(rightP);

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.2, 1.2), new THREE.MeshLambertMaterial({ color: 0xd32323 }));
    archTop.position.set(0, 4.4, 0.2);
    entryPortal.add(archTop);

    // Pizza Hut Red Hat Sign
    const hat = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.1, 4), new THREE.MeshLambertMaterial({ color: 0xd32323 }));
    hat.rotation.y = Math.PI / 4;
    hat.position.set(0, 5.6, 0.2);
    entryPortal.add(hat);

    this.scene.add(entryPortal);
  }

  buildSupercentWall(x, y, z, w, h, d, wallColor, baseColor) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const baseGeo = new THREE.BoxGeometry(w, 0.6, d);
    const baseMat = new THREE.MeshLambertMaterial({ color: baseColor });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -h / 2 + 0.3;
    base.receiveShadow = true;
    group.add(base);

    const topGeo = new THREE.BoxGeometry(w, h - 0.6, d);
    const topMat = new THREE.MeshLambertMaterial({ color: wallColor });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.3;
    top.receiveShadow = true;
    group.add(top);

    this.scene.add(group);
    return top;
  }

  buildRainParticles() {
    this.rainGroup = new THREE.Group();
    const rainGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
    const rainMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.6 });

    for (let i = 0; i < 200; i++) {
      const drop = new THREE.Mesh(rainGeo, rainMat);
      drop.position.set((Math.random() - 0.5) * 60, Math.random() * 25, (Math.random() - 0.5) * 50);
      this.rainGroup.add(drop);
      this.rainParticles.push({ mesh: drop, speed: 28 + Math.random() * 12 });
    }

    this.rainGroup.visible = false;
    this.scene.add(this.rainGroup);
  }

  updateWeather(preset, delta, dirLight, ambientLight) {
    if (!preset) return;
    this.isRaining = preset.isRain;
    if (this.rainGroup) this.rainGroup.visible = preset.isRain;

    if (this.scene.background) this.scene.background.lerp(new THREE.Color(preset.skyColor), 4.0 * delta);
    if (dirLight) {
      dirLight.color.lerp(new THREE.Color(preset.sunColor), 4.0 * delta);
      dirLight.intensity = THREE.MathUtils.lerp(dirLight.intensity, preset.sunIntensity, 4.0 * delta);
    }
    if (ambientLight) {
      ambientLight.color.lerp(new THREE.Color(preset.ambientColor), 4.0 * delta);
      ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, preset.ambientIntensity, 4.0 * delta);
    }
  }

  buildSecondFloorAndEscalator() {
    this.floor2Group = new THREE.Group();

    const deckGeo = new THREE.BoxGeometry(32, 0.5, 16);
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 6.55, -10);
    deck.receiveShadow = true;
    this.floor2Group.add(deck);

    const railGeo = new THREE.BoxGeometry(32, 1.2, 0.1);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, 7.4, -2.0);
    this.floor2Group.add(rail);

    [[-14, -4], [14, -4], [-14, -16], [14, -16]].forEach(pos => {
      const pillarGeo = new THREE.CylinderGeometry(0.45, 0.45, 6.8, 12);
      const pillarMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(pos[0], 3.4, pos[1]);
      pillar.castShadow = true;
      this.floor2Group.add(pillar);
    });

    this.escalatorMesh = new THREE.Group();
    this.escalatorMesh.position.set(0, 0, -10);

    const escBodyGeo = new THREE.BoxGeometry(2.8, 0.4, 9.5);
    const escBodyMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const escBody = new THREE.Mesh(escBodyGeo, escBodyMat);
    escBody.position.set(0, 3.4, -2.5);
    escBody.rotation.x = -Math.PI / 4.2;
    this.escalatorMesh.add(escBody);

    this.escSteps = [];
    for (let s = 0; s < 6; s++) {
      const stepGeo = new THREE.BoxGeometry(2.4, 0.12, 0.6);
      const stepMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(0, 0.8 + s * 1.0, 1.0 - s * 1.15);
      this.escalatorMesh.add(step);
      this.escSteps.push(step);
    }

    this.floor2Group.add(this.escalatorMesh);

    this.dessertStationMesh = new THREE.Group();
    this.dessertStationMesh.position.set(-8, 6.8, -12);

    const dBaseGeo = new THREE.BoxGeometry(3.0, 1.2, 2.2);
    const dBaseMat = new THREE.MeshLambertMaterial({ color: 0x451a03 });
    const dBase = new THREE.Mesh(dBaseGeo, dBaseMat);
    dBase.position.y = 0.6;
    dBase.castShadow = true;
    this.dessertStationMesh.add(dBase);

    this.dessertStationMesh.visible = false;
    this.floor2Group.add(this.dessertStationMesh);

    this.floor2Group.visible = false;
    this.scene.add(this.floor2Group);
  }

  buildJukeboxAndArcade() {
    const jukeGroup = new THREE.Group();
    jukeGroup.position.set(16, 0, -8);

    // Retro Arcade Cabinet
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 1.2), new THREE.MeshLambertMaterial({ color: 0x6d28d9 }));
    body.position.y = 1.2;
    body.castShadow = true;
    jukeGroup.add(body);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    screen.position.set(0, 1.5, 0.61);
    jukeGroup.add(screen);

    const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.1), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    marquee.position.set(0, 2.2, 0.6);
    jukeGroup.add(marquee);

    this.scene.add(jukeGroup);
  }

  applyStoreTheme(themeId) {
    const theme = window.TYCOON_CONFIG.storeThemes.find(t => t.id === themeId);
    if (!theme) return;
    if (this.floorMat) this.floorMat.color.setHex(theme.floorColor);
  }

  buildStorageRack() {
    this.storageRackMesh = new THREE.Group();
    this.storageRackMesh.position.set(window.TYCOON_CONFIG.storageRack.position.x, 0, window.TYCOON_CONFIG.storageRack.position.z);

    // Stainless Steel Heated Buffer Carousel
    [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]].forEach(pos => {
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(pos[0], 1.3, pos[1]);
      this.storageRackMesh.add(pole);
    });

    [0.6, 1.2, 1.8].forEach(sy => {
      const shelfGeo = new THREE.BoxGeometry(2.8, 0.08, 1.6);
      const shelfMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.y = sy;
      shelf.castShadow = true;
      this.storageRackMesh.add(shelf);
    });

    const hoodGeo = new THREE.BoxGeometry(2.9, 0.35, 1.7);
    const hoodMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.y = 2.45;
    this.storageRackMesh.add(hood);

    this.scene.add(this.storageRackMesh);
  }

  buildZone2Patio() {
    this.zone2Group = new THREE.Group();

    const deckGeo = new THREE.PlaneGeometry(18, 36);
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(28, 0.02, 0);
    deck.receiveShadow = true;
    this.zone2Group.add(deck);

    this.zone2Group.visible = window.TYCOON_CONFIG.zone2.unlocked;
    this.scene.add(this.zone2Group);
  }

  buildDriveThruStructure() {
    const dtGroup = new THREE.Group();
    dtGroup.position.set(-23, 0, 8);

    // Drive-Thru Order Kiosk & Canopy
    const pillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x334155 }));
    pillar1.position.set(-3.5, 2.1, 0);
    dtGroup.add(pillar1);

    const pillar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x334155 }));
    pillar2.position.set(3.5, 2.1, 0);
    dtGroup.add(pillar2);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.4, 5.0), new THREE.MeshLambertMaterial({ color: 0xd32323 }));
    canopy.position.set(0, 4.2, 0);
    canopy.castShadow = true;
    dtGroup.add(canopy);

    this.scene.add(dtGroup);
  }

  /** Industrial Conveyor Ovens with Glowing Quartz Embers */
  buildMultiOvens() {
    window.TYCOON_CONFIG.ovens.forEach(ovenConfig => {
      let ovenGroup = null;
      let ember = null;

      if (window.assetFactory3D) {
        const res = window.assetFactory3D.createCommercialConveyorOven(ovenConfig.color || 0xd32323, ovenConfig.type);
        ovenGroup = res.group;
        ember = res.emberMesh;
      } else {
        ovenGroup = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 4.2), new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }));
        body.position.set(0, 0.9, 0);
        ovenGroup.add(body);
      }

      ovenGroup.position.set(ovenConfig.position.x, 0, ovenConfig.position.z);
      ovenGroup.visible = ovenConfig.unlocked;
      this.scene.add(ovenGroup);

      this.ovensData.push({
        config: ovenConfig,
        mesh: ovenGroup,
        emberMesh: ember,
        boxes: [],
        timer: 0
      });
    });
  }

  buildSodaFountain() {
    const cfg = window.TYCOON_CONFIG.sodaFountain;
    if (window.assetFactory3D) {
      this.sodaFountainMesh = window.assetFactory3D.createCommercialSodaFountain();
    } else {
      this.sodaFountainMesh = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x334155 }));
      base.position.y = 0.6;
      this.sodaFountainMesh.add(base);
    }
    this.sodaFountainMesh.position.set(cfg.position.x, 0, cfg.position.z);
    this.sodaFountainMesh.visible = cfg.unlocked;
    this.scene.add(this.sodaFountainMesh);
  }

  buildSidesStation() {
    const cfg = window.TYCOON_CONFIG.sidesStation;
    if (window.assetFactory3D) {
      this.sidesStationMesh = window.assetFactory3D.createSidesFryerStation();
    } else {
      this.sidesStationMesh = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x475569 }));
      base.position.y = 0.6;
      this.sidesStationMesh.add(base);
    }
    this.sidesStationMesh.position.set(cfg.position.x, 0, cfg.position.z);
    this.sidesStationMesh.visible = cfg.unlocked;
    this.scene.add(this.sidesStationMesh);
  }

  buildHROffice() {
    const hrGroup = new THREE.Group();
    hrGroup.position.set(15, 0, -14);

    // Modern Executive Glass-Top Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    desk.position.y = 1.05;
    desk.castShadow = true;
    hrGroup.add(desk);

    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), new THREE.MeshLambertMaterial({ color: 0x334155 }));
    leg1.position.set(-1.2, 0.5, -0.6);
    hrGroup.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), new THREE.MeshLambertMaterial({ color: 0x334155 }));
    leg2.position.set(1.2, 0.5, -0.6);
    hrGroup.add(leg2);

    // Laptop on desk
    const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.45), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
    laptop.position.set(0, 1.13, 0);
    hrGroup.add(laptop);

    this.scene.add(hrGroup);
  }

  buildWasteBinStation() {
    if (window.assetFactory3D) {
      this.trashBinMesh = window.assetFactory3D.createWasteBinStation();
    } else {
      this.trashBinMesh = new THREE.Group();
      const bin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 1.8), new THREE.MeshLambertMaterial({ color: 0x3e2723 }));
      bin.position.y = 0.9;
      this.trashBinMesh.add(bin);
    }
    this.trashBinMesh.position.set(window.TYCOON_CONFIG.trashBin.position.x, 0, window.TYCOON_CONFIG.trashBin.position.z);
    this.scene.add(this.trashBinMesh);
  }

  spawnChimneySmoke(ovenPos) {
    const smokeGeo = new THREE.SphereGeometry(0.22 + Math.random() * 0.15, 6, 6);
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 });
    const smoke = new THREE.Mesh(smokeGeo, smokeMat);

    smoke.position.set(ovenPos.x + (Math.random() - 0.5) * 0.3, 3.6, ovenPos.z - 1.0 + (Math.random() - 0.5) * 0.3);
    this.scene.add(smoke);
    this.smokeParticles.push({ mesh: smoke, life: 1.2, maxLife: 1.2, scale: 1.0 });
  }

  spawnSparkles(x, y, z) {
    for (let i = 0; i < 8; i++) {
      const sparkGeo = new THREE.OctahedronGeometry(0.12 + Math.random() * 0.08);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);

      spark.position.set(x + (Math.random() - 0.5) * 1.2, y + 0.3 + Math.random() * 0.4, z + (Math.random() - 0.5) * 1.2);
      this.scene.add(spark);
      this.sparkleParticles.push({ mesh: spark, life: 0.6, maxLife: 0.6, velY: 1.2 + Math.random() * 0.8 });
    }
  }

  /** Purple POS Reception Counter (1:1 with Reference Screenshot) */
  buildFrontCounter() {
    if (window.assetFactory3D) {
      this.counterMesh = window.assetFactory3D.createSupercentCheckoutCounter();
    } else {
      this.counterMesh = new THREE.Group();
      const desk = new THREE.Mesh(new THREE.BoxGeometry(10.8, 1.35, 2.4), new THREE.MeshLambertMaterial({ color: 0x7e22ce }));
      desk.position.set(0, 0.67, 0);
      this.counterMesh.add(desk);
    }
    this.counterMesh.position.set(window.TYCOON_CONFIG.counter.position.x, 0, window.TYCOON_CONFIG.counter.position.z);
    this.scene.add(this.counterMesh);
  }

  /** Yellow Diner Booth Couches & Populated Tables (1:1 with Reference Screenshot) */
  buildDiningTables() {
    window.TYCOON_CONFIG.tables.forEach(tableData => {
      let tableGroup = null;

      if (window.assetFactory3D) {
        tableGroup = window.assetFactory3D.createDinerBoothTable(tableData.id, tableData.isPatio, tableData.is2F);
      } else {
        tableGroup = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.0), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        top.position.y = 1.05;
        tableGroup.add(top);
      }

      tableGroup.position.set(tableData.position.x, tableData.position.y || 0, tableData.position.z);

      const dirtyTrashGroup = new THREE.Group();
      dirtyTrashGroup.position.set(0, 1.2, 0);

      const dirtyBoxGeo = new THREE.BoxGeometry(0.85, 0.22, 0.85);
      const dirtyBoxMat = new THREE.MeshLambertMaterial({ color: 0x78553d });
      const dirtyBox = new THREE.Mesh(dirtyBoxGeo, dirtyBoxMat);
      dirtyTrashGroup.add(dirtyBox);

      dirtyTrashGroup.visible = false;
      tableGroup.add(dirtyTrashGroup);
      this.tableTrashMeshes[tableData.id] = dirtyTrashGroup;

      tableGroup.visible = tableData.unlocked;
      this.tableMeshes[tableData.id] = tableGroup;
      this.scene.add(tableGroup);
    });

    // Wall-to-Wall Yellow Plush Quilted Diner Booth Along Back Wall
    for (let bx = 4; bx <= 16; bx += 3.2) {
      const backBooth = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
      backBooth.position.set(bx, 0.6, -16.8);
      backBooth.castShadow = true;
      this.scene.add(backBooth);
    }
  }

  buildDecorations() {
    // Menu signs integrated above counter
  }

  /** White Rounded Square Unlock Pads (1:1 with Reference Screenshot) */
  buildSequentialUnlockZones() {
    this.unlockZones = [];
    
    window.TYCOON_CONFIG.unlockChain.forEach(item => {
      const zoneGroup = new THREE.Group();
      zoneGroup.position.set(item.position.x, (item.position.y || 0) + 0.05, item.position.z);

      const sqGeo = new THREE.PlaneGeometry(3.6, 3.6);
      const sqTex = (window.textureAtlas) ? window.textureAtlas.createUnlockSquareDecal(item.cost) : null;
      const sqMat = new THREE.MeshBasicMaterial({ map: sqTex, transparent: true, side: THREE.DoubleSide });
      const sqMesh = new THREE.Mesh(sqGeo, sqMat);
      sqMesh.rotation.x = -Math.PI / 2;
      zoneGroup.add(sqMesh);

      zoneGroup.visible = false;
      this.scene.add(zoneGroup);

      this.unlockZones.push({
        id: item.id,
        type: item.type,
        title: item.name,
        requires: item.requires,
        totalCost: item.cost,
        remainingCost: item.cost,
        position: item.position,
        mesh: zoneGroup,
        decalMesh: sqMesh,
        isUnlocked: false
      });
    });

    this.refreshUnlockProgression();
  }

  refreshUnlockProgression() {
    this.unlockZones.forEach(zone => {
      if (zone.isUnlocked) {
        zone.mesh.visible = false;
        return;
      }

      let prereqMet = false;
      if (!zone.requires) {
        prereqMet = true;
      } else {
        const prereqZone = this.unlockZones.find(z => z.id === zone.requires);
        if (prereqZone && prereqZone.isUnlocked) {
          prereqMet = true;
        }
      }

      zone.mesh.visible = prereqMet;
      zone.isActive = prereqMet;
    });
  }

  handleUnlockTrigger(zone, game) {
    zone.isUnlocked = true;
    zone.mesh.visible = false;
    window.arcadeAudio.playUnlock();

    if (zone.type === 'table') {
      const tableData = window.TYCOON_CONFIG.tables.find(t => t.id === zone.id);
      if (tableData) {
        tableData.unlocked = true;
        if (this.tableMeshes[zone.id]) this.tableMeshes[zone.id].visible = true;
      }
    } else if (zone.type === 'worker') {
      const w = new Worker3D(this.scene, this, zone.id);
      this.workers.push(w);
    } else if (zone.type === 'soda') {
      window.TYCOON_CONFIG.sodaFountain.unlocked = true;
      if (this.sodaFountainMesh) this.sodaFountainMesh.visible = true;
    } else if (zone.type === 'staff_cashier') {
      window.TYCOON_CONFIG.specializedStaff.cashier.unlocked = true;
      this.cashier = new Cashier3D(this.scene, this);
    } else if (zone.type === 'staff_cleaner') {
      window.TYCOON_CONFIG.specializedStaff.cleaner.unlocked = true;
      this.cleaner = new Cleaner3D(this.scene, this);
    } else if (zone.type === 'scooter') {
      window.TYCOON_CONFIG.scooterStation.unlocked = true;
      this.scooter = new DeliveryScooter3D(this.scene, this);
      game.showFloatingText('🛵 SCOOTER FLEET UNLOCKED!', 10, 18);
    } else if (zone.type === 'zone_expansion') {
      window.TYCOON_CONFIG.zone2.unlocked = true;
      if (this.zone2Group) this.zone2Group.visible = true;
      game.showFloatingText('🎉 OUTDOOR PATIO UNLOCKED!', 18, 0);
    } else if (zone.type === 'oven') {
      const o = window.TYCOON_CONFIG.ovens.find(ov => ov.id === zone.id);
      if (o) {
        o.unlocked = true;
        const oObj = this.ovensData.find(od => od.config.id === zone.id);
        if (oObj) oObj.mesh.visible = true;
      }
    } else if (zone.type === 'staff_chef') {
      window.TYCOON_CONFIG.specializedStaff.chef.unlocked = true;
      this.chef = new Chef3D(this.scene, this);
    } else if (zone.type === 'sides') {
      window.TYCOON_CONFIG.sidesStation.unlocked = true;
      if (this.sidesStationMesh) this.sidesStationMesh.visible = true;
    } else if (zone.type === 'drivethru_1') {
      window.TYCOON_CONFIG.drivethru.lane1.unlocked = true;
    } else if (zone.type === 'drivethru_2') {
      window.TYCOON_CONFIG.drivethru.lane2.unlocked = true;
    } else if (zone.type === 'escalator') {
      window.TYCOON_CONFIG.floor2.unlocked = true;
      if (this.floor2Group) this.floor2Group.visible = true;
      game.showFloatingText('🏬 2ND FLOOR UNLOCKED!', 0, -10);
    } else if (zone.type === 'dessert_station') {
      window.TYCOON_CONFIG.dessertStation.unlocked = true;
      if (this.dessertStationMesh) this.dessertStationMesh.visible = true;
      game.showFloatingText('🍫 LAVA CAKE & GELATO UNLOCKED!', -8, -12);
    }

    this.refreshUnlockProgression();
  }

  spawnOvenBox(ovenObj) {
    if (ovenObj.boxes.length >= ovenObj.config.maxCapacity) return;

    const typeInfo = window.TYCOON_CONFIG.pizzaTypes[ovenObj.config.type];
    const boxColor = typeInfo ? typeInfo.color : 0xd32323;

    const boxGeo = new THREE.BoxGeometry(0.85, 0.22, 0.85);
    const boxMat = new THREE.MeshLambertMaterial({ color: boxColor });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.castShadow = true;

    const stackIdx = ovenObj.boxes.length;
    box.position.set(0, 0.85 + stackIdx * 0.24, 3.6);

    ovenObj.mesh.add(box);
    ovenObj.boxes.push({ mesh: box, type: ovenObj.config.type });
  }

  spawnSodaCup() {
    const cfg = window.TYCOON_CONFIG.sodaFountain;
    if (this.sodaCups.length >= cfg.maxCapacity) return;

    const cupGroup = new THREE.Group();
    const cupGeo = new THREE.CylinderGeometry(0.28, 0.18, 0.5, 10);
    const cupMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const cup = new THREE.Mesh(cupGeo, cupMat);
    cup.position.y = 0.25;
    cup.castShadow = true;
    cupGroup.add(cup);

    const stackIdx = this.sodaCups.length;
    cupGroup.position.set(0, 1.25 + stackIdx * 0.26, 1.8);

    this.sodaFountainMesh.add(cupGroup);
    this.sodaCups.push({ mesh: cupGroup, type: 'pepsi' });
  }

  spawnSideItem() {
    const cfg = window.TYCOON_CONFIG.sidesStation;
    if (this.sideItems.length >= cfg.maxCapacity) return;

    const sideType = Math.random() < 0.5 ? 'breadsticks' : 'wings';
    const sideGroup = new THREE.Group();

    if (sideType === 'wings') {
      const bucketGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.45, 10);
      const bucketMat = new THREE.MeshLambertMaterial({ color: 0xd32323 });
      const bucket = new THREE.Mesh(bucketGeo, bucketMat);
      bucket.position.y = 0.22;
      sideGroup.add(bucket);
    } else {
      const bagGeo = new THREE.BoxGeometry(0.7, 0.38, 0.48);
      const bagMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
      const bag = new THREE.Mesh(bagGeo, bagMat);
      bag.position.y = 0.2;
      sideGroup.add(bag);
    }

    const stackIdx = this.sideItems.length;
    sideGroup.position.set(0, 1.25 + stackIdx * 0.26, 1.8);

    this.sidesStationMesh.add(sideGroup);
    this.sideItems.push({ mesh: sideGroup, type: sideType });
  }

  spawnDessertItem() {
    const cfg = window.TYCOON_CONFIG.dessertStation;
    if (this.dessertItems.length >= cfg.maxCapacity || !this.dessertStationMesh) return;

    const dType = Math.random() < 0.5 ? 'lavacake' : 'gelato';
    const dGroup = new THREE.Group();

    const plateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 10);
    const plateMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.04;
    dGroup.add(plate);

    if (dType === 'lavacake') {
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

    const stackIdx = this.dessertItems.length;
    dGroup.position.set(0, 1.25 + stackIdx * 0.26, 1.8);

    this.dessertStationMesh.add(dGroup);
    this.dessertItems.push({ mesh: dGroup, type: dType });
  }

  /** Neat Green 3D Cash Stacks on Floor (1:1 with Reference Screenshot) */
  dropCash(x, z, amount = 30, y = 0) {
    const isRush = (window.tycoonGame && window.tycoonGame.isRushHourActive);
    const finalAmount = isRush ? Math.round(amount * 2.0) : amount;
    const bundlesCount = Math.max(1, Math.floor(finalAmount / 15));
    
    const safeX = Math.max(-16.0, Math.min(16.0, x));
    const safeZ = Math.max(-15.0, Math.min(19.0, z));

    for (let i = 0; i < bundlesCount; i++) {
      const cashGeo = new THREE.BoxGeometry(0.72, 0.16, 0.44);
      const cashTex = (window.textureAtlas) ? window.textureAtlas.createCashBillTexture() : null;
      const cashMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: cashTex });
      const cash = new THREE.Mesh(cashGeo, cashMat);
      cash.castShadow = true;

      const row = Math.floor(i / 3);
      const col = i % 3;
      const posX = safeX + (col - 1) * 0.65;
      const posZ = safeZ + (row - 1) * 0.45;

      cash.position.set(posX, y + 0.08, posZ);

      this.scene.add(cash);
      this.cashBundles.push({
        mesh: cash,
        value: 15,
        targetPos: new THREE.Vector3(posX, y + 0.08, posZ)
      });
    }
  }

  completeCounterCustomer(cust, game) {
    const revenue = cust.getTotalRevenue();
    this.dropCash(cust.mesh.position.x, 7.8, revenue);
    window.arcadeAudio.playCash();

    cust.state = 'LEAVING';
    cust.targetPos.set(0, 0, 24);

    const remainingQueue = this.customers.filter(c => c.type === 'counter' && c !== cust && c.state !== 'LEAVING');
    remainingQueue.forEach((c, idx) => {
      c.queueIndex = idx;
      const targetZ = window.TYCOON_CONFIG.counter.customerQueueStart.z + idx * window.TYCOON_CONFIG.counter.customerQueueSpacing;
      c.setTargetPosition(window.TYCOON_CONFIG.counter.position.x, targetZ);
    });
  }

  completeTableCustomer(cust, game) {
    if (cust.isCritic) {
      this.dropCash(cust.mesh.position.x, cust.mesh.position.z + 0.8, cust.payout, cust.targetData.position.y || 0);
      window.arcadeAudio.playStarReviewSound();
      if (game) game.showFloatingText(`⭐⭐⭐⭐⭐ 5-STAR CRITIC! +$${cust.payout}`, cust.mesh.position.x, cust.mesh.position.z);
      this.spawnSparkles(cust.mesh.position.x, (cust.targetData.position.y || 0) + 1.6, cust.mesh.position.z);
      cust.startEating(4.0);
      return;
    }

    const is2F = cust.targetData.is2F;
    const multiplier = is2F ? 3.5 : 1.0;
    const revenue = Math.round((cust.getTotalRevenue() + 10) * multiplier);

    this.dropCash(cust.mesh.position.x, cust.mesh.position.z + 0.8, revenue, cust.targetData.position.y || 0);
    window.arcadeAudio.playCash();
    if (is2F) game.showFloatingText(`👑 4X VIP PENTHOUSE! +$${revenue}`, cust.mesh.position.x, cust.mesh.position.z);
    cust.startEating(cust.targetData.eatDuration || 5.5);
  }

  setTableDirty(tableData) {
    tableData.isDirty = true;
    if (this.tableTrashMeshes[tableData.id]) {
      this.tableTrashMeshes[tableData.id].visible = true;
    }
  }

  cleanTable(tableData, player) {
    tableData.isDirty = false;
    if (this.tableTrashMeshes[tableData.id]) {
      this.tableTrashMeshes[tableData.id].visible = false;
    }
    this.spawnSparkles(tableData.position.x, (tableData.position.y || 0) + 1.1, tableData.position.z);
    window.arcadeAudio.playSparkleClean();
  }

  update(delta, player, game) {
    if (this.storageCooldown > 0) this.storageCooldown -= delta;

    if (this.isRaining) {
      this.rainParticles.forEach(p => {
        p.mesh.position.y -= p.speed * delta;
        p.mesh.position.x -= delta * 3.0;
        if (p.mesh.position.y < 0) {
          p.mesh.position.y = 25;
          p.mesh.position.x = (Math.random() - 0.5) * 60;
        }
      });
    }

    // 1. Ovens Cooking
    this.ovensData.forEach(ovenObj => {
      if (!ovenObj.config.unlocked) return;
      ovenObj.timer += delta;
      if (ovenObj.timer >= ovenObj.config.cookInterval) {
        ovenObj.timer = 0;
        this.spawnOvenBox(ovenObj);
        this.spawnChimneySmoke(ovenObj.config.position);
      }
    });

    // 2. Soda Fountain
    if (window.TYCOON_CONFIG.sodaFountain.unlocked) {
      this.sodaTimer += delta;
      if (this.sodaTimer >= window.TYCOON_CONFIG.sodaFountain.cookInterval) {
        this.sodaTimer = 0;
        this.spawnSodaCup();
      }
    }

    // 3. Sides Station
    if (window.TYCOON_CONFIG.sidesStation.unlocked) {
      this.sidesTimer += delta;
      if (this.sidesTimer >= window.TYCOON_CONFIG.sidesStation.cookInterval) {
        this.sidesTimer = 0;
        this.spawnSideItem();
      }
    }

    // 4. 2F Dessert Station
    if (window.TYCOON_CONFIG.dessertStation.unlocked) {
      this.dessertTimer += delta;
      if (this.dessertTimer >= window.TYCOON_CONFIG.dessertStation.cookInterval) {
        this.dessertTimer = 0;
        this.spawnDessertItem();
      }
    }

    // 5. Escalator Stepping Trigger
    if (window.TYCOON_CONFIG.floor2.unlocked) {
      const distToEscBottom = Math.hypot(player.mesh.position.x - 0, player.mesh.position.z - (-8));
      if (distToEscBottom < 2.0 && player.currentFloor === 1) {
        player.currentFloor = 2;
        player.targetY = 6.8;
        player.mesh.position.z = -14;
        window.arcadeAudio.playBoxPickup();
        game.showFloatingText('🏬 2ND FLOOR PENTHOUSE', 0, -14);
      }

      const distToEscTop = Math.hypot(player.mesh.position.x - 0, player.mesh.position.z - (-16));
      if (distToEscTop < 2.0 && player.currentFloor === 2) {
        player.currentFloor = 1;
        player.targetY = 0;
        player.mesh.position.z = -6;
        window.arcadeAudio.playBoxPickup();
      }
    }

    // 6. Player Pickup from Ovens
    this.ovensData.forEach(ovenObj => {
      if (!ovenObj.config.unlocked || ovenObj.boxes.length === 0) return;
      const distToOven = Math.hypot(player.mesh.position.x - ovenObj.config.position.x, player.mesh.position.z - (ovenObj.config.position.z + 3.8));

      if (distToOven < window.TYCOON_CONFIG.player.pickupRadius && player.currentFloor === 1) {
        if (player.stackType !== 'trash' && player.stack.length < player.maxCapacity) {
          const item = ovenObj.boxes.pop();
          ovenObj.mesh.remove(item.mesh);
          player.addPizzaBox(ovenObj.config.type);
        }
      }
    });

    // 7. Soda Fountain Pickup
    if (window.TYCOON_CONFIG.sodaFountain.unlocked && this.sodaCups.length > 0 && player.currentFloor === 1) {
      const sf = window.TYCOON_CONFIG.sodaFountain;
      const distToFountain = Math.hypot(player.mesh.position.x - sf.position.x, player.mesh.position.z - (sf.position.z + 1.8));

      if (distToFountain < window.TYCOON_CONFIG.player.pickupRadius) {
        if (player.stackType !== 'trash' && player.stack.length < player.maxCapacity) {
          const cup = this.sodaCups.pop();
          this.sodaFountainMesh.remove(cup.mesh);
          player.addDrinkCup('pepsi');
        }
      }
    }

    // 8. Sides Station Pickup
    if (window.TYCOON_CONFIG.sidesStation.unlocked && this.sideItems.length > 0 && player.currentFloor === 1) {
      const ss = window.TYCOON_CONFIG.sidesStation;
      const distToSides = Math.hypot(player.mesh.position.x - ss.position.x, player.mesh.position.z - (ss.position.z + 1.8));

      if (distToSides < window.TYCOON_CONFIG.player.pickupRadius) {
        if (player.stackType !== 'trash' && player.stack.length < player.maxCapacity) {
          const side = this.sideItems.pop();
          this.sidesStationMesh.remove(side.mesh);
          player.addSideItem(side.type);
        }
      }
    }

    // 9. 2F Dessert Station Pickup
    if (window.TYCOON_CONFIG.dessertStation.unlocked && this.dessertItems.length > 0 && player.currentFloor === 2) {
      const ds = window.TYCOON_CONFIG.dessertStation;
      const distToDessert = Math.hypot(player.mesh.position.x - ds.position.x, player.mesh.position.z - (ds.position.z + 1.8));

      if (distToDessert < 2.8) {
        if (player.stackType !== 'trash' && player.stack.length < player.maxCapacity) {
          const des = this.dessertItems.pop();
          this.dessertStationMesh.remove(des.mesh);
          player.addDessertItem(des.type);
        }
      }
    }

    // 10. Storage Rack Stash
    const rackCfg = window.TYCOON_CONFIG.storageRack;
    const distToRack = Math.hypot(player.mesh.position.x - rackCfg.position.x, player.mesh.position.z - (rackCfg.position.z + 1.6));

    if (distToRack < 2.4 && this.storageCooldown <= 0 && player.currentFloor === 1) {
      if (player.stack.length > 0 && player.stackType !== 'trash') {
        if (this.storageRackItems.length < rackCfg.maxCapacity) {
          const lastItem = player.stack[player.stack.length - 1];
          let dropped = null;
          if (lastItem.category === 'pizza') dropped = player.removePizzaBox();
          else if (lastItem.category === 'drink') dropped = player.removeDrinkCup();
          else if (lastItem.category === 'side') dropped = player.removeSideItem();
          else if (lastItem.category === 'dessert') dropped = player.removeDessertItem();

          if (dropped) {
            const shelfMesh = dropped.mesh;
            const slotIdx = this.storageRackItems.length;
            shelfMesh.position.set((slotIdx % 2 === 0 ? -0.5 : 0.5), 0.65 + Math.floor(slotIdx / 2) * 0.35, 0);
            shelfMesh.scale.set(0.7, 0.7, 0.7);
            this.storageRackMesh.add(shelfMesh);

            this.storageRackItems.push({ mesh: shelfMesh, type: dropped.type, category: dropped.category });
            window.arcadeAudio.playShelfDrop();
            this.storageCooldown = 0.15;
          }
        }
      } else if (player.stack.length === 0 && this.storageRackItems.length > 0) {
        const item = this.storageRackItems.pop();
        this.storageRackMesh.remove(item.mesh);

        if (item.category === 'pizza') player.addPizzaBox(item.type);
        else if (item.category === 'drink') player.addDrinkCup(item.type);
        else if (item.category === 'side') player.addSideItem(item.type);
        else if (item.category === 'dessert') player.addDessertItem(item.type);

        window.arcadeAudio.playBoxPickup();
        this.storageCooldown = 0.15;
      }
    }

    // 11. Serving Customers (1F & 2F Tables)
    if (player.stack.length > 0) {
      this.customers.filter(c => c.state === 'WAITING' && !c.isOrderFulfilled()).forEach(cust => {
        const distToCust = Math.hypot(player.mesh.position.x - cust.mesh.position.x, player.mesh.position.z - cust.mesh.position.z);
        const sameFloor = (cust.type === 'counter' && player.currentFloor === 1) || (cust.targetData && ((cust.targetData.is2F && player.currentFloor === 2) || (!cust.targetData.is2F && player.currentFloor === 1)));

        if (distToCust < window.TYCOON_CONFIG.player.serveRadius && sameFloor) {
          const neededPizza = cust.getFirstNeededPizzaType();
          if (neededPizza && player.stack.some(b => b.category === 'pizza' && b.type === neededPizza)) {
            const served = player.removePizzaBox(neededPizza);
            if (served) {
              const finished = cust.receivePizzaBox(served.type);
              if (finished) {
                if (cust.type === 'counter') this.completeCounterCustomer(cust, game);
                else this.completeTableCustomer(cust, game);
              }
            }
          } else if (cust.needsDrink() && player.stack.some(b => b.category === 'drink')) {
            const servedCup = player.removeDrinkCup();
            if (servedCup) {
              const finished = cust.receiveDrink();
              if (finished) {
                if (cust.type === 'counter') this.completeCounterCustomer(cust, game);
                else this.completeTableCustomer(cust, game);
              }
            }
          } else if (cust.needsSide() && player.stack.some(b => b.category === 'side')) {
            const servedSide = player.removeSideItem();
            if (servedSide) {
              const finished = cust.receiveSideItem();
              if (finished) {
                if (cust.type === 'counter') this.completeCounterCustomer(cust, game);
                else this.completeTableCustomer(cust, game);
              }
            }
          } else if (cust.needsDessert && cust.needsDessert() && player.stack.some(b => b.category === 'dessert')) {
            const servedDes = player.removeDessertItem();
            if (servedDes) {
              const finished = cust.receiveDessertItem();
              if (finished) {
                if (cust.type === 'counter') this.completeCounterCustomer(cust, game);
                else this.completeTableCustomer(cust, game);
              }
            }
          }
        }
      });
    }

    // 11.5 Packing Scooter Delivery
    if (this.scooter && this.scooter.state === 'WAITING_FOR_PACKING' && player.currentFloor === 1 && player.stack.length > 0) {
      const distToScooter = Math.hypot(player.mesh.position.x - this.scooter.mesh.position.x, player.mesh.position.z - this.scooter.mesh.position.z);
      if (distToScooter < 3.5) {
        const neededPizza = this.scooter.getFirstNeededPizzaType();
        if (neededPizza && player.stack.some(b => b.category === 'pizza' && b.type === neededPizza)) {
          const served = player.removePizzaBox(neededPizza);
          if (served) {
            const finished = this.scooter.receivePizzaBox(served.type);
            if (finished) this.scooter.dispatchDelivery(game);
          }
        } else if (this.scooter.needsDrink() && player.stack.some(b => b.category === 'drink')) {
          const servedCup = player.removeDrinkCup();
          if (servedCup) {
            const finished = this.scooter.receiveDrink();
            if (finished) this.scooter.dispatchDelivery(game);
          }
        }
      }
    }

    // 11.6 Serving Drive-Thru Vehicles
    if (player.currentFloor === 1 && player.stack.length > 0) {
      this.driveThruCars.filter(car => car.state === 'WAITING').forEach(car => {
        const distToCar = Math.hypot(player.mesh.position.x - car.mesh.position.x, player.mesh.position.z - car.mesh.position.z);
        if (distToCar < 4.2) {
          const neededPizza = car.getFirstNeededPizzaType();
          if (neededPizza && player.stack.some(b => b.category === 'pizza' && b.type === neededPizza)) {
            const served = player.removePizzaBox(neededPizza);
            if (served) {
              const finished = car.receivePizzaBox(served.type);
              if (finished) {
                const isLimo = (car.carType === 'limousine');
                const rev = isLimo ? 280 : 90;
                this.dropCash(car.mesh.position.x + 3.0, 7.8, rev);
                if (isLimo && game) game.showFloatingText('👑 5X VIP LIMO BONUS! +$280', car.mesh.position.x, 8.0);
                car.state = 'LEAVING';
                window.arcadeAudio.playCash();
              }
            }
          } else if (car.needsDrink() && player.stack.some(b => b.category === 'drink')) {
            const servedCup = player.removeDrinkCup();
            if (servedCup) {
              const finished = car.receiveDrink();
              if (finished) {
                const isLimo = (car.carType === 'limousine');
                const rev = isLimo ? 280 : 90;
                this.dropCash(car.mesh.position.x + 3.0, 7.8, rev);
                car.state = 'LEAVING';
                window.arcadeAudio.playCash();
              }
            }
          } else if (car.needsSide() && player.stack.some(b => b.category === 'side')) {
            const servedSide = player.removeSideItem();
            if (servedSide) {
              const finished = car.receiveSideItem();
              if (finished) {
                const isLimo = (car.carType === 'limousine');
                const rev = isLimo ? 280 : 90;
                this.dropCash(car.mesh.position.x + 3.0, 7.8, rev);
                car.state = 'LEAVING';
                window.arcadeAudio.playCash();
              }
            }
          }
        }
      });
    }

    // 12. Cleaning Tables
    window.TYCOON_CONFIG.tables.filter(t => t.unlocked && t.isDirty).forEach(table => {
      const distToDirty = Math.hypot(player.mesh.position.x - table.position.x, player.mesh.position.z - table.position.z);
      const sameFloor = (table.is2F && player.currentFloor === 2) || (!table.is2F && player.currentFloor === 1);
      if (distToDirty < window.TYCOON_CONFIG.player.cleanRadius && sameFloor) {
        if (player.stack.length < player.maxCapacity && !player.stack.some(b => b.category === 'pizza' || b.category === 'drink' || b.category === 'side' || b.category === 'dessert')) {
          this.cleanTable(table, player);
          player.addTrashBox();
        }
      }
    });

    // 13. Dumping Trash
    const distToBin = Math.hypot(player.mesh.position.x - window.TYCOON_CONFIG.trashBin.position.x, player.mesh.position.z - (window.TYCOON_CONFIG.trashBin.position.z + 1.8));
    if (distToBin < 3.0 && player.stackType === 'trash' && player.stack.length > 0 && player.currentFloor === 1) {
      const count = player.dumpTrash();
      const bonus = count * window.TYCOON_CONFIG.trashBin.rewardPerTrash;
      game.addCash(bonus);
      game.showFloatingText(`+$${bonus} Trash Cleaned! 🧹`, player.mesh.position.x, player.mesh.position.z);
    }

    // 14. Magnetic Cash Collection
    for (let i = this.cashBundles.length - 1; i >= 0; i--) {
      const bundle = this.cashBundles[i];
      const dist = Math.hypot(player.mesh.position.x - bundle.mesh.position.x, player.mesh.position.z - bundle.mesh.position.z);

      if (dist < window.TYCOON_CONFIG.player.cashCollectRadius) {
        const speed = 26.0 * delta;
        bundle.mesh.position.x += (player.mesh.position.x - bundle.mesh.position.x) * speed;
        bundle.mesh.position.z += (player.mesh.position.z - bundle.mesh.position.z) * speed;

        if (dist < 1.4) {
          game.addCash(bundle.value);
          this.scene.remove(bundle.mesh);
          this.cashBundles.splice(i, 1);
          window.arcadeAudio.playCash();
        }
      }
    }

    // 15. Step-On Sequential Unlocks
    this.unlockZones.filter(z => z.isActive && !z.isUnlocked).forEach(zone => {
      const dist = Math.hypot(player.mesh.position.x - zone.position.x, player.mesh.position.z - zone.position.z);

      if (dist < 2.2 && game.cash > 0 && zone.remainingCost > 0) {
        const spendRate = Math.min(game.cash, Math.ceil(zone.totalCost * delta * 1.5));
        if (spendRate > 0) {
          game.cash -= spendRate;
          zone.remainingCost = Math.max(0, zone.remainingCost - spendRate);
          game.updateHUD();
          window.arcadeAudio.playCash();

          if (zone.remainingCost <= 0) {
            this.handleUnlockTrigger(zone, game);
          }
        }
      }
    });

    // 16. Update Entities
    this.workers.forEach(w => w.update(delta));
    if (this.cashier) this.cashier.update(delta);
    if (this.chef) this.chef.update(delta);
    if (this.cleaner) this.cleaner.update(delta);
    if (this.scooter) this.scooter.update(delta, game);

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.update(delta);
      if (c.isDead) {
        this.customers.splice(i, 1);
      }
    }

    for (let i = this.driveThruCars.length - 1; i >= 0; i--) {
      const car = this.driveThruCars[i];
      car.update(delta);
      if (car.isDead) {
        this.driveThruCars.splice(i, 1);
      }
    }
  }
}

window.Restaurant3D = Restaurant3D;

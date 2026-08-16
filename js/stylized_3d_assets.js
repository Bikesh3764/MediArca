/**
 * Pizza Ready! 3D Tycoon - Stylized 3D High-Poly Architectural Asset Builder
 * Generates ultra-detailed, commercial-grade procedural 3D models matching top-charting mobile tycoon games.
 * Unity Portability: Maps to HighPolyMeshFactory.cs, Station3DPrefabs.cs, VehicleFactory.cs
 */

class Stylized3DAssetFactory {
  constructor() {
    this.materials = this.initPBRMaterials();
  }

  initPBRMaterials() {
    return {
      // Wood & Flooring
      birchWood: new THREE.MeshLambertMaterial({ color: 0xffedd5 }),
      espressoWood: new THREE.MeshLambertMaterial({ color: 0x1f2937 }),
      warmOak: new THREE.MeshLambertMaterial({ color: 0x92400e }),
      darkWalnut: new THREE.MeshLambertMaterial({ color: 0x3e2723 }),

      // Metals & Stainless Steel
      stainlessSteel: new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }),
      darkMetal: new THREE.MeshLambertMaterial({ color: 0x334155 }),
      chromeMetal: new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }),
      goldenBrass: new THREE.MeshLambertMaterial({ color: 0xfbbf24 }),
      goldTrim: new THREE.MeshLambertMaterial({ color: 0xd97706 }),

      // Brand Colors
      pizzaHutRed: new THREE.MeshLambertMaterial({ color: 0xd32323 }),
      pizzaHutDarkRed: new THREE.MeshLambertMaterial({ color: 0x991b1b }),
      pizzaHutYellow: new THREE.MeshLambertMaterial({ color: 0xfacc15 }),
      arcadePurple: new THREE.MeshLambertMaterial({ color: 0x7e22ce }),
      arcadePlum: new THREE.MeshLambertMaterial({ color: 0x581c87 }),
      arcadeBlue: new THREE.MeshLambertMaterial({ color: 0x2563eb }),
      arcadeTeal: new THREE.MeshLambertMaterial({ color: 0x0d9488 }),
      emeraldGreen: new THREE.MeshLambertMaterial({ color: 0x10b981 }),

      // Upholstery & Furniture
      leatherYellow: new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
      leatherOrange: new THREE.MeshLambertMaterial({ color: 0xea580c }),
      leatherRed: new THREE.MeshLambertMaterial({ color: 0xd32323 }),
      velvetPurple: new THREE.MeshLambertMaterial({ color: 0x6b21a8 }),
      pureWhite: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      marbleWhite: new THREE.MeshLambertMaterial({ color: 0xf8fafc }),

      // Glass & Glowing Displays
      cyanGlass: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }),
      glowOrange: new THREE.MeshBasicMaterial({ color: 0xf97316 }),
      glowYellow: new THREE.MeshBasicMaterial({ color: 0xfde047 }),
      glowCyan: new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
      glowPink: new THREE.MeshBasicMaterial({ color: 0xf472b6 }),
      posScreenBlue: new THREE.MeshBasicMaterial({ color: 0x0284c7 })
    };
  }

  /** 1. Industrial Commercial Multi-Deck Conveyor Oven */
  createCommercialConveyorOven(bannerColor = 0xd32323, pizzaType = 'pepperoni') {
    const ovenGroup = new THREE.Group();

    // Heavy Industrial Base Stand
    const standGeo = new THREE.BoxGeometry(3.6, 0.6, 4.4);
    const stand = new THREE.Mesh(standGeo, this.materials.darkMetal);
    stand.position.y = 0.3;
    stand.castShadow = true;
    stand.receiveShadow = true;
    ovenGroup.add(stand);

    // 4 Heavy Duty Castor Wheel Legs
    [[-1.6, -1.9], [1.6, -1.9], [-1.6, 1.9], [1.6, 1.9]].forEach(pos => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), this.materials.chromeMetal);
      leg.position.set(pos[0], 0.3, pos[1]);
      ovenGroup.add(leg);

      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), this.materials.espressoWood);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], 0.06, pos[1]);
      ovenGroup.add(wheel);
    });

    // Stainless Steel Insulated Oven Body
    const bodyGeo = new THREE.BoxGeometry(3.4, 1.6, 4.2);
    const body = new THREE.Mesh(bodyGeo, this.materials.stainlessSteel);
    body.position.y = 1.35;
    body.castShadow = true;
    ovenGroup.add(body);

    // Conveyor Belt Bed Running Through (Steel Mesh)
    const beltGeo = new THREE.BoxGeometry(2.6, 0.12, 5.4);
    const beltMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(0, 1.12, 0);
    belt.castShadow = true;
    ovenGroup.add(belt);

    // Dual Chrome Conveyor Rollers
    [-2.7, 2.7].forEach(rz => {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 12), this.materials.chromeMetal);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, 1.12, rz);
      ovenGroup.add(roller);
    });

    // Glowing Quartz Ember Baking Chamber (Interior Heat Window)
    const emberGeo = new THREE.BoxGeometry(2.5, 0.6, 2.6);
    const ember = new THREE.Mesh(emberGeo, this.materials.glowOrange);
    ember.position.set(0, 1.25, 0);
    ovenGroup.add(ember);

    // Red Hood with Pizza Hut Logo Plate
    const hoodGeo = new THREE.BoxGeometry(3.6, 0.45, 4.4);
    const hoodMat = new THREE.MeshLambertMaterial({ color: bannerColor });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.y = 2.35;
    hood.castShadow = true;
    ovenGroup.add(hood);

    // Digital LED Control Panel on Side
    const panelGeo = new THREE.BoxGeometry(0.1, 0.6, 0.9);
    const panel = new THREE.Mesh(panelGeo, this.materials.espressoWood);
    panel.position.set(1.72, 1.5, 0.8);
    ovenGroup.add(panel);

    const tempDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), this.materials.glowYellow);
    tempDisplay.rotation.y = Math.PI / 2;
    tempDisplay.position.set(1.78, 1.55, 0.8);
    ovenGroup.add(tempDisplay);

    // Exhaust Chimney with Steam Flue
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4, 10), this.materials.darkMetal);
    chimney.position.set(0, 3.1, -1.0);
    ovenGroup.add(chimney);

    const chimneyCap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 10), this.materials.darkMetal);
    chimneyCap.position.set(0, 3.85, -1.0);
    ovenGroup.add(chimneyCap);

    return { group: ovenGroup, emberMesh: ember };
  }

  /** 2. Iconic Purple & Yellow POS Checkout Counter */
  createSupercentCheckoutCounter() {
    const counterGroup = new THREE.Group();

    // Vibrant Purple Base with Kickboard
    const baseGeo = new THREE.BoxGeometry(11.2, 1.3, 2.5);
    const base = new THREE.Mesh(baseGeo, this.materials.arcadePurple);
    base.position.set(0, 0.65, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    counterGroup.add(base);

    // White Top Splicing Slab
    const topGeo = new THREE.BoxGeometry(11.6, 0.16, 2.8);
    const top = new THREE.Mesh(topGeo, this.materials.pureWhite);
    top.position.set(0, 1.38, 0);
    top.castShadow = true;
    counterGroup.add(top);

    // Yellow Order Front Drop Tray
    const trayGeo = new THREE.BoxGeometry(11.2, 0.08, 0.6);
    const tray = new THREE.Mesh(trayGeo, this.materials.pizzaHutYellow);
    tray.position.set(0, 1.46, 0.9);
    counterGroup.add(tray);

    // Dual Touchscreen POS Registers
    [-2.4, 2.4].forEach(posPx => {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), this.materials.darkMetal);
      stand.position.set(posPx, 1.62, 0.2);
      counterGroup.add(stand);

      const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.1), this.materials.espressoWood);
      monitor.rotation.x = -Math.PI / 6;
      monitor.position.set(posPx, 2.0, 0.2);
      counterGroup.add(monitor);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.7), this.materials.posScreenBlue);
      screen.rotation.x = -Math.PI / 6;
      screen.position.set(posPx, 2.0, 0.26);
      counterGroup.add(screen);

      const receipt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), this.materials.darkMetal);
      receipt.position.set(posPx + 0.9, 1.55, 0.2);
      counterGroup.add(receipt);
    });

    // Golden Call Bell
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.materials.goldenBrass);
    bell.position.set(0, 1.5, 0.6);
    counterGroup.add(bell);

    return counterGroup;
  }

  /** 3. Yellow Diner Booth Couches & White Populated Table */
  createDinerBoothTable(tableId, isPatio = false, is2F = false) {
    const tableGroup = new THREE.Group();

    // Clean White Square Tabletop
    const topGeo = new THREE.BoxGeometry(2.4, 0.14, 2.0);
    const topMat = is2F ? this.materials.marbleWhite : this.materials.pureWhite;
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.05;
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), this.materials.darkMetal);
    leg.position.y = 0.5;
    tableGroup.add(leg);

    // Yellow / Orange Diner Booth Couches on Both Sides
    const boothMat = is2F ? this.materials.velvetPurple : isPatio ? this.materials.leatherOrange : this.materials.leatherYellow;
    [-1.4, 1.4].forEach(bx => {
      const boothGroup = new THREE.Group();
      boothGroup.position.set(bx, 0, 0);

      // Seat Cushion
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 2.0), boothMat);
      seat.position.y = 0.45;
      seat.castShadow = true;
      boothGroup.add(seat);

      // Tufted Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 2.0), boothMat);
      back.position.set(bx > 0 ? 0.35 : -0.35, 0.9, 0);
      back.castShadow = true;
      boothGroup.add(back);

      // Chrome Frame Base
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 2.05), this.materials.chromeMetal);
      frame.position.y = 0.15;
      boothGroup.add(frame);

      tableGroup.add(boothGroup);
    });

    // Tabletop Condiments (Salt & Pepper, Napkin Dispenser)
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.25), this.materials.chromeMetal);
    napkin.position.set(0, 1.25, 0);
    tableGroup.add(napkin);

    const salt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), this.materials.pureWhite);
    salt.position.set(0.25, 1.2, 0.1);
    tableGroup.add(salt);

    const pepper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), this.materials.darkMetal);
    pepper.position.set(0.25, 1.2, -0.1);
    tableGroup.add(pepper);

    return tableGroup;
  }

  /** 4. High-Detail Multi-Tap Soda Fountain Station */
  createCommercialSodaFountain() {
    const sfGroup = new THREE.Group();

    // Cabinet Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.4), this.materials.espressoWood);
    base.position.y = 0.6;
    base.castShadow = true;
    sfGroup.add(base);

    // Brushed Chrome Dispenser Housing
    const disp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.5), this.materials.stainlessSteel);
    disp.position.set(0, 1.8, -0.2);
    disp.castShadow = true;
    sfGroup.add(disp);

    // Illuminated Brand Acrylic Logos
    const pepsiBadge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.05), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    pepsiBadge.position.set(-0.65, 2.1, 0.58);
    sfGroup.add(pepsiBadge);

    const dewBadge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.05), new THREE.MeshBasicMaterial({ color: 0x84cc16 }));
    dewBadge.position.set(0.65, 2.1, 0.58);
    sfGroup.add(dewBadge);

    // 4 Dispenser Levers
    [-0.8, -0.3, 0.3, 0.8].forEach(lx => {
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), this.materials.chromeMetal);
      lever.position.set(lx, 1.6, 0.5);
      lever.rotation.x = Math.PI / 8;
      sfGroup.add(lever);
    });

    // Drip Grate
    const grate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.7), this.materials.darkMetal);
    grate.position.set(0, 1.22, 0.5);
    sfGroup.add(grate);

    return sfGroup;
  }

  /** 5. Deep Fryer & Food Warmer Station */
  createSidesFryerStation() {
    const fryerGroup = new THREE.Group();

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.4), this.materials.espressoWood);
    base.position.y = 0.6;
    base.castShadow = true;
    fryerGroup.add(base);

    // Heated Food Warmer Box
    const warmer = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), this.materials.pizzaHutYellow);
    warmer.position.set(0, 1.7, -0.1);
    warmer.castShadow = true;
    fryerGroup.add(warmer);

    // Infrared Heat Lamp Tube
    const heatLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), this.materials.glowOrange);
    heatLamp.rotation.z = Math.PI / 2;
    heatLamp.position.set(0, 2.3, 0.2);
    fryerGroup.add(heatLamp);

    // Wire Baskets
    [-0.6, 0.6].forEach(bx => {
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.9), this.materials.chromeMetal);
      basket.position.set(bx, 1.4, 0.2);
      fryerGroup.add(basket);
    });

    return fryerGroup;
  }

  /** 6. Modern Commercial Waste Disposal Cabinet with Swinging Flap */
  createWasteBinStation() {
    const binGroup = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 1.8), this.materials.darkWalnut);
    body.position.y = 0.9;
    body.castShadow = true;
    binGroup.add(body);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.08), this.materials.chromeMetal);
    flap.position.set(0, 1.2, 0.92);
    binGroup.add(flap);

    const trayShelf = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.9), this.materials.espressoWood);
    trayShelf.position.y = 1.85;
    binGroup.add(trayShelf);

    return binGroup;
  }
}

window.Stylized3DAssetFactory = Stylized3DAssetFactory;
window.assetFactory3D = new Stylized3DAssetFactory();

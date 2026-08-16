/**
 * Pizza Ready! 3D Tycoon - Commercial 3D Pizzeria Architectural Asset Builder
 * Generates ultra-detailed, commercial-grade procedural 3D models matching top-charting mobile tycoon games.
 * Unity Portability: Maps to CommercialAssetBuilder.cs, ProceduralMeshGenerators.cs
 */

class Commercial3DPizzeriaAssets {
  constructor() {
    this.cache = new Map();
  }

  /** 1. Multi-Tier High-Capacity Commercial Oven with Turning Cogs */
  createConveyorOvenComplex(ovenType = 'pepperoni', tierCount = 2) {
    const ovenGroup = new THREE.Group();

    const typeColors = {
      pepperoni: 0xd32323,
      veggie: 0x15803d,
      stuffed: 0xd97706,
      supreme: 0x991b1b,
      meatlovers: 0x7f1d1d
    };
    const bannerColor = typeColors[ovenType] || 0xd32323;

    // 1. Heavy Gauge Stainless Steel Base Stand
    const standGeo = new THREE.BoxGeometry(3.6, 0.6, 4.4);
    const standMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.y = 0.3;
    stand.castShadow = true;
    stand.receiveShadow = true;
    ovenGroup.add(stand);

    // 4 Industrial Swivel Castor Wheel Legs
    [[-1.6, -1.9], [1.6, -1.9], [-1.6, 1.9], [1.6, 1.9]].forEach(pos => {
      const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], 0.3, pos[1]);
      ovenGroup.add(leg);

      const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], 0.06, pos[1]);
      ovenGroup.add(wheel);
    });

    // 2. Insulated Stainless Steel Oven Cabinets (Multi-Tier)
    for (let t = 0; t < tierCount; t++) {
      const tierY = 0.6 + t * 1.2;

      const bodyGeo = new THREE.BoxGeometry(3.4, 1.1, 4.2);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = tierY + 0.55;
      body.castShadow = true;
      ovenGroup.add(body);

      // Conveyor Mesh Bed
      const beltGeo = new THREE.BoxGeometry(2.6, 0.08, 5.2);
      const beltMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.set(0, tierY + 0.5, 0);
      belt.castShadow = true;
      ovenGroup.add(belt);

      // Glowing Quartz Radiant Heating Chamber
      const emberGeo = new THREE.BoxGeometry(2.4, 0.45, 2.6);
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const ember = new THREE.Mesh(emberGeo, emberMat);
      ember.position.set(0, tierY + 0.55, 0);
      ovenGroup.add(ember);

      // Rotating Chrome End Rollers
      [-2.6, 2.6].forEach(rz => {
        const rollerGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.6, 12);
        const rollerMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
        const roller = new THREE.Mesh(rollerGeo, rollerMat);
        roller.rotation.z = Math.PI / 2;
        roller.position.set(0, tierY + 0.5, rz);
        ovenGroup.add(roller);
      });
    }

    // 3. Branded Top Exhaust Canopy & Digital Telemetry Panel
    const totalTopY = 0.6 + tierCount * 1.2;
    const hoodGeo = new THREE.BoxGeometry(3.6, 0.45, 4.4);
    const hoodMat = new THREE.MeshLambertMaterial({ color: bannerColor });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.y = totalTopY + 0.22;
    hood.castShadow = true;
    ovenGroup.add(hood);

    // Pizza Hut Logo Silhouette Plate
    const logoPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    logoPlate.position.set(0, totalTopY + 0.22, 2.22);
    ovenGroup.add(logoPlate);

    // Dual Stainless Exhaust Chimneys
    [-0.8, 0.8].forEach(cx => {
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 10), new THREE.MeshLambertMaterial({ color: 0x334155 }));
      chimney.position.set(cx, totalTopY + 1.0, -1.0);
      ovenGroup.add(chimney);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.25, 10), new THREE.MeshLambertMaterial({ color: 0x334155 }));
      cap.position.set(cx, totalTopY + 1.7, -1.0);
      ovenGroup.add(cap);
    });

    return ovenGroup;
  }

  /** 2. Luxury Pizzeria Dining Booth Set with Tableware & Pendant Lamp */
  createLuxuryDiningBoothSet(tableId, isPatio = false, is2F = false) {
    const boothSetGroup = new THREE.Group();

    // 1. Solid Oak Tabletop with Beveled Edges
    const topGeo = new THREE.BoxGeometry(2.4, 0.14, 2.0);
    const topMat = is2F ? new THREE.MeshLambertMaterial({ color: 0xf8fafc }) : new THREE.MeshLambertMaterial({ color: 0xffffff });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.05;
    top.castShadow = true;
    top.receiveShadow = true;
    boothSetGroup.add(top);

    // Chrome Pedestal Leg & Base Disc
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 10), new THREE.MeshLambertMaterial({ color: 0x334155 }));
    leg.position.y = 0.5;
    boothSetGroup.add(leg);

    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 12), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
    baseDisc.position.y = 0.025;
    boothSetGroup.add(baseDisc);

    // 2. Yellow Tufted Leather Diner Booth Couches on Both Sides
    const boothColor = is2F ? 0x6b21a8 : isPatio ? 0xea580c : 0xf59e0b;
    const boothMat = new THREE.MeshLambertMaterial({ color: boothColor });

    [-1.4, 1.4].forEach(bx => {
      const boothGroup = new THREE.Group();
      boothGroup.position.set(bx, 0, 0);

      // Seat Cushion
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 2.0), boothMat);
      seat.position.y = 0.45;
      seat.castShadow = true;
      boothGroup.add(seat);

      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 2.0), boothMat);
      back.position.set(bx > 0 ? 0.36 : -0.36, 0.92, 0);
      back.castShadow = true;
      boothGroup.add(back);

      // Chrome Trim Skirt
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 2.05), new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }));
      skirt.position.y = 0.15;
      boothGroup.add(skirt);

      boothSetGroup.add(boothGroup);
    });

    // 3. Tabletop Accessories: Ceramic Plates, Cups, Napkins
    const napkinDispenser = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.25), new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }));
    napkinDispenser.position.set(0, 1.25, 0);
    boothSetGroup.add(napkinDispenser);

    [-0.6, 0.6].forEach(px => {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      plate.position.set(px, 1.14, 0);
      boothSetGroup.add(plate);

      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.28, 8), new THREE.MeshLambertMaterial({ color: 0xd32323 }));
      cup.position.set(px, 1.26, 0.6);
      boothSetGroup.add(cup);
    });

    return boothSetGroup;
  }

  /** 3. Commercial Multi-Tap Fountain Beverage Station */
  createFountainBeverageStation() {
    const stationGroup = new THREE.Group();

    // Heavy Cabinet Body
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.4), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
    cabinet.position.y = 0.6;
    cabinet.castShadow = true;
    stationGroup.add(cabinet);

    // Dispenser Tower Housing
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.5), new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }));
    tower.position.set(0, 1.8, -0.2);
    tower.castShadow = true;
    stationGroup.add(tower);

    // Illuminated Brand Badges
    const pepsiBadge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.05), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    pepsiBadge.position.set(-0.65, 2.1, 0.58);
    stationGroup.add(pepsiBadge);

    const dewBadge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.05), new THREE.MeshBasicMaterial({ color: 0x84cc16 }));
    dewBadge.position.set(0.65, 2.1, 0.58);
    stationGroup.add(dewBadge);

    // 4 Dispenser Levers
    [-0.8, -0.3, 0.3, 0.8].forEach(lx => {
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }));
      lever.position.set(lx, 1.6, 0.5);
      lever.rotation.x = Math.PI / 8;
      stationGroup.add(lever);
    });

    // Drip Grate
    const grate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.7), new THREE.MeshLambertMaterial({ color: 0x334155 }));
    grate.position.set(0, 1.22, 0.5);
    stationGroup.add(grate);

    return stationGroup;
  }

  /** 4. Deep Fryer & Food Warmer Station */
  createSidesFryerStation() {
    const fryerGroup = new THREE.Group();

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.4), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
    base.position.y = 0.6;
    base.castShadow = true;
    fryerGroup.add(base);

    const warmer = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xfacc15 }));
    warmer.position.set(0, 1.7, -0.1);
    warmer.castShadow = true;
    fryerGroup.add(warmer);

    const heatLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
    heatLamp.rotation.z = Math.PI / 2;
    heatLamp.position.set(0, 2.3, 0.2);
    fryerGroup.add(heatLamp);

    [-0.6, 0.6].forEach(bx => {
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.9), new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }));
      basket.position.set(bx, 1.4, 0.2);
      fryerGroup.add(basket);
    });

    return fryerGroup;
  }
}

window.Commercial3DPizzeriaAssets = Commercial3DPizzeriaAssets;

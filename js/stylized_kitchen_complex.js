/**
 * Pizza Ready! 3D Tycoon - Stylized Kitchen Equipment Complex Builder
 * Generates ultra-detailed commercial kitchen prep equipment, proofing cabinets, and makelines.
 * Unity Portability: Maps to KitchenEquipmentFactory.cs, StationPrefabs.cs
 */

class StylizedKitchenComplex {
  constructor() {
    this.materials = {
      stainlessSteel: new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }),
      darkSteel: new THREE.MeshLambertMaterial({ color: 0x334155 }),
      chrome: new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }),
      woodOak: new THREE.MeshLambertMaterial({ color: 0x92400e }),
      stoneHearth: new THREE.MeshLambertMaterial({ color: 0x78350f }),
      doughColor: new THREE.MeshLambertMaterial({ color: 0xfef08a }),
      marinaraRed: new THREE.MeshLambertMaterial({ color: 0xd32323 }),
      cheeseGold: new THREE.MeshLambertMaterial({ color: 0xfacc15 }),
      glassClear: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
    };
  }

  /** 1. Central Pizza Prep Make-Line Table with Ingredient Tubs */
  createPizzaPrepMakeLine() {
    const tableGroup = new THREE.Group();

    // Heavy Stainless Prep Counter Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 2.4), this.materials.stainlessSteel);
    body.position.y = 0.6;
    body.castShadow = true;
    tableGroup.add(body);

    // Marble Cutting Board Top
    const cuttingBoard = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.08, 1.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cuttingBoard.position.set(0, 1.24, 0.4);
    tableGroup.add(cuttingBoard);

    // Raised Refrigerated Ingredient Rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.35, 0.8), this.materials.darkSteel);
    rail.position.set(0, 1.38, -0.6);
    tableGroup.add(rail);

    // 5 Polycarbonate Ingredient Pans (Sauce, Cheese, Pepperoni, Veggies, Olives)
    const panColors = [0xd32323, 0xfacc15, 0x991b1b, 0x15803d, 0x0f172a];
    panColors.forEach((color, idx) => {
      const pan = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.6), new THREE.MeshLambertMaterial({ color }));
      pan.position.set(-1.4 + idx * 0.7, 1.52, -0.6);
      tableGroup.add(pan);
    });

    // Glass Sneeze Guard Canopy
    const guard = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.6, 0.05), this.materials.glassClear);
    guard.position.set(0, 1.85, -0.2);
    guard.rotation.x = -Math.PI / 8;
    tableGroup.add(guard);

    // Wooden Rolling Pin & Dough Ball on Table
    const dough = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), this.materials.doughColor);
    dough.scale.set(1.2, 0.4, 1.2);
    dough.position.set(-0.8, 1.32, 0.4);
    tableGroup.add(dough);

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), this.materials.woodOak);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0.6, 1.32, 0.4);
    tableGroup.add(pin);

    return tableGroup;
  }

  /** 2. Commercial Dough Proofing Cabinet with Glass Doors */
  createDoughProofingCabinet() {
    const cabinetGroup = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 1.8), this.materials.stainlessSteel);
    body.position.y = 1.6;
    body.castShadow = true;
    cabinetGroup.add(body);

    const glassDoor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 0.05), this.materials.glassClear);
    glassDoor.position.set(0, 1.6, 0.92);
    cabinetGroup.add(glassDoor);

    for (let s = 0; s < 4; s++) {
      const pan = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 1.4), this.materials.chrome);
      pan.position.set(0, 0.6 + s * 0.7, 0);
      cabinetGroup.add(pan);

      const d1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.materials.doughColor);
      d1.position.set(-0.4, 0.72 + s * 0.7, 0);
      cabinetGroup.add(d1);

      const d2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.materials.doughColor);
      d2.position.set(0.4, 0.72 + s * 0.7, 0);
      cabinetGroup.add(d2);
    }

    return cabinetGroup;
  }
}

window.StylizedKitchenComplex = StylizedKitchenComplex;

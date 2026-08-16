/**
 * Pizza Ready! 3D Tycoon - 20-Step Commercial-Grade Master Quality & Visual Overhaul Plan
 * Unity Portability: Maps to GameSettingsSO / QualitySettingsSO in C#.
 */

window.TYCOON_CONFIG = {
  // Current Active Progression Milestone
  currentMilestone: 1,

  // 20-Step Commercial-Grade Master Plan
  roadmap: [
    {
      step: 1,
      title: 'Studio Lighting, Soft Shadows, Warm Rim Lights & Atmospheric Fog',
      desc: 'Multi-light studio rig with 2048px PCFSoft shadows, cyan-orange rim backlights, and cozy depth fog.',
      status: 'active'
    },
    {
      step: 2,
      title: 'Commercial Character Rigging, Squash-and-Stretch & Walk Physics',
      desc: 'Stylized 3D character mesh with animated head bobbing, torso breathing, walking dust puffs, and inertia tilt.',
      status: 'upcoming'
    },
    {
      step: 3,
      title: 'Expressive Customer AI with 3D Emote Bubbles & Mood States',
      desc: '8 unique customer archetypes with animated thought bubbles, eating joy squash, and heart particles.',
      status: 'upcoming'
    },
    {
      step: 4,
      title: 'High-Poly Conveyor Ovens, Glowing Quartz Embers & Steam Shimmer',
      desc: 'Industrial pizza conveyors with rotating rollers, glowing heating coils, digital LEDs, and smoke.',
      status: 'upcoming'
    },
    {
      step: 5,
      title: 'Beverage Station & Sides Deep Fryer Sensory Polish',
      desc: 'Dual soda fountain with fizzy streaming liquids and fryer station with sizzling oil bubbles.',
      status: 'upcoming'
    },
    {
      step: 6,
      title: 'Super-Juicy Carrying Stack Physics & Spring-Damper Inertia',
      desc: 'Physics-based multi-item stack wobbling, corner banking tilt, and ceiling height safety clearance.',
      status: 'upcoming'
    },
    {
      step: 7,
      title: 'Heated Stash Storage Shelf with 12 Visual 3D Slots & Auto-Transfer',
      desc: 'Dual-tier organized rack with instant 1-tap store/retrieve and floating inventory indicator.',
      status: 'upcoming'
    },
    {
      step: 8,
      title: 'Rigid Zero-Glitch Collision Grid & Dynamic Obstacle Avoidance',
      desc: 'Pixel-perfect collision matrix and smooth wall-sliding physics around counters and walls.',
      status: 'upcoming'
    },
    {
      step: 9,
      title: 'Front Counter Bezier Queue Flow & Cashier Register Chimes',
      desc: 'Clean queue line advance, zero-jitter stepping, and automatic cashier ringing checkout.',
      status: 'upcoming'
    },
    {
      step: 10,
      title: 'Table Service, Dirty Dish Stacks, Trash Sorting & Cleaning Loop',
      desc: 'Customers leave dirty boxes; cleaner busboy sweeps tables with sparkle stars and dumps trash.',
      status: 'upcoming'
    },
    {
      step: 11,
      title: 'Smooth 2-Floor Escalator Transportation & Dynamic Camera Elevation',
      desc: 'Animated steel steps, cyan glowing balustrade, smooth ride physics, and camera elevation tracking.',
      status: 'upcoming'
    },
    {
      step: 12,
      title: '2F VIP Penthouse Lounge & Chocolate Lava Cake Kitchen',
      desc: 'Rooftop dining with velvet booths, ambient candle lanterns, and 4X cash luxury desserts.',
      status: 'upcoming'
    },
    {
      step: 13,
      title: 'Multi-Lane Drive-Thru with Spinning Wheels & VIP Limousines',
      desc: 'Working car headlights, spinning tires, smooth deceleration, and 5X VIP limo payouts.',
      status: 'upcoming'
    },
    {
      step: 14,
      title: 'Scooter Delivery Fleet Hub & Active Roadside Logistics',
      desc: 'Online thermal hot-bag packing, moped engine rev, road driving loop, and +$220 cash bonus.',
      status: 'upcoming'
    },
    {
      step: 15,
      title: 'Outdoor Garden Patio with Teak Decking & Striped Umbrellas',
      desc: 'Wood plank flooring, sun umbrellas, warm bistro string fairy lights, and potted palm plants.',
      status: 'upcoming'
    },
    {
      step: 16,
      title: 'Sequential Holographic Unlock Pads & Precision Cash Draining',
      desc: 'Pulsing holographic rings with floating 3D icons and zero-overdraw cash countdown.',
      status: 'upcoming'
    },
    {
      step: 17,
      title: 'Interactive Store Theme Customizer & Real-time Material Swap',
      desc: 'Live palette swapper (Classic Red, Cyber Neon, Royal Gold, Retro 80s) with zero stutter.',
      status: 'upcoming'
    },
    {
      step: 18,
      title: 'Daily Lucky Spin Wheel & Golden Dough Tossing Mini-Games',
      desc: 'Physics friction wheel with clicker audio and interactive dough toss timing bar.',
      status: 'upcoming'
    },
    {
      step: 19,
      title: 'Multi-City Expansion, Golden Trophies & Offline Earnings Vault',
      desc: 'Prestige franchise resets (Chicago, New York, Tokyo) and 12-hour offline idle revenue.',
      status: 'upcoming'
    },
    {
      step: 20,
      title: '16-Bit Master Audio Synthesizer, 120 FPS Engine & Mobile Touch Polish',
      desc: 'Web Audio polyphony synthesizer, frustum culling, dynamic resolution, and haptics.',
      status: 'upcoming'
    }
  ],

  // Weather Presets
  weatherPresets: [
    {
      id: 'day',
      name: 'Sunny Noon',
      timeText: '12:00 PM',
      icon: '☀️',
      skyColor: 0x1e293b,
      sunColor: 0xffeedd,
      sunIntensity: 1.15,
      ambientColor: 0xfff5ea,
      ambientIntensity: 0.85,
      isRain: false
    },
    {
      id: 'sunset',
      name: 'Golden Sunset',
      timeText: '6:30 PM',
      icon: '🌅',
      skyColor: 0x451a03,
      sunColor: 0xfb923c,
      sunIntensity: 1.25,
      ambientColor: 0xfef08a,
      ambientIntensity: 0.75,
      isRain: false
    },
    {
      id: 'night',
      name: 'Neon Midnight',
      timeText: '11:00 PM',
      icon: '🌙',
      skyColor: 0x09090b,
      sunColor: 0x38bdf8,
      sunIntensity: 0.45,
      ambientColor: 0x1e1b4b,
      ambientIntensity: 0.6,
      isRain: false
    },
    {
      id: 'rain',
      name: 'Cozy Rainstorm',
      timeText: '4:00 PM',
      icon: '🌧️',
      skyColor: 0x0f172a,
      sunColor: 0x94a3b8,
      sunIntensity: 0.55,
      ambientColor: 0x334155,
      ambientIntensity: 0.7,
      isRain: true
    }
  ],

  // Second Floor & Escalator Configuration
  floor2: {
    unlocked: false,
    height: 6.8,
    escalator: {
      bottomPos: { x: 0, y: 0, z: -10 },
      topPos: { x: 0, y: 6.8, z: -16 },
      rideDuration: 1.2
    }
  },

  // 2nd Floor Dessert Station (Chocolate Lava Cake & Gelato)
  dessertStation: {
    id: 'dessert_station_2f',
    name: '🍫 Chocolate Lava Cake & Gelato Bar',
    cost: 320,
    unlocked: false,
    position: { x: -8, y: 6.8, z: -12 },
    cookInterval: 1.0,
    maxCapacity: 8,
    dessertPrice: 24,
    luxuryMultiplier: 4.0
  },

  // Store Customization Themes
  storeThemes: [
    {
      id: 'classic',
      name: 'Classic Red Roof',
      icon: '🏠',
      floorColor: 0x242432,
      carpetColor: 0x831843,
      wallColor: 0xd32323,
      cost: 0,
      unlocked: true
    },
    {
      id: 'cyber',
      name: 'Cyber Neon Pizzeria',
      icon: '🌌',
      floorColor: 0x0f172a,
      carpetColor: 0x0284c7,
      wallColor: 0x6366f1,
      cost: 150,
      unlocked: false
    },
    {
      id: 'luxury',
      name: 'Royal Gold Palace',
      icon: '👑',
      floorColor: 0x3b3b4d,
      carpetColor: 0x7e22ce,
      wallColor: 0xd97706,
      cost: 250,
      unlocked: false
    },
    {
      id: 'retro',
      name: '80s Vintage Diner',
      icon: '🕹️',
      floorColor: 0x1f2937,
      carpetColor: 0xdc2626,
      wallColor: 0x059669,
      cost: 200,
      unlocked: false
    }
  ],

  // Jukebox Tracks
  jukeboxTracks: [
    { id: 'classic', name: 'Classic Arcade Tycoon', icon: '🎵' },
    { id: 'synthwave', name: 'Cyber Neon Sunset', icon: '🌃' },
    { id: 'bistro', name: 'Italian Accordion Bistro', icon: '🍷' },
    { id: 'rush', name: 'Kitchen Turbo Rush', icon: '🔥' }
  ],

  // Rush Hour Frenzy Event Config
  rushHour: {
    duration: 35.0,
    interval: 80.0,
    cashMultiplier: 2.0,
    speedBoostMultiplier: 1.25,
    customerSpawnInterval: 1.4
  },

  // VIP Food Critic Config
  foodCritic: {
    spawnInterval: 90.0,
    payout: 350,
    stars: 5
  },

  // Pizza Varieties
  pizzaTypes: {
    pepperoni: {
      id: 'pepperoni',
      name: "Pepperoni Lover's®",
      icon: '🍕',
      color: 0xd32323,
      price: 15
    },
    veggie: {
      id: 'veggie',
      name: "Veggie Lover's®",
      icon: '🥦',
      color: 0x15803d,
      price: 22
    },
    stuffed: {
      id: 'stuffed',
      name: "Cheesy Stuffed Crust®",
      icon: '🧀',
      color: 0xf59e0b,
      price: 28
    }
  },

  // Player stats
  player: {
    baseSpeed: 11.0,
    baseCapacity: 4,
    speedPerLevel: 1.2,
    capacityPerLevel: 2,
    pickupRadius: 2.5,
    serveRadius: 3.8,
    cashCollectRadius: 6.0,
    cleanRadius: 3.0
  },

  // AI Worker stats
  worker: {
    baseSpeed: 8.0,
    baseCapacity: 4,
    speedPerLevel: 1.0,
    capacityPerLevel: 2
  },

  // Heated Storage Rack / Buffer Stash Table
  storageRack: {
    position: { x: -3.2, y: 0, z: -4.5 },
    maxCapacity: 12
  },

  // Waste Bin Station
  trashBin: {
    position: { x: -8, y: 0, z: -14 },
    rewardPerTrash: 5
  },

  // Front Checkout Counter
  counter: {
    position: { x: 0, y: 0, z: 8 },
    serveSlots: [
      { x: -1.8, y: 0, z: 7.2 },
      { x: 1.8, y: 0, z: 7.2 }
    ],
    customerQueueStart: { x: 0, y: 0, z: 9.8 },
    customerQueueSpacing: 2.2,
    maxQueueLength: 6
  },

  // Scooter Delivery Fleet Station
  scooterStation: {
    id: 'scooter_hub',
    name: '🛵 Scooter Delivery Fleet',
    cost: 180,
    unlocked: false,
    position: { x: 10, y: 0, z: 18 },
    deliveryDuration: 6.0,
    basePayout: 220
  },

  // Sequential Progressive Unlocks
  unlockChain: [
    {
      id: 'table_2',
      type: 'table',
      name: 'Indoor Table #2',
      cost: 40,
      requires: null,
      position: { x: 12, y: 0, z: 4 }
    },
    {
      id: 'worker_1',
      type: 'worker',
      name: 'Hire Helper #1',
      cost: 70,
      requires: 'table_2',
      position: { x: 4, y: 0, z: -2 }
    },
    {
      id: 'soda_fountain',
      type: 'soda',
      name: 'Pepsi Soda Fountain',
      cost: 90,
      requires: 'worker_1',
      position: { x: -4, y: 0, z: 2 }
    },
    {
      id: 'table_3',
      type: 'table',
      name: 'Indoor Booth #3',
      cost: 110,
      requires: 'soda_fountain',
      position: { x: 6, y: 0, z: -6 }
    },
    {
      id: 'staff_cashier',
      type: 'staff_cashier',
      name: 'Hire Front Cashier',
      cost: 130,
      requires: 'table_3',
      position: { x: 0, y: 0, z: 6.2 }
    },
    {
      id: 'staff_cleaner',
      type: 'staff_cleaner',
      name: 'Hire Dedicated Cleaner',
      cost: 150,
      requires: 'staff_cashier',
      position: { x: 8, y: 0, z: 0 }
    },
    {
      id: 'scooter_hub',
      type: 'scooter',
      name: '🛵 Scooter Delivery Fleet',
      cost: 180,
      requires: 'staff_cleaner',
      position: { x: 10, y: 0, z: 18 }
    },
    {
      id: 'zone_2_patio',
      type: 'zone_expansion',
      name: '✨ Expand: Outdoor Patio',
      cost: 200,
      requires: 'scooter_hub',
      position: { x: 18, y: 0, z: 0 }
    },
    {
      id: 'patio_table_1',
      type: 'table',
      name: 'Patio Umbrella Table #1',
      cost: 100,
      requires: 'zone_2_patio',
      position: { x: 24, y: 0, z: 5 }
    },
    {
      id: 'patio_table_2',
      type: 'table',
      name: 'Patio Umbrella Table #2',
      cost: 140,
      requires: 'patio_table_1',
      position: { x: 31, y: 0, z: 5 }
    },
    {
      id: 'patio_table_3',
      type: 'table',
      name: 'Patio Garden Table #3',
      cost: 180,
      requires: 'patio_table_2',
      position: { x: 24, y: 0, z: -5 }
    },
    {
      id: 'oven_veggie',
      type: 'oven',
      name: '✨ Kitchen: Veggie Oven',
      cost: 220,
      requires: 'patio_table_3',
      position: { x: -12, y: 0, z: -4 }
    },
    {
      id: 'staff_chef',
      type: 'staff_chef',
      name: 'Hire Master Chef',
      cost: 240,
      requires: 'oven_veggie',
      position: { x: -7, y: 0, z: -2 }
    },
    {
      id: 'sides_station',
      type: 'sides',
      name: 'Wings & Fryer Station',
      cost: 260,
      requires: 'staff_chef',
      position: { x: -12, y: 0, z: -10 }
    },
    {
      id: 'drivethru_lane_1',
      type: 'drivethru_1',
      name: '✨ Unlock Drive-Thru Lane',
      cost: 290,
      requires: 'sides_station',
      position: { x: -20, y: 0, z: 8 }
    },
    {
      id: 'drivethru_lane_2',
      type: 'drivethru_2',
      name: '👑 VIP Express Lane 2',
      cost: 350,
      requires: 'drivethru_lane_1',
      position: { x: -26, y: 0, z: 8 }
    },
    {
      id: 'escalator_2f',
      type: 'escalator',
      name: '🏬 Unlock 2nd Floor Escalator',
      cost: 380,
      requires: 'drivethru_lane_2',
      position: { x: 0, y: 0, z: -8 }
    },
    {
      id: 'dessert_station_2f',
      type: 'dessert_station',
      name: '🍫 Lava Cake & Gelato Bar',
      cost: 300,
      requires: 'escalator_2f',
      position: { x: -8, y: 6.8, z: -12 }
    },
    {
      id: 'table_2f_1',
      type: 'table',
      name: '👑 VIP Penthouse Booth #1',
      cost: 220,
      requires: 'dessert_station_2f',
      position: { x: 8, y: 6.8, z: -12 }
    },
    {
      id: 'table_2f_2',
      type: 'table',
      name: '👑 VIP Penthouse Booth #2',
      cost: 260,
      requires: 'table_2f_1',
      position: { x: 8, y: 6.8, z: -4 }
    }
  ],

  // Multiple Specialized Conveyor Ovens
  ovens: [
    {
      id: 'oven_pepperoni',
      type: 'pepperoni',
      name: "Pepperoni Lover's Oven",
      unlocked: true,
      cost: 0,
      position: { x: -12, y: 0, z: 2 },
      cookInterval: 1.1,
      maxCapacity: 10
    },
    {
      id: 'oven_veggie',
      type: 'veggie',
      name: "Veggie Lover's Oven",
      unlocked: false,
      cost: 220,
      position: { x: -12, y: 0, z: -4 },
      cookInterval: 1.2,
      maxCapacity: 10
    },
    {
      id: 'oven_stuffed',
      type: 'stuffed',
      name: "Stuffed Crust Oven",
      unlocked: false,
      cost: 300,
      position: { x: -12, y: 0, z: -16 },
      cookInterval: 1.4,
      maxCapacity: 10
    }
  ],

  // Soda Fountain Station
  sodaFountain: {
    id: 'soda_fountain',
    name: 'Pepsi Soda Fountain',
    cost: 90,
    unlocked: false,
    position: { x: -4, y: 0, z: 2 },
    cookInterval: 0.9,
    maxCapacity: 8,
    drinkPrice: 10,
    comboMultiplier: 2.0
  },

  // Sides Station
  sidesStation: {
    id: 'sides_station',
    name: 'Wings & Fryer Station',
    cost: 260,
    unlocked: false,
    position: { x: -12, y: 0, z: -10 },
    cookInterval: 1.1,
    maxCapacity: 8,
    sidePrice: 16,
    feastMultiplier: 3.0
  },

  // Zone 2 Expansion
  zone2: {
    id: 'zone_2_patio',
    name: 'Outdoor Patio Lounge',
    cost: 200,
    unlocked: false,
    position: { x: 18, y: 0, z: 0 }
  },

  // Specialized HR Staff Roles
  specializedStaff: {
    cashier: {
      id: 'staff_cashier',
      name: 'Hire Front Cashier',
      cost: 130,
      unlocked: false,
      position: { x: 0, y: 0, z: 6.2 },
      speed: 1.0
    },
    chef: {
      id: 'staff_chef',
      name: 'Hire Master Chef',
      cost: 240,
      unlocked: false,
      position: { x: -7, y: 0, z: -2 },
      cookBoost: 1.5
    },
    cleaner: {
      id: 'staff_cleaner',
      name: 'Hire Dedicated Cleaner',
      cost: 150,
      unlocked: false,
      position: { x: 8, y: 0, z: 0 },
      speed: 8.5
    }
  },

  // Dining Tables (1F & 2F)
  tables: [
    {
      id: 'table_1',
      name: 'Indoor Table #1',
      cost: 0,
      unlocked: true,
      zone: 1,
      position: { x: 6, y: 0, z: 4 },
      chairs: 2,
      eatDuration: 5.5,
      isDirty: false
    },
    {
      id: 'table_2',
      name: 'Indoor Table #2',
      cost: 40,
      unlocked: false,
      zone: 1,
      position: { x: 12, y: 0, z: 4 },
      chairs: 2,
      eatDuration: 5.5,
      isDirty: false
    },
    {
      id: 'table_3',
      name: 'Indoor Booth #3',
      cost: 110,
      unlocked: false,
      zone: 1,
      position: { x: 6, y: 0, z: -6 },
      chairs: 2,
      eatDuration: 5.5,
      isDirty: false
    },
    {
      id: 'patio_table_1',
      name: 'Patio Umbrella Table #1',
      cost: 100,
      unlocked: false,
      zone: 2,
      isPatio: true,
      position: { x: 24, y: 0, z: 5 },
      chairs: 2,
      eatDuration: 5.0,
      isDirty: false
    },
    {
      id: 'patio_table_2',
      name: 'Patio Umbrella Table #2',
      cost: 140,
      unlocked: false,
      zone: 2,
      isPatio: true,
      position: { x: 31, y: 0, z: 5 },
      chairs: 2,
      eatDuration: 5.0,
      isDirty: false
    },
    {
      id: 'patio_table_3',
      name: 'Patio Garden Table #3',
      cost: 180,
      unlocked: false,
      zone: 2,
      isPatio: true,
      position: { x: 24, y: 0, z: -5 },
      chairs: 2,
      eatDuration: 5.0,
      isDirty: false
    },
    {
      id: 'table_2f_1',
      name: '👑 VIP Penthouse Booth #1',
      cost: 220,
      unlocked: false,
      floor: 2,
      is2F: true,
      position: { x: 8, y: 6.8, z: -12 },
      chairs: 2,
      eatDuration: 6.0,
      isDirty: false
    },
    {
      id: 'table_2f_2',
      name: '👑 VIP Penthouse Booth #2',
      cost: 260,
      unlocked: false,
      floor: 2,
      is2F: true,
      position: { x: 8, y: 6.8, z: -4 },
      chairs: 2,
      eatDuration: 6.0,
      isDirty: false
    }
  ],

  // Helpers
  workers: [
    {
      id: 'worker_1',
      name: 'Hire Helper #1',
      cost: 70,
      unlocked: false,
      position: { x: 4, y: 0, z: -2 }
    }
  ],

  // Drive-Thru
  drivethru: {
    lane1: {
      id: 'drivethru_lane_1',
      name: 'Drive-Thru Lane 1',
      cost: 290,
      unlocked: false,
      position: { x: -20, y: 0, z: 8 },
      spawnInterval: 12.0
    },
    lane2: {
      id: 'drivethru_lane_2',
      name: 'VIP Express Lane 2',
      cost: 350,
      unlocked: false,
      position: { x: -26, y: 0, z: 8 },
      spawnInterval: 15.0
    }
  },

  // HR Upgrades
  upgrades: [
    {
      id: 'player_capacity',
      title: 'Player Capacity',
      icon: '🎒',
      desc: 'Carry more pizza boxes, drinks, sides & trash.',
      level: 1,
      maxLevel: 10,
      baseCost: 35,
      costMultiplier: 1.6
    },
    {
      id: 'player_speed',
      title: 'Player Speed',
      icon: '👟',
      desc: 'Sprint faster around the restaurant.',
      level: 1,
      maxLevel: 8,
      baseCost: 50,
      costMultiplier: 1.7
    },
    {
      id: 'cashier_efficiency',
      title: 'Cashier Service Speed',
      icon: '🛎️',
      desc: 'Speed up front counter order checkout by 35%.',
      level: 1,
      maxLevel: 6,
      baseCost: 75,
      costMultiplier: 1.7
    },
    {
      id: 'chef_mastery',
      title: 'Master Chef Turbo',
      icon: '👨‍🍳',
      desc: 'Chef cooks pizzas and sides with supreme 2X speed.',
      level: 1,
      maxLevel: 5,
      baseCost: 110,
      costMultiplier: 1.9
    },
    {
      id: 'cleaner_speed',
      title: 'Cleaner Busboy Turbo',
      icon: '🧹',
      desc: 'Dedicated cleaner sprints faster and clears tables instantly.',
      level: 1,
      maxLevel: 6,
      baseCost: 90,
      costMultiplier: 1.8
    }
  ]
};

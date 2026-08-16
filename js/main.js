/**
 * Pizza Ready! 3D Tycoon - Main Game Bootstrap, Multi-City Expansion, Battle Pass & Cinematic VFX
 * Unity Portability: Maps to GameManager.cs, CityManager.cs, BattlePassManager.cs, CinematicVFXManager.cs
 */

class PizzaReadyGame {
  constructor() {
    this.cash = 80;
    this.canvas = document.getElementById('webgl-canvas');
    this.worldUiLayer = document.getElementById('world-ui-layer');
    this.uiFloatersLayer = document.getElementById('ui-floaters-layer');

    this.inputVector = new THREE.Vector2();
    this.keys = {};
    this.joystickActive = false;
    this.joystickCenter = { x: 0, y: 0 };

    this.customerSpawnTimer = 0;
    this.carSpawnTimerLane1 = 0;
    this.carSpawnTimerLane2 = 0;
    this.criticSpawnTimer = 0;

    // Step 10: Rush Hour Event State
    this.isRushHourActive = false;
    this.rushHourTimer = 0;
    this.rushHourCooldown = 50.0;

    // Step 11: Spin Wheel & Dough Toss States
    this.isSpinning = false;
    this.wheelRotation = 0;
    this.wheelVelocity = 0;
    this.wheelPrizes = [
      { text: '$100 Cash', icon: '💵', reward: { type: 'cash', val: 100 }, color: '#ec4899' },
      { text: 'Pepperoni Fever', icon: '🍕', reward: { type: 'cash', val: 150 }, color: '#f59e0b' },
      { text: '👑 JACKPOT $500', icon: '👑', reward: { type: 'cash', val: 500 }, color: '#8b5cf6' },
      { text: 'Speed Boost', icon: '⚡', reward: { type: 'speed', val: 30 }, color: '#06b6d4' },
      { text: 'Drink Mania $120', icon: '🥤', reward: { type: 'cash', val: 120 }, color: '#3b82f6' },
      { text: 'Wing Feast $180', icon: '🍗', reward: { type: 'cash', val: 180 }, color: '#10b981' },
      { text: '$200 Cash', icon: '💵', reward: { type: 'cash', val: 200 }, color: '#f43f5e' },
      { text: 'Express Surge $250', icon: '🛵', reward: { type: 'cash', val: 250 }, color: '#eab308' }
    ];

    this.doughTossScore = 0;
    this.doughIndicatorPos = 0;
    this.doughIndicatorSpeed = 1.6;
    this.doughIndicatorDir = 1;
    this.isDoughModalOpen = false;

    // Step 12: Selected Theme & Jukebox Track
    this.selectedTheme = 'classic';
    this.selectedTrack = 'classic';

    // Step 14: Weather & Time of Day State
    this.weatherIdx = 0;
    this.weatherTimer = 45.0;

    this.lastTime = performance.now();

    this.initThree();
    this.initEntities();
    this.initControls();
    this.initUpgradeModal();
    this.initRoadmapModal();
    this.initSpinWheelModal();
    this.initDoughTossModal();
    this.initCustomizerModal();
    this.initWeatherWidget();
    this.initCitiesAndPrestigeModal();
    this.initBattlePassModal();

    // Step 16: Idle Earnings & Save System
    this.idleSave = new IdleEarningsAndSaveSystem(this);
    this.idleSave.loadGame();
    this.idleSave.calculateOfflineEarnings();

    this.updateHUD();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeafe);
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.006);

    this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(10.0, 25.0, 18.0);
    this.cameraTarget = new THREE.Vector3(0, 1.0, 0);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Hemisphere Ambient (Bright Sunny Daylight)
    this.ambientLight = new THREE.HemisphereLight(0xffffff, 0xffedd5, 1.45);
    this.scene.add(this.ambientLight);

    // Primary Key Sun Light (Warm Golden Sunlight)
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.15);
    this.dirLight.position.set(18, 34, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left = -35;
    this.dirLight.shadow.camera.right = 35;
    this.dirLight.shadow.camera.top = 35;
    this.dirLight.shadow.camera.bottom = -35;
    this.scene.add(this.dirLight);

    // Warm Golden Sun Bounce Light
    this.rimLight = new THREE.DirectionalLight(0xfef08a, 0.45);
    this.rimLight.position.set(-20, 22, -18);
    this.scene.add(this.rimLight);

    // Soft White Fill Light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    this.fillLight.position.set(20, 16, 20);
    this.scene.add(this.fillLight);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initEntities() {
    this.player = new Player3D(this.scene);
    this.restaurant = new Restaurant3D(this.scene);
    this.cityManager = new CityManager3D(this.scene, this.restaurant, this);
    this.battlePass = new BattlePassAndQuests(this);
    this.vfx = new CinematicVFXManager3D(this.scene, this.camera);
    this.perfOpt = new PerformanceOptimizer3D(this.renderer, this.scene, this.camera, this);
  }


  initControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      window.arcadeAudio.init();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const joyZone = document.getElementById('joystick-zone');
    const joyBase = document.getElementById('joystick-base');
    const joyKnob = document.getElementById('joystick-knob');

    const handleStart = (clientX, clientY) => {
      this.joystickActive = true;
      this.joystickCenter = { x: clientX, y: clientY };

      joyBase.style.left = `${clientX}px`;
      joyBase.style.top = `${clientY}px`;
      joyBase.style.display = 'block';

      joyKnob.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;
      window.arcadeAudio.init();
    };

    const handleMove = (clientX, clientY) => {
      if (!this.joystickActive) return;

      const dx = clientX - this.joystickCenter.x;
      const dy = clientY - this.joystickCenter.y;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 55;

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;
      joyKnob.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;

      this.inputVector.set(dx / maxRadius, dy / maxRadius);
      if (this.inputVector.length() > 1.0) {
        this.inputVector.normalize();
      }
    };

    const handleEnd = () => {
      this.joystickActive = false;
      this.inputVector.set(0, 0);
      joyBase.style.display = 'none';
    };

    joyZone.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleEnd);

    joyZone.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', handleEnd);

    const soundBtn = document.getElementById('btn-sound');
    soundBtn.addEventListener('click', () => {
      const on = window.arcadeAudio.toggleMute();
      soundBtn.textContent = on ? '🔊' : '🔇';
    });
  }

  // Step 15: Cities & Prestige Modal
  initCitiesAndPrestigeModal() {
    const modal = document.getElementById('modal-prestige');
    const openBtn = document.getElementById('btn-cities');
    const closeBtn = document.getElementById('btn-close-prestige');
    const prestigeBtn = document.getElementById('btn-do-prestige');
    const trophyPill = document.getElementById('hud-trophy-pill');

    const openModal = () => {
      this.renderCities();
      const earned = this.cityManager.calculatePrestigeTrophies(this.cash);
      const calcEl = document.getElementById('prestige-calc-trophies');
      if (calcEl) calcEl.textContent = `${earned} Golden Trophies`;
      modal.classList.add('active');
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (trophyPill) trophyPill.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (prestigeBtn) {
      prestigeBtn.addEventListener('click', () => {
        if (this.cityManager.executePrestige(this)) {
          this.vfx.triggerConfettiBurst(this.player.mesh.position, 150);
          modal.classList.remove('active');
        }
      });
    }
  }

  renderCities() {
    const container = document.getElementById('cities-list-container');
    if (!container) return;
    container.innerHTML = '';

    this.cityManager.cities.forEach(city => {
      const isCur = (this.cityManager.currentCityId === city.id);
      const card = document.createElement('div');
      card.className = `city-card ${isCur ? 'active' : ''}`;
      card.innerHTML = `
        <div>
          <div class="city-header">
            <span class="city-icon">${city.icon}</span>
            <div>
              <div class="city-name">${city.name}</div>
              <div class="city-tagline">${city.tagline}</div>
            </div>
          </div>
          <div class="city-meta" style="margin-top: 10px;">
            <span>Revenue: ${city.multiplier}X</span>
            <span>Specialty: ${city.specialty}</span>
          </div>
        </div>
        <button class="city-action-btn ${isCur ? 'selected' : ''}" ${!city.unlocked && this.cash < city.requiredCost ? 'disabled' : ''}>
          ${isCur ? 'OPERATING HERE ✓' : city.unlocked ? 'FLY TO CITY ✈️' : `UNLOCK $${city.requiredCost}`}
        </button>
      `;

      const btn = card.querySelector('.city-action-btn');
      btn.addEventListener('click', () => {
        if (!city.unlocked) {
          if (this.cash >= city.requiredCost) {
            this.cash -= city.requiredCost;
            city.unlocked = true;
            this.cityManager.switchCity(city.id);
            this.vfx.triggerConfettiBurst(this.player.mesh.position, 120);
            this.updateHUD();
            this.renderCities();
          }
        } else {
          this.cityManager.switchCity(city.id);
          this.renderCities();
        }
      });

      container.appendChild(card);
    });
  }

  // Step 17: Season 1 Battle Pass Modal
  initBattlePassModal() {
    const modal = document.getElementById('modal-battlepass');
    const openBtn = document.getElementById('btn-battlepass');
    const closeBtn = document.getElementById('btn-close-battlepass');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.renderBattlePass();
        modal.classList.add('active');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
  }

  renderBattlePass() {
    const tierBadge = document.getElementById('pass-tier-display');
    const xpFill = document.getElementById('pass-xp-fill');
    const xpLabel = document.getElementById('pass-xp-text');

    const curTier = this.battlePass.currentSeasonTier;
    const curXP = this.battlePass.currentXP;
    const tierXP = curXP % this.battlePass.xpPerTier;
    const pct = (tierXP / this.battlePass.xpPerTier) * 100;

    if (tierBadge) tierBadge.textContent = `TIER ${curTier}`;
    if (xpFill) xpFill.style.width = `${pct}%`;
    if (xpLabel) xpLabel.textContent = `${tierXP} / ${this.battlePass.xpPerTier} XP`;

    // Render Daily Quests
    const questsContainer = document.getElementById('quests-list-container');
    if (questsContainer) {
      questsContainer.innerHTML = '';
      this.battlePass.dailyQuests.forEach(q => {
        const card = document.createElement('div');
        card.className = `quest-card ${q.completed ? 'completed' : ''}`;
        card.innerHTML = `
          <div>
            <div class="quest-title">${q.title} (${q.current}/${q.target})</div>
            <div class="quest-desc">${q.desc}</div>
            <div class="quest-rewards">Rewards: +$${q.cashReward} & +${q.xpReward} XP</div>
          </div>
          <button class="quest-claim-btn" ${!q.completed || q.claimed ? 'disabled' : ''}>
            ${q.claimed ? 'CLAIMED ✓' : q.completed ? 'CLAIM!' : 'IN PROGRESS'}
          </button>
        `;

        const btn = card.querySelector('.quest-claim-btn');
        btn.addEventListener('click', () => {
          if (this.battlePass.claimQuest(q.id)) {
            this.vfx.triggerConfettiBurst(this.player.mesh.position, 80);
            this.renderBattlePass();
            this.updateHUD();
          }
        });

        questsContainer.appendChild(card);
      });
    }

    // Render Tiers
    const tiersContainer = document.getElementById('tiers-list-container');
    if (tiersContainer) {
      tiersContainer.innerHTML = '';
      this.battlePass.tiers.forEach(t => {
        const isUnlocked = curTier >= t.tier;
        const card = document.createElement('div');
        card.className = `tier-card ${isUnlocked ? 'unlocked' : ''}`;
        card.innerHTML = `
          <div class="tier-num">TIER ${t.tier}</div>
          <div class="tier-reward-icon">🎁</div>
          <div class="tier-reward-name">${t.freeReward.label}</div>
          <button class="tier-claim-btn" ${!isUnlocked || t.claimedFree ? 'disabled' : ''}>
            ${t.claimedFree ? 'CLAIMED ✓' : isUnlocked ? 'CLAIM' : 'LOCKED 🔒'}
          </button>
        `;

        const btn = card.querySelector('.tier-claim-btn');
        btn.addEventListener('click', () => {
          if (this.battlePass.claimTierReward(t.tier, false)) {
            this.vfx.triggerConfettiBurst(this.player.mesh.position, 90);
            this.renderBattlePass();
            this.updateHUD();
          }
        });

        tiersContainer.appendChild(card);
      });
    }
  }

  // Weather & Time Switcher
  initWeatherWidget() {
    const btn = document.getElementById('btn-weather-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      this.weatherIdx = (this.weatherIdx + 1) % window.TYCOON_CONFIG.weatherPresets.length;
      this.weatherTimer = 45.0;
      this.updateWeatherUI();
      window.arcadeAudio.playBoxPickup();
    });

    this.updateWeatherUI();
  }

  updateWeatherUI() {
    const preset = window.TYCOON_CONFIG.weatherPresets[this.weatherIdx];
    const iconEl = document.getElementById('weather-icon');
    const textEl = document.getElementById('weather-text');
    if (iconEl && textEl && preset) {
      iconEl.textContent = preset.icon;
      textEl.textContent = preset.timeText;
    }
  }

  initCustomizerModal() {
    const modal = document.getElementById('modal-customizer');
    const openBtn = document.getElementById('btn-customize');
    const closeBtn = document.getElementById('btn-close-customize');

    openBtn.addEventListener('click', () => {
      this.renderCustomizer();
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  renderCustomizer() {
    const themeContainer = document.getElementById('themes-list-container');
    themeContainer.innerHTML = '';

    window.TYCOON_CONFIG.storeThemes.forEach(theme => {
      const isSelected = (this.selectedTheme === theme.id);
      const isUnlocked = theme.unlocked;

      const card = document.createElement('div');
      card.className = `theme-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="theme-header">
          <span class="theme-icon">${theme.icon}</span>
          <div>
            <div class="theme-name">${theme.name}</div>
            <div class="theme-preview-palette">
              <div class="theme-swatch" style="background: #${theme.floorColor.toString(16).padStart(6, '0')}"></div>
              <div class="theme-swatch" style="background: #${theme.carpetColor.toString(16).padStart(6, '0')}"></div>
              <div class="theme-swatch" style="background: #${theme.wallColor.toString(16).padStart(6, '0')}"></div>
            </div>
          </div>
        </div>
        <button class="theme-action-btn ${isSelected ? 'selected' : ''}" ${!isUnlocked && this.cash < theme.cost ? 'disabled' : ''}>
          ${isSelected ? 'ACTIVE ✓' : isUnlocked ? 'APPLY THEME' : `UNLOCK $${theme.cost}`}
        </button>
      `;

      const btn = card.querySelector('.theme-action-btn');
      btn.addEventListener('click', () => {
        if (!isUnlocked) {
          if (this.cash >= theme.cost) {
            this.cash -= theme.cost;
            theme.unlocked = true;
            this.selectedTheme = theme.id;
            this.restaurant.applyStoreTheme(theme.id);
            this.updateHUD();
            this.renderCustomizer();
            window.arcadeAudio.playUnlock();
          }
        } else {
          this.selectedTheme = theme.id;
          this.restaurant.applyStoreTheme(theme.id);
          this.renderCustomizer();
          window.arcadeAudio.playBoxPickup();
        }
      });

      themeContainer.appendChild(card);
    });

    const jukeContainer = document.getElementById('jukebox-list-container');
    jukeContainer.innerHTML = '';

    window.TYCOON_CONFIG.jukeboxTracks.forEach(track => {
      const isPlaying = (this.selectedTrack === track.id);

      const card = document.createElement('div');
      card.className = `jukebox-card ${isPlaying ? 'active' : ''}`;
      card.innerHTML = `
        <div class="jukebox-header">
          <span class="jukebox-icon">${track.icon}</span>
          <span class="jukebox-name">${track.name}</span>
        </div>
        <button class="jukebox-action-btn ${isPlaying ? 'selected' : ''}">
          ${isPlaying ? 'PLAYING 🎵' : 'PLAY TRACK'}
        </button>
      `;

      const btn = card.querySelector('.jukebox-action-btn');
      btn.addEventListener('click', () => {
        this.selectedTrack = track.id;
        window.arcadeAudio.changeTrack(track.id);
        this.renderCustomizer();
      });

      jukeContainer.appendChild(card);
    });
  }

  initSpinWheelModal() {
    const modal = document.getElementById('modal-spin-wheel');
    const openBtn = document.getElementById('btn-spin');
    const closeBtn = document.getElementById('btn-close-spin');
    const spinBtn = document.getElementById('btn-do-spin');
    const resultBanner = document.getElementById('wheel-result-banner');

    openBtn.addEventListener('click', () => {
      this.drawWheelCanvas();
      resultBanner.textContent = '';
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    spinBtn.addEventListener('click', () => {
      if (this.isSpinning) return;
      this.isSpinning = true;
      spinBtn.disabled = true;
      resultBanner.textContent = 'Spinning... 🍀';

      this.wheelVelocity = 18.0 + Math.random() * 8.0;
      window.arcadeAudio.playBoxPickup();

      const spinInterval = setInterval(() => {
        this.wheelRotation += this.wheelVelocity * 0.05;
        this.wheelVelocity *= 0.98;
        this.drawWheelCanvas();

        if (this.wheelVelocity < 0.05) {
          clearInterval(spinInterval);
          this.isSpinning = false;
          spinBtn.disabled = false;

          const numSlices = this.wheelPrizes.length;
          const sliceAngle = (Math.PI * 2) / numSlices;
          const normalizedAngle = (this.wheelRotation + Math.PI / 2) % (Math.PI * 2);
          const prizeIndex = Math.floor((Math.PI * 2 - (normalizedAngle < 0 ? normalizedAngle + Math.PI * 2 : normalizedAngle)) / sliceAngle) % numSlices;
          
          const wonPrize = this.wheelPrizes[prizeIndex];
          resultBanner.textContent = `🎉 WON: ${wonPrize.icon} ${wonPrize.text}!`;

          if (wonPrize.reward.type === 'cash') {
            this.addCash(wonPrize.reward.val);
            this.vfx.triggerConfettiBurst(this.player.mesh.position, 100);
          } else if (wonPrize.reward.type === 'speed') {
            this.triggerRushHour();
          }
        }
      }, 20);
    });
  }

  drawWheelCanvas() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 8;
    const numSlices = this.wheelPrizes.length;
    const sliceAngle = (Math.PI * 2) / numSlices;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.wheelRotation);

    this.wheelPrizes.forEach((prize, i) => {
      const angle = i * sliceAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Nunito, sans-serif';
      ctx.fillText(`${prize.icon} ${prize.text}`, radius - 15, 4);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  initDoughTossModal() {
    const modal = document.getElementById('modal-dough-toss');
    const openBtn = document.getElementById('btn-dough');
    const closeBtn = document.getElementById('btn-close-dough');
    const tossBtn = document.getElementById('btn-do-toss');
    const doughVisual = document.getElementById('dough-visual');
    const scoreDisplay = document.getElementById('toss-score-display');
    const indicator = document.getElementById('toss-indicator');

    openBtn.addEventListener('click', () => {
      this.doughTossScore = 0;
      scoreDisplay.textContent = `0 / 3 Perfect Tosses`;
      this.isDoughModalOpen = true;
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
      this.isDoughModalOpen = false;
      modal.classList.remove('active');
    });

    tossBtn.addEventListener('click', () => {
      doughVisual.classList.add('tossed');
      setTimeout(() => doughVisual.classList.remove('tossed'), 250);

      if (this.doughIndicatorPos >= 38 && this.doughIndicatorPos <= 62) {
        this.doughTossScore += 1;
        window.arcadeAudio.playBoxPickup();
        scoreDisplay.textContent = `${this.doughTossScore} / 3 Perfect Tosses! ⭐`;

        if (this.doughTossScore >= 3) {
          this.vfx.triggerConfettiBurst(this.player.mesh.position, 120);
          this.addCash(250);
          this.battlePass.trackAction('dough_toss', 1);
          this.showFloatingText('🌟 GOLDEN PIZZA MASTER! +$250', 0, 0);
          scoreDisplay.textContent = `🎉 MASTERED! +$250 BONUS!`;
          setTimeout(() => {
            this.isDoughModalOpen = false;
            modal.classList.remove('active');
          }, 1200);
        }
      } else {
        window.arcadeAudio.playTrashDump();
        scoreDisplay.textContent = `❌ Missed Timing! Try again!`;
      }
    });

    setInterval(() => {
      if (!this.isDoughModalOpen) return;
      this.doughIndicatorPos += this.doughIndicatorSpeed * this.doughIndicatorDir;
      if (this.doughIndicatorPos >= 92) {
        this.doughIndicatorPos = 92;
        this.doughIndicatorDir = -1;
      } else if (this.doughIndicatorPos <= 2) {
        this.doughIndicatorPos = 2;
        this.doughIndicatorDir = 1;
      }
      if (indicator) {
        indicator.style.left = `${this.doughIndicatorPos}%`;
      }
    }, 16);
  }

  initUpgradeModal() {
    const modal = document.getElementById('modal-upgrade');
    const openBtn = document.getElementById('btn-hr');
    const closeBtn = document.getElementById('btn-close-upgrade');

    openBtn.addEventListener('click', () => {
      this.renderUpgrades();
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  initRoadmapModal() {
    const modal = document.getElementById('modal-roadmap');
    const openBtn = document.getElementById('btn-open-roadmap');
    const closeBtn = document.getElementById('btn-close-roadmap');
    const container = document.getElementById('roadmap-list-container');

    const renderRoadmap = () => {
      container.innerHTML = '';
      window.TYCOON_CONFIG.roadmap.forEach(item => {
        const div = document.createElement('div');
        const isCurrent = (item.step === window.TYCOON_CONFIG.currentMilestone);
        const isCompleted = (item.step < window.TYCOON_CONFIG.currentMilestone);

        div.className = `roadmap-item ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`;
        div.innerHTML = `
          <div class="roadmap-num-badge">${isCompleted ? '✓' : item.step}</div>
          <div class="roadmap-text">
            <div class="roadmap-title">Step ${item.step}: ${item.title}</div>
            <div class="roadmap-desc">${item.desc}</div>
          </div>
          <div class="roadmap-status-tag">${isCurrent ? 'ACTIVE' : isCompleted ? 'COMPLETED' : 'UPCOMING'}</div>
        `;
        container.appendChild(div);
      });
    };

    openBtn.addEventListener('click', () => {
      renderRoadmap();
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  renderUpgrades() {
    const container = document.getElementById('upgrade-list-container');
    container.innerHTML = '';

    window.TYCOON_CONFIG.upgrades.forEach(upg => {
      const cost = Math.round(upg.baseCost * Math.pow(upg.costMultiplier, upg.level - 1));
      const isMax = (upg.level >= upg.maxLevel);

      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-info">
          <span class="upgrade-icon">${upg.icon}</span>
          <div>
            <div class="upgrade-title">${upg.title}</div>
            <div class="upgrade-desc">${upg.desc}</div>
            <div class="upgrade-level">Level ${upg.level}/${upg.maxLevel}</div>
          </div>
        </div>
        <button class="upgrade-buy-btn" ${isMax || this.cash < cost ? 'disabled' : ''}>
          ${isMax ? 'MAX' : `$${cost}`}
        </button>
      `;

      const buyBtn = card.querySelector('.upgrade-buy-btn');
      buyBtn.addEventListener('click', () => {
        if (!isMax && this.cash >= cost) {
          this.cash -= cost;
          upg.level += 1;
          this.applyUpgrade(upg.id, upg.level);
          this.updateHUD();
          this.renderUpgrades();
          window.arcadeAudio.playUnlock();
        }
      });

      container.appendChild(card);
    });
  }

  applyUpgrade(id, level) {
    if (id === 'player_capacity') {
      this.player.maxCapacity = window.TYCOON_CONFIG.player.baseCapacity + (level - 1) * window.TYCOON_CONFIG.player.capacityPerLevel;
      this.player.updateHUD();
    } else if (id === 'player_speed') {
      this.player.speed = window.TYCOON_CONFIG.player.baseSpeed + (level - 1) * window.TYCOON_CONFIG.player.speedPerLevel;
    } else if (id === 'cashier_efficiency') {
      window.TYCOON_CONFIG.specializedStaff.cashier.speed = 1.0 + (level - 1) * 0.35;
    } else if (id === 'chef_mastery') {
      window.TYCOON_CONFIG.specializedStaff.chef.cookBoost = 1.5 + (level - 1) * 0.4;
    } else if (id === 'cleaner_speed') {
      if (this.restaurant.cleaner) {
        this.restaurant.cleaner.speed = 8.5 + (level - 1) * 1.5;
      }
    }
  }

  spawnFlyingCoins(startX, startY, count = 4) {
    const cashPill = document.getElementById('hud-cash-pill');
    if (!cashPill) return;
    const pillRect = cashPill.getBoundingClientRect();
    const targetX = pillRect.left + pillRect.width / 2;
    const targetY = pillRect.top + pillRect.height / 2;

    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'flying-gold-coin';
      coin.textContent = '🪙';
      coin.style.position = 'fixed';
      coin.style.left = `${startX + (Math.random() - 0.5) * 40}px`;
      coin.style.top = `${startY + (Math.random() - 0.5) * 40}px`;
      coin.style.zIndex = '200';
      coin.style.fontSize = '1.4rem';
      coin.style.pointerEvents = 'none';
      coin.style.transition = `all ${0.45 + i * 0.08}s cubic-bezier(0.25, 1, 0.5, 1)`;
      document.body.appendChild(coin);

      requestAnimationFrame(() => {
        coin.style.transform = 'scale(1.2)';
        coin.style.left = `${targetX}px`;
        coin.style.top = `${targetY}px`;
        coin.style.opacity = '0.4';
      });

      setTimeout(() => {
        coin.remove();
        if (i === count - 1) {
          cashPill.classList.add('bounce');
          setTimeout(() => cashPill.classList.remove('bounce'), 150);
        }
      }, 550 + i * 80);
    }
  }

  addCash(amount) {
    const cityMult = this.cityManager ? this.cityManager.getMultiplier() : 1.0;
    const finalVal = Math.round(amount * cityMult);

    this.cash += finalVal;
    if (this.battlePass) this.battlePass.addXP(Math.round(finalVal / 4));
    this.updateHUD();

    const spawnX = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
    const spawnY = window.innerHeight / 2 + (Math.random() - 0.5) * 60;

    const floater = document.createElement('div');
    floater.className = 'cash-floater';
    floater.textContent = `+$${finalVal}`;
    floater.style.left = `${spawnX}px`;
    floater.style.top = `${spawnY}px`;
    this.uiFloatersLayer.appendChild(floater);
    setTimeout(() => floater.remove(), 800);

    this.spawnFlyingCoins(spawnX, spawnY, 4);
  }

  showFloatingText(text, worldX, worldZ) {
    const pos = new THREE.Vector3(worldX, this.player.mesh.position.y + 2.0, worldZ);
    const screen = this.toScreenXY(pos);
    if (screen.visible) {
      const floater = document.createElement('div');
      floater.className = 'cash-floater';
      floater.style.color = '#38bdf8';
      floater.textContent = text;
      floater.style.left = `${screen.x}px`;
      floater.style.top = `${screen.y}px`;
      this.uiFloatersLayer.appendChild(floater);
      setTimeout(() => floater.remove(), 900);
    }
  }

  triggerRushHour() {
    this.isRushHourActive = true;
    this.rushHourTimer = window.TYCOON_CONFIG.rushHour.duration || 35.0;
    this.player.speed = window.TYCOON_CONFIG.player.baseSpeed * (window.TYCOON_CONFIG.rushHour.speedBoostMultiplier || 1.25);
    this.vfx.triggerScreenShake(0.4, 0.5);
    window.arcadeAudio.playRushHourStart();
    this.showFloatingText('🔥 2X LUNCH RUSH HOUR STARTED!', 0, 0);
  }

  endRushHour() {
    this.isRushHourActive = false;
    this.rushHourCooldown = window.TYCOON_CONFIG.rushHour.interval || 80.0;
    this.player.speed = window.TYCOON_CONFIG.player.baseSpeed;
    this.showFloatingText('⚡ Rush Hour Ended!', 0, 0);
  }

  updateHUD() {
    const cashVal = document.getElementById('cash-val');
    if (cashVal) cashVal.textContent = `$${this.cash}`;

    const trophyEl = document.getElementById('trophy-count-display');
    if (trophyEl && this.cityManager) trophyEl.textContent = `${this.cityManager.goldenTrophies}`;

    const cashPill = document.getElementById('hud-cash-pill');
    if (cashPill) {
      cashPill.classList.add('bounce');
      setTimeout(() => cashPill.classList.remove('bounce'), 150);
    }

    const tag = document.querySelector('.tracker-step-tag');
    const title = document.querySelector('.tracker-step-title');
    if (tag && title) {
      const cur = window.TYCOON_CONFIG.roadmap.find(r => r.step === window.TYCOON_CONFIG.currentMilestone);
      if (cur) {
        tag.textContent = `MILESTONE ${cur.step}/20`;
        title.textContent = this.isRushHourActive ? `🔥 2X RUSH: ${Math.ceil(this.rushHourTimer)}s` : cur.title;
      }
    }
  }

  toScreenXY(pos3D) {
    const v = pos3D.clone();
    v.project(this.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(v.y * 0.5) + 0.5) * window.innerHeight;
    return { x, y, visible: v.z < 1.0 };
  }

  updateWorldUI() {
    this.worldUiLayer.innerHTML = '';

    // 1. Storage Rack Item Tag
    if (this.player.currentFloor === 1) {
      const rackPos = new THREE.Vector3(window.TYCOON_CONFIG.storageRack.position.x, 2.6, window.TYCOON_CONFIG.storageRack.position.z);
      const rackScreen = this.toScreenXY(rackPos);
      if (rackScreen.visible) {
        const rackTag = document.createElement('div');
        rackTag.className = 'world-order-bubble';
        rackTag.style.borderColor = '#f59e0b';
        rackTag.innerHTML = `📦 <strong>Stash Shelf</strong> (${this.restaurant.storageRackItems.length}/${window.TYCOON_CONFIG.storageRack.maxCapacity})`;
        rackTag.style.left = `${rackScreen.x}px`;
        rackTag.style.top = `${rackScreen.y}px`;
        this.worldUiLayer.appendChild(rackTag);
      }
    }

    // 2. Counter Customer Order Bubbles
    this.restaurant.customers.filter(c => c.state === 'WAITING' && !c.isOrderFulfilled()).forEach(cust => {
      const is2FCust = cust.targetData && cust.targetData.is2F;
      if ((is2FCust && this.player.currentFloor === 2) || (!is2FCust && this.player.currentFloor === 1)) {
        const headPos = cust.mesh.position.clone().add(new THREE.Vector3(0, 2.4, 0));
        const screen = this.toScreenXY(headPos);

        if (screen.visible) {
          const bubble = document.createElement('div');
          bubble.className = 'world-order-bubble';
          if (cust.isCritic) bubble.style.borderColor = '#a855f7';
          bubble.innerHTML = cust.getOrderHtml();
          bubble.style.left = `${screen.x}px`;
          bubble.style.top = `${screen.y}px`;
          this.worldUiLayer.appendChild(bubble);
        }
      }
    });

    // 3. Scooter Delivery Fleet Bubble
    if (this.player.currentFloor === 1 && this.restaurant.scooter && this.restaurant.scooter.state === 'WAITING_FOR_PACKING') {
      const scooterPos = this.restaurant.scooter.mesh.position.clone().add(new THREE.Vector3(0, 2.6, 0));
      const screen = this.toScreenXY(scooterPos);
      if (screen.visible) {
        const bubble = document.createElement('div');
        bubble.className = 'world-order-bubble';
        bubble.style.borderColor = '#ef4444';
        bubble.innerHTML = this.restaurant.scooter.getOrderHtml();
        bubble.style.left = `${screen.x}px`;
        bubble.style.top = `${screen.y}px`;
        this.worldUiLayer.appendChild(bubble);
      }
    }

    // 4. Dirty Table Clean Tags
    window.TYCOON_CONFIG.tables.filter(t => t.unlocked && t.isDirty).forEach(table => {
      const is2FTable = table.is2F;
      if ((is2FTable && this.player.currentFloor === 2) || (!is2FTable && this.player.currentFloor === 1)) {
        const tablePos = new THREE.Vector3(table.position.x, (table.position.y || 0) + 2.2, table.position.z);
        const screen = this.toScreenXY(tablePos);
        if (screen.visible) {
          const tag = document.createElement('div');
          tag.className = 'world-order-bubble';
          tag.style.borderColor = '#eab308';
          tag.innerHTML = `🧹 <strong>Clean Table!</strong>`;
          tag.style.left = `${screen.x}px`;
          tag.style.top = `${screen.y}px`;
          this.worldUiLayer.appendChild(tag);
        }
      }
    });

    // 5. Drive-Thru Vehicle Bubbles
    if (this.player.currentFloor === 1) {
      this.restaurant.driveThruCars.filter(car => car.state === 'WAITING').forEach(car => {
        const carPos = car.mesh.position.clone().add(new THREE.Vector3(0, 2.6, 0));
        const screen = this.toScreenXY(carPos);
        if (screen.visible) {
          const bubble = document.createElement('div');
          bubble.className = 'world-order-bubble';
          bubble.innerHTML = car.getOrderHtml();
          bubble.style.left = `${screen.x}px`;
          bubble.style.top = `${screen.y}px`;
          this.worldUiLayer.appendChild(bubble);
        }
      });
    }

    // 6. Only Active Sequential Unlock Pad Badge
    this.restaurant.unlockZones.filter(z => z.isActive && !z.isUnlocked).forEach(zone => {
      const is2FZone = (zone.position.y && zone.position.y > 3.0);
      if ((is2FZone && this.player.currentFloor === 2) || (!is2FZone && this.player.currentFloor === 1)) {
        const zonePos = new THREE.Vector3(zone.position.x, (zone.position.y || 0) + 1.2, zone.position.z);
        const screen = this.toScreenXY(zonePos);

        if (screen.visible) {
          const tag = document.createElement('div');
          tag.className = 'world-unlock-tag';
          tag.innerHTML = `🟢 ${zone.title}<br><strong>$${zone.remainingCost}</strong>`;
          tag.style.left = `${screen.x}px`;
          tag.style.top = `${screen.y}px`;
          this.worldUiLayer.appendChild(tag);
        }
      }
    });
  }

  spawnCustomerRoutines(delta) {
    if (this.isRushHourActive) {
      this.rushHourTimer -= delta;
      if (this.rushHourTimer <= 0) {
        this.endRushHour();
      }
    } else {
      this.rushHourCooldown -= delta;
      if (this.rushHourCooldown <= 0) {
        this.triggerRushHour();
      }
    }

    this.customerSpawnTimer += delta;
    const spawnRate = this.isRushHourActive ? window.TYCOON_CONFIG.rushHour.customerSpawnInterval : 3.0;
    const counterCustCount = this.restaurant.customers.filter(c => c.type === 'counter' && c.state !== 'LEAVING').length;

    if (this.customerSpawnTimer >= spawnRate && counterCustCount < window.TYCOON_CONFIG.counter.maxQueueLength) {
      this.customerSpawnTimer = 0;
      const cust = new Customer3D(this.scene, 'counter', null, this.restaurant);
      const queueIndex = counterCustCount;
      cust.queueIndex = queueIndex;
      const targetZ = window.TYCOON_CONFIG.counter.customerQueueStart.z + queueIndex * window.TYCOON_CONFIG.counter.customerQueueSpacing;
      cust.setTargetPosition(window.TYCOON_CONFIG.counter.position.x, targetZ);
      this.restaurant.customers.push(cust);
    }

    this.criticSpawnTimer += delta;
    if (this.criticSpawnTimer >= (window.TYCOON_CONFIG.foodCritic.spawnInterval || 90.0)) {
      const freeCleanTable = window.TYCOON_CONFIG.tables.find(t => t.unlocked && !t.occupiedBy && !t.isDirty);
      if (freeCleanTable) {
        this.criticSpawnTimer = 0;
        freeCleanTable.occupiedBy = true;
        const critic = new FoodCritic3D(this.scene, freeCleanTable, this.restaurant);
        critic.setTargetPosition(freeCleanTable.position.x, freeCleanTable.position.z + 0.9);
        freeCleanTable.occupiedBy = critic;
        this.restaurant.customers.push(critic);
        this.showFloatingText('⭐ VIP CRITIC ARRIVED!', freeCleanTable.position.x, freeCleanTable.position.z);
        window.arcadeAudio.playVipReward();
      }
    }

    const freeCleanTable = window.TYCOON_CONFIG.tables.find(t => t.unlocked && !t.occupiedBy && !t.isDirty);
    const tableChance = this.isRushHourActive ? 0.05 : 0.02;
    if (freeCleanTable && Math.random() < tableChance) {
      freeCleanTable.occupiedBy = true;
      const cust = new Customer3D(this.scene, 'table', freeCleanTable, this.restaurant);
      cust.mesh.position.y = freeCleanTable.position.y || 0;
      cust.setTargetPosition(freeCleanTable.position.x, freeCleanTable.position.z + 0.9);
      freeCleanTable.occupiedBy = cust;
      this.restaurant.customers.push(cust);
    }

    if (window.TYCOON_CONFIG.drivethru.lane1.unlocked) {
      const lane1Car = this.restaurant.driveThruCars.find(c => c.lane === 1 && c.state !== 'LEAVING');
      if (!lane1Car) {
        this.carSpawnTimerLane1 += delta;
        if (this.carSpawnTimerLane1 >= window.TYCOON_CONFIG.drivethru.lane1.spawnInterval) {
          this.carSpawnTimerLane1 = 0;
          this.restaurant.driveThruCars.push(new DriveThruCar3D(this.scene, 1));
        }
      }
    }

    if (window.TYCOON_CONFIG.drivethru.lane2.unlocked) {
      const lane2Car = this.restaurant.driveThruCars.find(c => c.lane === 2 && c.state !== 'LEAVING');
      if (!lane2Car) {
        this.carSpawnTimerLane2 += delta;
        if (this.carSpawnTimerLane2 >= window.TYCOON_CONFIG.drivethru.lane2.spawnInterval) {
          this.carSpawnTimerLane2 = 0;
          this.restaurant.driveThruCars.push(new DriveThruCar3D(this.scene, 2));
        }
      }
    }
  }

  animate(time) {
    requestAnimationFrame(this.animate);

    const delta = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    // Weather & Day/Night Cycling
    this.weatherTimer -= delta;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 50.0;
      this.weatherIdx = (this.weatherIdx + 1) % window.TYCOON_CONFIG.weatherPresets.length;
      this.updateWeatherUI();
    }
    const currentPreset = window.TYCOON_CONFIG.weatherPresets[this.weatherIdx];
    this.restaurant.updateWeather(currentPreset, delta, this.dirLight, this.ambientLight);

    let moveX = this.inputVector.x;
    let moveY = this.inputVector.y;

    if (!this.joystickActive) {
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveY -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveY += 1;
    }

    const currentInput = new THREE.Vector2(moveX, moveY);
    if (currentInput.lengthSq() > 1.0) currentInput.normalize();

    this.player.update(delta, currentInput);
    this.restaurant.update(delta, this.player, this);
    this.spawnCustomerRoutines(delta);
    if (this.cityManager) this.cityManager.update(delta);
    if (this.vfx) this.vfx.update(delta);
    if (this.perfOpt) this.perfOpt.update(time, delta);

    const camBaseY = (this.player.currentFloor === 2) ? 32.0 : 25.0;
    const targetCamX = this.player.mesh.position.x * 0.55 + 10.0;
    const targetCamZ = this.player.mesh.position.z * 0.55 + 18.0;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 6.0 * delta);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, 6.0 * delta);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, camBaseY, 6.0 * delta);

    this.cameraTarget.set(this.player.mesh.position.x * 0.55, 1.0, this.player.mesh.position.z * 0.55);
    this.camera.lookAt(this.cameraTarget);

    this.renderer.render(this.scene, this.camera);
    this.updateHUD();
    this.updateWorldUI();
  }
}

window.PizzaReadyGame = PizzaReadyGame;

function startPizzaReadyGame() {
  if (!window.tycoonGame) {
    window.tycoonGame = new PizzaReadyGame();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPizzaReadyGame);
} else {
  startPizzaReadyGame();
}


/**
 * Pizza Ready! 3D Tycoon - Offline Idle Earnings Simulator & LocalStorage Save Engine
 * Unity Portability: Maps to IdleEarningsManager.cs, SaveSystem.cs
 */

class IdleEarningsAndSaveSystem {
  constructor(game) {
    this.game = game;
    this.saveKey = 'pizza_ready_tycoon_v3_save';
    this.autoSaveInterval = 3000; // auto-save every 3 seconds
    this.pendingIdleEarnings = 0;
    this.offlineMinutes = 0;

    this.initAutoSave();
  }

  calculateOfflineEarnings() {
    const raw = localStorage.getItem(this.saveKey);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (!data || !data.lastTimestamp) return;

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - data.lastTimestamp) / 1000);
      
      // If offline for more than 40 seconds
      if (elapsedSeconds > 40) {
        this.offlineMinutes = Math.min(720, Math.floor(elapsedSeconds / 60)); // Capped at 12 hours
        
        // Base rate per minute
        let ratePerMin = 15;
        if (data.staffCashier) ratePerMin += 20;
        if (data.staffChef) ratePerMin += 30;
        if (data.staffCleaner) ratePerMin += 15;
        if (data.scooterUnlocked) ratePerMin += 25;
        if (data.floor2Unlocked) ratePerMin += 40;

        const trophies = data.goldenTrophies || 0;
        const multiplier = 1.0 + (trophies * 0.25);

        this.pendingIdleEarnings = Math.round(this.offlineMinutes * ratePerMin * multiplier);
        if (this.pendingIdleEarnings > 25) {
          setTimeout(() => this.showOfflineEarningsModal(), 800);
        }
      }
    } catch (e) {
      console.warn("Save parse error:", e);
    }
  }

  showOfflineEarningsModal() {
    const modal = document.getElementById('modal-offline-earnings');
    const amountEl = document.getElementById('offline-cash-val');
    const timeEl = document.getElementById('offline-time-val');
    const claim1xBtn = document.getElementById('btn-claim-1x');
    const claim2xBtn = document.getElementById('btn-claim-2x');

    if (!modal) return;

    if (amountEl) amountEl.textContent = `$${this.pendingIdleEarnings}`;
    if (timeEl) timeEl.textContent = `${this.offlineMinutes} minutes`;

    modal.classList.add('active');

    claim1xBtn.onclick = () => {
      this.game.addCash(this.pendingIdleEarnings);
      window.arcadeAudio.playVipReward();
      modal.classList.remove('active');
      this.pendingIdleEarnings = 0;
    };

    claim2xBtn.onclick = () => {
      const doubleAmount = this.pendingIdleEarnings * 2;
      this.game.addCash(doubleAmount);
      window.arcadeAudio.playVipReward();
      this.game.showFloatingText(`🎉 2X EXECUTIVE BONUS! +$${doubleAmount}`, 0, 0);
      modal.classList.remove('active');
      this.pendingIdleEarnings = 0;
    };
  }

  saveGame() {
    const data = {
      cash: this.game.cash,
      lastTimestamp: Date.now(),
      upgrades: window.TYCOON_CONFIG.upgrades.map(u => ({ id: u.id, level: u.level })),
      themes: window.TYCOON_CONFIG.storeThemes.map(t => ({ id: t.id, unlocked: t.unlocked })),
      selectedTheme: this.game.selectedTheme,
      selectedTrack: this.game.selectedTrack,
      unlockedChain: window.TYCOON_CONFIG.unlockChain.map(u => ({ id: u.id, isUnlocked: (this.game.restaurant.unlockZones.find(z => z.id === u.id) || {}).isUnlocked })),
      staffCashier: window.TYCOON_CONFIG.specializedStaff.cashier.unlocked,
      staffChef: window.TYCOON_CONFIG.specializedStaff.chef.unlocked,
      staffCleaner: window.TYCOON_CONFIG.specializedStaff.cleaner.unlocked,
      scooterUnlocked: window.TYCOON_CONFIG.scooterStation.unlocked,
      floor2Unlocked: window.TYCOON_CONFIG.floor2.unlocked,
      goldenTrophies: (this.game.cityManager ? this.game.cityManager.goldenTrophies : 0),
      currentCity: (this.game.cityManager ? this.game.cityManager.currentCityId : 'chicago'),
      battlePassXP: (this.game.battlePass ? this.game.battlePass.currentXP : 0)
    };

    localStorage.setItem(this.saveKey, JSON.stringify(data));
  }

  loadGame() {
    const raw = localStorage.getItem(this.saveKey);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (!data) return;

      if (data.cash !== undefined) this.game.cash = data.cash;
      if (data.selectedTheme) {
        this.game.selectedTheme = data.selectedTheme;
        this.game.restaurant.applyStoreTheme(data.selectedTheme);
      }
      if (data.selectedTrack) {
        this.game.selectedTrack = data.selectedTrack;
        window.arcadeAudio.changeTrack(data.selectedTrack);
      }

      if (data.upgrades) {
        data.upgrades.forEach(savedUpg => {
          const cfg = window.TYCOON_CONFIG.upgrades.find(u => u.id === savedUpg.id);
          if (cfg) {
            cfg.level = savedUpg.level;
            this.game.applyUpgrade(cfg.id, cfg.level);
          }
        });
      }

      if (data.goldenTrophies && this.game.cityManager) {
        this.game.cityManager.goldenTrophies = data.goldenTrophies;
      }

      if (data.currentCity && this.game.cityManager) {
        this.game.cityManager.switchCity(data.currentCity);
      }

      if (data.battlePassXP && this.game.battlePass) {
        this.game.battlePass.currentXP = data.battlePassXP;
        this.game.battlePass.currentSeasonTier = Math.min(15, 1 + Math.floor(data.battlePassXP / 250));
      }
    } catch (e) {
      console.warn("Load parse error:", e);
    }
  }

  initAutoSave() {
    setInterval(() => {
      this.saveGame();
    }, this.autoSaveInterval);
  }
}

window.IdleEarningsAndSaveSystem = IdleEarningsAndSaveSystem;

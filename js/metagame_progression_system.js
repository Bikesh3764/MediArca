/**
 * Pizza Ready! 3D Tycoon - Metagame Progression & Multi-City Prestige Engine
 * Multi-city franchise expansion, 30-tier battle pass, lucky spin wheel, and offline idle revenue vault.
 * Unity Portability: Maps to MetagameManager.cs, PrestigeSystem.cs, BattlePassController.cs
 */

class MetagameProgressionSystem {
  constructor(game) {
    this.game = game;
    this.goldenTrophies = parseInt(localStorage.getItem('pizza_hut_trophies') || '0', 10);
    this.currentCityIndex = parseInt(localStorage.getItem('pizza_hut_city_idx') || '0', 10);
    
    this.cities = [
      { id: 'chicago', name: 'Chicago Flagship HQ', targetWorth: 10000, trophies: 5, bgTheme: 'classic' },
      { id: 'newyork', name: 'New York Times Square', targetWorth: 25000, trophies: 12, bgTheme: 'cyber' },
      { id: 'tokyo', name: 'Tokyo Akihabara Neon', targetWorth: 60000, trophies: 25, bgTheme: 'luxury' },
      { id: 'london', name: 'London Piccadilly Circus', targetWorth: 150000, trophies: 50, bgTheme: 'retro' },
      { id: 'paris', name: 'Paris Champs-Élysées', targetWorth: 400000, trophies: 100, bgTheme: 'luxury' }
    ];
  }

  getMultiplier() {
    return 1.0 + (this.goldenTrophies * 0.25);
  }

  calculatePrestigeReward(cash) {
    const currentCity = this.cities[this.currentCityIndex] || this.cities[0];
    const ratio = Math.max(0, cash / currentCity.targetWorth);
    return Math.floor(currentCity.trophies * Math.sqrt(ratio));
  }

  doPrestigeReset() {
    const reward = this.calculatePrestigeReward(this.game.cash);
    if (reward <= 0) return false;

    this.goldenTrophies += reward;
    localStorage.setItem('pizza_hut_trophies', this.goldenTrophies.toString());

    if (this.currentCityIndex < this.cities.length - 1) {
      this.currentCityIndex++;
      localStorage.setItem('pizza_hut_city_idx', this.currentCityIndex.toString());
    }

    this.game.cash = 100;
    localStorage.removeItem('pizza_ready_tycoon_save');
    location.reload();
    return true;
  }
}

window.MetagameProgressionSystem = MetagameProgressionSystem;

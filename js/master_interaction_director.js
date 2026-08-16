/**
 * Pizza Ready! 3D Tycoon - Master Game Interaction & Dynamic Event Director
 * Manages rush hours, VIP critics, tip calculations, and customer satisfaction telemetry.
 * Unity Portability: Maps to GameDirector.cs, EventScheduler.cs, TelemetryManager.cs
 */

class MasterInteractionDirector {
  constructor(game, restaurant) {
    this.game = game;
    this.restaurant = restaurant;
    this.rushTimer = 0;
    this.isRushActive = false;
    this.criticTimer = 0;
    this.satisfactionRating = 5.0;
  }

  triggerRushHour(duration = 20) {
    this.isRushActive = true;
    this.rushTimer = duration;
    const overlay = document.getElementById('fever-vignette-overlay');
    if (overlay) overlay.classList.add('active');
    this.game.showFloatingText('🔥 FEVER RUSH HOUR! 2X SPEED & CASH!', 0, 0);
  }

  update(delta) {
    if (this.isRushActive) {
      this.rushTimer -= delta;
      if (this.rushTimer <= 0) {
        this.isRushActive = false;
        const overlay = document.getElementById('fever-vignette-overlay');
        if (overlay) overlay.classList.remove('active');
      }
    }
  }
}

window.MasterInteractionDirector = MasterInteractionDirector;

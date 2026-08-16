/**
 * Pizza Ready! 3D Tycoon - Season 1 Chef Battle Pass, Daily Quests & Lifetime Achievements
 * Unity Portability: Maps to BattlePassManager.cs, QuestController.cs, AchievementSystem.cs
 */

class BattlePassAndQuests {
  constructor(game) {
    this.game = game;
    this.currentXP = 120;
    this.currentSeasonTier = 1;
    this.xpPerTier = 250;
    this.maxTier = 15;
    this.isVipPassUnlocked = false;

    this.initTiers();
    this.initQuests();
    this.initAchievements();
  }

  initTiers() {
    this.tiers = [
      { tier: 1, freeReward: { type: 'cash', val: 100, label: '$100 Cash' }, vipReward: { type: 'cash', val: 300, label: '$300 Cash' }, claimedFree: true, claimedVip: false },
      { tier: 2, freeReward: { type: 'xp', val: 150, label: '+150 Bonus XP' }, vipReward: { type: 'speed', val: 45, label: '45s Mega Sprint' }, claimedFree: false, claimedVip: false },
      { tier: 3, freeReward: { type: 'cash', val: 200, label: '$200 Cash' }, vipReward: { type: 'cash', val: 500, label: '$500 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 4, freeReward: { type: 'skin', val: 'golden_hat', label: '👑 Golden Cap' }, vipReward: { type: 'cash', val: 750, label: '$750 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 5, freeReward: { type: 'cash', val: 350, label: '$350 Cash' }, vipReward: { type: 'trophy', val: 2, label: '🏆 +2 Gold Trophies' }, claimedFree: false, claimedVip: false },
      { tier: 6, freeReward: { type: 'speed', val: 30, label: '30s Rush Hour' }, vipReward: { type: 'cash', val: 1000, label: '$1,000 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 7, freeReward: { type: 'cash', val: 500, label: '$500 Cash' }, vipReward: { type: 'skin', val: 'diamond_apron', label: '💎 Diamond Apron' }, claimedFree: false, claimedVip: false },
      { tier: 8, freeReward: { type: 'xp', val: 300, label: '+300 Bonus XP' }, vipReward: { type: 'cash', val: 1200, label: '$1,200 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 9, freeReward: { type: 'cash', val: 650, label: '$650 Cash' }, vipReward: { type: 'trophy', val: 3, label: '🏆 +3 Gold Trophies' }, claimedFree: false, claimedVip: false },
      { tier: 10, freeReward: { type: 'skin', val: 'master_chef', label: '👨‍🍳 Royal Toque' }, vipReward: { type: 'cash', val: 1500, label: '$1,500 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 11, freeReward: { type: 'cash', val: 800, label: '$800 Cash' }, vipReward: { type: 'cash', val: 2000, label: '$2,000 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 12, freeReward: { type: 'speed', val: 60, label: '60s Super Rush' }, vipReward: { type: 'trophy', val: 5, label: '🏆 +5 Gold Trophies' }, claimedFree: false, claimedVip: false },
      { tier: 13, freeReward: { type: 'cash', val: 1000, label: '$1,000 Cash' }, vipReward: { type: 'cash', val: 2500, label: '$2,500 Cash' }, claimedFree: false, claimedVip: false },
      { tier: 14, freeReward: { type: 'xp', val: 500, label: '+500 Bonus XP' }, vipReward: { type: 'skin', val: 'golden_box', label: '✨ Golden Boxes' }, claimedFree: false, claimedVip: false },
      { tier: 15, freeReward: { type: 'trophy', val: 5, label: '🏆 +5 Gold Trophies' }, vipReward: { type: 'cash', val: 5000, label: '👑 $5,000 Grand Prize' }, claimedFree: false, claimedVip: false }
    ];
  }

  initQuests() {
    this.dailyQuests = [
      { id: 'bake_pizzas', title: 'Master Baker', desc: 'Bake 15 fresh pizza boxes in ovens', current: 0, target: 15, xpReward: 100, cashReward: 120, completed: false, claimed: false },
      { id: 'serve_drinks', title: 'Soda Maestro', desc: 'Dispense & serve 6 Pepsi fountain drinks', current: 0, target: 6, xpReward: 80, cashReward: 90, completed: false, claimed: false },
      { id: 'clean_tables', title: 'Cleanliness Guru', desc: 'Wipe down and dump 8 dirty table trash stacks', current: 0, target: 8, xpReward: 90, cashReward: 100, completed: false, claimed: false },
      { id: 'scooter_deliv', title: 'Speedy Dispatch', desc: 'Pack 3 online scooter delivery orders', current: 0, target: 3, xpReward: 120, cashReward: 150, completed: false, claimed: false },
      { id: 'dough_toss', title: 'Dough Master', desc: 'Complete 3 perfect dough tosses in the mini-game', current: 0, target: 3, xpReward: 150, cashReward: 200, completed: false, claimed: false }
    ];
  }

  initAchievements() {
    this.achievements = [
      { id: 'first_1k', title: '💵 First Grand', desc: 'Earn your first $1,000 in total pizzeria revenue', current: 80, target: 1000, claimed: false, icon: '💰' },
      { id: 'vip_critic', title: '⭐ Michelin Acclaim', desc: 'Serve a VIP Food Critic with a 5-Star rating', current: 0, target: 1, claimed: false, icon: '⭐' },
      { id: 'floor2_king', title: '🏬 Penthouse Empire', desc: 'Ride the 2nd floor escalator and serve luxury dessert', current: 0, target: 1, claimed: false, icon: '🍰' },
      { id: 'drive_limo', title: '👑 Limo VIP Whisperer', desc: 'Serve 3 stretch VIP limousines at the drive-thru window', current: 0, target: 3, claimed: false, icon: '🚘' }
    ];
  }

  addXP(amount) {
    this.currentXP += amount;
    const newTier = Math.min(this.maxTier, 1 + Math.floor(this.currentXP / this.xpPerTier));
    if (newTier > this.currentSeasonTier) {
      this.currentSeasonTier = newTier;
      this.game.showFloatingText(`🎟️ BATTLE PASS TIER UP! (TIER ${this.currentSeasonTier})`, 0, 0);
      window.arcadeAudio.playVipReward();
    }
  }

  trackAction(actionType, count = 1) {
    this.dailyQuests.forEach(q => {
      if (q.id === actionType && !q.completed) {
        q.current = Math.min(q.target, q.current + count);
        if (q.current >= q.target) {
          q.completed = true;
          this.game.showFloatingText(`✨ QUEST COMPLETE: ${q.title}!`, 0, 0);
          window.arcadeAudio.playBoxPickup();
        }
      }
    });

    this.achievements.forEach(ach => {
      if (ach.id === actionType && !ach.claimed) {
        ach.current = Math.min(ach.target, ach.current + count);
      }
    });
  }

  claimQuest(questId) {
    const quest = this.dailyQuests.find(q => q.id === questId);
    if (quest && quest.completed && !quest.claimed) {
      quest.claimed = true;
      this.game.addCash(quest.cashReward);
      this.addXP(quest.xpReward);
      window.arcadeAudio.playVipReward();
      return true;
    }
    return false;
  }

  claimTierReward(tierNum, isVip) {
    const tierData = this.tiers.find(t => t.tier === tierNum);
    if (!tierData || this.currentSeasonTier < tierNum) return false;

    if (isVip) {
      if (!this.isVipPassUnlocked || tierData.claimedVip) return false;
      tierData.claimedVip = true;
      this.grantReward(tierData.vipReward);
      window.arcadeAudio.playVipReward();
      return true;
    } else {
      if (tierData.claimedFree) return false;
      tierData.claimedFree = true;
      this.grantReward(tierData.freeReward);
      window.arcadeAudio.playVipReward();
      return true;
    }
  }

  grantReward(reward) {
    if (reward.type === 'cash') {
      this.game.addCash(reward.val);
    } else if (reward.type === 'xp') {
      this.addXP(reward.val);
    } else if (reward.type === 'speed') {
      this.game.triggerRushHour();
    } else if (reward.type === 'trophy' && this.game.cityManager) {
      this.game.cityManager.goldenTrophies += reward.val;
      this.game.showFloatingText(`🏆 +${reward.val} GOLDEN TROPHIES CLAIMED!`, 0, 0);
    }
  }
}

window.BattlePassAndQuests = BattlePassAndQuests;

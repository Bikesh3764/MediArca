using UnityEngine;
using System;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class BattlePassManager : MonoBehaviour
    {
        [Header("Progression")]
        [SerializeField] private int currentXP = 0;
        [SerializeField] private int currentTier = 1;
        [SerializeField] private int xpPerTier = 250;
        [SerializeField] private int maxTier = 15;

        public event Action<int, int> OnXPUpdated;

        public int CurrentTier => currentTier;
        public int CurrentXP => currentXP;

        public void AddXP(int amount)
        {
            currentXP += amount;
            int newTier = Mathf.Min(maxTier, 1 + (currentXP / xpPerTier));
            if (newTier > currentTier)
            {
                currentTier = newTier;
                // Trigger celebratory sound & tier up banner
            }
            OnXPUpdated?.Invoke(currentXP, currentTier);
        }
    }
}

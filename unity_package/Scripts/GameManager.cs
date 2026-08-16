using UnityEngine;
using System;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private RestaurantConfigSO config;

        [Header("Economy & Stats")]
        [SerializeField] private int cash = 80;
        [SerializeField] private int goldenTrophies = 0;

        [Header("Subsystems")]
        [SerializeField] private PlayerController player;
        [SerializeField] private CityPrestigeManager cityManager;
        [SerializeField] private BattlePassManager battlePass;
        [SerializeField] private IdleEarningsManager idleEarnings;
        [SerializeField] private CinematicVFXManager vfxManager;
        [SerializeField] private AudioManager audioManager;

        [Header("Rush Hour Frenzy")]
        [SerializeField] private bool isRushHourActive = false;
        [SerializeField] private float rushHourTimer = 0f;
        [SerializeField] private float rushHourCooldown = 80f;

        public event Action<int> OnCashChanged;
        public event Action<bool> OnRushHourToggled;

        public int Cash => cash;
        public int GoldenTrophies => goldenTrophies;
        public bool IsRushHour => isRushHourActive;
        public RestaurantConfigSO Config => config;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            OnCashChanged?.Invoke(cash);
        }

        private void Update()
        {
            HandleRushHourCycle(Time.deltaTime);
        }

        public void AddCash(int amount, Vector3 spawnPosition = default)
        {
            float cityMult = cityManager != null ? cityManager.GetActiveCityMultiplier() : 1.0f;
            float trophyMult = 1.0f + (goldenTrophies * config.trophyIncomeMultiplier);
            int finalAmount = Mathf.RoundToInt(amount * cityMult * trophyMult);

            cash += finalAmount;
            OnCashChanged?.Invoke(cash);

            if (battlePass != null)
            {
                battlePass.AddXP(Mathf.Max(1, finalAmount / 4));
            }

            if (audioManager != null)
            {
                audioManager.PlaySound("Cash");
            }
        }

        public bool SpendCash(int amount)
        {
            if (cash >= amount)
            {
                cash -= amount;
                OnCashChanged?.Invoke(cash);
                if (audioManager != null) audioManager.PlaySound("Cash");
                return true;
            }
            return false;
        }

        public void TriggerRushHour(float duration = 35f)
        {
            isRushHourActive = true;
            rushHourTimer = duration;
            OnRushHourToggled?.Invoke(true);

            if (vfxManager != null) vfxManager.TriggerScreenShake(0.5f, 0.4f);
            if (audioManager != null) audioManager.PlaySound("RushHourStart");
        }

        private void HandleRushHourCycle(float dt)
        {
            if (isRushHourActive)
            {
                rushHourTimer -= dt;
                if (rushHourTimer <= 0f)
                {
                    isRushHourActive = false;
                    rushHourCooldown = 80f;
                    OnRushHourToggled?.Invoke(false);
                }
            }
            else
            {
                rushHourCooldown -= dt;
                if (rushHourCooldown <= 0f)
                {
                    TriggerRushHour();
                }
            }
        }
    }
}

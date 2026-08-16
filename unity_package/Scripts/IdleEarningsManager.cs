using UnityEngine;
using System;

namespace PizzaReadyTycoon
{
    public class IdleEarningsManager : MonoBehaviour
    {
        private const string LAST_TIME_KEY = "PizzaTycoon_LastTimestamp";

        private void Start()
        {
            CalculateOfflineEarnings();
        }

        private void OnApplicationQuit()
        {
            SaveTimestamp();
        }

        private void OnApplicationPause(bool pause)
        {
            if (pause) SaveTimestamp();
            else CalculateOfflineEarnings();
        }

        private void SaveTimestamp()
        {
            PlayerPrefs.SetString(LAST_TIME_KEY, DateTime.UtcNow.ToString());
            PlayerPrefs.Save();
        }

        private void CalculateOfflineEarnings()
        {
            if (PlayerPrefs.HasKey(LAST_TIME_KEY))
            {
                string savedStr = PlayerPrefs.GetString(LAST_TIME_KEY);
                if (DateTime.TryParse(savedStr, out DateTime lastTime))
                {
                    TimeSpan elapsed = DateTime.UtcNow - lastTime;
                    double minutes = Math.Min(720.0, elapsed.TotalMinutes);
                    if (minutes > 1.0)
                    {
                        int offlineCash = Mathf.RoundToInt((float)minutes * 25f);
                        // Trigger Welcome Back Dialog
                        Debug.Log($"Welcome back! You earned ${offlineCash} while away.");
                    }
                }
            }
        }
    }
}

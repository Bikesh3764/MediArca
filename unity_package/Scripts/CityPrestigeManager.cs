using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class CityPrestigeManager : MonoBehaviour
    {
        [System.Serializable]
        public class CityData
        {
            public string cityId;
            public string cityName;
            public float multiplier;
            public int unlockCost;
            public bool isUnlocked;
            public GameObject landmarksRoot;
        }

        [SerializeField] private List<CityData> availableCities = new List<CityData>();
        [SerializeField] private string activeCityId = "chicago";

        public float GetActiveCityMultiplier()
        {
            CityData city = availableCities.Find(c => c.cityId == activeCityId);
            return city != null ? city.multiplier : 1.0f;
        }

        public void SwitchCity(string cityId)
        {
            CityData targetCity = availableCities.Find(c => c.cityId == cityId);
            if (targetCity != null && targetCity.isUnlocked)
            {
                activeCityId = cityId;
                foreach (var c in availableCities)
                {
                    if (c.landmarksRoot != null)
                    {
                        c.landmarksRoot.SetActive(c.cityId == cityId);
                    }
                }
            }
        }
    }
}

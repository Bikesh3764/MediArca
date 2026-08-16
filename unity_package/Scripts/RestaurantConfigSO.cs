using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    [CreateAssetMenu(fileName = "RestaurantConfig", menuName = "PizzaTycoon/RestaurantConfig", order = 1)]
    public class RestaurantConfigSO : ScriptableObject
    {
        [Header("Player Settings")]
        public float basePlayerSpeed = 11.0f;
        public int basePlayerCapacity = 4;
        public float speedPerUpgrade = 1.2f;
        public int capacityPerUpgrade = 2;
        public float pickupRadius = 2.5f;
        public float serveRadius = 3.8f;
        public float cashCollectRadius = 5.5f;
        public float cleanRadius = 3.0f;

        [Header("Worker AI Settings")]
        public float baseWorkerSpeed = 8.0f;
        public int baseWorkerCapacity = 4;

        [Header("Oven Recipes")]
        public PizzaRecipeData pepperoniPizza = new PizzaRecipeData("pepperoni", "Pepperoni Lover's", 15, 1.1f);
        public PizzaRecipeData veggiePizza = new PizzaRecipeData("veggie", "Veggie Lover's", 22, 1.2f);
        public PizzaRecipeData stuffedCrustPizza = new PizzaRecipeData("stuffed", "Cheesy Stuffed Crust", 28, 1.4f);

        [Header("Drink & Sides Data")]
        public int drinkPrice = 10;
        public int sidePrice = 16;
        public int dessertPrice = 24;

        [Header("Prestige Settings")]
        public float trophyIncomeMultiplier = 0.25f; // +25% per trophy
    }

    [System.Serializable]
    public class PizzaRecipeData
    {
        public string id;
        public string displayName;
        public int basePrice;
        public float cookInterval;

        public PizzaRecipeData(string id, string displayName, int basePrice, float cookInterval)
        {
            this.id = id;
            this.displayName = displayName;
            this.basePrice = basePrice;
            this.cookInterval = cookInterval;
        }
    }

    public enum ItemCategory
    {
        Pizza,
        Drink,
        Side,
        Dessert,
        Trash
    }

    [System.Serializable]
    public class StackItem
    {
        public ItemCategory category;
        public string type;
        public GameObject visualObj;

        public StackItem(ItemCategory category, string type, GameObject visualObj)
        {
            this.category = category;
            this.type = type;
            this.visualObj = visualObj;
        }
    }
}

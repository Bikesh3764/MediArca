using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class FountainStation : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private float pourInterval = 0.9f;
        [SerializeField] private int maxCapacity = 8;
        [SerializeField] private GameObject drinkCupPrefab;
        [SerializeField] private Transform trayRoot;

        private List<GameObject> pouredCups = new List<GameObject>();
        private float timer = 0f;

        private void Update()
        {
            timer += Time.deltaTime;
            if (timer >= pourInterval)
            {
                timer = 0f;
                if (pouredCups.Count < maxCapacity && drinkCupPrefab != null)
                {
                    GameObject cup = Instantiate(drinkCupPrefab, trayRoot);
                    cup.transform.localPosition = new Vector3(0f, pouredCups.Count * 0.26f, 0f);
                    pouredCups.Add(cup);
                }
            }
        }

        private void OnTriggerStay(Collider other)
        {
            if (other.CompareTag("Player"))
            {
                PlayerController player = other.GetComponent<PlayerController>();
                if (player != null && player.CarriedCount < player.MaxCapacity && pouredCups.Count > 0)
                {
                    int last = pouredCups.Count - 1;
                    GameObject cup = pouredCups[last];
                    pouredCups.RemoveAt(last);
                    player.AddItem(ItemCategory.Drink, "pepsi", drinkCupPrefab);
                    Destroy(cup);
                }
            }
        }
    }
}

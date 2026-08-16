using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class SidesStation : MonoBehaviour
    {
        [Header("Fryer & Warmer Config")]
        [SerializeField] private float cookInterval = 1.1f;
        [SerializeField] private int maxCapacity = 8;
        [SerializeField] private GameObject wingsPrefab;
        [SerializeField] private GameObject breadsticksPrefab;
        [SerializeField] private Transform trayRoot;

        private List<GameObject> cookedSides = new List<GameObject>();
        private List<string> sideTypes = new List<string>();
        private float timer = 0f;

        private void Update()
        {
            timer += Time.deltaTime;
            if (timer >= cookInterval)
            {
                timer = 0f;
                if (cookedSides.Count < maxCapacity)
                {
                    bool isWings = Random.value < 0.5f;
                    GameObject prefab = isWings ? wingsPrefab : breadsticksPrefab;
                    if (prefab != null)
                    {
                        GameObject item = Instantiate(prefab, trayRoot);
                        item.transform.localPosition = new Vector3(0f, cookedSides.Count * 0.26f, 0f);
                        cookedSides.Add(item);
                        sideTypes.Add(isWings ? "wings" : "breadsticks");
                    }
                }
            }
        }

        private void OnTriggerStay(Collider other)
        {
            if (other.CompareTag("Player"))
            {
                PlayerController player = other.GetComponent<PlayerController>();
                if (player != null && player.CarriedCount < player.MaxCapacity && cookedSides.Count > 0)
                {
                    int last = cookedSides.Count - 1;
                    GameObject item = cookedSides[last];
                    string type = sideTypes[last];

                    cookedSides.RemoveAt(last);
                    sideTypes.RemoveAt(last);

                    GameObject prefab = (type == "wings") ? wingsPrefab : breadsticksPrefab;
                    player.AddItem(ItemCategory.Side, type, prefab);
                    Destroy(item);
                }
            }
        }
    }
}

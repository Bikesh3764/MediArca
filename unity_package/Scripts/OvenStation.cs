using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class OvenStation : MonoBehaviour
    {
        [Header("Recipe & Capacity")]
        [SerializeField] private string pizzaType = "pepperoni";
        [SerializeField] private float cookInterval = 1.1f;
        [SerializeField] private int maxCapacity = 10;
        [SerializeField] private GameObject pizzaBoxPrefab;
        [SerializeField] private Transform outTray;
        [SerializeField] private ParticleSystem chimneySmoke;

        private List<GameObject> bakedBoxes = new List<GameObject>();
        private float timer = 0f;

        public int AvailableCount => bakedBoxes.Count;
        public string PizzaType => pizzaType;

        private void Update()
        {
            timer += Time.deltaTime;
            if (timer >= cookInterval)
            {
                timer = 0f;
                SpawnBakedBox();
            }
        }

        private void SpawnBakedBox()
        {
            if (bakedBoxes.Count >= maxCapacity || pizzaBoxPrefab == null) return;

            GameObject box = Instantiate(pizzaBoxPrefab, outTray);
            box.transform.localPosition = new Vector3(0f, bakedBoxes.Count * 0.25f, 0f);
            bakedBoxes.Add(box);

            if (chimneySmoke != null && !chimneySmoke.isPlaying)
            {
                chimneySmoke.Play();
            }
        }

        public GameObject DispenseBox()
        {
            if (bakedBoxes.Count > 0)
            {
                int lastIdx = bakedBoxes.Count - 1;
                GameObject box = bakedBoxes[lastIdx];
                bakedBoxes.RemoveAt(lastIdx);
                return box;
            }
            return null;
        }

        private void OnTriggerStay(Collider other)
        {
            if (other.CompareTag("Player"))
            {
                PlayerController player = other.GetComponent<PlayerController>();
                if (player != null && player.CarriedCount < player.MaxCapacity && bakedBoxes.Count > 0)
                {
                    GameObject box = DispenseBox();
                    if (box != null)
                    {
                        player.AddItem(ItemCategory.Pizza, pizzaType, pizzaBoxPrefab);
                        Destroy(box);
                    }
                }
            }
        }
    }
}

using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class DriveThruSystem : MonoBehaviour
    {
        [Header("Lane Config")]
        [SerializeField] private Transform lane1Window;
        [SerializeField] private Transform lane2Window;
        [SerializeField] private GameObject sportsCarPrefab;
        [SerializeField] private GameObject limousinePrefab;
        [SerializeField] private float spawnInterval = 14.0f;

        private float timer = 0f;

        private void Update()
        {
            timer += Time.deltaTime;
            if (timer >= spawnInterval)
            {
                timer = 0f;
                SpawnVehicle();
            }
        }

        private void SpawnVehicle()
        {
            bool isLimo = Random.value < 0.25f;
            GameObject prefab = isLimo ? limousinePrefab : sportsCarPrefab;
            if (prefab != null && lane1Window != null)
            {
                GameObject car = Instantiate(prefab, lane1Window.position + new Vector3(0f, 0f, 30f), Quaternion.identity);
                // Car controller handles moving up to window and requesting combo orders
            }
        }
    }
}

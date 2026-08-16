using UnityEngine;
using UnityEngine.AI;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class CustomerController : MonoBehaviour
    {
        [Header("Order Requirements")]
        [SerializeField] private List<string> requestedPizzas = new List<string>();
        [SerializeField] private bool requestsDrink = false;
        [SerializeField] private bool requestsSide = false;
        [SerializeField] private bool isVIPCritic = false;

        [Header("State")]
        [SerializeField] private string state = "WAITING"; // WAITING, EATING, LEAVING
        [SerializeField] private float eatTimer = 5.0f;

        private NavMeshAgent agent;
        private Transform assignedTable;

        public bool IsVIP => isVIPCritic;
        public string State => state;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
        }

        public void InitializeOrder(bool isCritic, bool allowDrinks, bool allowSides)
        {
            this.isVIPCritic = isCritic;
            requestedPizzas.Clear();
            requestedPizzas.Add(Random.value < 0.6f ? "pepperoni" : "veggie");

            if (isCritic)
            {
                requestedPizzas.Add("stuffed");
                requestsDrink = true;
                requestsSide = true;
            }
            else
            {
                requestsDrink = allowDrinks && Random.value < 0.4f;
                requestsSide = allowSides && Random.value < 0.35f;
            }
        }

        public bool ReceivePizza(string pizzaType)
        {
            if (requestedPizzas.Contains(pizzaType))
            {
                requestedPizzas.Remove(pizzaType);
                return CheckOrderCompletion();
            }
            return false;
        }

        public bool ReceiveDrink()
        {
            if (requestsDrink)
            {
                requestsDrink = false;
                return CheckOrderCompletion();
            }
            return false;
        }

        public bool ReceiveSide()
        {
            if (requestsSide)
            {
                requestsSide = false;
                return CheckOrderCompletion();
            }
            return false;
        }

        private bool CheckOrderCompletion()
        {
            return requestedPizzas.Count == 0 && !requestsDrink && !requestsSide;
        }

        public void StartEating(Transform table, float duration)
        {
            assignedTable = table;
            eatTimer = duration;
            state = "EATING";
        }

        private void Update()
        {
            if (state == "EATING")
            {
                eatTimer -= Time.deltaTime;
                if (eatTimer <= 0f)
                {
                    state = "LEAVING";
                    LeaveRestaurant();
                }
            }
        }

        public void LeaveRestaurant()
        {
            if (agent != null && agent.isOnNavMesh)
            {
                agent.SetDestination(new Vector3(0f, 0f, 25f));
            }
            Destroy(gameObject, 6.0f);
        }
    }
}

using UnityEngine;
using UnityEngine.AI;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public enum WorkerRole
    {
        GeneralHelper,
        DedicatedCashier,
        MasterChef,
        BusboyCleaner
    }

    [RequireComponent(typeof(NavMeshAgent))]
    public class WorkerAI : MonoBehaviour
    {
        [Header("Role & Config")]
        [SerializeField] private WorkerRole role = WorkerRole.GeneralHelper;
        [SerializeField] private float movementSpeed = 8.0f;
        [SerializeField] private int maxCapacity = 4;
        [SerializeField] private Transform stackRoot;

        [Header("Waypoints")]
        [SerializeField] private Transform ovenStation;
        [SerializeField] private Transform frontCounter;
        [SerializeField] private Transform trashStation;

        private NavMeshAgent agent;
        private List<StackItem> carriedBoxes = new List<StackItem>();
        private string currentState = "FETCHING";

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            agent.speed = movementSpeed;
        }

        private void Start()
        {
            if (role == WorkerRole.DedicatedCashier)
            {
                agent.isStopped = true;
                currentState = "CASHIERING";
            }
            else
            {
                SetDestination(ovenStation.position);
            }
        }

        private void Update()
        {
            if (role == WorkerRole.DedicatedCashier) return;

            if (currentState == "FETCHING")
            {
                if (Vector3.Distance(transform.position, ovenStation.position) < 2.0f)
                {
                    // Simulated Box pickup
                    currentState = "DELIVERING";
                    SetDestination(frontCounter.position);
                }
            }
            else if (currentState == "DELIVERING")
            {
                if (Vector3.Distance(transform.position, frontCounter.position) < 2.0f)
                {
                    // Drop off boxes
                    currentState = "FETCHING";
                    SetDestination(ovenStation.position);
                }
            }
        }

        public void SetDestination(Vector3 target)
        {
            if (agent != null && agent.isOnNavMesh)
            {
                agent.SetDestination(target);
            }
        }
    }
}

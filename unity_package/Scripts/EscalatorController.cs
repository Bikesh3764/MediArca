using UnityEngine;

namespace PizzaReadyTycoon
{
    public class EscalatorController : MonoBehaviour
    {
        [Header("Floor Waypoints")]
        [SerializeField] private Transform bottomTrigger;
        [SerializeField] private Transform topTrigger;
        [SerializeField] private float floor2Height = 6.8f;

        private void OnTriggerEnter(Collider other)
        {
            if (other.CompareTag("Player"))
            {
                PlayerController player = other.GetComponent<PlayerController>();
                if (player != null)
                {
                    if (player.CurrentFloor == 1)
                    {
                        player.SetFloor(2, floor2Height);
                        player.transform.position = topTrigger.position;
                    }
                    else
                    {
                        player.SetFloor(1, 0f);
                        player.transform.position = bottomTrigger.position;
                    }
                }
            }
        }
    }
}

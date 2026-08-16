using UnityEngine;

namespace PizzaReadyTycoon
{
    public class ScooterDeliveryHub : MonoBehaviour
    {
        [Header("Moped Config")]
        [SerializeField] private Transform mopedMesh;
        [SerializeField] private float deliveryDuration = 6.0f;
        [SerializeField] private int basePayout = 220;

        private bool isDelivering = false;
        private float deliverTimer = 0f;

        private void Update()
        {
            if (isDelivering)
            {
                deliverTimer -= Time.deltaTime;
                if (deliverTimer <= 0f)
                {
                    isDelivering = false;
                    GameManager.Instance.AddCash(basePayout, transform.position);
                    mopedMesh.gameObject.SetActive(true);
                }
            }
        }

        public void DispatchScooter()
        {
            if (!isDelivering)
            {
                isDelivering = true;
                deliverTimer = deliveryDuration;
                mopedMesh.gameObject.SetActive(false);
            }
        }
    }
}

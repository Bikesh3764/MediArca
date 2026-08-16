using UnityEngine;
using System.Collections;

namespace PizzaReadyTycoon
{
    public class CinematicVFXManager : MonoBehaviour
    {
        [Header("Confetti & Particles")]
        [SerializeField] private ParticleSystem confettiCannon;
        [SerializeField] private Camera mainCam;

        private Vector3 originalCamPos;

        private void Awake()
        {
            if (mainCam == null) mainCam = Camera.main;
            if (mainCam != null) originalCamPos = mainCam.transform.localPosition;
        }

        public void TriggerConfetti(Vector3 position)
        {
            if (confettiCannon != null)
            {
                confettiCannon.transform.position = position;
                confettiCannon.Play();
            }
            TriggerScreenShake(0.35f, 0.25f);
        }

        public void TriggerScreenShake(float duration = 0.3f, float magnitude = 0.25f)
        {
            if (mainCam != null)
            {
                StartCoroutine(ShakeRoutine(duration, magnitude));
            }
        }

        private IEnumerator ShakeRoutine(float duration, float magnitude)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                float x = Random.Range(-1f, 1f) * magnitude;
                float y = Random.Range(-1f, 1f) * magnitude;
                mainCam.transform.localPosition = originalCamPos + new Vector3(x, y, 0f);

                elapsed += Time.deltaTime;
                yield return null;
            }
            mainCam.transform.localPosition = originalCamPos;
        }
    }
}

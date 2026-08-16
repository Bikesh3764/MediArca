using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    public class AudioManager : MonoBehaviour
    {
        [System.Serializable]
        public class SoundEntry
        {
            public string soundName;
            public AudioClip clip;
            [Range(0f, 1f)] public float volume = 1f;
        }

        [SerializeField] private AudioSource sfxSource;
        [SerializeField] private AudioSource musicSource;
        [SerializeField] private List<SoundEntry> sounds = new List<SoundEntry>();

        public void PlaySound(string soundName)
        {
            SoundEntry entry = sounds.Find(s => s.soundName == soundName);
            if (entry != null && entry.clip != null && sfxSource != null)
            {
                sfxSource.PlayOneShot(entry.clip, entry.volume);
            }
        }
    }
}

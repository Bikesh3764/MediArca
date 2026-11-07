// Everyday words (English and Hinglish) → specialty, so "skin doctor" or "bacchon ka doctor" finds the right doctors.
// Platform-free: used by the app's Find screen (and can be used by the website).

const WORDS: { specialty: string; words: string[] }[] = [
  { specialty: 'Dermatology', words: ['skin', 'chamdi', 'twacha', 'pimple', 'pimples', 'acne', 'hair', 'baal', 'derma', 'dermatologist'] },
  { specialty: 'Pediatrics', words: ['child', 'children', 'kid', 'kids', 'baby', 'babies', 'bacchon', 'bachon', 'bacche', 'bachche', 'bachcha', 'baccha', 'bacha', 'bache', 'paediatric', 'pediatric', 'pediatrician', 'paediatrician'] },
  { specialty: 'Cardiology', words: ['heart', 'dil', 'cardio', 'cardiologist', 'bp'] },
  { specialty: 'Gynecology & Obstetrics', words: ['women', 'woman', 'lady', 'ladies', 'mahila', 'pregnancy', 'pregnant', 'gynae', 'gyne', 'gyno', 'gynaecologist', 'gynecologist', 'periods'] },
  { specialty: 'Orthopedics', words: ['bone', 'bones', 'haddi', 'joint', 'joints', 'knee', 'ghutna', 'fracture', 'ortho', 'orthopaedic', 'orthopedic'] },
  { specialty: 'ENT / Otorhinolaryngology', words: ['ear', 'nose', 'throat', 'kaan', 'naak', 'gala', 'ent'] },
  { specialty: 'Dentistry', words: ['teeth', 'tooth', 'dant', 'daant', 'dental', 'dentist'] },
  { specialty: 'Ophthalmology', words: ['eye', 'eyes', 'aankh', 'ankh', 'aankhon', 'ankhon', 'vision', 'chashma'] },
  { specialty: 'Neurology', words: ['brain', 'nerve', 'nerves', 'migraine', 'dimag', 'neuro', 'neurologist'] },
  { specialty: 'General Medicine', words: ['fever', 'bukhar', 'cold', 'cough', 'khansi', 'physician', 'general'] },
  { specialty: 'Psychiatry', words: ['mental', 'depression', 'anxiety', 'psychiatrist'] },
  { specialty: 'Gastroenterology', words: ['stomach', 'pet', 'gastro', 'acidity', 'liver'] },
];

/** Filler words people add that aren't part of a name or city. */
const FILLER = new Set(['doctor', 'doctors', 'dr', 'dr.', 'ka', 'ki', 'ke', 'specialist', 'near', 'me', 'for', 'the', 'a', 'of', 'wala', 'wali', 'clinic']);

/**
 * "skin doctor mumbai" → { specialty: 'Dermatology', rest: 'mumbai' }.
 * Returns null when no everyday word is found, so the search runs as typed.
 */
export const specialtyFromSearch = (query: string): { specialty: string; rest: string } | null => {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  for (const { specialty, words } of WORDS) {
    const hit = tokens.find((t) => words.includes(t.replace(/[^a-z]/g, '')));
    if (!hit) continue;
    const rest = tokens.filter((t) => t !== hit && !FILLER.has(t) && !words.includes(t.replace(/[^a-z]/g, ''))).join(' ');
    return { specialty, rest };
  }
  return null;
};

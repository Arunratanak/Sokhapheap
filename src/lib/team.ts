/**
 * Team members shown on the home page and the About page.
 * TODO(TEAM): replace the placeholders below with the real team (4–5 people). No code changes needed:
 *  - name / role / bio: English and Khmer
 *  - photo: optional path under /public (e.g. "/team/dara.jpg", ~400×400 px); initials are shown when empty
 *  - links: optional; use only public profile links the person agreed to share
 */
export interface TeamMember {
  name: { en: string; km: string };
  role: { en: string; km: string };
  bio: { en: string; km: string };
  photo?: string;
  links?: { kind: "email" | "telegram" | "web"; href: string }[];
}

export const TEAM: TeamMember[] = [
  {
    name: { en: "Team member 1", km: "សមាជិកក្រុមទី ១" },
    role: { en: "Team lead · Product", km: "ប្រធានក្រុម · ផលិតផល" },
    bio: { en: "Placeholder: one line about this person.", km: "កន្លែងដាក់អត្ថបទ៖ ព័ត៌មានមួយបន្ទាត់អំពីសមាជិកនេះ។" },
  },
  {
    name: { en: "Team member 2", km: "សមាជិកក្រុមទី ២" },
    role: { en: "Full-stack developer", km: "អ្នកអភិវឌ្ឍកម្មវិធី" },
    bio: { en: "Placeholder: one line about this person.", km: "កន្លែងដាក់អត្ថបទ៖ ព័ត៌មានមួយបន្ទាត់អំពីសមាជិកនេះ។" },
  },
  {
    name: { en: "Team member 3", km: "សមាជិកក្រុមទី ៣" },
    role: { en: "Data analyst", km: "អ្នកវិភាគទិន្នន័យ" },
    bio: { en: "Placeholder: one line about this person.", km: "កន្លែងដាក់អត្ថបទ៖ ព័ត៌មានមួយបន្ទាត់អំពីសមាជិកនេះ។" },
  },
  {
    name: { en: "Team member 4", km: "សមាជិកក្រុមទី ៤" },
    role: { en: "Design · Khmer content", km: "រចនា · មាតិកាភាសាខ្មែរ" },
    bio: { en: "Placeholder: one line about this person.", km: "កន្លែងដាក់អត្ថបទ៖ ព័ត៌មានមួយបន្ទាត់អំពីសមាជិកនេះ។" },
  },
];

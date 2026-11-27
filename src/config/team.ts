/**
 * Team members shown on the home page and the About page, in this order.
 *  - name: English and Khmer (the Khmer page shows the Latin spelling until a Khmer spelling is added)
 *  - role / bio: optional, shown under the name when present
 *  - photo: optional path under /public (~400×400 px); initials are shown when empty
 *  - links: optional; use only public profile links the person agreed to share
 */
export interface TeamMember {
  name: { en: string; km: string };
  role?: { en: string; km: string };
  bio?: { en: string; km: string };
  photo?: string;
  links?: { kind: "email" | "telegram" | "web"; href: string }[];
}

export const TEAM: TeamMember[] = [
  { name: { en: "Hem Muninrichny", km: "Hem Muninrichny" }, role: { en: "Product & Pitch Lead", km: "អ្នកដឹកនាំផលិតផល និងបទបង្ហាញ" }, photo: "/team/member-1.jpg" },
  { name: { en: "Prak Arunratanak", km: "Prak Arunratanak" }, role: { en: "Full-Stack Developer", km: "អ្នកអភិវឌ្ឍកម្មវិធី Full-Stack" }, photo: "/team/member-2.jpg" },
  { name: { en: "Duch Soklysereyboth", km: "Duch Soklysereyboth" }, role: { en: "Research & Data Analyst", km: "អ្នកស្រាវជ្រាវ និងវិភាគទិន្នន័យ" }, photo: "/team/member-3.jpg" },
  { name: { en: "Vorn Molika", km: "Vorn Molika" }, role: { en: "User Research & Localization", km: "ស្រាវជ្រាវអ្នកប្រើប្រាស់ និងការបកប្រែភាសា" }, photo: "/team/member-4.jpg" },
];

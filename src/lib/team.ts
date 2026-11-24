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
  { name: { en: "Hem Muninrichny", km: "Hem Muninrichny" }, photo: "/team/member-1.jpg" },
  { name: { en: "Prak Arunratanak", km: "Prak Arunratanak" }, photo: "/team/member-2.jpg" },
  { name: { en: "Duch Soklysereyboth", km: "Duch Soklysereyboth" }, photo: "/team/member-3.jpg" },
  { name: { en: "Vorn Molika", km: "Vorn Molika" }, photo: "/team/member-4.jpg" },
];

import projectsData from "@/data/projects.json";

export type Project = {
  slug: string;
  title: string;
  description: string;
  originalPrice: number;
  currentPrice: number;
  images: string[];
};

// Keep prices in sync with backend/config/shopProducts.js when adding items.
const projects = projectsData as Project[];

export function getAllProjects(): Project[] {
  return projects;
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function discountPercent(originalPrice: number, currentPrice: number): number {
  if (!originalPrice || originalPrice <= 0 || currentPrice >= originalPrice) {
    return 0;
  }
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

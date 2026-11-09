export interface IStandardService {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDuration: number; // Duration in minutes
  category: string;
  iconName: string;
}

export const WORKSHOP_SERVICES: IStandardService[] = [
  {
    id: "oil-change",
    name: "Oil Change & Lube",
    description: "Full synthetic motor oil replacement, new OEM filter, and fluid level top-up.",
    price: 49,
    estimatedDuration: 45,
    category: "Routine Maintenance",
    iconName: "Droplet"
  },
  {
    id: "wheel-alignment",
    name: "Wheel Alignment & Balancing",
    description: "Precision 4-wheel computer alignment, computerized wheel balancing, and tire tread inspection.",
    price: 65,
    estimatedDuration: 60,
    category: "Wheels & Tires",
    iconName: "Disc"
  },
  {
    id: "brake-service",
    name: "Brake System Overhaul",
    description: "Front & rear ceramic brake pads replacement, rotor resurfacing, caliper check, and fluid flush.",
    price: 110,
    estimatedDuration: 90,
    category: "Braking",
    iconName: "AlertTriangle"
  },
  {
    id: "full-inspection",
    name: "50-Point Full Inspection",
    description: "In-depth bumper-to-bumper mechanical, electrical, OBD2 diagnostic scanning, and suspension check.",
    price: 85,
    estimatedDuration: 120,
    category: "Diagnostics",
    iconName: "ClipboardCheck"
  },
  {
    id: "engine-repair",
    name: "Engine Diagnostics & Repair",
    description: "Complete engine sensor diagnostics, timing inspection, spark plug replacement, and performance tuning.",
    price: 175,
    estimatedDuration: 180,
    category: "Engine & Transmission",
    iconName: "Wrench"
  },
  {
    id: "dent-paint",
    name: "Dent Removal & Paint Touchup",
    description: "Paintless dent repair, deep scratch filling, clear-coat buffing, and computerized color matching.",
    price: 135,
    estimatedDuration: 150,
    category: "Body & Paint",
    iconName: "Paintbrush"
  }
];

export const getServiceByNameOrId = (nameOrId: string): IStandardService | undefined => {
  if (!nameOrId) return undefined;
  const lower = nameOrId.toLowerCase().trim();
  return WORKSHOP_SERVICES.find(s => 
    s.id.toLowerCase() === lower || 
    s.name.toLowerCase() === lower ||
    s.name.toLowerCase().includes(lower) ||
    lower.includes(s.name.toLowerCase())
  );
};

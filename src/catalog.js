// catalog.js — the app catalog for larpstore.app.
// This is the source of truth for what the store sells. On boot it is synced
// into the `products` table so purchases can reference real rows.
//
// Prices are stored in integer CENTS to avoid floating-point money bugs.

export const CATEGORIES = [
  { id: "featured", name: "Featured" },
  { id: "utilities", name: "Utilities" },
  { id: "tools", name: "Tools" },
  { id: "lifestyle", name: "Lifestyle" },
];

/**
 * tiers[].period:
 *   "monthly"  -> entitlement expires 30 days after purchase
 *   "lifetime" -> entitlement never expires
 */
export const APPS = [
  {
    slug: "exodus",
    name: "Exodus",
    developer: "larpstore",
    tagline: "Your all-access pass. One app, everything unlocked.",
    category: "utilities",
    featured: true,
    rating: 4.8,
    ratingCount: 2143,
    size: "48.2 MB",
    ageRating: "17+",
    accent: "#6C5CE7",
    // Simple emoji/logo glyph used in the generated SVG icon.
    glyph: "✺",
    description:
      "Exodus is the flagship release on larpstore — a single, polished app that bundles the full toolkit in one place. Fast, private, and built to stay out of your way. Pick a plan below and it lands in your Library instantly.",
    highlights: [
      "Instant unlock — appears in your Library the moment you buy",
      "Private by default, no account sprawl",
      "Lightweight and fast on any device",
      "Priority updates for lifetime members",
    ],
    screenshots: [
      { title: "Home", hue: 258 },
      { title: "Library", hue: 280 },
      { title: "Settings", hue: 235 },
    ],
    tiers: [
      {
        id: "monthly",
        label: "1 Month",
        period: "monthly",
        priceCents: 600, // $6.00
        blurb: "Full access, billed monthly. Cancel anytime.",
        badge: null,
      },
      {
        id: "lifetime",
        label: "Lifetime",
        period: "lifetime",
        priceCents: 2000, // $20.00
        blurb: "Pay once, keep it forever. Best value.",
        badge: "Best value",
      },
    ],
  },

  // Filler tiles so the storefront looks like a real store. These are marked
  // "coming soon" and are not purchasable.
  {
    slug: "halcyon",
    name: "Halcyon",
    developer: "larpstore",
    tagline: "Calm, focused, fast.",
    category: "lifestyle",
    featured: false,
    comingSoon: true,
    rating: 0,
    ratingCount: 0,
    accent: "#00B894",
    glyph: "◍",
    description: "Coming soon to larpstore.",
    highlights: [],
    screenshots: [],
    tiers: [],
  },
  {
    slug: "relay",
    name: "Relay",
    developer: "larpstore",
    tagline: "Everything, in sync.",
    category: "tools",
    featured: false,
    comingSoon: true,
    rating: 0,
    ratingCount: 0,
    accent: "#0984E3",
    glyph: "⟲",
    description: "Coming soon to larpstore.",
    highlights: [],
    screenshots: [],
    tiers: [],
  },
  {
    slug: "monolith",
    name: "Monolith",
    developer: "larpstore",
    tagline: "Built like a tank.",
    category: "utilities",
    featured: false,
    comingSoon: true,
    rating: 0,
    ratingCount: 0,
    accent: "#636E72",
    glyph: "▦",
    description: "Coming soon to larpstore.",
    highlights: [],
    screenshots: [],
    tiers: [],
  },
  {
    slug: "pulse",
    name: "Pulse",
    developer: "larpstore",
    tagline: "Feel the rhythm of your day.",
    category: "lifestyle",
    featured: false,
    comingSoon: true,
    rating: 0,
    ratingCount: 0,
    accent: "#E17055",
    glyph: "♥",
    description: "Coming soon to larpstore.",
    highlights: [],
    screenshots: [],
    tiers: [],
  },
];

export function getApp(slug) {
  return APPS.find((a) => a.slug === slug) || null;
}

export function getTier(app, tierId) {
  if (!app || !app.tiers) return null;
  return app.tiers.find((t) => t.id === tierId) || null;
}

export function formatPrice(cents) {
  return "$" + (cents / 100).toFixed(2).replace(/\.00$/, "");
}

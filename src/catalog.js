// catalog.js — the app catalog for larpstore.app.
// Only Exodus is sold. Ratings are REAL (computed from the ratings table in
// db.js), so no rating is hard-coded here. Prices are in integer CENTS.

export const CATEGORIES = [{ id: "utilities", name: "Utilities" }];

// Bump `version` and `updatedAt` when you ship an update — the app page shows
// the version and a relative "Updated …" time automatically.
export const APPS = [
  {
    slug: "exodus",
    name: "Exodus",
    developer: "larpstore", // shown with a verified badge on the app page
    developerHandle: "@larpstore",
    tagline: "Exodus crypto wallet simulator.",
    simulatorNote: "This app simulates money. It's for fun — no real funds move.",
    category: "utilities",
    featured: true,
    platform: "iOS & Android",
    platformKind: "Mobile",
    version: "1.9",
    updatedAt: "2026-10-02", // change this when you update; page shows "Updated …"
    size: "48.2 MB",
    ageRating: "17+",
    accent: "#6C5CE7",
    // Use the uploaded image as the app icon instead of a generated glyph.
    iconImage: "/assets/exodus-icon.webp",
    glyph: "E",
    description:
      "Exodus is a crypto wallet simulator — a polished sandbox that looks and feels like the real thing. Set your own balances, swap between coins, send and receive with real-looking addresses and QR codes, and scrub live-style price charts. Everything is simulated and harmless; nothing leaves your device and no real money is involved.",
    highlights: [
      "Set every balance yourself — your wallet, your numbers",
      "Swap, send and receive across 14 networks",
      "Live-style charts you can scrub to any moment",
      "A pay tab with a card and rewards",
    ],
    // The uploaded screenshots, in order, each with a short caption.
    screenshots: [
      { src: "/assets/shot-wallet.webp", caption: "Your whole crypto wallet" },
      { src: "/assets/shot-chart.webp", caption: "Scrub any chart to the minute" },
      { src: "/assets/shot-swap.webp", caption: "Swap between any two coins" },
      { src: "/assets/shot-activity.webp", caption: "Activity history for every coin" },
      { src: "/assets/shot-balances.webp", caption: "Edit balances in Backstage" },
      { src: "/assets/shot-card.webp", caption: "Pay tab with card and rewards" },
      { src: "/assets/shot-send.webp", caption: "Send on 14 networks" },
      { src: "/assets/shot-receive.webp", caption: "Receive with a QR code" },
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

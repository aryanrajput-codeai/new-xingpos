/**
 * CENTRAL RESTAURANT BRAND CONFIGURATION
 * White-label configuration for XINGS KITCHEN powered by Webrajya
 */

export const RESTAURANT_BRANDING = {
  name: "XINGS KITCHEN",
  shortName: "XINGS",
  legalName: "XINGS KITCHEN",
  tagline: "Authentic Flavors, Quality Cuisine & Pure Delicacies",
  estd: "ESTD. 2024",
  poweredBy: "Webrajya",
  poweredByLabel: "Powered by Webrajya",

  // Contact & Location Config (Placeholders for XINGS KITCHEN)
  contact: {
    phone: "", // Configure via Admin Settings or set restaurant phone
    displayPhone: "+91 (Contact Number Placeholder)",
    email: "contact@xingskitchen.com",
    address: "Restaurant Address Placeholder",
    city: "City Center",
    state: "",
    postalCode: "",
    country: "India",
    businessHours: "Mon-Sun: 10:00 AM - 11:00 PM",
    website: "",
    // Social placeholders (leave blank or generic)
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    googleMapsEmbedUrl: "",
  },

  // Billing & Receipts
  receipt: {
    header: "XINGS KITCHEN",
    tagline: "Taste That Brings You Back",
    footerGreeting: "Thank You! Visit XINGS KITCHEN Again.",
    poweredByNote: "Powered by Webrajya",
  },
} as const;

export default RESTAURANT_BRANDING;

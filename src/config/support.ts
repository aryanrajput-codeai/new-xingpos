/**
 * CENTRAL WEBRAJYA CUSTOMER SUPPORT CONFIGURATION
 * Easily update support contact details for XINGS KITCHEN POS
 */

export const SUPPORT_CONFIG = {
  name: "ARYAN RAJPUT",
  role: "Customer Support",
  email: "infowebrajya@gmail.com",
  phone: "9630013483",
  subject: "XINGS KITCHEN POS Support",
  get mailtoUrl() {
    return `mailto:${this.email}?subject=${encodeURIComponent(this.subject)}`;
  },
  get telUrl() {
    return `tel:${this.phone}`;
  }
} as const;

export default SUPPORT_CONFIG;

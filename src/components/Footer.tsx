import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { RESTAURANT_BRANDING } from "../config/branding";

export default function Footer({ onAdminClick }: { onAdminClick?: () => void }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-stone-950 text-stone-300 border-t border-stone-900 pt-16 pb-8 px-6 relative overflow-hidden" id="restaurant-footer">
      {/* Decorative Gradient Line top border */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

      <div className="max-w-7xl mx-auto z-10 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-12">
          
          {/* Column 1: Brand & Description */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide uppercase">
              {RESTAURANT_BRANDING.name}
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed font-sans font-light max-w-md">
              Welcome to {RESTAURANT_BRANDING.name}. Experience authentic cuisine, fresh delicacies, and swift dining service crafted with passion.
            </p>
            
            {/* Social Grid */}
            <div className="flex items-center gap-3.5 pt-3">
              <a
                href={RESTAURANT_BRANDING.contact.facebookUrl || "#"}
                aria-label="Facebook Profile"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-stone-900 hover:bg-[#d4af37] border border-stone-850 hover:border-transparent flex items-center justify-center text-stone-450 hover:text-black transition-all cursor-pointer"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href={RESTAURANT_BRANDING.contact.instagramUrl || "#"}
                aria-label="Instagram Profile"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-stone-900 hover:bg-[#d4af37] border border-stone-850 hover:border-transparent flex items-center justify-center text-stone-450 hover:text-black transition-all cursor-pointer"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={RESTAURANT_BRANDING.contact.twitterUrl || "#"}
                aria-label="Twitter Profile"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-stone-900 hover:bg-[#d4af37] border border-stone-850 hover:border-transparent flex items-center justify-center text-stone-450 hover:text-black transition-all cursor-pointer"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Information, Hours & Contacts */}
          <div className="lg:col-span-3 space-y-5">
            <h3 className="text-xs font-mono font-bold text-white tracking-widest uppercase text-[#d4af37]">
              CONTACT DETAILS
            </h3>
            <ul className="space-y-4 text-xs sm:text-sm font-sans">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#d4af37] flex-shrink-0 mt-0.5" />
                <span className="text-stone-400 font-light leading-snug">
                  {RESTAURANT_BRANDING.contact.address ? RESTAURANT_BRANDING.contact.address : "Location & Address (Configure in Admin Settings)"}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#d4af37] flex-shrink-0" />
                <span className="text-stone-400 font-light">
                  {RESTAURANT_BRANDING.contact.phone ? (
                    <a href={`tel:${RESTAURANT_BRANDING.contact.phone}`} className="hover:text-white transition-colors">
                      {RESTAURANT_BRANDING.contact.phone}
                    </a>
                  ) : (
                    <span>Phone: Configure in Settings</span>
                  )}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#d4af37] flex-shrink-0" />
                <a href={`mailto:${RESTAURANT_BRANDING.contact.email}`} className="text-stone-400 hover:text-white transition-colors font-light truncate">
                  {RESTAURANT_BRANDING.contact.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#d4af37] flex-shrink-0 mt-0.5" />
                <div className="text-stone-400 font-light">
                  <span className="block font-medium text-white mb-0.5">BUSINESS HOURS</span>
                  <span className="block text-[11px] leading-relaxed">
                    {RESTAURANT_BRANDING.contact.businessHours}
                  </span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 3: Dining & Ordering Info */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-xs font-mono font-bold text-white tracking-widest uppercase text-[#d4af37]">
              EXPERIENCE OUR HOSPITALITY
            </h3>
            
            {/* Dining info panel */}
            <div className="w-full h-36 rounded-xl border border-stone-850 bg-stone-900 p-4 flex flex-col justify-center items-center text-center relative shadow-md">
              <span className="text-xs font-serif font-bold text-[#d4af37] tracking-wider uppercase">
                {RESTAURANT_BRANDING.name}
              </span>
              <p className="text-[11px] text-stone-400 mt-1 max-w-xs">
                Dine-In • Takeaway • Digital QR Tableside Ordering
              </p>
              <div className="mt-3 text-[10px] font-mono text-stone-500 bg-stone-950 px-2.5 py-1 rounded border border-stone-800">
                {RESTAURANT_BRANDING.poweredByLabel}
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Credits strip & Back to top button */}
        <div className="pt-8 border-t border-stone-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 font-sans tracking-wide">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span>
              &copy; {new Date().getFullYear()} {RESTAURANT_BRANDING.name}. All Rights Reserved.
            </span>
            <span className="text-stone-700 hidden sm:inline">•</span>
            <span className="text-stone-400 font-medium">
              {RESTAURANT_BRANDING.poweredByLabel}
            </span>
            {onAdminClick && (
              <span className="inline-flex items-center gap-1.5 ml-2">
                <span className="text-stone-800">|</span>
                <button
                  type="button"
                  onClick={onAdminClick}
                  className="px-2 py-0.5 bg-[#d4af37]/10 hover:bg-[#d4af37] border border-[#d4af37]/20 hover:border-transparent text-[10px] text-[#d4af37] hover:text-black font-semibold rounded transition-all cursor-pointer focus:outline-none"
                  id="footer-admin-login-link"
                >
                  🔐 Admin Login
                </button>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-6">
            <div className="font-light text-[10px] text-stone-400 bg-stone-900/40 px-2.5 py-1 rounded border border-stone-850 leading-none">
              FINE DINING & FAST POS
            </div>
            
            {/* Back to top */}
            <button
              onClick={scrollToTop}
              className="px-3 py-2 bg-stone-900 hover:bg-[#d4af37] border border-stone-850 hover:border-transparent text-stone-450 hover:text-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
              title="Return to top"
              id="back-to-top-btn"
            >
              Back to Top
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

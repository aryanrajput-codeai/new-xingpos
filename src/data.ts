import { MenuItem, Category, Review } from "./types";

export const categories: Category[] = [
  {
    id: "Soup",
    name: "Soup",
    icon: "🥣",
    description: "Comforting, warm Asian broths & soups"
  },
  {
    id: "Crispy Starter",
    name: "Crispy Starter",
    icon: "🥢",
    description: "Crispy golden appetizers & wok-tossed starters"
  },
  {
    id: "Starter",
    name: "Starter",
    icon: "🥗",
    description: "Delicious sizzling wok starters & appetisers"
  },
  {
    id: "Rolls",
    name: "Rolls",
    icon: "🌯",
    description: "Freshly tossed Asian rolls & wraps"
  },
  {
    id: "Veg Rice",
    name: "Veg Rice",
    icon: "🍚",
    description: "Aromatic wok-fried rice & classic Chinese rice dishes"
  },
  {
    id: "Veg Noodles",
    name: "Veg Noodles",
    icon: "🍜",
    description: "Hand-pulled & wok-tossed Hakka noodles"
  },
  {
    id: "Combo",
    name: "Combo",
    icon: "🍱",
    description: "Special value meal combos with rice, noodles & Manchurian"
  }
];

export const menuItems: MenuItem[] = [];

export const reviews: Review[] = [
  {
    id: "r1",
    name: "Arjun Verma",
    rating: 5,
    date: "2026-07-14",
    comment: "The Schezwan Chicken Noodles and Momos at The Xings Kitchen are exceptional! Authentic wok hei aroma and super fast packaging.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
  },
  {
    id: "r2",
    name: "Prachi Sen",
    rating: 5,
    date: "2026-07-15",
    comment: "Best Indo-Chinese spot in town! The Drums of Heaven and Honey Darsaan are incredible. Highly recommend for takeaway and counter dining.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100"
  }
];

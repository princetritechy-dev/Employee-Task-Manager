import {
  Cat, Dog, Bird, Fish, Ghost, Rocket,
  Star, Heart, Smile, Sun, Moon, Zap,
  Coffee, Music, Gamepad2, Palette,
  Flame, Leaf, Snowflake, Turtle, Rabbit, Panda,
  Crown, Gem, Trophy, Feather, TreePine, Mountain,
  Waves, Camera, Cookie, Sparkles,
} from "lucide-react";


export const AVATAR_OPTIONS = [
  { id: "cat", icon: Cat, bg: "#2563EB" },
  { id: "dog", icon: Dog, bg: "#DB2777" },
  { id: "bird", icon: Bird, bg: "#059669" },
  { id: "fish", icon: Fish, bg: "#D97706" },
  { id: "ghost", icon: Ghost, bg: "#7C3AED" },
  { id: "rocket", icon: Rocket, bg: "#0891B2" },
  { id: "star", icon: Star, bg: "#DC2626" },
  { id: "heart", icon: Heart, bg: "#DB2777" },
  { id: "smile", icon: Smile, bg: "#CA8A04" },
  { id: "sun", icon: Sun, bg: "#EA580C" },
  { id: "moon", icon: Moon, bg: "#4338CA" },
  { id: "zap", icon: Zap, bg: "#65A30D" },
  { id: "coffee", icon: Coffee, bg: "#78350F" },
  { id: "music", icon: Music, bg: "#BE185D" },
  { id: "gamepad", icon: Gamepad2, bg: "#0D9488" },
  { id: "palette", icon: Palette, bg: "#9333EA" },
  { id: "flame", icon: Flame, bg: "#F97316" },
  { id: "leaf", icon: Leaf, bg: "#22C55E" },
  { id: "snowflake", icon: Snowflake, bg: "#0EA5E9" },
  { id: "turtle", icon: Turtle, bg: "#14B8A6" },
  { id: "rabbit", icon: Rabbit, bg: "#F43F5E" },
  { id: "panda", icon: Panda, bg: "#475569" },
  { id: "crown", icon: Crown, bg: "#EAB308" },
  { id: "gem", icon: Gem, bg: "#06B6D4" },
  { id: "trophy", icon: Trophy, bg: "#F59E0B" },
  { id: "feather", icon: Feather, bg: "#A855F7" },
  { id: "tree", icon: TreePine, bg: "#10B981" },
  { id: "mountain", icon: Mountain, bg: "#6366F1" },
  { id: "waves", icon: Waves, bg: "#3B82F6" },
  { id: "camera", icon: Camera, bg: "#8B5CF6" },
  { id: "cookie", icon: Cookie, bg: "#B45309" },
  { id: "sparkles", icon: Sparkles, bg: "#EC4899" },
];

export function getAvatarOption(id) {
  return AVATAR_OPTIONS.find((a) => a.id === id) || null;
}
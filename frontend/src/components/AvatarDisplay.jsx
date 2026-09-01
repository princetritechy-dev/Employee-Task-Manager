import React from "react";
import { getAvatarOption } from "../avatarOptions";

export default function AvatarDisplay({ avatarId, name, size = 36, className = "" }) {
  const option = getAvatarOption(avatarId);
  const Icon = option?.icon;

  return (
    <div
      className={`avatar-display ${className}`}
      style={{
        width: size,
        height: size,
        background: option?.bg || "var(--primary)",
        fontSize: Math.round(size * 0.42),
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.55)} color="white" /> : (name?.charAt(0)?.toUpperCase() || "U")}
    </div>
  );
}
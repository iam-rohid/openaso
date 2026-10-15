export const FOLDER_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "gray"] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

export const DEFAULT_FOLDER_COLOR: FolderColor = "blue";
export const FOLDER_NAME_MAX = 50;

/** Tailwind classes per folder color: `text` tints the folder icon, `swatch` fills the picker dot. */
export const folderColorClasses: Record<FolderColor, { text: string; swatch: string }> = {
  red: { text: "text-red-500", swatch: "bg-red-500" },
  orange: { text: "text-orange-500", swatch: "bg-orange-500" },
  yellow: { text: "text-yellow-500", swatch: "bg-yellow-400" },
  green: { text: "text-green-500", swatch: "bg-green-500" },
  blue: { text: "text-sky-500", swatch: "bg-sky-500" },
  purple: { text: "text-fuchsia-500", swatch: "bg-fuchsia-500" },
  gray: { text: "text-zinc-400", swatch: "bg-zinc-400" },
};

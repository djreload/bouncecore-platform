export const chatReactionOptions = [
  { key: "like", label: "Like", icon: "👍" },
  { key: "love", label: "Love", icon: "❤️" },
  { key: "haha", label: "Haha", icon: "😂" },
  { key: "wow", label: "Wow", icon: "😮" },
  { key: "sad", label: "Sad", icon: "😢" },
  { key: "angry", label: "Angry", icon: "😡" }
] as const;

export type ChatReactionKey = (typeof chatReactionOptions)[number]["key"];

export function isChatReactionKey(value: string): value is ChatReactionKey {
  return chatReactionOptions.some((option) => option.key === value);
}

import React from "react";
import { HashtagText } from "@/components/HashtagText";

/**
 * Renders post/comment text with #hashtags (via HashtagText) and @mentions
 * highlighted in the accent color — matching the mobile PostCard treatment
 * (`mobile/components/PostCard.tsx`). Shared by the feed card and post detail.
 */
export function MentionHighlight({ text }: { text: string }) {
  const parts = text.split(/(?<!@)@[\w.]+/g);
  const matches = text.match(/(?<!@)@[\w.]+/g);
  if (!matches) return <HashtagText text={text} />;

  return (
    <>
      {parts.reduce<React.ReactNode[]>((acc, part, i) => {
        acc.push(<HashtagText key={`p${i}`} text={part} />);
        if (i < matches.length) {
          acc.push(
            <span key={`m${i}`} className="text-accent font-semibold">
              {matches[i]}
            </span>
          );
        }
        return acc;
      }, [])}
    </>
  );
}

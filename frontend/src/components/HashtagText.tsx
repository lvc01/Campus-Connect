import { Fragment } from "react";

export function HashtagText({ text }: { text: string }) {
  const parts = text.split(/(#[\w]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} className="font-medium text-accent">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

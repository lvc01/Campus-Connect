import React from "react";
import { cn } from "@/lib/utils";

type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

const gapX: Record<Gap, string> = {
  0:  "gap-x-0",
  1:  "gap-x-1",
  2:  "gap-x-2",
  3:  "gap-x-3",
  4:  "gap-x-4",
  5:  "gap-x-5",
  6:  "gap-x-6",
  8:  "gap-x-8",
  10: "gap-x-10",
  12: "gap-x-12",
};

export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  align?: "start" | "center" | "end" | "baseline" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  wrap?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

export const Row = React.forwardRef<HTMLDivElement, RowProps>(function Row(
  {
    gap = 3,
    align,
    justify,
    wrap = false,
    className,
    as: Tag = "div",
    children,
    ...props
  },
  ref,
) {
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={cn(
        "flex flex-row",
        gapX[gap],
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "baseline" && "items-baseline",
        align === "stretch" && "items-stretch",
        justify === "start" && "justify-start",
        justify === "center" && "justify-center",
        justify === "end" && "justify-end",
        justify === "between" && "justify-between",
        justify === "around" && "justify-around",
        justify === "evenly" && "justify-evenly",
        wrap && "flex-wrap",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

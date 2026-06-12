import React from "react";
import { cn } from "@/lib/utils";

type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

const gapY: Record<Gap, string> = {
  0:  "gap-y-0",
  1:  "gap-y-1",
  2:  "gap-y-2",
  3:  "gap-y-3",
  4:  "gap-y-4",
  5:  "gap-y-5",
  6:  "gap-y-6",
  8:  "gap-y-8",
  10: "gap-y-10",
  12: "gap-y-12",
};

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  align?: "start" | "center" | "end" | "stretch";
  as?: keyof React.JSX.IntrinsicElements;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(function Stack(
  { gap = 3, align, className, as: Tag = "div", children, ...props },
  ref,
) {
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={cn(
        "flex flex-col",
        gapY[gap],
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "stretch" && "items-stretch",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

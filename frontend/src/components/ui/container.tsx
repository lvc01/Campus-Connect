import React from "react";
import { cn } from "@/lib/utils";

export type ContainerSize = "feed" | "wide" | "full";

const sizeMap: Record<ContainerSize, string> = {
  feed: "max-w-[600px]",
  wide: "max-w-[990px]",
  full: "max-w-[1265px]",
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  as?: keyof React.JSX.IntrinsicElements;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { size = "full", as: Tag = "div", className, children, ...props },
  ref,
) {
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={cn("w-full mx-auto px-4 sm:px-6", sizeMap[size], className)}
      {...props}
    >
      {children}
    </Comp>
  );
});

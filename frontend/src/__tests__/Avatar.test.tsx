import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "@/components/Avatar";

describe("Avatar", () => {
  it("renders initials when no avatar URL", () => {
    render(<Avatar user={{ name: "John Doe" }} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("uses display_name from profile", () => {
    render(
      <Avatar
        user={{
          profile: { display_name: "Jane Smith", avatar_url: null },
        }}
      />
    );
    expect(screen.getByText("JS")).toBeInTheDocument();
  });

  it("falls back to 'User' when no name info", () => {
    render(<Avatar user={{}} />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("renders image when avatar_url is provided", () => {
    render(
      <Avatar
        user={{
          name: "Test",
          profile: { display_name: "Test", avatar_url: "https://example.com/avatar.jpg" },
        }}
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("applies custom size", () => {
    render(<Avatar user={{ name: "AB" }} size={64} />);
    const span = screen.getByLabelText("AB");
    expect(span).toHaveStyle({ width: "64px", height: "64px" });
  });
});

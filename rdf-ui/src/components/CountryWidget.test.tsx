import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import UsersByCountryWidget from "./CountryWidget";

describe("UsersByCountryWidget", () => {
  it("toggles full country list and forwards country clicks", async () => {
    const onCountryClick = vi.fn();
    const user = userEvent.setup();

    render(
      <UsersByCountryWidget
        totalOverride={30}
        theme="light"
        onCountryClick={onCountryClick}
        rows={[
          { name: "United States", code: "US", value: 10, color: "rgba(30,64,175,0.8)" },
          { name: "Germany", code: "DE", value: 8, color: "rgba(30,64,175,0.7)" },
          { name: "United Kingdom", code: "GB", value: 6, color: "rgba(30,64,175,0.6)" },
          { name: "France", code: "FR", value: 4, color: "rgba(30,64,175,0.5)" },
          { name: "Japan", code: "JP", value: 2, color: "rgba(30,64,175,0.4)" },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Japan" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show all countries" }));

    expect(screen.getByRole("button", { name: "Show less countries" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Japan" }));

    expect(onCountryClick).toHaveBeenCalledWith("JP", "Japan");
  });
});

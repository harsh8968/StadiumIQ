import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuList } from "@/components/order/MenuList";
import type { MenuItem } from "@/lib/mock/menus";

/**
 * Tests for components/order/MenuList.tsx
 *
 * MenuList renders the concession menu with quantity stepper controls.
 * It is the primary UI through which fans build their cart, which then
 * drives the GA4 `order_placed` conversion event and Firebase Analytics
 * `purchase` event. Testing this component covers the full fan-facing
 * order entry flow.
 */

const burgerItem: MenuItem = {
  id: "burger",
  name: "Classic Burger",
  description: "Juicy beef patty with lettuce and tomato",
  priceCents: 1200,
};

const beerItem: MenuItem = {
  id: "beer",
  name: "IPA",
  description: "Craft India Pale Ale",
  priceCents: 800,
};

const pizzaItem: MenuItem = {
  id: "pizza",
  name: "Margherita Pizza",
  description: "Classic tomato and mozzarella",
  priceCents: 1500,
};

const allItems: MenuItem[] = [burgerItem, beerItem, pizzaItem];

// ── Rendering ────────────────────────────────────────────────────────────────

describe("MenuList — rendering", () => {
  it("renders all provided menu items", () => {
    render(<MenuList items={allItems} cart={{}} onChange={vi.fn()} />);
    expect(screen.getByText("Classic Burger")).toBeTruthy();
    expect(screen.getByText("IPA")).toBeTruthy();
    expect(screen.getByText("Margherita Pizza")).toBeTruthy();
  });

  it("renders item descriptions", () => {
    render(<MenuList items={allItems} cart={{}} onChange={vi.fn()} />);
    expect(screen.getByText("Juicy beef patty with lettuce and tomato")).toBeTruthy();
  });

  it("displays formatted prices for each item", () => {
    render(<MenuList items={allItems} cart={{}} onChange={vi.fn()} />);
    expect(screen.getByText("$12.00")).toBeTruthy();
    expect(screen.getByText("$8.00")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
  });

  it("renders a quantity of 0 for each item when cart is empty", () => {
    render(<MenuList items={allItems} cart={{}} onChange={vi.fn()} />);
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBe(3);
  });

  it("shows current quantities from the cart prop", () => {
    render(
      <MenuList items={allItems} cart={{ burger: 2, beer: 1 }} onChange={vi.fn()} />,
    );
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders with an empty items array without crashing", () => {
    expect(() =>
      render(<MenuList items={[]} cart={{}} onChange={vi.fn()} />),
    ).not.toThrow();
  });
});

// ── Increment ────────────────────────────────────────────────────────────────

describe("MenuList — add item (+ button)", () => {
  it("calls onChange with incremented qty when + is clicked", () => {
    const onChange = vi.fn();
    render(<MenuList items={[burgerItem]} cart={{}} onChange={onChange} />);

    // Each item has two buttons: minus and plus. Click the second (plus).
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // plus button

    expect(onChange).toHaveBeenCalledWith({ burger: 1 });
  });

  it("increments existing quantity correctly", () => {
    const onChange = vi.fn();
    render(
      <MenuList items={[burgerItem]} cart={{ burger: 3 }} onChange={onChange} />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // plus
    expect(onChange).toHaveBeenCalledWith({ burger: 4 });
  });
});

// ── Decrement ────────────────────────────────────────────────────────────────

describe("MenuList — remove item (- button)", () => {
  it("minus button is disabled when qty is 0", () => {
    render(<MenuList items={[burgerItem]} cart={{}} onChange={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled(); // minus button
  });

  it("calls onChange with decremented qty when - is clicked", () => {
    const onChange = vi.fn();
    render(
      <MenuList items={[burgerItem]} cart={{ burger: 3 }} onChange={onChange} />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // minus
    expect(onChange).toHaveBeenCalledWith({ burger: 2 });
  });

  it("removes item from cart when qty decrements to 0", () => {
    const onChange = vi.fn();
    render(
      <MenuList items={[burgerItem]} cart={{ burger: 1 }} onChange={onChange} />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // minus → should remove burger key
    const calledWith = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(calledWith).not.toHaveProperty("burger");
  });
});

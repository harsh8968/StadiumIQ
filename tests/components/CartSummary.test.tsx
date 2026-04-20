import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CartSummary } from "@/components/order/CartSummary";
import type { MenuItem } from "@/lib/mock/menus";

/**
 * Tests for components/order/CartSummary.tsx
 *
 * CartSummary is the sticky bottom bar in the order flow. It aggregates
 * cart items, computes subtotal + tax, and renders the "Place Order" CTA.
 * GA4 + Firebase Analytics conversion events fire when the order is placed,
 * so this component is in the critical path of our Google Services funnel.
 */

const burgerItem: MenuItem = {
  id: "burger",
  name: "Classic Burger",
  description: "Juicy beef patty",
  priceCents: 1200,
};

const friesItem: MenuItem = {
  id: "fries",
  name: "Fries",
  description: "Crispy fries",
  priceCents: 500,
};

const allItems: MenuItem[] = [burgerItem, friesItem];

describe("CartSummary — empty cart state", () => {
  it("renders the 'Add items to order' prompt when cart is empty", () => {
    render(
      <CartSummary items={allItems} cart={{}} loading={false} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText(/Add items to order/i)).toBeTruthy();
  });

  it("disables the Place Order button when cart is empty", () => {
    render(
      <CartSummary items={allItems} cart={{}} loading={false} onPlaceOrder={vi.fn()} />,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("does not show individual item rows when cart is empty", () => {
    render(
      <CartSummary items={allItems} cart={{}} loading={false} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.queryByText("Classic Burger")).toBeNull();
    expect(screen.queryByText("Fries")).toBeNull();
  });
});

describe("CartSummary — populated cart state", () => {
  it("renders the item name and quantity for each cart item", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 2, fries: 1 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    expect(screen.getByText(/Classic Burger × 2/)).toBeTruthy();
    expect(screen.getByText(/Fries × 1/)).toBeTruthy();
  });

  it("computes and displays individual line totals correctly", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 2 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    // 2 × $12.00 = $24.00
    expect(screen.getByText("$24.00")).toBeTruthy();
  });

  it("shows the tax row with label 'Tax (8.875%)'", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    expect(screen.getByText(/Tax \(8\.875%\)/)).toBeTruthy();
  });

  it("shows correct tax amount for a $12.00 item", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    // Tax: round(1200 * 0.08875) = round(106.5) = 107 → $1.07
    expect(screen.getByText("$1.07")).toBeTruthy();
  });

  it("shows the Total row", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    expect(screen.getByText("Total")).toBeTruthy();
  });

  it("enables the Place Order button when cart has items", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
  });

  it("shows the total in the Place Order button label", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={false}
        onPlaceOrder={vi.fn()}
      />,
    );
    // $12.00 + $1.07 tax = $13.07
    expect(screen.getByRole("button").textContent).toContain("$13.07");
  });
});

describe("CartSummary — interaction", () => {
  it("calls onPlaceOrder when the button is clicked", () => {
    const onPlaceOrder = vi.fn();
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={false}
        onPlaceOrder={onPlaceOrder}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onPlaceOrder).toHaveBeenCalledOnce();
  });

  it("does not call onPlaceOrder when the cart is empty", () => {
    const onPlaceOrder = vi.fn();
    render(
      <CartSummary items={allItems} cart={{}} loading={false} onPlaceOrder={onPlaceOrder} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onPlaceOrder).not.toHaveBeenCalled();
  });
});

describe("CartSummary — loading state", () => {
  it("shows 'Placing order…' when loading is true", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={true}
        onPlaceOrder={vi.fn()}
      />,
    );
    expect(screen.getByText(/Placing order…/)).toBeTruthy();
  });

  it("disables the button while loading", () => {
    render(
      <CartSummary
        items={allItems}
        cart={{ burger: 1 }}
        loading={true}
        onPlaceOrder={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

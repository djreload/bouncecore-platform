"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LogIn, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

const storageKey = "bouncecore.shopCart.v1";
const maxQuantity = 10;

export type ShopCartVariant = {
  id: string;
  imageUrl: string | null;
  pricePence: number;
  productName: string;
  sku: string;
  stock: number;
  variantName: string;
};

type CartItem = {
  quantity: number;
  variantId: string;
};

type CartLine = CartItem & {
  variant: ShopCartVariant;
};

type ShopCartContextValue = {
  addVariant: (variantId: string) => void;
  isInCart: (variantId: string) => boolean;
  openCart: () => void;
};

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function clampQuantity(value: number, variant: ShopCartVariant) {
  return Math.max(1, Math.min(maxQuantity, variant.stock, value));
}

function storedCartItems(variantsById: Map<string, ShopCartVariant>) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : null))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => {
        const variantId = typeof item.variantId === "string" ? item.variantId : "";
        const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
        const variant = variantsById.get(variantId);

        if (!variant || variant.stock < 1 || !Number.isFinite(quantity)) {
          return null;
        }

        return {
          quantity: clampQuantity(Math.round(quantity), variant),
          variantId
        };
      })
      .filter((item): item is CartItem => Boolean(item));
  } catch {
    return [];
  }
}

function useShopCart() {
  const context = useContext(ShopCartContext);

  if (!context) {
    throw new Error("Shop cart controls must be rendered inside ShopCartProvider.");
  }

  return context;
}

export function ShopCartProvider({
  checkoutReady,
  checkoutReason,
  children,
  signedIn,
  variants
}: {
  checkoutReady: boolean;
  checkoutReason: string | null;
  children: ReactNode;
  signedIn: boolean;
  variants: ShopCartVariant[];
}) {
  const variantsById = useMemo(() => new Map(variants.map((variant) => [variant.id, variant])), [variants]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCartItems(storedCartItems(variantsById)));

    return () => window.cancelAnimationFrame(frame);
  }, [variantsById]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(cartItems));
  }, [cartItems]);

  const cartLines = useMemo(
    () =>
      cartItems
        .map((item) => {
          const variant = variantsById.get(item.variantId);

          if (!variant) {
            return null;
          }

          return {
            ...item,
            variant
          };
        })
        .filter((line): line is CartLine => Boolean(line)),
    [cartItems, variantsById]
  );
  const totalPence = cartLines.reduce((total, line) => total + line.variant.pricePence * line.quantity, 0);
  const totalQuantity = cartLines.reduce((total, line) => total + line.quantity, 0);

  function setQuantity(variantId: string, quantity: number) {
    const variant = variantsById.get(variantId);

    if (!variant) {
      return;
    }

    setCartItems((current) =>
      current.map((item) => (item.variantId === variantId ? { ...item, quantity: clampQuantity(quantity, variant) } : item))
    );
  }

  const value: ShopCartContextValue = {
    addVariant: (variantId) => {
      const variant = variantsById.get(variantId);

      if (!variant || variant.stock < 1) {
        return;
      }

      setCartItems((current) => {
        const existing = current.find((item) => item.variantId === variantId);

        if (existing) {
          return current.map((item) =>
            item.variantId === variantId ? { ...item, quantity: clampQuantity(item.quantity + 1, variant) } : item
          );
        }

        return [...current, { quantity: 1, variantId }];
      });
      setCartOpen(true);
    },
    isInCart: (variantId) => cartItems.some((item) => item.variantId === variantId),
    openCart: () => setCartOpen(true)
  };

  return (
    <ShopCartContext.Provider value={value}>
      {children}

      {cartLines.length ? (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md">
          {!cartOpen ? (
            <Button className="w-full justify-between" onClick={() => setCartOpen(true)} type="button" variant="primary">
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Basket
              </span>
              <span>{totalQuantity} / {formatMoney(totalPence)}</span>
            </Button>
          ) : (
            <section className="rounded-md border border-bc-line bg-bc-panel shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between gap-3 border-b border-bc-line p-4">
                <div>
                  <h2 className="font-black">Shop basket</h2>
                  <p className="mt-1 text-sm text-bc-muted">{totalQuantity} items / {formatMoney(totalPence)}</p>
                </div>
                <button
                  aria-label="Close shop basket"
                  className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-white"
                  onClick={() => setCartOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto p-3">
                {cartLines.map((line) => (
                  <div className="grid gap-3 border-b border-bc-line py-3 last:border-b-0" key={line.variantId}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{line.variant.productName}</p>
                        <p className="mt-1 text-xs text-bc-muted">
                          {line.variant.variantName} / {line.variant.sku}
                        </p>
                      </div>
                      <p className="text-sm font-black">{formatMoney(line.variant.pricePence * line.quantity)}</p>
                      <button
                        aria-label={`Remove ${line.variant.productName} ${line.variant.variantName} from basket`}
                        className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-bc-muted hover:text-white"
                        onClick={() => setCartItems((current) => current.filter((item) => item.variantId !== line.variantId))}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={`Reduce ${line.variant.productName} quantity`}
                          className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-white"
                          onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                          type="button"
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="grid h-9 min-w-12 place-items-center rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          aria-label={`Increase ${line.variant.productName} quantity`}
                          className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-white"
                          disabled={line.quantity >= Math.min(maxQuantity, line.variant.stock)}
                          onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          type="button"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="text-xs text-bc-muted">{line.variant.stock} available</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-bc-line p-4">
                {!signedIn ? (
                  <ButtonLink className="w-full" href="/auth/login?error=auth-required" variant="primary">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Login to checkout
                  </ButtonLink>
                ) : (
                  <form action="/shop/checkout" method="post">
                    {cartLines.map((line) => (
                      <div key={line.variantId}>
                        <input name="variantId" type="hidden" value={line.variantId} />
                        <input name="quantity" type="hidden" value={line.quantity} />
                      </div>
                    ))}
                    <Button className="w-full" disabled={!checkoutReady} type="submit" variant="primary">
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      Checkout with PayPal
                    </Button>
                    {!checkoutReady ? <p className="mt-2 text-xs text-bc-muted">{checkoutReason}</p> : null}
                  </form>
                )}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </ShopCartContext.Provider>
  );
}

export function ShopCartButton({ disabled, size = "sm", variantId }: { disabled?: boolean; size?: "sm" | "md"; variantId: string }) {
  const { addVariant, isInCart, openCart } = useShopCart();
  const added = isInCart(variantId);

  if (added) {
    return (
      <Button onClick={openCart} size={size} type="button" variant="ghost">
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        In basket
      </Button>
    );
  }

  return (
    <Button disabled={disabled} onClick={() => addVariant(variantId)} size={size} type="button" variant="primary">
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      Add to cart
    </Button>
  );
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { LogIn, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { dispatchCartUpdated } from "@/lib/cart/cart-events";
import { shopCartStorageKey } from "@/lib/cart/storage-keys";
import { privacyPolicyHref, termsHref } from "@/lib/privacy/privacy-config";
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
const shippingInputClasses = "min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white";

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
    const parsed = JSON.parse(window.localStorage.getItem(shopCartStorageKey) ?? "[]") as unknown;

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

function ShippingField({ children, help }: { children: ReactNode; help: ReactNode }) {
  return (
    <label className="block min-w-0">
      {children}
      <span className="mt-1 block text-[11px] leading-snug text-bc-muted">{help}</span>
    </label>
  );
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
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCartItems(storedCartItems(variantsById));
      setCartHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [variantsById]);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    window.localStorage.setItem(shopCartStorageKey, JSON.stringify(cartItems));
    dispatchCartUpdated();
  }, [cartHydrated, cartItems]);

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
            <section className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-md border border-bc-line bg-bc-panel shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
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
                    <div className="mb-4 grid gap-3 rounded-md border border-bc-line bg-bc-panel p-3">
                      <div>
                        <h3 className="text-sm font-black">Shipping address</h3>
                        <p className="mt-1 text-xs text-bc-muted">Used by fulfilment for physical shop products.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ShippingField help="Full name for the delivery label.">
                          <input
                            autoComplete="shipping name"
                            className={shippingInputClasses}
                            name="shippingName"
                            placeholder="Full name"
                            required
                          />
                        </ShippingField>
                        <ShippingField help="Email for delivery questions and order updates.">
                          <input
                            autoComplete="shipping email"
                            className={shippingInputClasses}
                            name="shippingEmail"
                            placeholder="Email"
                            required
                            type="email"
                          />
                        </ShippingField>
                      </div>
                      <ShippingField help="Phone number for courier contact if needed.">
                        <input autoComplete="shipping tel" className={shippingInputClasses} name="shippingPhone" placeholder="Phone" />
                      </ShippingField>
                      <ShippingField help="House number, building, and street.">
                        <input
                          autoComplete="shipping address-line1"
                          className={shippingInputClasses}
                          name="shippingLine1"
                          placeholder="Address line 1"
                          required
                        />
                      </ShippingField>
                      <ShippingField help="Flat, unit, or extra delivery detail.">
                        <input
                          autoComplete="shipping address-line2"
                          className={shippingInputClasses}
                          name="shippingLine2"
                          placeholder="Address line 2"
                        />
                      </ShippingField>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ShippingField help="Town or city for delivery.">
                          <input
                            autoComplete="shipping address-level2"
                            className={shippingInputClasses}
                            name="shippingCity"
                            placeholder="Town / city"
                            required
                          />
                        </ShippingField>
                        <ShippingField help="County, state, or region.">
                          <input
                            autoComplete="shipping address-level1"
                            className={shippingInputClasses}
                            name="shippingCounty"
                            placeholder="County / region"
                          />
                        </ShippingField>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ShippingField help="Postcode or ZIP code.">
                          <input
                            autoComplete="shipping postal-code"
                            className={shippingInputClasses}
                            name="shippingPostcode"
                            placeholder="Postcode"
                            required
                          />
                        </ShippingField>
                        <ShippingField help="Destination country.">
                          <input
                            autoComplete="shipping country-name"
                            className={shippingInputClasses}
                            defaultValue="United Kingdom"
                            name="shippingCountry"
                            placeholder="Country"
                            required
                          />
                        </ShippingField>
                      </div>
                    </div>
                    <Button className="w-full" disabled={!checkoutReady} type="submit" variant="primary">
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      Checkout with PayPal
                    </Button>
                    <p className="mt-2 text-xs leading-5 text-bc-muted">
                      Checkout stores order, shipping, fulfilment, and PayPal reference details. See{" "}
                      <Link className="font-semibold text-bc-electric hover:text-white" href={privacyPolicyHref}>
                        Privacy
                      </Link>{" "}
                      and{" "}
                      <Link className="font-semibold text-bc-electric hover:text-white" href={termsHref}>
                        Terms
                      </Link>
                      .
                    </p>
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

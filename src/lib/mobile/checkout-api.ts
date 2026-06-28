import { type CurrentUser } from "@/lib/auth/rbac";
import {
  cancelTrackCartCheckout,
  cancelTrackCheckout,
  completeTrackCartCheckout,
  completeTrackCheckout,
  startTrackCartCheckout,
  startTrackCheckout
} from "@/lib/music/track-checkout-service";
import { cancelStarsCheckout, completeStarsCheckout, startStarsCheckout } from "@/lib/rewards/stars-checkout-service";
import { cancelShopCheckout, completeShopCheckout, startShopCartCheckout, startShopCheckout } from "@/lib/shop/checkout-service";

export type MobileCheckoutPayload = {
  checkoutId?: string;
  items?: {
    quantity?: string;
    variantId?: string;
  }[];
  paypalOrderId?: string;
  purchaseId?: string;
  orderId?: string;
  packageId?: string;
  quantities?: string[];
  quantity?: string;
  shippingAddress?: {
    city?: string;
    country?: string;
    county?: string;
    email?: string;
    line1?: string;
    line2?: string;
    name?: string;
    phone?: string;
    postcode?: string;
  };
  trackIds?: string[];
  trackId?: string;
  variantIds?: string[];
  variantId?: string;
};

function payloadString(payload: MobileCheckoutPayload, key: keyof MobileCheckoutPayload) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function payloadTrackIds(payload: MobileCheckoutPayload) {
  if (Array.isArray(payload.trackIds)) {
    return payload.trackIds.filter((trackId): trackId is string => typeof trackId === "string");
  }

  return [];
}

function payloadShopItems(payload: MobileCheckoutPayload) {
  if (Array.isArray(payload.items)) {
    return payload.items
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => ({
        quantity: typeof item.quantity === "string" ? item.quantity : "1",
        variantId: typeof item.variantId === "string" ? item.variantId : ""
      }))
      .filter((item) => item.variantId);
  }

  if (Array.isArray(payload.variantIds)) {
    const quantities = Array.isArray(payload.quantities) ? payload.quantities : [];

    return payload.variantIds
      .filter((variantId): variantId is string => typeof variantId === "string")
      .map((variantId, index) => ({
        quantity: typeof quantities[index] === "string" ? quantities[index] : "1",
        variantId
      }));
  }

  return [];
}

function payloadShippingAddress(payload: MobileCheckoutPayload) {
  const shipping = payload.shippingAddress;

  if (!shipping || typeof shipping !== "object" || Array.isArray(shipping)) {
    return {};
  }

  return shipping;
}

export async function startMobileShopCheckout(user: CurrentUser, origin: string, payload: MobileCheckoutPayload) {
  const items = payloadShopItems(payload);

  if (items.length) {
    const checkout = await startShopCartCheckout(user.id, {
      items,
      origin,
      shippingAddress: payloadShippingAddress(payload)
    });

    return {
      approvalUrl: checkout.approvalUrl,
      orderId: checkout.orderId,
      provider: "paypal",
      status: "pending"
    };
  }

  const checkout = await startShopCheckout(user.id, {
    origin,
    quantity: payloadString(payload, "quantity") || "1",
    shippingAddress: payloadShippingAddress(payload),
    variantId: payloadString(payload, "variantId")
  });

  return {
    approvalUrl: checkout.approvalUrl,
    orderId: checkout.orderId,
    provider: "paypal",
    status: "pending"
  };
}

export async function captureMobileShopCheckout(user: CurrentUser, payload: MobileCheckoutPayload) {
  const order = await completeShopCheckout(user.id, payloadString(payload, "orderId"), payloadString(payload, "paypalOrderId"));

  return {
    orderId: order.id,
    paypalCaptureId: order.paypalCaptureId,
    status: order.status,
    totalPence: order.totalPence
  };
}

export async function cancelMobileShopCheckout(user: CurrentUser, payload: MobileCheckoutPayload) {
  const order = await cancelShopCheckout(user.id, payloadString(payload, "orderId"), payloadString(payload, "paypalOrderId") || undefined);

  return {
    orderId: order?.id ?? null,
    status: order?.status ?? "cancelled"
  };
}

export async function startMobileMusicCheckout(user: CurrentUser, origin: string, payload: MobileCheckoutPayload) {
  const trackIds = payloadTrackIds(payload);

  if (trackIds.length) {
    const checkout = await startTrackCartCheckout(user.id, {
      origin,
      trackIds
    });

    return {
      approvalUrl: checkout.approvalUrl,
      checkoutId: checkout.checkoutId,
      provider: "paypal",
      status: "pending"
    };
  }

  const checkout = await startTrackCheckout(user.id, {
    origin,
    trackId: payloadString(payload, "trackId")
  });

  return {
    approvalUrl: checkout.approvalUrl,
    provider: "paypal",
    purchaseId: checkout.purchaseId,
    status: "pending"
  };
}

export async function captureMobileMusicCheckout(user: CurrentUser, payload: MobileCheckoutPayload) {
  const checkoutId = payloadString(payload, "checkoutId");

  if (checkoutId) {
    const checkout = await completeTrackCartCheckout(user.id, checkoutId, payloadString(payload, "paypalOrderId"));

    return {
      checkoutId: checkout.id,
      paypalCaptureId: checkout.paypalCaptureId,
      status: checkout.status,
      totalPence: checkout.totalPence
    };
  }

  const purchase = await completeTrackCheckout(user.id, payloadString(payload, "purchaseId"), payloadString(payload, "paypalOrderId"));

  return {
    paypalCaptureId: purchase.paypalCaptureId,
    purchaseId: purchase.id,
    status: purchase.status,
    trackId: purchase.trackId
  };
}

export async function cancelMobileMusicCheckout(user: CurrentUser, payload: MobileCheckoutPayload) {
  const checkoutId = payloadString(payload, "checkoutId");

  if (checkoutId) {
    const checkout = await cancelTrackCartCheckout(user.id, checkoutId, payloadString(payload, "paypalOrderId") || undefined);

    return {
      checkoutId: checkout?.id ?? null,
      status: checkout?.status ?? "cancelled"
    };
  }

  const purchase = await cancelTrackCheckout(user.id, payloadString(payload, "purchaseId"), payloadString(payload, "paypalOrderId") || undefined);

  return {
    purchaseId: purchase?.id ?? null,
    status: purchase?.status ?? "cancelled"
  };
}

export async function startMobileStarsCheckout(user: CurrentUser, origin: string, payload: MobileCheckoutPayload) {
  const checkout = await startStarsCheckout(user.id, {
    origin,
    packageId: payloadString(payload, "packageId")
  });

  return {
    approvalUrl: checkout.approvalUrl,
    provider: "paypal",
    purchaseId: checkout.purchaseId,
    status: "pending"
  };
}

export async function captureMobileStarsCheckout(user: CurrentUser, payload: MobileCheckoutPayload) {
  const purchase = await completeStarsCheckout(user.id, payloadString(payload, "purchaseId"), payloadString(payload, "paypalOrderId"));

  return {
    paypalCaptureId: purchase.paypalCaptureId,
    purchaseId: purchase.id,
    stars: purchase.stars,
    status: purchase.status
  };
}

export async function cancelMobileStarsCheckout(user: CurrentUser, payload: MobileCheckoutPayload) {
  const purchase = await cancelStarsCheckout(user.id, payloadString(payload, "purchaseId"), payloadString(payload, "paypalOrderId") || undefined);

  return {
    purchaseId: purchase?.id ?? null,
    status: purchase?.status ?? "cancelled"
  };
}

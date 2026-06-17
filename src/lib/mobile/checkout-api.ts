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
import { cancelShopCheckout, completeShopCheckout, startShopCheckout } from "@/lib/shop/checkout-service";

export type MobileCheckoutPayload = {
  checkoutId?: string;
  paypalOrderId?: string;
  purchaseId?: string;
  orderId?: string;
  packageId?: string;
  quantity?: string;
  trackIds?: string[];
  trackId?: string;
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

export async function startMobileShopCheckout(user: CurrentUser, origin: string, payload: MobileCheckoutPayload) {
  const checkout = await startShopCheckout(user.id, {
    origin,
    quantity: payloadString(payload, "quantity") || "1",
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

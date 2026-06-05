"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { orderStatusOptions, updateOrderStatus, type OrderStatus } from "@/lib/shop/order-service";
import type { AdminOrdersActionState } from "@/app/admin/orders/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isOrderStatus(value: string): value is OrderStatus {
  return orderStatusOptions.includes(value as OrderStatus);
}

function revalidateOrderViews() {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/fulfilment");
  revalidatePath("/admin/supporters");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account/orders");
  revalidatePath("/account/rewards");
}

export async function adminOrdersAction(
  _previousState: AdminOrdersActionState,
  formData: FormData
): Promise<AdminOrdersActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "shop.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage orders."
    };
  }

  try {
    const status = formString(formData, "status");

    if (!isOrderStatus(status)) {
      return {
        status: "error",
        message: "Invalid order status."
      };
    }

    const order = await updateOrderStatus(actor.id, formString(formData, "orderId"), status);
    revalidateOrderViews();

    return {
      status: "success",
      message: `Order ${order.id.slice(0, 8)} moved to ${order.status}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Order action failed."
    };
  }
}

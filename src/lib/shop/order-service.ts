import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

export const orderStatusOptions = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;

export type OrderStatus = (typeof orderStatusOptions)[number];

export type OrderItemRow = {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPricePence: number;
  totalPence: number;
};

export type OrderRow = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalPence: number;
  currency: string;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: OrderItemRow[];
};

export type OrderStats = {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  processingOrders: number;
  fulfilledOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  grossPence: number;
  activeFulfilment: number;
};

export type OrdersData = {
  orders: OrderRow[];
  stats: OrderStats;
};

function assertOrderStatus(status: string): asserts status is OrderStatus {
  if (!orderStatusOptions.includes(status as OrderStatus)) {
    throw new Error("Invalid order status.");
  }
}

function toOrderRow(order: {
  id: string;
  userId: string;
  status: string;
  totalPence: number;
  currency: string;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  items: OrderItemRow[];
  user: {
    displayName: string;
    email: string;
  };
}): OrderRow {
  return {
    id: order.id,
    userId: order.userId,
    customerName: order.user.displayName,
    customerEmail: order.user.email,
    status: order.status,
    totalPence: order.totalPence,
    currency: order.currency,
    paypalOrderId: order.paypalOrderId,
    paypalCaptureId: order.paypalCaptureId,
    paypalPayerEmail: order.paypalPayerEmail,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      sku: item.sku,
      totalPence: item.totalPence,
      unitPricePence: item.unitPricePence,
      variantName: item.variantName
    }))
  };
}

function statsForOrders(orders: OrderRow[]): OrderStats {
  return {
    activeFulfilment: orders.filter((order) => ["paid", "processing"].includes(order.status)).length,
    cancelledOrders: orders.filter((order) => order.status === "cancelled").length,
    fulfilledOrders: orders.filter((order) => order.status === "fulfilled").length,
    grossPence: orders
      .filter((order) => !["cancelled", "refunded"].includes(order.status))
      .reduce((total, order) => total + order.totalPence, 0),
    paidOrders: orders.filter((order) => order.status === "paid").length,
    pendingOrders: orders.filter((order) => order.status === "pending").length,
    processingOrders: orders.filter((order) => order.status === "processing").length,
    refundedOrders: orders.filter((order) => order.status === "refunded").length,
    totalOrders: orders.length
  };
}

export async function getAccountOrdersData(userId: string): Promise<OrdersData> {
  const orders = await prisma.order.findMany({
    where: {
      userId
    },
    include: {
      items: {
        orderBy: {
          productName: "asc"
        }
      },
      user: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });
  const rows = orders.map(toOrderRow);

  return {
    orders: rows,
    stats: statsForOrders(rows)
  };
}

export async function getAdminOrdersData(): Promise<OrdersData> {
  const orders = await prisma.order.findMany({
    include: {
      items: {
        orderBy: {
          productName: "asc"
        }
      },
      user: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 200
  });
  const rows = orders.map(toOrderRow);

  return {
    orders: rows,
    stats: statsForOrders(rows)
  };
}

export async function getAdminFulfilmentData(): Promise<OrdersData> {
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ["paid", "processing"]
      }
    },
    include: {
      items: {
        orderBy: {
          productName: "asc"
        }
      },
      user: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 200
  });
  const rows = orders.map(toOrderRow);

  return {
    orders: rows,
    stats: statsForOrders(rows)
  };
}

export async function updateOrderStatus(actorId: string, orderId: string, status: string) {
  if (!orderId) {
    throw new Error("Missing order.");
  }

  assertOrderStatus(status);

  const existing = await prisma.order.findUniqueOrThrow({
    where: {
      id: orderId
    }
  });
  const order = await prisma.order.update({
    where: {
      id: orderId
    },
    data: {
      status
    }
  });

  await writeAuditLog({
    actorId,
    action: "shop.order.status_update",
    target: `order:${order.id}`,
    severity: existing.status !== order.status ? "warning" : "info",
    metadata: {
      previousStatus: existing.status,
      status: order.status,
      totalPence: order.totalPence,
      userId: order.userId
    }
  });

  return order;
}

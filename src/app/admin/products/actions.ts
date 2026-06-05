"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  archiveProduct,
  createProduct,
  createProductVariant,
  productStatusOptions,
  updateProduct,
  updateProductVariant,
  type ProductInput,
  type ProductStatus,
  type ProductVariantInput
} from "@/lib/shop/shop-service";
import { saveOptionalImageUpload } from "@/lib/media/media-service";
import type { AdminProductsActionState } from "@/app/admin/products/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function isProductStatus(value: string): value is ProductStatus {
  return productStatusOptions.includes(value as ProductStatus);
}

async function productInput(formData: FormData): Promise<ProductInput> {
  const status = formString(formData, "status");
  const uploadedImageUrl = await saveOptionalImageUpload(formFile(formData, "imageFile"), "product-images");

  if (!isProductStatus(status)) {
    throw new Error("Invalid product status.");
  }

  return {
    description: formString(formData, "description"),
    imageUrl: uploadedImageUrl ?? formString(formData, "imageUrl"),
    name: formString(formData, "name"),
    productId: formString(formData, "productId") || undefined,
    slug: formString(formData, "slug"),
    status
  };
}

function variantInput(formData: FormData): ProductVariantInput {
  return {
    name: formString(formData, "variantName"),
    pricePounds: formString(formData, "pricePounds"),
    productId: formString(formData, "productId"),
    sku: formString(formData, "sku"),
    stock: formString(formData, "stock"),
    variantId: formString(formData, "variantId") || undefined
  };
}

function revalidateShopViews() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/shop");
}

export async function adminProductsAction(
  _previousState: AdminProductsActionState,
  formData: FormData
): Promise<AdminProductsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "shop.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage shop products."
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "create-product") {
      const product = await createProduct(actor.id, await productInput(formData));
      revalidateShopViews();

      return {
        status: "success",
        message: `Product ${product.name} created.`
      };
    }

    if (intent === "update-product") {
      const product = await updateProduct(actor.id, await productInput(formData));
      revalidateShopViews();

      return {
        status: "success",
        message: `Product ${product.name} updated.`
      };
    }

    if (intent === "archive-product") {
      await archiveProduct(actor.id, formString(formData, "productId"));
      revalidateShopViews();

      return {
        status: "success",
        message: "Product archived."
      };
    }

    if (intent === "create-variant") {
      const variant = await createProductVariant(actor.id, variantInput(formData));
      revalidateShopViews();

      return {
        status: "success",
        message: `Variant ${variant.name} created.`
      };
    }

    if (intent === "update-variant") {
      const variant = await updateProductVariant(actor.id, variantInput(formData));
      revalidateShopViews();

      return {
        status: "success",
        message: `Variant ${variant.name} updated.`
      };
    }

    return {
      status: "error",
      message: "Unknown product action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Product action failed."
    };
  }
}

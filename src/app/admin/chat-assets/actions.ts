"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import {
  chatAssetKindOptions,
  chatStickerPackStatusOptions,
  createChatStickerAsset,
  createChatStickerPack,
  updateChatStickerAsset,
  updateChatStickerPack,
  type ChatStickerAssetInput,
  type ChatStickerPackInput
} from "@/lib/chat/chat-asset-service";
import { normalizeOptionalChatAssetUrl, saveOptionalChatAssetUpload } from "@/lib/media/media-service";
import type { AdminChatAssetsActionState } from "@/app/admin/chat-assets/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);

  return value instanceof File ? value : null;
}

function formNumber(formData: FormData, key: string) {
  const value = Number(formString(formData, key));

  return Number.isFinite(value) ? value : 0;
}

function packInput(formData: FormData): ChatStickerPackInput {
  return {
    description: formString(formData, "description"),
    name: formString(formData, "name"),
    packId: formString(formData, "packId") || undefined,
    slug: formString(formData, "slug"),
    sortOrder: formNumber(formData, "sortOrder"),
    status: formString(formData, "status") || chatStickerPackStatusOptions[0]
  };
}

async function assetImageUrl(formData: FormData) {
  const assetKind = formString(formData, "kind");

  if (!chatAssetKindOptions.includes(assetKind as (typeof chatAssetKindOptions)[number])) {
    throw new Error("Invalid chat asset type.");
  }

  const kind = assetKind === "emoji" ? "chat-emojis" : "chat-stickers";
  const uploaded = await saveOptionalChatAssetUpload(formFile(formData, "imageUpload"), kind);

  if (uploaded) {
    return uploaded;
  }

  return normalizeOptionalChatAssetUrl(formString(formData, "imageUrl"), kind);
}

async function assetInput(formData: FormData): Promise<ChatStickerAssetInput> {
  return {
    assetId: formString(formData, "assetId") || undefined,
    imageUrl: await assetImageUrl(formData),
    isAnimated: formString(formData, "isAnimated") === "true",
    kind: formString(formData, "kind"),
    name: formString(formData, "name"),
    packId: formString(formData, "packId"),
    shortcode: formString(formData, "shortcode"),
    sortOrder: formNumber(formData, "sortOrder")
  };
}

function revalidateChatAssetViews() {
  revalidatePath("/admin/chat-assets");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/chat");
  revalidatePath("/live");
}

export async function adminChatAssetsAction(
  _previousState: AdminChatAssetsActionState,
  formData: FormData
): Promise<AdminChatAssetsActionState> {
  const intent = formString(formData, "intent");
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "admin.access")) {
    return {
      status: "error",
      message: "You do not have permission to manage chat assets."
    };
  }

  try {
    if (intent === "create-pack") {
      await createChatStickerPack(packInput(formData), actor.id);
      revalidateChatAssetViews();

      return {
        status: "success",
        message: "Sticker pack created."
      };
    }

    if (intent === "update-pack") {
      await updateChatStickerPack(packInput(formData), actor.id);
      revalidateChatAssetViews();

      return {
        status: "success",
        message: "Sticker pack updated."
      };
    }

    if (intent === "create-asset") {
      await createChatStickerAsset(await assetInput(formData), actor.id);
      revalidateChatAssetViews();

      return {
        status: "success",
        message: "Chat asset created."
      };
    }

    if (intent === "update-asset") {
      await updateChatStickerAsset(await assetInput(formData), actor.id);
      revalidateChatAssetViews();

      return {
        status: "success",
        message: "Chat asset updated."
      };
    }

    return {
      status: "error",
      message: "Unknown chat asset action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Chat asset action failed."
    };
  }
}

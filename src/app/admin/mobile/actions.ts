"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { mobileFeatureKeys, updateMobileConfig, type MobileConfigInput } from "@/lib/admin/mobile-service";
import type { AdminMobileActionState } from "@/app/admin/mobile/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function mobileConfigInput(formData: FormData): MobileConfigInput {
  return {
    accent: formString(formData, "accent"),
    announcementBody: formString(formData, "announcementBody"),
    announcementTitle: formString(formData, "announcementTitle"),
    appName: formString(formData, "appName"),
    environmentLabel: formString(formData, "environmentLabel"),
    features: mobileFeatureKeys.reduce<Record<(typeof mobileFeatureKeys)[number], boolean>>(
      (features, key) => ({
        ...features,
        [key]: formBoolean(formData, `feature_${key}`)
      }),
      {
        ads: false,
        chat: false,
        live: false,
        music: false,
        rewards: false,
        shop: false
      }
    ),
    levelPlayAppKey: formString(formData, "levelPlayAppKey"),
    levelPlayBannerAdUnitId: formString(formData, "levelPlayBannerAdUnitId"),
    levelPlayInterstitialAdUnitId: formString(formData, "levelPlayInterstitialAdUnitId"),
    levelPlayTestSuiteEnabled: formBoolean(formData, "levelPlayTestSuiteEnabled"),
    maintenanceEnabled: formBoolean(formData, "maintenanceEnabled"),
    maintenanceMessage: formString(formData, "maintenanceMessage"),
    supportEmail: formString(formData, "supportEmail"),
    themeMode: formString(formData, "themeMode")
  };
}

function revalidateMobileViews() {
  revalidatePath("/admin/mobile");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/api/mobile/v1/config");
}

export async function adminMobileAction(
  _previousState: AdminMobileActionState,
  formData: FormData
): Promise<AdminMobileActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "mobile.manage")) {
    return {
      message: "You do not have permission to manage mobile app settings.",
      status: "error"
    };
  }

  try {
    await updateMobileConfig(mobileConfigInput(formData), actor.id);
    revalidateMobileViews();

    return {
      message: "Mobile app configuration saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Mobile app configuration could not be saved.",
      status: "error"
    };
  }
}

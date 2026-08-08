import { createUploadSignature } from "@/lib/uploads.functions";
import { validateImageFile } from "@/lib/domain";

export type UploadedImage = { url: string; publicId: string };

/** Downscale + re-encode in the browser so uploads stay small. */
async function compressImage(file: File): Promise<Blob> {
  if (typeof window === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    bitmap.close();
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Validates, compresses and uploads a single image straight to Cloudinary
 * using a server-generated signature.
 */
export async function uploadImage(
  file: File,
  folder: "posts" | "avatars",
): Promise<UploadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const signature = await createUploadSignature({ data: { folder } });
  const blob = await compressImage(file);

  const form = new FormData();
  form.append("file", blob, file.name);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("folder", signature.folder);
  form.append("transformation", signature.transformation);
  form.append("signature", signature.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: "POST", body: form },
  );

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      /* ignore */
    }
    console.error("[upload] cloudinary error", response.status, detail);
    throw new Error("The image could not be uploaded. Please try again.");
  }

  const result = (await response.json()) as { secure_url?: string; public_id?: string };
  if (!result.secure_url || !result.public_id) {
    throw new Error("The image could not be uploaded. Please try again.");
  }
  return { url: result.secure_url, publicId: result.public_id };
}

/** Cloudinary delivery transform for responsive, optimised rendering. */
export function cloudinaryThumb(url: string, width = 800): string {
  return url.replace("/upload/", `/upload/c_limit,w_${width},q_auto,f_auto/`);
}

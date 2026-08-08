import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const folderSchema = z.object({
  folder: z.enum(["posts", "avatars"]),
});

/**
 * Returns a short-lived signature so the browser can upload one image directly
 * to Cloudinary. The API secret stays on the server.
 */
export const createUploadSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => folderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("Could not verify your account. Please try again.");
    if (!profile) throw new Error("Profile not found.");
    if (profile.is_banned) throw new Error("Your account has been suspended by a moderator.");

    const { getCloudinaryConfig, signParams } = await import("@/lib/cloudinary.server");
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `aiub-lost-found/${data.folder}`;
    const params = {
      folder,
      timestamp,
      // Server-enforced normalisation: max 1600px, auto quality/format.
      transformation: "c_limit,w_1600,h_1600,q_auto:good",
    };
    const signature = await signParams(params, apiSecret);

    return { cloudName, apiKey, timestamp, folder, signature, transformation: params.transformation };
  });

/**
 * Deletes a Cloudinary asset. Only the owner of the referencing row (or an
 * admin) may do this; ownership is re-checked server side under RLS.
 */
export const deleteUploadedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        publicId: z.string().min(1).max(300),
        scope: z.enum(["post", "avatar"]),
        postId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.scope === "avatar") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_public_id")
        .eq("id", userId)
        .maybeSingle();
      if (!profile || profile.avatar_public_id !== data.publicId) {
        throw new Error("You are not allowed to remove this image.");
      }
    } else {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!data.postId) throw new Error("Missing post reference.");
      const { data: post } = await supabase
        .from("posts")
        .select("user_id, image_public_id")
        .eq("id", data.postId)
        .maybeSingle();
      if (!post || post.image_public_id !== data.publicId) {
        throw new Error("Image not found for this post.");
      }
      if (post.user_id !== userId && !isAdmin) {
        throw new Error("You are not allowed to remove this image.");
      }
    }

    const { destroyAsset } = await import("@/lib/cloudinary.server");
    const ok = await destroyAsset(data.publicId);
    return { ok };
  });

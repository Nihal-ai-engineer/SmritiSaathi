import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { decryptBytes, encryptBytes } from "./crypto";
import { api } from "./api";
export async function uploadPhoto(
  file: File,
  profileId: string,
  key: Uint8Array<ArrayBuffer>,
) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a JPG, PNG or WebP photo smaller than 10 MB.");
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not read this photo."))),
      "image/jpeg",
      0.85,
    ),
  );
  const bytes = await encryptBytes(
    key,
    new Uint8Array(await blob.arrayBuffer()),
  );
  const form = new FormData();
  form.append(
    "photo",
    new Blob([bytes], { type: "application/octet-stream" }),
    "photo.enc",
  );
  return (await api(`/profiles/${profileId}/photos`, "POST", form))
    .id as string;
}
export default function Photo({
  id,
  profileId,
  vaultKey,
  alt,
}: {
  id?: string;
  profileId: string;
  vaultKey: Uint8Array<ArrayBuffer>;
  alt: string;
}) {
  const [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false,
      objectUrl = "";
    setUrl("");
    setFailed(false);
    if (id)
      (async () => {
        try {
          const response = await fetch(
            `/api/profiles/${profileId}/photos/${id}`,
          );
          if (!response.ok) throw new Error();
          const bytes = await decryptBytes(
            vaultKey,
            new Uint8Array(await response.arrayBuffer()),
          );
          objectUrl = URL.createObjectURL(
            new Blob([bytes], { type: "image/jpeg" }),
          );
          if (!cancelled) setUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        } catch {
          if (!cancelled) setFailed(true);
        }
      })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, profileId, vaultKey]);
  return url ? (
    <img src={url} alt={alt} loading="lazy" />
  ) : (
    <div className="photo-placeholder">
      <ImageIcon size={28} />
      <span>
        {failed
          ? "Photo unavailable"
          : id
            ? "Unlocking photo…"
            : "No photo added"}
      </span>
    </div>
  );
}

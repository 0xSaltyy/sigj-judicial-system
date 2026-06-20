import "server-only";

type SignatureStorageClient = {
  storage: {
    from(bucket: string): {
      download(path: string): PromiseLike<{ data: Blob | null }>;
    };
  };
};

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function signatureImageDataUrl(
  client: SignatureStorageClient,
  path: string | null | undefined,
) {
  if (!path) return null;
  try {
    const { data } = await client.storage.from("signatures").download(path);
    if (!data || data.size === 0 || data.size > 2 * 1024 * 1024) return null;
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.length < PNG_HEADER.length || !bytes.subarray(0, PNG_HEADER.length).equals(PNG_HEADER)) return null;
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

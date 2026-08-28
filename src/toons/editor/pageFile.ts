import type { ToonRecord } from "./types";

/** Keep local caption edits; take the new plate from the Worker payload. */
export function mergeReplacedPage(local: ToonRecord, remote: ToonRecord, pageId: string): ToonRecord {
  const incoming = remote.pages.find((p) => p.id === pageId);
  if (!incoming) return remote;
  return {
    ...local,
    pages: local.pages.map((p) =>
      p.id === pageId
        ? {
            ...p,
            fileKey: incoming.fileKey,
            fileUrl: incoming.fileUrl,
            width: incoming.width,
            height: incoming.height,
          }
        : p
    ),
  };
}

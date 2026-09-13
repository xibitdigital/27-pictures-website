import type { PageFilePatch, ToonRecord } from "./types";

/** Keep local captions/regions; take only this page's new plate. */
export function mergeReplacedPage(local: ToonRecord, plate: PageFilePatch, pageId: string): ToonRecord {
  return {
    ...local,
    pages: local.pages.map((p) =>
      p.id === pageId
        ? {
            ...p,
            fileKey: plate.fileKey,
            fileUrl: plate.fileUrl,
            width: plate.width,
            height: plate.height,
          }
        : p
    ),
  };
}

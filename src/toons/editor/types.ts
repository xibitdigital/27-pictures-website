/** Records the editor Worker returns. Drafts live in D1, not config.json. */

export interface BubbleRecord {
  id: string;
  x: number;
  y: number;
  variant: string;
  tail: string | null;
  size: number | null;
  angle: number | null;
  textEn: string;
  textJson?: string | null;
  extraJson?: string | null;
  sort: number;
}

export interface PageRecord {
  id: string;
  position: number;
  fileKey: string;
  fileUrl: string;
  width: number | null;
  height: number | null;
  bubbles: BubbleRecord[];
}

export interface ToonRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverKey: string | null;
  coverUrl: string | null;
  designWidth: number;
  designHeight: number;
  pages: PageRecord[];
}

export interface ToonListItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  coverUrl: string | null;
  pageCount?: number;
  status?: string;
}

export interface ToonMetaInput {
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
}

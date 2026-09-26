import { GenAITier, VideoFormat } from "./types";

/**
 * A single render job request built by the Home hero pill.
 * `file` is kept in-memory only (never serialized) so the original
 * uploaded bytes can be persisted to IndexedDB for later replay.
 */
export interface JobRequest {
  title: string;
  rawVideoUrl: string;
  format: VideoFormat;
  genaiTier: GenAITier;
  duration: number;
  file?: File | null;
  /** R2 object key (raw/<userId>/...) quando il sorgente è su R2. */
  r2Key?: string;
}

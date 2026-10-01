// Compression settings (CLAUDE.md §8.5).

export interface ImagePreset {
  id: 'standard' | 'smaller';
  maxEdge: number;
  quality: number;
}

/** Every image, on add. */
export const STANDARD: ImagePreset = { id: 'standard', maxEdge: 1600, quality: 0.7 };

/** "Compress more", when the packet is over budget. */
export const SMALLER: ImagePreset = { id: 'smaller', maxEdge: 1200, quality: 0.6 };

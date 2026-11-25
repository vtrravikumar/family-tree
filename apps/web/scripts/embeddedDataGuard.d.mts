export interface EmbeddedDataFinding { kind: string; detail: string }
export interface EmbeddedDataFileFinding extends EmbeddedDataFinding { file: string }
export const LITERAL_RECORD_THRESHOLD: number;
export function findEmbeddedFamilyData(text: string): EmbeddedDataFinding[];
export function scanDirectory(directory: string, options?: { skipTests?: boolean }): EmbeddedDataFileFinding[];

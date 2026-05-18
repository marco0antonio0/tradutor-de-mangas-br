export interface ResolvedImageFile {
  filePath: string
  mime: string
  size: number
}

export type ImageKind = 'original' | 'translated'

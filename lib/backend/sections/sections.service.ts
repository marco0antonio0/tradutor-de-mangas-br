import { SectionsRepository } from './sections.repository'
import type { ImageKind } from './sections.types'

export class SectionsService {
  constructor(private readonly repository: SectionsRepository) {}

  listSections(userId: number) {
    return this.repository.listSections(userId)
  }

  createSectionFromFormData(userId: number, formData: FormData) {
    return this.repository.createSectionFromFormData(userId, formData)
  }

  getSectionDetail(sectionId: number, userId: number) {
    return this.repository.getSectionDetail(sectionId, userId)
  }

  deleteSection(sectionId: number, userId: number) {
    return this.repository.deleteSection(sectionId, userId)
  }

  resolveImageFile(sectionId: number, imageId: number, kind: ImageKind, userId: number) {
    return this.repository.resolveImageFile(sectionId, imageId, kind, userId)
  }

  reprocessSection(sectionId: number, userId: number) {
    return this.repository.reprocessSection(sectionId, userId)
  }

  renameSection(sectionId: number, userId: number, name: string) {
    return this.repository.renameSection(sectionId, userId, name)
  }

  updateSectionPriority(sectionId: number, userId: number, priority: number) {
    return this.repository.updateSectionPriority(sectionId, userId, priority)
  }

  updateImageSelection(sectionId: number, userId: number, selection: Record<number, boolean>) {
    return this.repository.updateImageSelection(sectionId, userId, selection)
  }
}

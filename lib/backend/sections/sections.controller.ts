import type { ImageKind } from './sections.types'
import { SectionsService } from './sections.service'

export class SectionsController {
  constructor(private readonly service: SectionsService) {}

  listSections(userId: number) {
    return this.service.listSections(userId)
  }

  createSectionFromFormData(userId: number, formData: FormData) {
    return this.service.createSectionFromFormData(userId, formData)
  }

  getSectionDetail(sectionId: number, userId: number) {
    return this.service.getSectionDetail(sectionId, userId)
  }

  deleteSection(sectionId: number, userId: number) {
    return this.service.deleteSection(sectionId, userId)
  }

  resolveImageFile(sectionId: number, imageId: number, kind: ImageKind, userId: number) {
    return this.service.resolveImageFile(sectionId, imageId, kind, userId)
  }

  reprocessSection(sectionId: number, userId: number) {
    return this.service.reprocessSection(sectionId, userId)
  }

  renameSection(sectionId: number, userId: number, name: string) {
    return this.service.renameSection(sectionId, userId, name)
  }

  updateSectionPriority(sectionId: number, userId: number, priority: number) {
    return this.service.updateSectionPriority(sectionId, userId, priority)
  }

  updateImageSelection(sectionId: number, userId: number, selection: Record<number, boolean>) {
    return this.service.updateImageSelection(sectionId, userId, selection)
  }
}

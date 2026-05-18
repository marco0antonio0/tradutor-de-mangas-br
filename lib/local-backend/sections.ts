import 'server-only'

import { sectionsController } from '@/lib/backend/sections/sections.module'
import type { ImageKind } from '@/lib/backend/sections/sections.types'

export function listSections(userId: number) {
  return sectionsController.listSections(userId)
}

export async function createSectionFromFormData(userId: number, formData: FormData) {
  return sectionsController.createSectionFromFormData(userId, formData)
}

export function getSectionDetail(sectionId: number, userId: number) {
  return sectionsController.getSectionDetail(sectionId, userId)
}

export function deleteSection(sectionId: number, userId: number) {
  return sectionsController.deleteSection(sectionId, userId)
}

export function resolveImageFile(sectionId: number, imageId: number, kind: ImageKind, userId: number) {
  return sectionsController.resolveImageFile(sectionId, imageId, kind, userId)
}

export function reprocessSection(sectionId: number, userId: number) {
  return sectionsController.reprocessSection(sectionId, userId)
}

export function renameSection(sectionId: number, userId: number, name: string) {
  return sectionsController.renameSection(sectionId, userId, name)
}

export function updateSectionPriority(sectionId: number, userId: number, priority: number) {
  return sectionsController.updateSectionPriority(sectionId, userId, priority)
}

export function updateImageSelection(sectionId: number, userId: number, selection: Record<number, boolean>) {
  return sectionsController.updateImageSelection(sectionId, userId, selection)
}

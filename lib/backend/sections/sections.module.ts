import { SectionsController } from './sections.controller'
import { SectionsRepository } from './sections.repository'
import { SectionsService } from './sections.service'

const sectionsRepository = new SectionsRepository()
const sectionsService = new SectionsService(sectionsRepository)
export const sectionsController = new SectionsController(sectionsService)

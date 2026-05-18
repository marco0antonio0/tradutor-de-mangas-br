'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { readAutoProcessingEnabledPreference, writeAutoProcessingEnabledPreference } from '@/lib/user-preferences'
import { Camera, CircleHelp, FolderTree, Loader2, Plus, RotateCcw, Save, Trash2, UserRound } from 'lucide-react'

type ProfilePayload = {
  idUser?: number
  name?: string
  email?: string
  role?: number
  foto?: string | null
  message?: string
  error?: string
}

type OpenRouterPayload = {
  hasApiKey?: boolean
  isValid?: boolean
  availableModels?: string[]
  selectedModel?: string | null
  message?: string
  error?: string
}

type CategoryPreferencesState = {
  font_family: 'sans' | 'serif' | 'mono' | 'comic' | 'manga' | 'anime' | 'manhwa' | 'condensed'
  font_scale: number
  box_inset_percent: number
  density: number
  global_shape: 'rect' | 'oval'
  overlay_opacity: number
  default_reading_mode: 'paginated' | 'scroll'
}

type CategoryItem = {
  id: number
  name: string
  preferences?: CategoryPreferencesState | null
}

type CategoriesPayload = {
  category_items?: unknown
  message?: string
  error?: string
}

const DEFAULT_CATEGORY_PREFERENCES: CategoryPreferencesState = {
  font_family: 'sans',
  font_scale: 0.3,
  box_inset_percent: 6,
  density: 1,
  global_shape: 'rect',
  overlay_opacity: 1,
  default_reading_mode: 'paginated',
}

const CATEGORY_FONT_SCALE_MIN = 0.1
const CATEGORY_FONT_SCALE_MAX = 1.5
const CATEGORY_FONT_SCALE_STEP = 0.05
const CATEGORY_FONT_SCALE_BASE = 0.3
const CATEGORY_DENSITY_MIN = 0.45
const CATEGORY_DENSITY_MAX = 2.5
const CATEGORY_DENSITY_STEP = 0.1
const CATEGORY_OPACITY_MIN = 0.08
const CATEGORY_OPACITY_MAX = 1
const CATEGORY_OPACITY_STEP = 0.05

const OCR_OVERLAY_FONT_FAMILIES: Record<
  CategoryPreferencesState['font_family'],
  { label: string; css: string }
> = {
  sans: {
    label: 'Wild Words',
    css: 'var(--font-bangers), "CC Wild Words", "Anime Ace 2.0 BB", "Komika Axis", cursive',
  },
  serif: {
    label: 'Retro Hero',
    css: 'var(--font-carter-one), var(--font-righteous), "Trebuchet MS", sans-serif',
  },
  mono: {
    label: 'Tech Scan',
    css: 'var(--font-rubik-mono-one), var(--font-audiowide), "Arial Black", sans-serif',
  },
  comic: {
    label: 'Ink Brush',
    css: 'var(--font-permanent-marker), var(--font-kalam), "Comic Sans MS", cursive',
  },
  manga: {
    label: 'Shonen Blast',
    css: 'var(--font-luckiest-guy), var(--font-bangers), var(--font-changa-one), "Arial Black", sans-serif',
  },
  anime: {
    label: 'Anime Title',
    css: 'var(--font-bebas-neue), var(--font-anton), var(--font-teko), Impact, sans-serif',
  },
  manhwa: {
    label: 'Manhwa Clean Pro',
    css: 'var(--font-noto-sans-kr), "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif',
  },
  condensed: {
    label: 'Action Condensed',
    css: 'var(--font-teko), var(--font-bebas-neue), "Arial Narrow", Impact, sans-serif',
  },
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function normalizeCategoryPreferences(rawValue: unknown): CategoryPreferencesState {
  const root = asRecord(rawValue) ?? {}
  const fontFamilyRaw = String(root.font_family ?? '').trim().toLowerCase()
  const allowedFontFamilies = new Set([
    'sans',
    'serif',
    'mono',
    'comic',
    'manga',
    'anime',
    'manhwa',
    'condensed',
  ])
  const font_family = allowedFontFamilies.has(fontFamilyRaw)
    ? (fontFamilyRaw as CategoryPreferencesState['font_family'])
    : DEFAULT_CATEGORY_PREFERENCES.font_family

  const globalShapeRaw = String(root.global_shape ?? '').trim().toLowerCase()
  const global_shape: 'rect' | 'oval' = globalShapeRaw === 'oval' ? 'oval' : 'rect'
  const defaultReadingModeRaw = String(root.default_reading_mode ?? '').trim().toLowerCase()
  const default_reading_mode: 'paginated' | 'scroll' =
    defaultReadingModeRaw === 'scroll' ? 'scroll' : 'paginated'

  const rawFontScale = toFiniteNumber(root.font_scale) ?? DEFAULT_CATEGORY_PREFERENCES.font_scale
  const normalizedFontScale = rawFontScale > CATEGORY_FONT_SCALE_MAX
    ? rawFontScale * CATEGORY_FONT_SCALE_BASE
    : rawFontScale

  return {
    font_family,
    font_scale: clampRange(
      normalizedFontScale,
      CATEGORY_FONT_SCALE_MIN,
      CATEGORY_FONT_SCALE_MAX
    ),
    box_inset_percent: clampRange(
      toFiniteNumber(root.box_inset_percent) ?? DEFAULT_CATEGORY_PREFERENCES.box_inset_percent,
      0,
      100
    ),
    density: clampRange(
      toFiniteNumber(root.density) ?? DEFAULT_CATEGORY_PREFERENCES.density,
      CATEGORY_DENSITY_MIN,
      CATEGORY_DENSITY_MAX
    ),
    overlay_opacity: clampRange(
      toFiniteNumber(root.overlay_opacity) ?? DEFAULT_CATEGORY_PREFERENCES.overlay_opacity,
      CATEGORY_OPACITY_MIN,
      CATEGORY_OPACITY_MAX
    ),
    global_shape,
    default_reading_mode,
  }
}

function normalizeCategoryItems(payload: CategoriesPayload) {
  if (!Array.isArray(payload.category_items)) return [] as CategoryItem[]
  return payload.category_items
    .map((entry) => {
      const root = asRecord(entry)
      if (!root) return null
      const id = toFiniteNumber(root.id)
      const name = typeof root.name === 'string' ? root.name.trim() : ''
      if (id === null || !name) return null
      return {
        id: Math.floor(id),
        name,
        preferences: root.preferences
          ? normalizeCategoryPreferences(root.preferences)
          : null,
      } satisfies CategoryItem
    })
    .filter(Boolean) as CategoryItem[]
}

function initialsFromName(name: string) {
  const normalized = name.trim()
  if (!normalized) return 'U'
  const parts = normalized.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

function hasCustomPreferences(item: CategoryItem): boolean {
  if (!item.preferences) return false
  const p = item.preferences
  const d = DEFAULT_CATEGORY_PREFERENCES
  return (
    p.font_family !== d.font_family ||
    Math.abs(p.font_scale - d.font_scale) > 0.001 ||
    Math.abs(p.box_inset_percent - d.box_inset_percent) > 0.001 ||
    Math.abs(p.density - d.density) > 0.001 ||
    p.global_shape !== d.global_shape ||
    Math.abs(p.overlay_opacity - d.overlay_opacity) > 0.001 ||
    p.default_reading_mode !== d.default_reading_mode
  )
}

function PreferencesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-9 w-52 animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

function StepperControl({
  label,
  value,
  min,
  max,
  disabled,
  display,
  onDecrement,
  onIncrement,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled: boolean
  display: (v: number) => string
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={onDecrement}
          disabled={disabled || value <= min}
          aria-label={`Diminuir ${label}`}
        >
          -
        </Button>
        <span className="min-w-16 text-center text-sm font-semibold text-foreground">
          {display(value)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={onIncrement}
          disabled={disabled || value >= max}
          aria-label={`Aumentar ${label}`}
        >
          +
        </Button>
      </div>
    </div>
  )
}

export function PreferencesHub() {
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const actionGuardRef = useRef<Record<string, number>>({})

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileFoto, setProfileFoto] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isAutoProcessingEnabled, setIsAutoProcessingEnabled] = useState(false)
  const [isSavingAutoProcessing, setIsSavingAutoProcessing] = useState(false)
  const [userRole, setUserRole] = useState<number | null>(null)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [hasOpenRouterApiKey, setHasOpenRouterApiKey] = useState(false)
  const [isOpenRouterValid, setIsOpenRouterValid] = useState(false)
  const [openRouterModels, setOpenRouterModels] = useState<string[]>([])
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState('')
  const [isSavingOpenRouterKey, setIsSavingOpenRouterKey] = useState(false)
  const [isSavingOpenRouterModel, setIsSavingOpenRouterModel] = useState(false)
  const [isDeletingOpenRouterKey, setIsDeletingOpenRouterKey] = useState(false)
  const [isDeleteOpenRouterDialogOpen, setIsDeleteOpenRouterDialogOpen] = useState(false)

  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [renameCategoryName, setRenameCategoryName] = useState('')
  const [categoryPreferences, setCategoryPreferences] = useState<CategoryPreferencesState>(DEFAULT_CATEGORY_PREFERENCES)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)
  const preferenceDirtyRef = useRef(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  )
  const selectedCategorySupportsId = Boolean(selectedCategory && selectedCategory.id > 0)

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((item) => item.name.toLowerCase().includes(q))
  }, [categories, categorySearch])

  const canRunAction = (actionKey: string, windowMs = 700) => {
    const now = Date.now()
    const lastRun = actionGuardRef.current[actionKey] ?? 0
    if (now - lastRun < windowMs) return false
    actionGuardRef.current[actionKey] = now
    return true
  }

  const loadProfile = async () => {
    const response = await fetch('/api/auth/me', { cache: 'no-store' })
    const data = (await response.json()) as ProfilePayload

    if (response.status === 401) {
      window.location.href = '/login?expired=1'
      return
    }
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível carregar seu perfil.')
    }

    setProfileName(data.name ?? '')
    setProfileEmail(data.email ?? '')
    setProfileFoto(data.foto ?? null)
    setUserRole(typeof data.role === 'number' ? data.role : null)
    return typeof data.role === 'number' ? data.role : null
  }

  const loadOpenRouterSettings = async () => {
    const response = await fetch('/api/openrouter', { cache: 'no-store' })
    const data = await response.json() as OpenRouterPayload
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível carregar configurações do OpenRouter.')
    }

    const models = Array.isArray(data.availableModels) ? data.availableModels : []
    const selectedModel = typeof data.selectedModel === 'string' ? data.selectedModel : ''

    setHasOpenRouterApiKey(Boolean(data.hasApiKey))
    setIsOpenRouterValid(Boolean(data.isValid))
    setOpenRouterModels(models)
    setSelectedOpenRouterModel(selectedModel && models.includes(selectedModel) ? selectedModel : (models[0] ?? ''))
  }

  const loadCategories = async () => {
    const response = await fetch('/api/sections/categories', { cache: 'no-store' })
    const data = (await response.json()) as CategoriesPayload
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível carregar categorias.')
    }

    const nextItems = normalizeCategoryItems(data)
    setCategories(nextItems)
    setSelectedCategoryId((prev) => {
      if (prev && nextItems.some((item) => item.id === prev)) return prev
      return nextItems[0]?.id ?? null
    })
  }

  const loadCategoryPreferences = async (categoryId: number) => {
    const response = await fetch(`/api/sections/categories/${categoryId}/preferences`, { cache: 'no-store' })
    const data = await response.json() as { state?: unknown; message?: string }
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível carregar preferências da categoria.')
    }
    setCategoryPreferences(normalizeCategoryPreferences(data.state))
  }

  useEffect(() => {
    let cancelled = false
    void readAutoProcessingEnabledPreference().then((enabled) => {
      if (cancelled) return
      setIsAutoProcessingEnabled(enabled)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      setIsLoading(true)
      try {
        const role = await loadProfile()
        await loadCategories()
        if (role === 4) {
          await loadOpenRouterSettings()
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Erro ao carregar preferências.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const updatePreference = (updater: (prev: CategoryPreferencesState) => CategoryPreferencesState) => {
    preferenceDirtyRef.current = true
    setCategoryPreferences(updater)
  }

  useEffect(() => {
    preferenceDirtyRef.current = false
    if (!selectedCategory) {
      setRenameCategoryName('')
      setCategoryPreferences(DEFAULT_CATEGORY_PREFERENCES)
      return
    }

    setRenameCategoryName(selectedCategory.name)
    setCategoryPreferences(selectedCategory.preferences ?? DEFAULT_CATEGORY_PREFERENCES)
    void loadCategoryPreferences(selectedCategory.id).catch(() => {
      // fallback para preferências já carregadas no category_items
    })
  }, [selectedCategory])

  const handleProfilePhotoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 3MB.')
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Falha ao ler imagem.'))
      }
      reader.onerror = () => reject(new Error('Falha ao ler imagem.'))
      reader.readAsDataURL(file)
    })
    setProfileFoto(dataUrl)
  }

  const handleSaveProfile = async () => {
    if (isSavingProfile || !canRunAction('save-profile')) return
    setIsSavingProfile(true)
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          foto: profileFoto,
        }),
      })
      const data = await response.json() as ProfilePayload
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível salvar perfil.')
      }
      toast.success(data.message || 'Perfil atualizado.')
      await loadProfile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perfil.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleToggleAutoProcessing = async (checked: boolean) => {
    if (isSavingAutoProcessing) return
    const previousValue = isAutoProcessingEnabled
    setIsAutoProcessingEnabled(checked)
    setIsSavingAutoProcessing(true)
    const persisted = await writeAutoProcessingEnabledPreference(checked)
    setIsSavingAutoProcessing(false)

    if (persisted !== checked) {
      setIsAutoProcessingEnabled(previousValue)
      toast.error('Não foi possível salvar a preferência no momento.')
      return
    }

    toast.success(
      checked
        ? 'Processamento automático habilitado.'
        : 'Processamento automático desabilitado.'
    )
  }

  const handleSaveOpenRouterKey = async () => {
    if (isSavingOpenRouterKey || !canRunAction('save-openrouter-key')) return
    const apiKey = openRouterApiKey.trim()
    if (!apiKey) {
      toast.error('Informe a API key do OpenRouter.')
      return
    }

    setIsSavingOpenRouterKey(true)
    try {
      const response = await fetch('/api/openrouter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      const data = await response.json() as OpenRouterPayload
      if (!response.ok) throw new Error(data.message || 'Não foi possível salvar API key.')

      setOpenRouterApiKey('')
      setHasOpenRouterApiKey(true)
      setIsOpenRouterValid(Boolean(data.isValid))
      setOpenRouterModels(Array.isArray(data.availableModels) ? data.availableModels : [])
      setSelectedOpenRouterModel(typeof data.selectedModel === 'string' ? data.selectedModel : '')
      toast.success(data.message || 'API key salva com sucesso.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar API key.')
    } finally {
      setIsSavingOpenRouterKey(false)
    }
  }

  const handleSaveOpenRouterModel = async () => {
    if (isSavingOpenRouterModel || !canRunAction('save-openrouter-model')) return
    const model = selectedOpenRouterModel.trim()
    if (!model) {
      toast.error('Selecione um modelo.')
      return
    }

    setIsSavingOpenRouterModel(true)
    try {
      const response = await fetch('/api/openrouter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      const data = await response.json() as OpenRouterPayload
      if (!response.ok) throw new Error(data.message || 'Não foi possível salvar modelo.')
      toast.success(data.message || 'Modelo salvo com sucesso.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar modelo.')
    } finally {
      setIsSavingOpenRouterModel(false)
    }
  }

  const handleDeleteOpenRouterKey = async () => {
    if (isDeletingOpenRouterKey || !canRunAction('delete-openrouter-key')) return
    if (!hasOpenRouterApiKey) {
      toast.error('Não há API key salva para remover.')
      return
    }

    setIsDeletingOpenRouterKey(true)
    try {
      const response = await fetch('/api/openrouter', { method: 'DELETE' })
      const data = await response.json() as OpenRouterPayload
      if (!response.ok) throw new Error(data.message || 'Não foi possível remover API key.')

      setOpenRouterApiKey('')
      setHasOpenRouterApiKey(false)
      setIsOpenRouterValid(false)
      setOpenRouterModels([])
      setSelectedOpenRouterModel('')
      setIsDeleteOpenRouterDialogOpen(false)
      toast.success(data.message || 'API key removida com sucesso.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover API key.')
    } finally {
      setIsDeletingOpenRouterKey(false)
    }
  }

  const handleCreateCategory = async () => {
    if (isSavingCategory || !canRunAction('create-category')) return
    const category = newCategoryName.trim()
    if (!category) {
      toast.error('Digite um nome para criar a categoria.')
      return
    }
    setIsSavingCategory(true)
    try {
      const response = await fetch('/api/sections/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      const data = await response.json() as CategoriesPayload
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível criar categoria.')
      }
      setNewCategoryName('')
      const nextItems = normalizeCategoryItems(data)
      setCategories(nextItems)
      const created = nextItems.find((item) => item.name.toLowerCase() === category.toLowerCase())
      if (created) {
        setSelectedCategoryId(created.id)
      }
      toast.success('Categoria criada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria.')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleRenameCategory = async () => {
    if (isSavingCategory || !canRunAction('rename-category')) return
    if (!selectedCategorySupportsId || !selectedCategory) return
    const category = renameCategoryName.trim()
    if (!category) {
      toast.error('Informe o novo nome da categoria.')
      return
    }
    setIsSavingCategory(true)
    try {
      const response = await fetch(`/api/sections/categories/${selectedCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      const data = await response.json() as CategoriesPayload
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível renomear categoria.')
      }
      setCategories(normalizeCategoryItems(data))
      toast.success('Categoria atualizada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar categoria.')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (isDeletingCategory || !canRunAction('delete-category')) return
    if (!selectedCategorySupportsId || !selectedCategory) return
    const deletingCategoryId = selectedCategory.id
    const deletingCategoryName = selectedCategory.name
    setIsDeletingCategory(true)
    try {
      let response = await fetch(`/api/sections/categories/${deletingCategoryId}`, {
        method: 'DELETE',
      })

      let data = await response.json() as CategoriesPayload

      // Fallback legado: alguns ambientes mantêm remoção por nome.
      if (!response.ok) {
        const fallbackResponse = await fetch('/api/sections/categories', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: deletingCategoryName }),
        })
        const fallbackData = await fallbackResponse.json() as CategoriesPayload
        if (fallbackResponse.ok) {
          response = fallbackResponse
          data = fallbackData
        }
      }

      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível excluir categoria.')
      }

      // Sempre recarrega do servidor para evitar reentrada visual de item removido.
      await loadCategories()
      const nextItems = normalizeCategoryItems(data)
      setCategories(nextItems)
      setSelectedCategoryId((current) => {
        if (current && nextItems.some((item) => item.id === current)) return current
        return nextItems[0]?.id ?? null
      })
      setIsDeleteDialogOpen(false)

      const stillExists = nextItems.some(
        (item) => item.name.trim().toLocaleLowerCase('pt-BR') === deletingCategoryName.trim().toLocaleLowerCase('pt-BR')
      )
      if (stillExists) {
        toast.warning('A categoria ainda existe no servidor. Atualize e tente novamente.')
      } else {
        toast.success('Categoria excluída.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir categoria.')
    } finally {
      setIsDeletingCategory(false)
    }
  }

  const handleSaveCategoryPreferences = async () => {
    if (isSavingPreferences || !canRunAction('save-category-preferences')) return
    if (!selectedCategorySupportsId || !selectedCategory) return

    setIsSavingPreferences(true)
    try {
      const response = await fetch(`/api/sections/categories/${selectedCategory.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: categoryPreferences }),
      })
      const data = await response.json() as { message?: string }

      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível salvar preferências.')
      }

      preferenceDirtyRef.current = false
      toast.success(data.message || 'Preferências salvas.')
      await loadCategories()
      await loadCategoryPreferences(selectedCategory.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar preferências.')
    } finally {
      setIsSavingPreferences(false)
    }
  }


  if (isLoading) {
    return <PreferencesSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Preferências</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie perfil, categorias e padrões de leitura aplicados automaticamente.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className={cn('grid w-full md:w-fit', userRole === 4 ? 'grid-cols-3' : 'grid-cols-2')}>
          <TabsTrigger value="profile" className="gap-2">
            <UserRound className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          {userRole === 4 ? (
            <TabsTrigger value="openrouter" className="gap-2">
              OpenRouter
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePhotoFile}
                />
                <button
                  type="button"
                  className="group relative"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Alterar foto de perfil"
                >
                  <Avatar className="h-24 w-24 border-2">
                    {profileFoto ? <AvatarImage src={profileFoto} alt="Foto de perfil" /> : null}
                    <AvatarFallback className="text-xl font-semibold">
                      {initialsFromName(profileName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-5 w-5 text-white" />
                    <span className="mt-0.5 text-[10px] font-medium text-white">Alterar</span>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setProfileFoto(null)}
                  disabled={!profileFoto}
                >
                  Remover foto
                </Button>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Nome</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">E-mail</Label>
                  <Input id="profile-email" value={profileEmail} disabled />
                  <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm">Processamento automático</Label>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                            Experimental
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                              type="button"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              aria-label="Explicação sobre processamento automático"
                            >
                              <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            Quando habilitado, ao abrir a seção o sistema inicia automaticamente o processamento.
                            Se falhar, tenta reprocessar. Recurso experimental.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Experimental. Recomendado desabilitado para controle manual com os botões Processar/Reprocessar.
                      </p>
                    </div>
                    <Switch
                      checked={isAutoProcessingEnabled}
                      onCheckedChange={(checked) => { void handleToggleAutoProcessing(checked) }}
                      disabled={isSavingAutoProcessing}
                      aria-label="Alternar processamento automático"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button onClick={() => void handleSaveProfile()} disabled={isSavingProfile} className="gap-2">
                    <Save className="h-4 w-4" />
                    {isSavingProfile ? 'Salvando...' : 'Salvar perfil'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {userRole === 4 ? (
          <TabsContent value="openrouter" className="space-y-4">
            <Card className="space-y-4 p-4 md:p-6">
              <div>
                <h2 className="text-base font-semibold">OpenRouter</h2>
                <p className="text-sm text-muted-foreground">
                  Cadastre a API key para habilitar modelos de tradução no servidor.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouter-api-key">API key</Label>
                <Input
                  id="openrouter-api-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-or-v1-..."
                  value={openRouterApiKey}
                  onChange={(event) => setOpenRouterApiKey(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {hasOpenRouterApiKey
                    ? (isOpenRouterValid ? 'Chave salva e validada.' : 'Há chave salva, mas inválida.')
                    : 'Nenhuma chave salva.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => void handleSaveOpenRouterKey()}
                  disabled={isSavingOpenRouterKey || isDeletingOpenRouterKey}
                >
                  {isSavingOpenRouterKey ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSavingOpenRouterKey ? 'Validando...' : 'Salvar e validar chave'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setIsDeleteOpenRouterDialogOpen(true)}
                  disabled={!hasOpenRouterApiKey || isDeletingOpenRouterKey || isSavingOpenRouterKey}
                >
                  {isDeletingOpenRouterKey ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isDeletingOpenRouterKey ? 'Removendo...' : 'Remover chave'}
                </Button>
              </div>

              {isOpenRouterValid && openRouterModels.length > 0 ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <Label>Modelo</Label>
                  <Select value={selectedOpenRouterModel} onValueChange={setSelectedOpenRouterModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {openRouterModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSaveOpenRouterModel()}
                    disabled={isSavingOpenRouterModel || !selectedOpenRouterModel}
                  >
                    {isSavingOpenRouterModel ? 'Salvando...' : 'Salvar modelo'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  O modelo `google/gemma-4-31b-it` só aparece após chave válida.
                </p>
              )}
            </Card>

            <AlertDialog open={isDeleteOpenRouterDialogOpen} onOpenChange={setIsDeleteOpenRouterDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover API key do OpenRouter?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A chave e o modelo selecionado serão removidos do sistema. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingOpenRouterKey}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault()
                      void handleDeleteOpenRouterKey()
                    }}
                    disabled={isDeletingOpenRouterKey}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {isDeletingOpenRouterKey ? 'Removendo...' : 'Remover chave'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        ) : null}

        {/* ── Categories ── */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Categorias</h2>
                <p className="text-sm text-muted-foreground">
                  Crie, edite e configure padrões herdados pelas seções.
                </p>
              </div>
              <Badge variant="outline">
                {categories.length} {categories.length === 1 ? 'cadastrada' : 'cadastradas'}
              </Badge>
            </div>

            <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
              {/* Left panel */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova categoria..."
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleCreateCategory()
                      }
                    }}
                  />
                  <Button
                    onClick={() => void handleCreateCategory()}
                    disabled={isSavingCategory}
                    size="icon"
                    aria-label="Criar categoria"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Separator />

                <Input
                  placeholder="Buscar categoria..."
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                />

                <div className="max-h-80 overflow-auto rounded-md border">
                  {filteredCategories.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {categories.length === 0 ? 'Nenhuma categoria ainda.' : 'Nenhuma categoria encontrada.'}
                    </div>
                  ) : (
                    filteredCategories.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0',
                          selectedCategoryId === item.id
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => setSelectedCategoryId(item.id)}
                      >
                        <span className="truncate">{item.name}</span>
                        {hasCustomPreferences(item) && (
                          <span
                            className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                            title="Preferências customizadas"
                          />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right panel */}
              {!selectedCategory ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                  <FolderTree className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">Selecione uma categoria</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    As configurações aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Rename / delete */}
                  <Card className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Editar categoria</h3>
                      <Badge variant="secondary" className="max-w-35 truncate">
                        {selectedCategory.name}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        aria-label="Nome da categoria"
                        placeholder="Nome da categoria"
                        value={renameCategoryName}
                        onChange={(event) => setRenameCategoryName(event.target.value)}
                        disabled={!selectedCategorySupportsId}
                        className="flex-1"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => void handleRenameCategory()}
                          disabled={!selectedCategorySupportsId || isSavingCategory}
                        >
                          {isSavingCategory ? 'Salvando...' : 'Renomear'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => setIsDeleteDialogOpen(true)}
                          disabled={!selectedCategorySupportsId || isDeletingCategory}
                          aria-label="Excluir categoria"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {!selectedCategorySupportsId ? (
                      <p className="text-xs text-amber-600">
                        Esta categoria veio de fallback legado. Atualize o backend para habilitar edição completa.
                      </p>
                    ) : null}
                  </Card>

                  {/* Preferences */}
                  <Card className="space-y-5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">Padrões de leitura</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Aplicado no menu{' '}
                          <span className="font-medium text-foreground">Aa</span> para seções desta categoria.
                        </p>
                      </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs"
                      disabled={!selectedCategory}
                      onClick={() => updatePreference(() => DEFAULT_CATEGORY_PREFERENCES)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Padrão
                    </Button>
                    {preferenceDirtyRef.current && !isSavingPreferences ? (
                      <span className="text-xs text-amber-600">Alterações não salvas</span>
                    ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Fonte</Label>
                        <Select
                          value={categoryPreferences.font_family}
                          onValueChange={(value) =>
                            updatePreference((prev) => ({
                              ...prev,
                              font_family: value as CategoryPreferencesState['font_family'],
                            }))
                          }
                          disabled={!selectedCategorySupportsId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Fonte" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(OCR_OVERLAY_FONT_FAMILIES).map(([key, config]) => (
                              <SelectItem key={key} value={key} style={{ fontFamily: config.css }}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Forma dos balões</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryPreferences.global_shape === 'rect' ? 'default' : 'outline'}
                            disabled={!selectedCategorySupportsId}
                            onClick={() =>
                              updatePreference((prev) => ({ ...prev, global_shape: 'rect' }))
                            }
                          >
                            Retângulo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryPreferences.global_shape === 'oval' ? 'default' : 'outline'}
                            disabled={!selectedCategorySupportsId}
                            onClick={() =>
                              updatePreference((prev) => ({ ...prev, global_shape: 'oval' }))
                            }
                          >
                            Oval
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Paginação padrão</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryPreferences.default_reading_mode === 'paginated' ? 'default' : 'outline'}
                            disabled={!selectedCategorySupportsId}
                            onClick={() =>
                              updatePreference((prev) => ({ ...prev, default_reading_mode: 'paginated' }))
                            }
                          >
                            Paginada
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryPreferences.default_reading_mode === 'scroll' ? 'default' : 'outline'}
                            disabled={!selectedCategorySupportsId}
                            onClick={() =>
                              updatePreference((prev) => ({ ...prev, default_reading_mode: 'scroll' }))
                            }
                          >
                            Contínua
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-3">
                      <StepperControl
                        label="Escala da fonte"
                        value={categoryPreferences.font_scale}
                        min={CATEGORY_FONT_SCALE_MIN}
                        max={CATEGORY_FONT_SCALE_MAX}
                        disabled={!selectedCategorySupportsId}
                        display={(v) => `${Math.round((v / CATEGORY_FONT_SCALE_BASE) * 100)}%`}
                        onDecrement={() =>
                          updatePreference((prev) => ({
                            ...prev,
                            font_scale: clampRange(prev.font_scale - CATEGORY_FONT_SCALE_STEP, CATEGORY_FONT_SCALE_MIN, CATEGORY_FONT_SCALE_MAX),
                          }))
                        }
                        onIncrement={() =>
                          updatePreference((prev) => ({
                            ...prev,
                            font_scale: clampRange(prev.font_scale + CATEGORY_FONT_SCALE_STEP, CATEGORY_FONT_SCALE_MIN, CATEGORY_FONT_SCALE_MAX),
                          }))
                        }
                      />
                      <StepperControl
                        label="Densidade"
                        value={categoryPreferences.density}
                        min={CATEGORY_DENSITY_MIN}
                        max={CATEGORY_DENSITY_MAX}
                        disabled={!selectedCategorySupportsId}
                        display={(v) => `${Math.round(v * 100)}%`}
                        onDecrement={() =>
                          updatePreference((prev) => ({
                            ...prev,
                            density: clampRange(prev.density - CATEGORY_DENSITY_STEP, CATEGORY_DENSITY_MIN, CATEGORY_DENSITY_MAX),
                          }))
                        }
                        onIncrement={() =>
                          updatePreference((prev) => ({
                            ...prev,
                            density: clampRange(prev.density + CATEGORY_DENSITY_STEP, CATEGORY_DENSITY_MIN, CATEGORY_DENSITY_MAX),
                          }))
                        }
                      />
                      <StepperControl
                        label="Opacidade do overlay"
                        value={categoryPreferences.overlay_opacity}
                        min={CATEGORY_OPACITY_MIN}
                        max={CATEGORY_OPACITY_MAX}
                        disabled={!selectedCategorySupportsId}
                        display={(v) => `${Math.round(v * 100)}%`}
                        onDecrement={() =>
                          updatePreference((prev) => ({
                            ...prev,
                            overlay_opacity: clampRange(prev.overlay_opacity - CATEGORY_OPACITY_STEP, CATEGORY_OPACITY_MIN, CATEGORY_OPACITY_MAX),
                          }))
                        }
                        onIncrement={() =>
                          updatePreference((prev) => ({
                            ...prev,
                            overlay_opacity: clampRange(prev.overlay_opacity + CATEGORY_OPACITY_STEP, CATEGORY_OPACITY_MIN, CATEGORY_OPACITY_MAX),
                          }))
                        }
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        className="gap-2"
                        disabled={!selectedCategorySupportsId || isSavingPreferences}
                        onClick={() => void handleSaveCategoryPreferences()}
                      >
                        {isSavingPreferences ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSavingPreferences ? 'Salvando...' : 'Salvar preferências'}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </Card>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedCategory
                    ? `A categoria "${selectedCategory.name}" será removida e as seções vinculadas ficarão sem categoria.`
                    : 'Esta ação não pode ser desfeita.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    void handleDeleteCategory()
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeletingCategory}
                >
                  {isDeletingCategory ? 'Excluindo...' : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}

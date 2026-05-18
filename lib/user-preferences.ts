export function readAutoProcessingEnabledPreference() {
  if (typeof window === 'undefined') return Promise.resolve(false)

  return fetch('/api/user/preferences/auto-processing', {
    method: 'GET',
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) return false
      const data = (await response.json()) as { auto_processing_enabled?: unknown }
      return data.auto_processing_enabled === true
    })
    .catch(() => false)
}

export function writeAutoProcessingEnabledPreference(enabled: boolean) {
  if (typeof window === 'undefined') return Promise.resolve(false)

  return fetch('/api/user/preferences/auto-processing', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auto_processing_enabled: enabled,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        return false
      }
      const data = (await response.json()) as { auto_processing_enabled?: unknown }
      return data.auto_processing_enabled === true
    })
    .catch(() => false)
}

import type { LatLng } from '@shared/types'

export type GeoFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export class GeoError extends Error {
  code: GeoFailure
  constructor(code: GeoFailure) {
    super(code)
    this.code = code
  }
}

export function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function requestPosition(timeoutMs = 12_000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!geoSupported()) {
      reject(new GeoError('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new GeoError('denied'))
        else if (err.code === err.TIMEOUT) reject(new GeoError('timeout'))
        else reject(new GeoError('unavailable'))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 20_000 },
    )
  })
}

export function watchPosition(
  onPosition: (latlng: LatLng, at: number) => void,
  onError: (failure: GeoFailure) => void,
): () => void {
  if (!geoSupported()) {
    onError('unsupported')
    return () => {}
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }, pos.timestamp || Date.now()),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) onError('denied')
      else if (err.code === err.TIMEOUT) onError('timeout')
      else onError('unavailable')
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

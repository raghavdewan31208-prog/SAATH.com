import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LatLng } from '@shared/types'
import { useApp } from '../lib/store'

export interface MapLine {
  id: string
  points: LatLng[]
  color: string
  dashed?: boolean
  weight?: number
}

export interface MapMarker {
  id: string
  point: LatLng
  label: string
  color?: string
  pulse?: boolean
  /** Optional icon glyph rendered inside the pin (instead of a text label). */
  glyph?: 'pin' | 'flag' | 'light' | 'bus' | 'walk' | 'alert'
}

// Small inline SVG glyph paths (Lucide-style, 24x24) used as map symbols.
const GLYPHS: Record<NonNullable<MapMarker['glyph']>, string> = {
  pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="9.8" r="2.4"/>',
  flag: '<path d="M5 21V3.5c4-2 7 2 11 0v9c-4 2-7-2-11 0"/>',
  light: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  bus: '<rect x="4" y="4" width="16" height="13" rx="2.5"/><path d="M4 10h16M8 17v2M16 17v2"/>',
  walk: '<circle cx="13" cy="4.6" r="2"/><path d="m10.5 21 1.6-5.2-2.2-3 1.2-4.1 3.1 1.4 2.2 2.9"/>',
  alert: '<path d="M12 3.6 2.7 20.2h18.6z"/><path d="M12 9.3v4.5M12 17.2h.01"/>',
}

export function MapView({
  lines,
  markers,
  center,
  zoom = 15,
  height = 260,
  label,
  className = '',
}: {
  lines: MapLine[]
  markers: MapMarker[]
  center?: LatLng
  zoom?: number
  height?: number
  label: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const { resolvedTheme } = useApp()

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return
    const map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      minZoom: 3,
    })
    mapRef.current = map
    layersRef.current = L.layerGroup().addTo(map)
    const start = center ?? lines[0]?.points[0] ?? { lat: 12.9338, lng: 77.6186 }
    map.setView([start.lat, start.lng], zoom)
    return () => {
      map.remove()
      mapRef.current = null
      layersRef.current = null
      tileRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (tileRef.current) {
      map.removeLayer(tileRef.current)
      tileRef.current = null
    }
    const tile = L.tileLayer(
      resolvedTheme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        detectRetina: true,
      },
    )
    tile.addTo(map)
    tileRef.current = tile
  }, [resolvedTheme])

  const dataKey = JSON.stringify({ lines, markers })
  useEffect(() => {
    const map = mapRef.current
    const group = layersRef.current
    if (!map || !group) return
    group.clearLayers()
    const bounds: L.LatLngExpression[] = []

    for (const line of lines) {
      if (line.points.length < 2) continue
      const latlngs = line.points.map((p) => [p.lat, p.lng] as [number, number])
      L.polyline(latlngs, {
        color: line.color,
        weight: line.weight ?? 5,
        opacity: 0.95,
        dashArray: line.dashed ? '7 9' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)
      bounds.push(...latlngs)
    }

    for (const marker of markers) {
      const inner = marker.glyph
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[marker.glyph]}</svg>`
        : marker.label
      const html = `<div class="pin" role="img" aria-label="${marker.label.replace(/"/g, '')}" style="background:${marker.color ?? '#0f766e'};${
        marker.pulse ? 'animation:pulse-soft 1.8s ease-in-out infinite;' : ''
      }">${inner}</div>`
      L.marker([marker.point.lat, marker.point.lng], {
        icon: L.divIcon({
          html,
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        keyboard: false,
      }).addTo(group)
      bounds.push([marker.point.lat, marker.point.lng])
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [34, 34], maxZoom: 16 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  return (
    <div className={`map-frame ${className}`}>
      <div
        ref={containerRef}
        className="map-canvas"
        style={{ height }}
        role="img"
        aria-label={label}
      />
      <p
        className="hint"
        style={{
          position: 'absolute',
          left: 10,
          bottom: 22,
          zIndex: 500,
          background: 'color-mix(in srgb, var(--saath-surface) 92%, transparent)',
          border: '1px solid var(--saath-line)',
          padding: '3px 7px',
          borderRadius: 7,
          fontSize: '0.66rem',
          pointerEvents: 'none',
        }}
      >
        {label}
      </p>
    </div>
  )
}

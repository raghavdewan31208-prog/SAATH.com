import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_DESTINATION, DEMO_PLACES, DEMO_START, inDemoArea } from '@shared/demo'
import type { ObservationKind, Place, RouteOption, RoutePlan } from '@shared/types'
import { confidenceLabel, formatAge, observationSourceLabel, pickObservation, routeCoverage } from '@shared/recommend'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, ConfidenceChip, PageLoader, Sheet, TopBar } from '../components/ui'
import { MapView } from '../components/MapView'
import { buildDemoPlan, fetchLivePlan, parseCoordinates } from '../lib/planner'
import { requestPosition, GeoError } from '../lib/geo'
import { formatDistance, formatDuration } from '../lib/i18n'
import { getHealth, requestRemoteRouteExplanation } from '../lib/ai'

const CONDITION_ROWS: { kind: ObservationKind; en: string; hi: string; icon: 'light' | 'walk' | 'activity' | 'alert' }[] = [
  { kind: 'lighting', en: 'Lighting', hi: 'रोशनी', icon: 'light' },
  { kind: 'walkway', en: 'Walkway', hi: 'फुटपाथ', icon: 'walk' },
  { kind: 'activity', en: 'Activity at this time', hi: 'इस समय गतिविधि', icon: 'activity' },
  { kind: 'incident', en: 'Incident reports', hi: 'घटना रिपोर्ट', icon: 'alert' },
]

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function PlanScreen() {
  const { state, dispatch, t, lang, now, online, toast } = useApp()
  const navigate = useNavigate()
  const [start, setStart] = useState<Place>(state.plan?.start ?? DEMO_START)
  const [destination, setDestination] = useState<Place>(state.plan?.destination ?? DEMO_DESTINATION)
  const [picker, setPicker] = useState<'start' | 'destination' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'offline' | 'routing' | null>(null)
  const plan = state.plan
  const journeyActive = Boolean(state.journey && state.journey.status !== 'ended')

  const compare = async (from = start, to = destination) => {
    setLoading(true)
    setError(null)
    setErrorKind(null)
    try {
      const planNow = Date.now()
      const demoArea = inDemoArea(from) && inDemoArea(to)
      if (demoArea) {
        await delay(320)
        dispatch({ type: 'plan/set', plan: buildDemoPlan(from, to, state.reports, planNow) })
      } else {
        if (!online) {
          setErrorKind('offline')
          setError(
            t(
              'You’re offline, so live routing cannot be fetched. Try the demo area, or reconnect and retry.',
              'आप ऑफ़लाइन हैं, इसलिए लाइव रूटिंग नहीं मिल सकती। डेमो क्षेत्र आज़माएँ या फिर से जुड़कर प्रयास करें।',
            ),
          )
          return
        }
        const live = await fetchLivePlan(from, to, planNow)
        dispatch({ type: 'plan/set', plan: live })
      }
    } catch {
      setErrorKind('routing')
      setError(
        t(
          'Live routing did not respond. This is not a safety assessment for your route. You can retry or use the demo area.',
          'लाइव रूटिंग ने जवाब नहीं दिया। यह आपके मार्ग का सुरक्षा आकलन नहीं है। आप पुनः प्रयास कर सकते हैं या डेमो क्षेत्र उपयोग कर सकते हैं।',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  const useDemo = async () => {
    setStart(DEMO_START)
    setDestination(DEMO_DESTINATION)
    setPicker(null)
    await compare(DEMO_START, DEMO_DESTINATION)
  }

  const startJourney = () => {
    if (!plan) return
    if (journeyActive) {
      toast(t('You already have an active journey.', 'आपकी पहले से एक सक्रिय यात्रा है।'))
      navigate('/journey')
      return
    }
    const route = plan.routes.find((r) => r.id === plan.recommendedId) ?? plan.routes[0]
    if (!route) return
    dispatch({
      type: 'journey/start',
      now: Date.now(),
      route,
      start: plan.start,
      destination: plan.destination,
    })
    toast(
      t('Journey started. Sharing is explicit and can be revoked any time.', 'यात्रा शुरू। साझा करना स्पष्ट है और कभी भी रद्द किया जा सकता है।'),
    )
    navigate('/journey')
  }

  const selectedDemo = inDemoArea(start) && inDemoArea(destination)

  return (
    <>
      <TopBar title={t('Plan a journey', 'यात्रा की योजना')} subtitle={t('Compare evening routes', 'शाम के मार्गों की तुलना')} back="/" />
      <div className="screen">
        {journeyActive ? (
          <Banner
            tone="brand"
            icon="route"
            title={t('A journey is already running', 'एक यात्रा पहले से चल रही है')}
            action={
              <button type="button" className="btn btn-sm btn-secondary" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => navigate('/journey')}>
                {t('Open Journey Mode', 'यात्रा मोड खोलें')}
              </button>
            }
          >
            {t('End the current journey before starting a new one.', 'नई यात्रा शुरू करने से पहले मौजूदा यात्रा समाप्त करें।')}
          </Banner>
        ) : null}

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            type="button"
            onClick={() => setPicker('start')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: '10px 0', textAlign: 'left', width: '100%' }}
          >
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--saath-brand-soft)', color: 'var(--saath-brand)', display: 'grid', placeItems: 'center' }}>
              <Icon name="pin" size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="hint" style={{ display: 'block' }}>{t('Starting point', 'प्रारंभ स्थान')}</span>
              <span style={{ display: 'block', fontWeight: 640, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{start.label}</span>
            </span>
            <Icon name="edit" size={18} />
          </button>
          <hr className="divider" />
          <button
            type="button"
            onClick={() => setPicker('destination')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: '10px 0', textAlign: 'left', width: '100%' }}
          >
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--saath-surface-2)', color: 'var(--saath-text)', display: 'grid', placeItems: 'center', border: '1px solid var(--saath-line)' }}>
              <Icon name="flag" size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="hint" style={{ display: 'block' }}>{t('Destination', 'गंतव्य')}</span>
              <span style={{ display: 'block', fontWeight: 640, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destination.label}</span>
            </span>
            <Icon name="edit" size={18} />
          </button>
          {selectedDemo ? (
            <p className="hint" style={{ paddingTop: 6 }}>
              {t('Both places are inside the Koramangala demo area.', 'दोनों जगहें कोरमंगला डेमो क्षेत्र में हैं।')}
            </p>
          ) : null}
        </section>

        {!online ? (
          <Banner tone="warn" icon="wifiOff" title={t('Offline', 'ऑफ़लाइन')}>
            {t(
              'Only the sample demo area can be compared offline. Live routing is unavailable.',
              'ऑफ़लाइन केवल नमूना डेमो क्षेत्र की तुलना हो सकती है। लाइव रूटिंग उपलब्ध नहीं है।',
            )}
          </Banner>
        ) : null}

        <button type="button" className="btn btn-primary btn-block" onClick={() => compare()} disabled={loading}>
          {loading ? (
            <>
              <span className="pulse-soft" aria-hidden="true"><Icon name="refresh" size={18} /></span>
              {t('Comparing routes…', 'मार्गों की तुलना हो रही है…')}
            </>
          ) : (
            <>
              <Icon name="route" size={19} />
              {t('Compare routes', 'मार्गों की तुलना करें')}
            </>
          )}
        </button>

        {error ? (
          <Banner
            tone="danger"
            icon="alert"
            title={errorKind === 'offline' ? t('Offline — no live route', 'ऑफ़लाइन — लाइव मार्ग नहीं') : t('Route comparison failed', 'मार्ग तुलना विफल')}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => compare()}>
                  <Icon name="refresh" size={16} />
                  {t('Retry', 'पुनः प्रयास')}
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={useDemo}>
                  {t('Use demo area', 'डेमो क्षेत्र उपयोग करें')}
                </button>
              </div>
            }
          >
            {error}
          </Banner>
        ) : null}

        {loading ? <PageLoader label={t('Checking two possible routes…', 'दो संभावित मार्गों की जाँच…')} /> : null}

        {!loading && plan ? (
          <PlanResult
            plan={plan}
            now={now}
            lang={lang}
            onStart={startJourney}
            journeyActive={journeyActive}
            onDemoRetry={useDemo}
          />
        ) : null}

        {!loading && !plan ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ color: 'var(--saath-brand)' }}><Icon name="map" size={22} /></span>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('What you’ll see', 'आपको क्या दिखेगा')}</p>
            </div>
            <p className="hint">
              {t(
                'Two routes on a real map, with travel time, distance, transport waits, and time-stamped lighting, walkway, activity and incident observations. Unavailable details are marked Unknown.',
                'वास्तविक मानचित्र पर दो मार्ग — यात्रा समय, दूरी, परिवहन प्रतीक्षा, और समय-चिह्नित रोशनी, फुटपाथ, गतिविधि व घटना अवलोकन। अनुपलब्ध जानकारी “अज्ञात” दिखेगी।',
              )}
            </p>
            <p className="hint">
              {t(
                'Saath does not measure crowds or predict crime, and never promises a safe route.',
                'साथ भीड़ नहीं मापता या अपराध का अनुमान नहीं लगाता, और कभी सुरक्षित मार्ग का वादा नहीं करता।',
              )}
            </p>
          </div>
        ) : null}
      </div>

      <PlacePicker
        mode={picker}
        onClose={() => setPicker(null)}
        onSelect={(place) => {
          if (picker === 'start') setStart(place)
          else setDestination(place)
          setPicker(null)
        }}
      />
    </>
  )
}

function PlacePicker({
  mode,
  onClose,
  onSelect,
}: {
  mode: 'start' | 'destination' | null
  onClose: () => void
  onSelect: (place: Place) => void
}) {
  const { dispatch, t, toast } = useApp()
  const [tab, setTab] = useState<'current' | 'places' | 'coords'>('places')
  const [coords, setCoords] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const useCurrent = async () => {
    setLocating(true)
    setError(null)
    try {
      const position = await requestPosition()
      dispatch({ type: 'permission/set', key: 'location', value: 'granted' })
      onSelect({ label: t('Current location', 'वर्तमान लोकेशन'), lat: position.lat, lng: position.lng, kind: 'current' })
      toast(t('Using your current location as the start.', 'वर्तमान लोकेशन प्रारंभ के रूप में उपयोग हो रही है।'))
    } catch (err) {
      const code = err instanceof GeoError ? err.code : 'unavailable'
      if (code === 'denied') dispatch({ type: 'permission/set', key: 'location', value: 'denied' })
      setError(
        code === 'denied'
          ? t('Location permission was denied. Choose a saved place or enter coordinates instead.', 'लोकेशन अनुमति अस्वीकृत। सहेजी जगह चुनें या निर्देशांक दर्ज करें।')
          : t('Your location could not be read. You can try again or enter a place manually.', 'आपकी लोकेशन नहीं पढ़ी जा सकी। पुनः प्रयास करें या जगह मैन्युअल दर्ज करें।'),
      )
    } finally {
      setLocating(false)
    }
  }

  const submitCoords = () => {
    const parsed = parseCoordinates(coords)
    if (!parsed) {
      setError(t('Enter coordinates as latitude, longitude — for example 12.9338, 77.6265.', 'निर्देशांक “अक्षांश, देशांतर” में दर्ज करें — जैसे 12.9338, 77.6265।'))
      return
    }
    onSelect({
      label: label.trim() || t('Manual place', 'मैन्युअल स्थान'),
      lat: parsed.lat,
      lng: parsed.lng,
      kind: 'manual',
    })
  }

  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={mode === 'start' ? t('Choose a starting point', 'प्रारंभ स्थान चुनें') : t('Choose a destination', 'गंतव्य चुनें')}
    >
      <div className="segmented" role="group" aria-label={t('Place entry method', 'स्थान दर्ज करने का तरीका')}>
        {mode === 'start' ? (
          <button type="button" aria-pressed={tab === 'current'} onClick={() => { setTab('current'); setError(null) }}>
            {t('Current', 'वर्तमान')}
          </button>
        ) : null}
        <button type="button" aria-pressed={tab === 'places'} onClick={() => { setTab('places'); setError(null) }}>
          {t('Saved places', 'सहेजी जगहें')}
        </button>
        <button type="button" aria-pressed={tab === 'coords'} onClick={() => { setTab('coords'); setError(null) }}>
          {t('Coordinates', 'निर्देशांक')}
        </button>
      </div>

      {tab === 'current' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="hint">
            {t(
              'Saath asks for location only when you use it. You can explore and plan without granting it.',
              'साथ लोकेशन केवल तब माँगता है जब आप उपयोग करें। आप अनुमति के बिना भी देख और योजना बना सकते हैं।',
            )}
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={useCurrent} disabled={locating}>
            <Icon name="pin" size={19} />
            {locating ? t('Reading location…', 'लोकेशन पढ़ी जा रही है…') : t('Use my current location', 'मेरी वर्तमान लोकेशन उपयोग करें')}
          </button>
          {error ? <Banner tone="warn" icon="alert">{error}</Banner> : null}
        </div>
      ) : null}

      {tab === 'places' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="hint">
            {t(
              'A small offline list for the demo area. Saath has no live place search in this build.',
              'डेमो क्षेत्र के लिए छोटी ऑफ़लाइन सूची। इस बिल्ड में साथ के पास लाइव स्थान खोज नहीं है।',
            )}
          </p>
          {DEMO_PLACES.map((place) => (
            <button
              key={place.label}
              type="button"
              className="card-soft"
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              onClick={() => onSelect(place)}
            >
              <Icon name="pin" size={18} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 620, fontSize: '0.92rem' }}>{place.label}</span>
                <span className="hint" style={{ display: 'block' }}>
                  {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                </span>
              </span>
              <Icon name="chevronRight" size={17} />
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'coords' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="place-label">{t('Place name (optional)', 'स्थान का नाम (वैकल्पिक)')}</label>
            <input id="place-label" className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t('My destination', 'मेरा गंतव्य')} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="place-coords">{t('Coordinates', 'निर्देशांक')}</label>
            <input
              id="place-coords"
              className="input"
              value={coords}
              onChange={(event) => setCoords(event.target.value)}
              placeholder="12.9338, 77.6265"
              inputMode="decimal"
            />
            <p className="hint">{t('Latitude, longitude. Outside the demo area, conditions are shown as Unknown.', 'अक्षांश, देशांतर। डेमो क्षेत्र के बाहर स्थितियाँ अज्ञात दिखेंगी।')}</p>
          </div>
          {error ? <Banner tone="warn" icon="alert">{error}</Banner> : null}
          <button type="button" className="btn btn-primary btn-block" onClick={submitCoords}>
            {t('Use this place', 'यह स्थान उपयोग करें')}
          </button>
        </div>
      ) : null}
    </Sheet>
  )
}

function PlanResult({
  plan,
  now,
  lang,
  onStart,
  journeyActive,
  onDemoRetry,
}: {
  plan: RoutePlan
  now: number
  lang: 'en' | 'hi'
  onStart: () => void
  journeyActive: boolean
  onDemoRetry: () => void
}) {
  const { t } = useApp()
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const recommended = plan.routes.find((route) => route.id === plan.recommendedId) ?? null

  useEffect(() => {
    let cancelled = false
    setAiSummary(null)
    getHealth().then(async (health) => {
      if (cancelled || !health?.ai.configured) return
      const summary = await requestRemoteRouteExplanation({
        reasons: plan.reasons,
        routeLabels: plan.routes.map((route) => route.label),
        lang,
      })
      if (!cancelled && summary) setAiSummary(summary)
    })
    return () => {
      cancelled = true
    }
  }, [plan.id, lang])
  const { state } = useApp()
  const recColor = '#4f46e5'
  const altColor = '#94a3b8'

  const lines = plan.routes.map((route) => ({
    id: route.id,
    points: route.geometry,
    color: route.id === plan.recommendedId ? recColor : altColor,
    dashed: route.id !== plan.recommendedId,
    weight: route.id === plan.recommendedId ? 6 : 4,
  }))

  // Only honest, point-based symbols are plotted: the two chosen places, a
  // real (sample) bus stop that sits on the demo routes, and *approved* report
  // locations at their coarse area. Lighting/walkway notes are route segments,
  // not points, so they are shown as condition rows/legend rather than fake pins.
  const demoBusStop = plan.area === 'demo' ? DEMO_PLACES.find((place) => place.label.includes('bus stop')) : undefined
  const concernReports = state.reports.filter(
    (report) => report.status === 'approved' && report.shareWithRoutes && report.coarseLocation,
  )

  const markers = [
    { id: 'start', point: plan.start, label: t('Start', 'प्रारंभ'), color: '#0f766e', glyph: 'walk' as const },
    { id: 'end', point: plan.destination, label: t('Destination', 'गंतव्य'), color: '#17233b', glyph: 'flag' as const },
    ...(demoBusStop ? [{ id: 'bus-stop', point: demoBusStop, label: demoBusStop.label, color: '#6366f1', glyph: 'bus' as const }] : []),
    ...concernReports.map((report) => ({
      id: `report-${report.id}`,
      point: report.coarseLocation!,
      label: t('Approved concern report (coarse area)', 'स्वीकृत चिंता रिपोर्ट (मोटा क्षेत्र)'),
      color: '#b45309',
      glyph: 'alert' as const,
    })),
  ]

  return (
    <>
      <Banner
        tone={plan.area === 'demo' ? 'warn' : 'neutral'}
        icon={plan.area === 'demo' ? 'info' : 'map'}
        title={plan.area === 'demo' ? t('Sample conditions for a small demo area', 'छोटे डेमो क्षेत्र के लिए नमूना स्थितियाँ') : t('Live routing, conditions Unknown', 'लाइव रूटिंग, स्थितियाँ अज्ञात')}
      >
        {plan.dataNote}
      </Banner>

      <MapView
        lines={lines}
        markers={markers}
        label={
          plan.area === 'demo'
            ? t('Map © OpenStreetMap + CARTO · sample route lines', 'मानचित्र © OpenStreetMap + CARTO · नमूना मार्ग रेखाएँ')
            : t('Map © OpenStreetMap + CARTO · live OSRM geometry', 'मानचित्र © OpenStreetMap + CARTO · लाइव OSRM ज्यामिति')
        }
      />

      <div className="map-legend" aria-label={t('Map legend', 'मानचित्र संकेत')}>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: '#0f766e' }}>
            <Icon name="walk" size={9} label="" />
          </span>
          {t('Start', 'प्रारंभ')}
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: '#17233b' }}>
            <Icon name="flag" size={9} label="" />
          </span>
          {t('Destination', 'गंतव्य')}
        </span>
        {demoBusStop ? (
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: '#6366f1' }}>
              <Icon name="bus" size={9} label="" />
            </span>
            {t('Bus stop (sample)', 'बस स्टॉप (नमूना)')}
          </span>
        ) : null}
        {concernReports.length > 0 ? (
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: '#b45309' }}>
              <Icon name="alert" size={9} label="" />
            </span>
            {t('Approved concern', 'स्वीकृत चिंता')}
          </span>
        ) : null}
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: recColor, height: 4, width: 20, borderRadius: 999 }} />
          {t('Recommended route', 'अनुशंसित मार्ग')}
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{
              background: `repeating-linear-gradient(90deg, ${altColor} 0 4px, transparent 4px 7px)`,
              height: 4,
              width: 20,
              borderRadius: 999,
            }}
          />
          {t('Alternative', 'वैकल्पिक')}
        </span>
        <span className="legend-sep" aria-hidden="true" />
        <span className="legend-item" style={{ color: 'var(--saath-ink)' }}>
          {t('Condition symbols:', 'स्थिति संकेत:')}
        </span>
        <span className="legend-item">
          <Icon name="light" size={13} />
          {t('Lighting', 'रोशनी')}
        </span>
        <span className="legend-item">
          <Icon name="walk" size={13} />
          {t('Walkway', 'फुटपाथ')}
        </span>
        <span className="legend-item">
          <Icon name="alert" size={13} />
          {t('Concern', 'चिंता')}
        </span>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-between">
          <p className="section-title">{t('Route options', 'मार्ग विकल्प')}</p>
          <Chip tone={plan.area === 'demo' ? 'warn' : 'neutral'}>{plan.routes.length} {t('routes', 'मार्ग')}</Chip>
        </div>
        {plan.routes.map((route, index) => (
          <RouteCard
            key={route.id}
            route={route}
            recommended={route.id === plan.recommendedId}
            plan={plan}
            now={now}
            open={index === 0}
          />
        ))}
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-between">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--saath-brand)' }}><Icon name="sparkles" size={20} /></span>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Why this recommendation', 'यह सुझाव क्यों')}</p>
          </div>
          <ConfidenceChip value={plan.confidence} />
        </div>
        <ul style={{ margin: 0, paddingLeft: 19, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {plan.reasons.map((reason) => (
            <li key={reason} className="hint" style={{ color: 'var(--saath-ink)', lineHeight: 1.45 }}>{reason}</li>
          ))}
        </ul>
        <p className="hint">
          {t(
            'Explanations are generated deterministically from approved observations — not by the AI. AI does not choose or invent route conditions.',
            'स्पष्टीकरण स्वीकृत अवलोकनों से निश्चित रूप से बनते हैं — AI से नहीं। AI मार्ग की स्थितियाँ नहीं चुनता या गढ़ता।',
          )}
        </p>
        {aiSummary ? (
          <div className="card-soft">
            <div className="row-between" style={{ marginBottom: 5 }}>
              <p style={{ fontWeight: 650, fontSize: '0.88rem' }}>{t('AI paraphrase of the reasons above', 'ऊपर के कारणों का AI सारांश')}</p>
              <Chip tone="brand" icon="sparkles">{t('Provider', 'प्रदाता')}</Chip>
            </div>
            <p className="hint" style={{ color: 'var(--saath-ink)' }}>{aiSummary}</p>
            <p className="hint">{t('This wording is generated by the configured provider from the approved reasons only. It cannot change the recommendation.', 'यह शब्दावली कॉन्फ़िगर प्रदाता द्वारा केवल स्वीकृत कारणों से बनाई गई है। यह सुझाव नहीं बदल सकती।')}</p>
          </div>
        ) : null}
        <div className="row-between">
          <span className="hint">{t('Data coverage', 'डेटा कवरेज')}</span>
          <span style={{ fontWeight: 650 }}>{Math.round(routeCoverage(plan.routes[0]) * 100)}%</span>
        </div>
        {plan.area === 'outside-demo' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onDemoRetry}>
            {t('Compare the sample demo routes instead', 'इसके बजाय नमूना डेमो मार्गों की तुलना करें')}
          </button>
        ) : null}
      </section>

      <Banner tone="neutral" icon="info">
        {t(
          'Lighting, walkway and incident observations are time-stamped human notes. Missing reports and low activity are not proof of danger, and no route is guaranteed safe.',
          'रोशनी, फुटपाथ और घटना अवलोकन समय-चिह्नित मानवीय नोट्स हैं। अनुपलब्ध रिपोर्ट और कम गतिविधि ख़तरे का प्रमाण नहीं हैं, और कोई मार्ग पूरी तरह सुरक्षित नहीं है।',
        )}
      </Banner>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-block" onClick={onStart} disabled={!recommended || journeyActive}>
          <Icon name="navigate" size={19} />
          {journeyActive
            ? t('Journey already active', 'यात्रा पहले से सक्रिय')
            : t('Start Journey Mode', 'यात्रा मोड शुरू करें')}
        </button>
        <p className="hint" style={{ textAlign: 'center' }}>
          {t('Journey Mode shares a simulated location with selected contacts until you end it.', 'यात्रा मोड आपके द्वारा समाप्त करने तक चुने संपर्कों के साथ सिम्युलेटेड लोकेशन साझा करता है।')}
        </p>
      </div>
    </>
  )
}

function RouteCard({ route, recommended, plan, now, open }: { route: RouteOption; recommended: boolean; plan: RoutePlan; now: number; open: boolean }) {
  const { t, lang } = useApp()
  const [expanded, setExpanded] = useState(open)
  const drawbacks = route.observations.filter((o) => o.polarity === 'negative').map((o) => o.summary)

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: recommended ? 'var(--saath-brand)' : 'var(--saath-line)',
        boxShadow: recommended ? '0 0 0 1px color-mix(in srgb, var(--saath-brand) 30%, transparent)' : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9, padding: 16, background: 'none', border: 0, textAlign: 'left' }}
      >
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 720, fontSize: '0.98rem' }}>{route.label}</span>
              {recommended ? <Chip tone="brand" icon="sparkles">{t('Recommended', 'सुझाया गया')}</Chip> : null}
            </div>
            <p className="hint">{route.summary}</p>
          </div>
          <Icon name={expanded ? 'chevronLeft' : 'chevronRight'} size={18} />
        </div>
        <div className="row" style={{ gap: 20 }}>
          <div className="stat">
            <span className="stat-value">{formatDuration(route.durationMin, lang)}</span>
            <span className="stat-label">{t('Travel time', 'यात्रा समय')}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatDistance(route.distanceKm, lang)}</span>
            <span className="stat-label">{t('Distance', 'दूरी')}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{route.transport.available ? (route.transport.waitMinutes !== null ? `~${route.transport.waitMinutes} min` : '—') : '—'}</span>
            <span className="stat-label">{t('Transport wait', 'परिवहन प्रतीक्षा')}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {route.source === 'sample' ? <Chip tone="warn" icon="info">{t('Sample conditions', 'नमूना स्थितियाँ')}</Chip> : <Chip tone="neutral" icon="map">{t('Live geometry', 'लाइव ज्यामिति')}</Chip>}
          {recommended ? <Chip tone="brand">{t('Selected by Saath rules', 'साथ नियमों से चुना')}</Chip> : null}
        </div>
      </button>

      {expanded ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <hr className="divider" />
          {CONDITION_ROWS.map((row) => {
            const observation = pickObservation(route, row.kind)
            return (
              <div key={row.kind} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: 'var(--saath-muted)', marginTop: 2 }}>
                  <Icon name={row.icon} size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-between" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 620, fontSize: '0.87rem' }}>{lang === 'hi' ? row.hi : row.en}</span>
                    {observation ? (
                      <span className="hint" style={{ whiteSpace: 'nowrap' }}>{formatAge(observation.observedAt, now, lang)}</span>
                    ) : (
                      <Chip tone="neutral">{t('Unknown', 'अज्ञात')}</Chip>
                    )}
                  </div>
                  {observation ? (
                    <>
                      <p className="hint" style={{ marginTop: 2, color: 'var(--saath-ink)' }}>{observation.summary}</p>
                      <div className="row" style={{ gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                        <Chip tone="neutral">{observationSourceLabel(observation.source, lang)}</Chip>
                        <Chip tone={observation.confidence === 'low' ? 'warn' : 'brand'}>
                          {t('Confidence', 'विश्वास')} {confidenceLabel(observation.confidence, lang)}
                        </Chip>
                        {observation.polarity === 'negative' ? <Chip tone="warn" icon="alert">{t('Concern reported', 'चिंता दर्ज')}</Chip> : null}
                      </div>
                    </>
                  ) : (
                    <p className="hint" style={{ marginTop: 2 }}>
                      {row.kind === 'incident'
                        ? t('No recent incident reports in this dataset. Missing reports are not evidence of safety.', 'इस डेटासेट में हाल की घटना रिपोर्ट नहीं। रिपोर्ट न होना सुरक्षा का प्रमाण नहीं।')
                        : t('No approved observation for this route. Saath will not guess.', 'इस मार्ग के लिए कोई स्वीकृत अवलोकन नहीं। साथ अनुमान नहीं लगाता।')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ color: 'var(--saath-muted)', marginTop: 2 }}>
              <Icon name="bus" size={17} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="row-between" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 620, fontSize: '0.87rem' }}>{t('Public transport', 'सार्वजनिक परिवहन')}</span>
                {route.transport.available ? <Chip tone="brand">{t('Available', 'उपलब्ध')}</Chip> : <Chip tone="neutral">{t('Unknown / none', 'अज्ञात / नहीं')}</Chip>}
              </div>
              <p className="hint" style={{ marginTop: 2, color: 'var(--saath-ink)' }}>
                {route.transport.available
                  ? `${route.transport.modes.join(', ') || t('Service noted', 'सेवा दर्ज')} · ${
                      route.transport.waitMinutes !== null
                        ? `${t('about', 'लगभग')} ${route.transport.waitMinutes} ${t('min wait', 'मिनट प्रतीक्षा')}`
                        : t('wait Unknown', 'प्रतीक्षा अज्ञात')
                    }`
                  : t('No direct service. Wait time Unknown.', 'सीधी सेवा नहीं। प्रतीक्षा समय अज्ञात।')}
              </p>
              {route.transport.note ? <p className="hint">{route.transport.note}</p> : null}
            </div>
          </div>

          {route.warnings.map((warning) => (
            <Banner key={warning} tone="warn" icon="alert">{warning}</Banner>
          ))}

          {recommended ? (
            <div className="card-soft">
              <p style={{ fontWeight: 680, fontSize: '0.9rem' }}>{t('Why Saath suggests this', 'साथ यह क्यों सुझाता है')}</p>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {plan.reasons.map((reason) => (
                  <li key={reason} className="hint">{reason}</li>
                ))}
              </ul>
            </div>
          ) : drawbacks.length > 0 ? (
            <div className="card-soft">
              <p style={{ fontWeight: 680, fontSize: '0.9rem' }}>{t('Why it was not recommended', 'इसे क्यों नहीं सुझाया गया')}</p>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {drawbacks.map((item) => (
                  <li key={item} className="hint">{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}


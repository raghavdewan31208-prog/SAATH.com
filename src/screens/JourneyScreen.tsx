import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { journeyEtaAt, journeyProgressAt } from '@shared/engine'
import { shareExpired, shareIsLive, maskToken } from '@shared/tokens'
import type { JourneyEvent } from '@shared/types'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, EmptyState, Sheet, TopBar } from '../components/ui'
import { MapView } from '../components/MapView'
import { EmptyJourneyIllustration } from '../components/Illustrations'
import { formatAge } from '@shared/recommend'
import { formatDuration, formatEta, formatTime } from '../lib/i18n'
import { distanceMeters, requestPosition, watchPosition } from '../lib/geo'
import type { GeoFailure } from '../lib/geo'

const EVENT_LABELS: Record<JourneyEvent['kind'], [string, string]> = {
  started: ['Journey started', 'यात्रा शुरू'],
  paused: ['Journey paused', 'यात्रा रुकी'],
  resumed: ['Journey resumed', 'यात्रा फिर शुरू'],
  'checkin-raised': ['Check-in requested', 'चेक-इन माँगा'],
  'checkin-ok': ['You checked in as okay', 'आपने ठीक होने की पुष्टि की'],
  'checkin-extended': ['Journey time updated', 'यात्रा समय अपडेट'],
  'checkin-help': ['You asked for help', 'आपने मदद माँगी'],
  escalated: ['Check-in escalated (simulated)', 'चेक-इन आगे भेजा (सिम्युलेटेड)'],
  'share-started': ['Sharing started (simulated)', 'साझा करना शुरू (सिम्युलेटेड)'],
  'share-revoked': ['Sharing revoked', 'साझा करना रद्द'],
  'journey-ended': ['Journey ended', 'यात्रा समाप्त'],
  'sos-started': ['SOS activated', 'SOS सक्रिय'],
  note: ['Note', 'नोट'],
}

const CHECKIN_TITLES: Record<string, [string, string]> = {
  scheduled: ['Routine check-in', 'नियमित चेक-इन'],
  deviation: ['You seem to be off the planned route', 'आप योजना से अलग मार्ग पर लग रहे हैं'],
  stop: ['You’ve been in one place a while', 'आप कुछ समय से एक ही जगह हैं'],
  overdue: ['Your arrival is overdue', 'आपका आगमन देर से है'],
}

export default function JourneyScreen() {
  const { state, dispatch, t, lang, now, online, toast } = useApp()
  const navigate = useNavigate()
  const journey = state.journey
  const [endOpen, setEndOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [permissionBusy, setPermissionBusy] = useState(false)
  const [outsideDemo, setOutsideDemo] = useState(false)
  const [extraMinutes, setExtraMinutes] = useState(10)
  const [note, setNote] = useState('')

  const locationPermission = state.profile.permissions.location

  // Optional device tracking. It runs only while the journey is active and the
  // permission is granted, and only when the device is near the route.
  useEffect(() => {
    if (!journey || journey.status !== 'active') return
    if (locationPermission !== 'granted') return
    let lastSent = 0
    const stop = watchPosition(
      (position) => {
        if (Date.now() - lastSent < 10_000) return
        if (distanceMeters(position, journey.route.geometry[0]) > 5000) {
          setOutsideDemo(true)
          return
        }
        lastSent = Date.now()
        setOutsideDemo(false)
        dispatch({ type: 'journey/tick', now: Date.now(), online, position })
      },
      (failure: GeoFailure) => {
        if (failure === 'denied') dispatch({ type: 'permission/set', key: 'location', value: 'denied' })
      },
    )
    return stop
  }, [journey?.id, journey?.status, locationPermission, online, dispatch])

  if (!journey) {
    return (
      <>
        <TopBar title={t('Journey Mode', 'यात्रा मोड')} back="/" />
        <div className="screen">
          <EmptyState
            icon="route"
            illustration={<EmptyJourneyIllustration />}
            title={t('No journey yet', 'अभी कोई यात्रा नहीं')}
            body={t(
              'Plan an evening route, compare conditions, then start Journey Mode to share progress and receive check-ins.',
              'शाम का मार्ग चुनें, स्थितियों की तुलना करें, फिर प्रगति साझा करने और चेक-इन पाने के लिए यात्रा मोड शुरू करें।',
            )}
            action={
              <button type="button" className="btn btn-primary" onClick={() => navigate('/plan')}>
                <Icon name="map" size={18} />
                {t('Plan a journey', 'यात्रा की योजना बनाएँ')}
              </button>
            }
          />
        </div>
      </>
    )
  }

  if (journey.status === 'ended') {
    const endedSharing = journey.sharing
    return (
      <>
        <TopBar title={t('Journey summary', 'यात्रा सारांश')} back="/" />
        <div className="screen">
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div className="row-between">
              <Chip tone="neutral" icon="check">{t('Ended', 'समाप्त')}</Chip>
              <span className="hint">{journey.endedAt ? formatTime(journey.endedAt, lang) : ''}</span>
            </div>
            <div>
              <h1 className="h2">{journey.destination.label}</h1>
              <p className="hint">{journey.route.label}</p>
            </div>
            <div className="row" style={{ gap: 22 }}>
              <div className="stat">
                <span className="stat-value">{formatDuration(((journey.endedAt ?? now) - journey.startedAt - journey.pausedMs) / 60_000, lang)}</span>
                <span className="stat-label">{t('Journey duration', 'यात्रा अवधि')}</span>
              </div>
              <div className="stat">
                <span className="stat-value">{Math.round(journey.progress * 100)}%</span>
                <span className="stat-label">{t('Planned route', 'नियोजित मार्ग')}</span>
              </div>
            </div>
            <div className="card-soft">
              <div className="row-between">
                <span className="hint">{t('Location sharing', 'लोकेशन साझा')}</span>
                <Chip tone={endedSharing.revokedAt ? 'neutral' : 'warn'} icon={endedSharing.revokedAt ? 'lock' : 'alert'}>
                  {endedSharing.revokedAt ? t('Revoked', 'रद्द') : t('Not revoked', 'रद्द नहीं')}
                </Chip>
              </div>
              <p className="hint" style={{ marginTop: 5 }}>
                {t('Ending a journey stops its sharing session. Simulated delivery already sent may remain with recipients.', 'यात्रा समाप्त करने पर साझा सत्र बंद होता है। पहले भेजी गई सिम्युलेटेड जानकारी प्राप्तकर्ताओं के पास रह सकती है।')}
              </p>
              <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={() => navigate('/share')}>
                {t('View sharing details', 'साझा विवरण देखें')}
              </button>
            </div>
          </section>

          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Journey timeline', 'यात्रा टाइमलाइन')}</p>
            {journey.events.slice(-6).reverse().map((event) => (
              <div key={event.id} className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{EVENT_LABELS[event.kind][lang === 'hi' ? 1 : 0]}</p>
                  {event.detail ? <p className="hint">{event.detail}</p> : null}
                </div>
                <span className="hint" style={{ whiteSpace: 'nowrap' }}>{formatTime(event.at, lang)}</span>
              </div>
            ))}
          </section>

          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/plan')}>
            <Icon name="map" size={18} />
            {t('Plan another journey', 'दूसरी यात्रा की योजना')}
          </button>
        </div>
      </>
    )
  }

  const progress = journeyProgressAt(journey, now)
  const eta = journeyEtaAt(journey, now)
  const pending = journey.checkin.pending
  const sharing = journey.sharing
  const live = shareIsLive(sharing, now)
  const expired = shareExpired(sharing, now)
  const recipients = state.contacts
    .filter((contact) => sharing.contactIds.includes(contact.id))
    .sort((a, b) => a.priority - b.priority)
  const stale = online && journey.status === 'active' && now - journey.lastFixAt > 2 * 60_000
  const graceLeft = pending
    ? Math.max(0, state.settings.checkin.graceSeconds * 1000 - (now - pending.raisedAt))
    : 0
  const escalatedContact = pending?.escalatedToContactId
    ? state.contacts.find((contact) => contact.id === pending.escalatedToContactId)
    : null
  const nextCheckinIn = Math.max(0, journey.checkin.nextDueAt - now)

  const mapProgressPoint = journey.position
  const idxFloat = progress * (journey.route.geometry.length - 1)
  const idx = Math.min(journey.route.geometry.length - 1, Math.floor(idxFloat))
  const traveled = [...journey.route.geometry.slice(0, idx + 1)]
  if (traveled.length > 0 && (mapProgressPoint.lat !== traveled[traveled.length - 1].lat || mapProgressPoint.lng !== traveled[traveled.length - 1].lng)) {
    traveled.push(mapProgressPoint)
  }
  const remaining = [mapProgressPoint, ...journey.route.geometry.slice(idx + 1)]

  const lines = [
    { id: 'remaining', points: remaining, color: '#94a3b8', dashed: true, weight: 4 },
    { id: 'traveled', points: traveled, color: '#4f46e5', weight: 6 },
  ]
  const markers = [
    { id: 'start', point: journey.route.geometry[0], label: t('Start', 'प्रारंभ'), color: '#0f766e', glyph: 'walk' as const },
    { id: 'destination', point: journey.destination, label: t('Destination', 'गंतव्य'), color: '#17233b', glyph: 'flag' as const },
    { id: 'you', point: mapProgressPoint, label: t('Your current position', 'आपकी वर्तमान स्थिति'), color: '#4f46e5', glyph: 'pin' as const, pulse: true },
  ]

  const resolveCheckin = (response: 'ok' | 'help') => {
    if (pending) {
      dispatch({ type: 'journey/checkin', now: Date.now(), response })
    } else {
      dispatch({ type: 'journey/checkin-now', now: Date.now() })
    }
    if (response === 'help') {
      navigate('/sos')
    } else {
      toast(t('Check-in recorded. Your sharing status has not changed.', 'चेक-इन दर्ज। आपकी साझा स्थिति नहीं बदली।'))
    }
  }

  const submitUpdate = () => {
    const timestamp = Date.now()
    if (pending) {
      dispatch({ type: 'journey/checkin', now: timestamp, response: 'extended', extraMin: extraMinutes })
      if (note.trim()) dispatch({ type: 'journey/note', now: timestamp, text: note.trim() })
    } else {
      dispatch({ type: 'journey/extend', now: timestamp, minutes: extraMinutes, note: note.trim() || undefined })
    }
    setUpdateOpen(false)
    setNote('')
    toast(t('Journey updated. The new time is local to this device.', 'यात्रा अपडेट। नया समय इस डिवाइस पर स्थानीय है।'))
  }

  const askDeviceLocation = async () => {
    setPermissionBusy(true)
    try {
      const position = await requestPosition()
      dispatch({ type: 'permission/set', key: 'location', value: 'granted' })
      dispatch({ type: 'journey/tick', now: Date.now(), online, position })
      toast(t('Device location enabled for this journey.', 'इस यात्रा के लिए डिवाइस लोकेशन सक्रिय।'))
    } catch {
      dispatch({ type: 'permission/set', key: 'location', value: 'denied' })
      toast(t('Location is unavailable. Journey Mode continues with simulated movement.', 'लोकेशन उपलब्ध नहीं। यात्रा मोड सिम्युलेटेड गति से जारी रहेगा।'), 'danger')
    } finally {
      setPermissionBusy(false)
    }
  }

  return (
    <>
      <TopBar
        title={t('Journey Mode', 'यात्रा मोड')}
        subtitle={journey.route.label}
        back="/"
        right={
          <button type="button" className="icon-btn" aria-label={t('Journey settings', 'यात्रा सेटिंग्स')} onClick={() => navigate('/settings')}>
            <Icon name="settings" size={20} />
          </button>
        }
      />
      <div className="screen">
        {!online ? (
          <Banner tone="warn" icon="wifiOff" title={t('Offline — location is stale', 'ऑफ़लाइन — लोकेशन पुरानी')}>
            {t(
              'New simulated updates and delivery are paused. Check-in timers continue on this device. Last update',
              'नए सिम्युलेटेड अपडेट और डिलीवरी रुकी हैं। चेक-इन टाइमर इस डिवाइस पर चलते रहते हैं। अंतिम अपडेट',
            )}{' '}
            {formatAge(journey.lastFixAt, now, lang)}.
          </Banner>
        ) : null}

        <div className="row" style={{ gap: 9, flexWrap: 'wrap' }}>
          <Chip tone={journey.status === 'paused' ? 'warn' : 'brand'} icon={journey.status === 'paused' ? 'pause' : 'activity'}>
            {journey.status === 'paused' ? t('Paused', 'रुका हुआ') : t('Active', 'सक्रिय')}
          </Chip>
          <Chip tone={live ? 'brand' : 'neutral'} icon="share">
            {live ? t('Sharing simulated', 'साझा सिम्युलेटेड') : expired ? t('Share expired', 'साझा समाप्त') : sharing.revokedAt ? t('Sharing revoked', 'साझा रद्द') : t('Not sharing', 'साझा नहीं')}
          </Chip>
          {journey.positionSource === 'simulated' ? <Chip tone="warn" icon="info">{t('Demo movement', 'डेमो गति')}</Chip> : <Chip tone="brand" icon="pin">{t('Device location', 'डिवाइस लोकेशन')}</Chip>}
        </div>

        <button type="button" className="btn btn-danger btn-block" style={{ minHeight: 58 }} onClick={() => navigate('/sos')}>
          <Icon name="shield" size={22} />
          {t('SOS — share location and ask for help', 'SOS — लोकेशन साझा करें और मदद माँगें')}
        </button>

        <MapView
          lines={lines}
          markers={markers}
          label={t('Map © OpenStreetMap + CARTO · route and last known position', 'मानचित्र © OpenStreetMap + CARTO · मार्ग और अंतिम ज्ञात स्थिति')}
          height={300}
        />

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row-between">
            <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ color: 'var(--saath-accent)', marginTop: 2 }}>
                <Icon name="flag" size={20} />
              </span>
              <div>
                <p className="eyebrow">{t('Heading to', 'गंतव्य')}</p>
                <p className="section-title">{journey.destination.label}</p>
              </div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ color: 'var(--saath-brand)', marginTop: 3 }}>
                <Icon name="clock" size={18} />
              </span>
              <div className="stat" style={{ alignItems: 'flex-end' }}>
                <span className="stat-value">{formatEta(eta, now, lang)}</span>
                <span className="stat-label">{t('remaining', 'शेष')}</span>
              </div>
            </div>
          </div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={t('Journey progress', 'यात्रा प्रगति')}>
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="row-between">
            <span className="hint">{Math.round(progress * 100)}% {t('complete', 'पूर्ण')}</span>
            <span className="hint">{t('Arrival by', 'आगमन')} {formatTime(eta, lang)}</span>
          </div>
          {journey.extendedMin > 0 ? (
            <p className="hint">+{journey.extendedMin} {t('minutes added', 'मिनट जोड़े गए')}</p>
          ) : null}
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <span style={{ color: 'var(--saath-brand)' }}><Icon name="pin" size={20} /></span>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('Current or last-known location', 'वर्तमान या अंतिम ज्ञात लोकेशन')}</p>
            </div>
            <span className="hint">{formatAge(journey.lastFixAt, now, lang)}</span>
          </div>
          <p style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>
            {journey.position.lat.toFixed(5)}, {journey.position.lng.toFixed(5)}
          </p>
          <p className="hint">
            {journey.positionSource === 'device'
              ? t('From your device. Accuracy depends on your phone and surroundings.', 'आपके डिवाइस से। सटीकता फ़ोन और आस-पास पर निर्भर है।')
              : t('Simulated movement along the sample route. Not a real GPS reading.', 'नमूना मार्ग पर सिम्युलेटेड गति। वास्तविक GPS रीडिंग नहीं।')}
          </p>
          {stale ? (
            <Banner tone="warn" icon="alert">
              {t('This location is more than 2 minutes old. Contacts would see the same timestamp.', 'यह लोकेशन 2 मिनट से पुरानी है। संपर्कों को भी यही समय दिखेगा।')}
            </Banner>
          ) : null}
          {journey.status === 'paused' ? (
            <Banner tone="warn" icon="pause">{t('Journey paused. Sharing continues until you end or revoke it.', 'यात्रा रुकी है। समाप्त या रद्द करने तक साझा करना जारी रहेगा।')}</Banner>
          ) : null}
          {outsideDemo ? (
            <Banner tone="neutral" icon="info">
              {t(
                'Your device is outside the demo area, so Saath keeps simulated movement and does not mix your real position with sample routes.',
                'आपका डिवाइस डेमो क्षेत्र से बाहर है, इसलिए साथ सिम्युलेटेड गति रखता है और आपकी वास्तविक स्थिति को नमूना मार्गों से नहीं मिलाता।',
              )}
            </Banner>
          ) : null}
          {locationPermission !== 'granted' ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={askDeviceLocation} disabled={permissionBusy}>
              <Icon name="pin" size={16} />
              {permissionBusy ? t('Asking…', 'पूछा जा रहा है…') : t('Use my device location', 'मेरी डिवाइस लोकेशन उपयोग करें')}
            </button>
          ) : null}
        </section>

        {journey.checkin.enabled ? (
          <section
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 13,
              borderColor: pending ? 'color-mix(in srgb, var(--saath-warn) 55%, var(--saath-line))' : undefined,
              background: pending ? 'color-mix(in srgb, var(--saath-warn) 7%, var(--saath-surface))' : undefined,
            }}
          >
            {pending ? (
              <>
                <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--saath-warn)', marginTop: 1 }}><Icon name="clock" size={22} /></span>
                  <div>
                    <p className="section-title" style={{ fontSize: '1.02rem' }}>
                      {CHECKIN_TITLES[pending.kind][lang === 'hi' ? 1 : 0]}
                    </p>
                    <p className="hint" style={{ marginTop: 3 }}>
                      {t(
                        'This is a prompt, not a danger classification. Also raised at',
                        'यह एक अनुरोध है, ख़तरे का वर्गीकरण नहीं। यह भी दर्ज हुआ',
                      )}{' '}
                      {formatTime(pending.raisedAt, lang)}.
                    </p>
                  </div>
                </div>
                {pending.escalatedAt ? (
                  <Banner tone="warn" icon="users" title={t('One limited escalation sent (simulated)', 'एक सीमित एस्केलेशन भेजा (सिम्युलेटेड)')}>
                    {t(
                      `${escalatedContact?.name ?? 'Your priority contact'} received a simulated check-in request. No reply is recorded.`,
                      `${escalatedContact?.name ?? 'आपके प्राथमिकता संपर्क'} को सिम्युलेटेड चेक-इन अनुरोध मिला। कोई उत्तर दर्ज नहीं।`,
                    )}
                  </Banner>
                ) : state.settings.checkin.escalate ? (
                  <p className="hint">
                    {t('One simulated escalation in', 'एक सिम्युलेटेड एस्केलेशन')} {Math.max(0, Math.ceil(graceLeft / 1000))}s ·{' '}
                    {t('it will not repeat automatically.', 'यह स्वतः दोहराया नहीं जाएगा।')}
                  </p>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <button type="button" className="btn btn-primary" onClick={() => resolveCheckin('ok')}>
                    <Icon name="check" size={19} />
                    {t('I’m okay', 'मैं ठीक हूँ')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setUpdateOpen(true)}>
                    <Icon name="clock" size={18} />
                    {t('Update my journey', 'यात्रा अपडेट करें')}
                  </button>
                </div>
                <button type="button" className="btn btn-danger-soft btn-block" onClick={() => resolveCheckin('help')}>
                  <Icon name="shield" size={19} />
                  {t('I need help', 'मुझे मदद चाहिए')}
                </button>
              </>
            ) : (
              <>
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ color: 'var(--saath-brand)' }}><Icon name="clock" size={20} /></span>
                    <p className="section-title" style={{ fontSize: '1rem' }}>{t('Check-ins are on', 'चेक-इन सक्रिय हैं')}</p>
                  </div>
                  <Chip tone="brand">{t('Every', 'हर')} {journey.checkin.intervalMin} {t('min', 'मि')}</Chip>
                </div>
                <p className="hint">
                  {t('Next check-in in', 'अगला चेक-इन')} {Math.floor(nextCheckinIn / 60000)}:{String(Math.floor((nextCheckinIn % 60000) / 1000)).padStart(2, '0')}.{' '}
                  {t('A deviation, stop or late arrival can also prompt one.', 'मार्ग हटना, रुकावट या देर से आगमन भी पूछ सकता है।')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => resolveCheckin('ok')}>
                    <Icon name="check" size={18} />
                    {t('Check in now', 'अभी चेक-इन')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setUpdateOpen(true)}>
                    <Icon name="clock" size={18} />
                    {t('Update journey', 'यात्रा अपडेट')}
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <Banner tone="neutral" icon="info" title={t('Check-ins are off', 'चेक-इन बंद हैं')}>
            {t('Journey sharing still runs, but no check-in prompts will appear.', 'यात्रा साझा चलता रहेगा, पर चेक-इन अनुरोध नहीं दिखेंगे।')}
          </Banner>
        )}

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <span style={{ color: 'var(--saath-brand)' }}><Icon name="share" size={20} /></span>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('Sharing status', 'साझा स्थिति')}</p>
            </div>
            <Chip tone={live ? 'brand' : 'neutral'}>{live ? t('Active', 'सक्रिय') : t('Stopped', 'रुका')}</Chip>
          </div>
          {recipients.length === 0 ? (
            <Banner tone="warn" icon="users">
              {t('No contact is receiving this journey. Add a contact or choose location sharing.', 'कोई संपर्क यह यात्रा नहीं पा रहा। संपर्क जोड़ें या लोकेशन साझा चुनें।')}
            </Banner>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipients.map((contact) => (
                <div key={contact.id} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 620, fontSize: '0.9rem' }}>{contact.name}</span>
                  {contact.share.location ? <Chip tone="neutral" icon="pin">{t('Location', 'लोकेशन')}</Chip> : null}
                  {contact.share.journey ? <Chip tone="neutral" icon="route">{t('Journey', 'यात्रा')}</Chip> : null}
                  {contact.share.notes ? <Chip tone="neutral" icon="message">{t('Notes', 'नोट्स')}</Chip> : null}
                  {!contact.share.location && !contact.share.journey && !contact.share.notes ? <Chip tone="warn">{t('Nothing shared', 'कुछ साझा नहीं')}</Chip> : null}
                </div>
              ))}
            </div>
          )}
          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="row-between">
              <span className="hint">{t('Simulated token', 'सिम्युलेटेड टोकन')}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{maskToken(sharing.token)}</span>
            </div>
            <div className="row-between">
              <span className="hint">{t('Expires', 'समाप्ति')}</span>
              <span style={{ fontSize: '0.85rem' }}>{formatTime(sharing.expiresAt, lang)}</span>
            </div>
            <p className="hint">
              {t('No live link is sent: Saath has no sharing backend in this build. Expiry and revocation are enforced locally.', 'कोई लाइव लिंक नहीं भेजा जाता: इस बिल्ड में साथ के पास शेयरिंग बैकएंड नहीं है। समाप्ति और रद्दीकरण इस डिवाइस पर लागू हैं।')}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/share')}>
              {t('View details', 'विवरण देखें')}
            </button>
            <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => setRevokeOpen(true)} disabled={!live}>
              <Icon name="lock" size={16} />
              {t('Revoke now', 'अभी रद्द करें')}
            </button>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (journey.status === 'paused') dispatch({ type: 'journey/resume', now: Date.now() })
              else dispatch({ type: 'journey/pause', now: Date.now() })
            }}
          >
            <Icon name={journey.status === 'paused' ? 'play' : 'pause'} size={18} />
            {journey.status === 'paused' ? t('Resume', 'फिर शुरू') : t('Pause', 'रोकें')}
          </button>
          <button type="button" className="btn btn-danger-soft" onClick={() => setEndOpen(true)}>
            <Icon name="stop" size={17} />
            {t('End journey', 'यात्रा समाप्त')}
          </button>
        </div>

        <details className="card" style={{ padding: 0 }}>
          <summary style={{ padding: 15, cursor: 'pointer', fontWeight: 650, fontSize: '0.92rem', listStyle: 'none' }}>
            <span className="row" style={{ justifyContent: 'space-between' }}>
              <span className="row" style={{ gap: 8 }}>
                <Icon name="sparkles" size={18} />
                {t('Demo controls — simulation only', 'डेमो नियंत्रण — केवल सिम्युलेशन')}
              </span>
              <Icon name="chevronRight" size={17} />
            </span>
          </summary>
          <div style={{ padding: '0 15px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="hint">
              {t(
                'These buttons inject sample events. A deviation or stop prompts a check-in; it never labels you as in danger.',
                'ये बटन नमूना घटनाएँ जोड़ते हैं। मार्ग हटना या रुकावट चेक-इन माँगती है; यह आपको ख़तरे में नहीं कहती।',
              )}
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={Boolean(pending) || journey.status === 'paused'}
                onClick={() => {
                  dispatch({ type: 'journey/simulate', now: Date.now(), kind: 'deviation' })
                  toast(t('Route deviation simulated. Only one check-in alert is raised.', 'मार्ग विचलन सिम्युलेटेड। केवल एक चेक-इन अलर्ट बनेगा।'))
                }}
              >
                <Icon name="navigate" size={16} />
                {t('Simulate route deviation', 'मार्ग विचलन सिम्युलेट करें')}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={Boolean(pending) || journey.status === 'paused'}
                onClick={() => {
                  dispatch({ type: 'journey/simulate', now: Date.now(), kind: 'stop' })
                  window.setTimeout(() => dispatch({ type: 'journey/tick', now: Date.now(), online }), 80)
                  toast(t('Unexpected stop simulated.', 'अचानक रुकावट सिम्युलेटेड।'))
                }}
              >
                <Icon name="clock" size={16} />
                {t('Simulate unexpected stop', 'अचानक रुकावट सिम्युलेट')}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={Boolean(pending)}
                onClick={() => {
                  const at = Date.now()
                  dispatch({ type: 'journey/simulate', now: at, kind: 'deviation' })
                  dispatch({ type: 'journey/simulate', now: at + 1, kind: 'deviation' })
                  toast(
                    t('Triggered twice. Only one check-in alert exists because overlapping events are deduplicated.', 'दो बार ट्रिगर। केवल एक चेक-इन अलर्ट है क्योंकि ओवरलैपिंग घटनाएँ डुप्लिकेट नहीं होतीं।'),
                  )
                }}
              >
                <Icon name="refresh" size={16} />
                {t('Test duplicate trigger', 'डुप्लिकेट ट्रिगर जाँचें')}
              </button>
            </div>
            {pending ? <p className="hint">{t('Resolve the current check-in before adding another event.', 'दूसरी घटना जोड़ने से पहले मौजूदा चेक-इन हल करें।')}</p> : null}
          </div>
        </details>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Timeline', 'टाइमलाइन')}</p>
          <div className="timeline">
            {[...journey.events].slice(-6).reverse().map((event) => (
              <div key={event.id} className="timeline-item">
                <span className="timeline-dot" aria-hidden="true"><Icon name="check" size={13} /></span>
                <div>
                  <div className="row-between" style={{ gap: 8 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{EVENT_LABELS[event.kind][lang === 'hi' ? 1 : 0]}</span>
                    <span className="hint">{formatTime(event.at, lang)}</span>
                  </div>
                  {event.detail ? <p className="hint">{event.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
          <p className="hint">
            {t('Times and states are generated by deterministic code on this device; AI does not create journey events.', 'समय और स्थितियाँ इस डिवाइस पर निश्चित कोड से बनती हैं; AI यात्रा घटनाएँ नहीं बनाता।')}
          </p>
        </section>
      </div>

      <Sheet open={endOpen} onClose={() => setEndOpen(false)} title={t('End this journey?', 'यह यात्रा समाप्त करें?')}>
        <p className="hint">
          {t(
            'Ending stops the sharing session immediately and cancels any pending check-in. Contacts who already received simulated details may still have them.',
            'समाप्त करने पर साझा सत्र तुरंत बंद होता है और लंबित चेक-इन रद्द होता है। जिन संपर्कों को सिम्युलेटेड जानकारी मिल चुकी है, उनके पास वह रह सकती है।',
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setEndOpen(false)}>
            {t('Keep journey', 'यात्रा जारी रखें')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              dispatch({ type: 'journey/end', now: Date.now() })
              setEndOpen(false)
              toast(t('Journey ended. Sharing was revoked.', 'यात्रा समाप्त। साझा करना रद्द हुआ।'), 'danger')
            }}
          >
            {t('End journey', 'यात्रा समाप्त')}
          </button>
        </div>
      </Sheet>

      <Sheet open={updateOpen} onClose={() => setUpdateOpen(false)} title={t('Update my journey', 'यात्रा अपडेट करें')}>
        <p className="hint">
          {t('Add time and an optional note. The new arrival estimate is recalculated locally.', 'समय और वैकल्पिक नोट जोड़ें। नया आगमन अनुमान स्थानीय रूप से फिर बनेगा।')}
        </p>
        <div className="field">
          <span className="field-label">{t('Extra time', 'अतिरिक्त समय')}</span>
          <div className="segmented" role="group" aria-label={t('Extra time', 'अतिरिक्त समय')}>
            {[5, 10, 15, 20].map((minutes) => (
              <button key={minutes} type="button" aria-pressed={extraMinutes === minutes} onClick={() => setExtraMinutes(minutes)}>
                +{minutes}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="journey-note">{t('Note for recipients (optional)', 'प्राप्तकर्ताओं के लिए नोट (वैकल्पिक)')}</label>
          <textarea
            id="journey-note"
            className="textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={140}
            placeholder={t('Only contacts allowed to see notes receive this.', 'केवल नोट्स देखने वाले संपर्कों को यह मिलेगा।')}
          />
          <p className="hint">{note.length}/140 · {t('No note is sent if all contacts have notes off.', 'सभी संपर्कों के नोट्स बंद होने पर कुछ नहीं भेजा जाएगा।')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={submitUpdate}>
          <Icon name="check" size={18} />
          {t('Save update', 'अपडेट सहेजें')}
        </button>
      </Sheet>

      <Sheet open={revokeOpen} onClose={() => setRevokeOpen(false)} title={t('Revoke sharing?', 'साझा करना रद्द करें?')}>
        <p className="hint">
          {t(
            'This immediately ends the simulated sharing session. The journey continues and check-ins stay active.',
            'यह सिम्युलेटेड साझा सत्र तुरंत समाप्त करता है। यात्रा जारी रहेगी और चेक-इन सक्रिय रहेंगे।',
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setRevokeOpen(false)}>
            {t('Keep sharing', 'साझा रखें')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              dispatch({ type: 'share/revoke', now: Date.now() })
              setRevokeOpen(false)
              toast(t('Sharing revoked. No new updates will be shared.', 'साझा करना रद्द। कोई नया अपडेट साझा नहीं होगा।'))
            }}
          >
            {t('Revoke', 'रद्द करें')}
          </button>
        </div>
      </Sheet>
    </>
  )
}

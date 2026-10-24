import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, EmptyState, Sheet, SosStateChip, TopBar } from '../components/ui'
import { maskToken, minutesUntil, shareExpired, shareIsLive } from '@shared/tokens'
import { formatAge } from '@shared/recommend'
import { formatTime } from '../lib/i18n'

export default function ShareScreen() {
  const { state, dispatch, t, lang, now, toast } = useApp()
  const navigate = useNavigate()
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  const sosShare = state.sos?.status === 'active' ? state.sos.share : null
  const session = sosShare ?? state.journey?.sharing ?? state.sos?.share ?? null
  const kind: 'sos' | 'journey' = sosShare ? 'sos' : state.journey?.sharing ? 'journey' : 'sos'
  const shareAction = state.sos?.actions.find((action) => action.kind === 'share') ?? null
  const recipients = session
    ? [...state.contacts].filter((contact) => session.contactIds.includes(contact.id)).sort((a, b) => a.priority - b.priority)
    : []
  const selected = recipients.find((contact) => contact.id === selectedContactId) ?? recipients[0] ?? null
  const live = shareIsLive(session, now)
  const expired = shareExpired(session, now)
  const revoked = session?.revokedAt !== null && session?.revokedAt !== undefined

  const location =
    kind === 'sos'
      ? state.sos?.sharedFacts.location ?? null
      : state.journey?.position ?? null
  const locationAt =
    kind === 'sos' ? state.sos?.sharedFacts.locationAt ?? null : state.journey?.lastFixAt ?? null

  if (!session) {
    return (
      <>
        <TopBar title={t('Sharing status', 'साझा स्थिति')} back="/" />
        <div className="screen">
          <EmptyState
            icon="share"
            title={t('Nothing is being shared', 'कुछ भी साझा नहीं हो रहा')}
            body={t(
              'Start a journey or activate SOS to create a simulated sharing session. Saath never shares your location in the background.',
              'साझा सत्र बनाने के लिए यात्रा शुरू करें या SOS सक्रिय करें। साथ कभी पृष्ठभूमि में आपकी लोकेशन साझा नहीं करता।',
            )}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/plan')}>
                  {t('Plan a journey', 'यात्रा की योजना')}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/sos')}>
                  {t('Emergency screen', 'आपातकालीन स्क्रीन')}
                </button>
              </div>
            }
          />
        </div>
      </>
    )
  }

  const phoneNotes = state.journey?.events.filter((event) => event.kind === 'note' && event.detail).slice(-4) ?? []
  const mins = minutesUntil(session.expiresAt, now)

  return (
    <>
      <TopBar
        title={t('Sharing status', 'साझा स्थिति')}
        subtitle={kind === 'sos' ? t('SOS share', 'SOS साझा') : t('Journey share', 'यात्रा साझा')}
        back="/"
      />
      <div className="screen">
        <Banner tone="warn" icon="info" title={t('Simulated sharing only', 'केवल सिम्युलेटेड साझा')}>
          {t(
            'No live link is generated or sent. Saath has no sharing backend in this build; the token, expiry and revocation are enforced locally so you can inspect the full flow.',
            'कोई लाइव लिंक नहीं बनाया या भेजा जाता है। इस बिल्ड में साथ के पास शेयरिंग बैकएंड नहीं है; टोकन, समाप्ति और रद्दीकरण स्थानीय रूप से लागू हैं ताकि आप पूरा प्रवाह देख सकें।',
          )}
        </Banner>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <span style={{ color: live ? 'var(--saath-brand)' : 'var(--saath-muted)' }}><Icon name="share" size={21} /></span>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('Session', 'सत्र')}</p>
            </div>
            <Chip tone={live ? 'brand' : expired ? 'warn' : 'neutral'}>
              {live ? t('Active', 'सक्रिय') : revoked ? t('Revoked', 'रद्द') : expired ? t('Expired', 'समाप्त') : t('Stopped', 'रुका')}
            </Chip>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <span className="hint">{t('Simulated token', 'सिम्युलेटेड टोकन')}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{maskToken(session.token)}</span>
            </div>
            <p className="hint">
              {t(
                'A 144-bit random token, not derived from your name or contacts. It is not a working URL.',
                '144-बिट यादृच्छिक टोकन, आपके नाम या संपर्कों से नहीं बना। यह काम करने वाला URL नहीं है।',
              )}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(session.token)
                  toast(t('Simulated token copied. Do not treat it as a live link.', 'सिम्युलेटेड टोकन कॉपी हुआ। इसे लाइव लिंक न मानें।'))
                } catch {
                  toast(t('Copy is unavailable in this browser.', 'इस ब्राउज़र में कॉपी उपलब्ध नहीं।'))
                }
              }}
            >
              <Icon name="copy" size={16} />
              {t('Copy simulated token', 'सिम्युलेटेड टोकन कॉपी करें')}
            </button>
          </div>

          <div className="row-between">
            <span className="hint">{t('Created', 'बनाया')}</span>
            <span style={{ fontSize: '0.88rem' }}>{formatTime(session.createdAt, lang)}</span>
          </div>
          <div className="row-between">
            <span className="hint">{t('Expires', 'समाप्ति')}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              {formatTime(session.expiresAt, lang)} · {live ? `${mins} ${t('min left', 'मिनट शेष')}` : t('ended', 'समाप्त')}
            </span>
          </div>
          {kind === 'sos' && shareAction ? (
            <div className="row-between">
              <span className="hint">{t('Delivery state', 'डिलीवरी स्थिति')}</span>
              <SosStateChip state={shareAction.state} />
            </div>
          ) : null}
          <p className="hint">
            {t(
              'Expiry is checked from the stored timestamp on every render. Revocation takes effect immediately and cannot be undone.',
              'हर बार दिखाने पर समाप्ति सहेजे समय से जाँची जाती है। रद्द करना तुरंत लागू होता है और वापस नहीं लिया जा सकता।',
            )}
          </p>
          <button
            type="button"
            className="btn btn-danger-soft btn-block"
            onClick={() => setRevokeOpen(true)}
            disabled={!live}
          >
            <Icon name="lock" size={17} />
            {live ? t('Revoke this sharing session', 'यह साझा सत्र रद्द करें') : t('Session already stopped', 'सत्र पहले ही रुका')}
          </button>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Recipients', 'प्राप्तकर्ता')}</p>
          {recipients.length === 0 ? (
            <Banner tone="warn" icon="users">
              {t('No contacts were included in this session. Add a contact who allows location sharing.', 'इस सत्र में कोई संपर्क शामिल नहीं था। लोकेशन साझा करने वाला संपर्क जोड़ें।')}
            </Banner>
          ) : (
            <>
              <p className="hint">
                {t(
                  'Select a contact to preview exactly what their link would show. Only allowed fields appear.',
                  'किसी संपर्क को चुनें और देखें कि उनका लिंक क्या दिखाएगा। केवल अनुमत फ़ील्ड दिखेंगी।',
                )}
              </p>
              <div className="segmented" style={{ gridAutoFlow: 'row', gridTemplateColumns: `repeat(${Math.min(recipients.length, 2)}, 1fr)` }} role="group" aria-label={t('Preview contact', 'संपर्क पूर्वावलोकन')}>
                {recipients.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    aria-pressed={selected?.id === contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                  >
                    {contact.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {selected ? (
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row-between">
              <div>
                <p className="eyebrow">{t('What', 'जो')} {selected.name} {t('would see', 'देखेंगे')}</p>
                <p className="section-title" style={{ fontSize: '1rem' }}>{t('Recipient preview', 'प्राप्तकर्ता पूर्वावलोकन')}</p>
              </div>
              <Chip tone={live ? 'brand' : 'neutral'} icon={live ? 'eye' : 'lock'}>
                {live ? t('Live preview', 'लाइव पूर्वावलोकन') : t('Read-only', 'केवल पढ़ें')}
              </Chip>
            </div>

            {!session.contactIds.includes(selected.id) ? (
              <p className="hint">{t('This contact was not included in this session and would see nothing.', 'यह संपर्क इस सत्र में शामिल नहीं था और कुछ नहीं देखेगा।')}</p>
            ) : (
              <>
                <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon name="pin" size={17} />
                    <span style={{ fontWeight: 620, fontSize: '0.9rem' }}>{t('Latest shared location', 'नवीनतम साझा लोकेशन')}</span>
                  </div>
                  {selected.share.location && location && locationAt ? (
                    <>
                      <p style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>
                        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                      </p>
                      <p className="hint">{formatAge(locationAt, now, lang)} · {t('one point only, no route history', 'केवल एक बिंदु, मार्ग इतिहास नहीं')}</p>
                      {!live ? <p className="hint" style={{ color: 'var(--saath-warn)' }}>{t('Session ended — a real link would stop updating and expire.', 'सत्र समाप्त — वास्तविक लिंक अपडेट होना बंद कर देता और समाप्त हो जाता।')}</p> : null}
                    </>
                  ) : (
                    <p className="hint">
                      {selected.share.location
                        ? t('No location was available for this session.', 'इस सत्र के लिए कोई लोकेशन उपलब्ध नहीं थी।')
                        : t('You chose not to share location with this contact.', 'आपने इस संपर्क के साथ लोकेशन साझा नहीं करने का चयन किया।')}
                    </p>
                  )}
                </div>

                <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon name="route" size={17} />
                    <span style={{ fontWeight: 620, fontSize: '0.9rem' }}>{t('Journey details', 'यात्रा विवरण')}</span>
                  </div>
                  {selected.share.journey && state.journey ? (
                    <>
                      <p style={{ fontSize: '0.92rem', fontWeight: 620 }}>{state.journey.destination.label}</p>
                      <p className="hint">{state.journey.route.label}</p>
                      <p className="hint">
                        {state.journey.status === 'active'
                          ? `${Math.round(state.journey.progress * 100)}% ${t('complete', 'पूर्ण')} · ${t('sharing continues until ended', 'समाप्त होने तक साझा जारी')}`
                          : state.journey.status === 'paused'
                            ? t('Journey paused', 'यात्रा रुकी')
                            : t('Journey ended', 'यात्रा समाप्त')}
                      </p>
                    </>
                  ) : (
                    <p className="hint">
                      {selected.share.journey ? t('No journey details in this SOS session.', 'इस SOS सत्र में यात्रा विवरण नहीं।') : t('You chose not to share journey details with this contact.', 'आपने इस संपर्क के साथ यात्रा विवरण साझा नहीं करने का चयन किया।')}
                    </p>
                  )}
                </div>

                <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon name="message" size={17} />
                    <span style={{ fontWeight: 620, fontSize: '0.9rem' }}>{t('Your notes', 'आपके नोट्स')}</span>
                  </div>
                  {selected.share.notes && phoneNotes.length > 0 ? (
                    phoneNotes.map((event) => (
                      <p key={event.id} className="hint">{event.detail}</p>
                    ))
                  ) : (
                    <p className="hint">
                      {selected.share.notes ? t('No notes were added.', 'कोई नोट नहीं जोड़ा गया।') : t('Notes are private for this contact.', 'इस संपर्क के लिए नोट्स निजी हैं।')}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        ) : null}

        <Banner tone="brand" icon="lock" title={t('Privacy boundaries', 'गोपनीयता सीमाएँ')}>
          {t(
            'Recipients see one latest point, not a public map or a history of your movements. Saath does not expose your contact list or exact past journeys.',
            'प्राप्तकर्ता एक नवीनतम बिंदु देखते हैं, सार्वजनिक मैप या आपकी गतिविधि का इतिहास नहीं। साथ आपकी संपर्क सूची या पिछली सटीक यात्राएँ उजागर नहीं करता।',
          )}
        </Banner>
      </div>

      <Sheet open={revokeOpen} onClose={() => setRevokeOpen(false)} title={t('Revoke sharing now?', 'साझा करना अभी रद्द करें?')}>
        <p className="hint">
          {t(
            'This ends the session immediately. A recipient who already opened the simulated details may have copied them; revocation cannot recall what was already seen.',
            'यह सत्र तुरंत समाप्त करता है। जिस प्राप्तकर्ता ने सिम्युलेटेड विवरण पहले देख लिया, उसने कॉपी किया हो सकता है; रद्द करने से देखी गई जानकारी वापस नहीं होती।',
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setRevokeOpen(false)}>
            {t('Keep active', 'सक्रिय रखें')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (kind === 'sos') dispatch({ type: 'sos/share-revoke', now: Date.now() })
              else dispatch({ type: 'share/revoke', now: Date.now() })
              setRevokeOpen(false)
              toast(t('Sharing revoked immediately.', 'साझा करना तुरंत रद्द हुआ।'))
            }}
          >
            {t('Revoke', 'रद्द करें')}
          </button>
        </div>
      </Sheet>
    </>
  )
}

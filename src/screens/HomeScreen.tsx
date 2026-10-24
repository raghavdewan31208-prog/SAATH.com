import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Icon, Logo } from '../components/Icon'
import { Avatar } from '../components/Avatar'
import { Banner, Chip, EmptyState, Sheet } from '../components/ui'
import { formatEta, formatTime } from '../lib/i18n'
import { journeyEtaAt } from '@shared/engine'
import { countContacts } from '../lib/i18n'
import { shareIsLive } from '@shared/tokens'

export default function HomeScreen() {
  const { state, dispatch, t, lang, now, online, toast } = useApp()
  const navigate = useNavigate()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const journey = state.journey
  const active = journey && journey.status !== 'ended'
  const pending = journey?.checkin.pending ?? null
  const unread = state.alerts.filter((alert) => !alert.read).length
  const priority = [...state.contacts].sort((a, b) => a.priority - b.priority)
  const sharingLive = journey ? shareIsLive(journey.sharing, now) : false

  const hour = new Date(now).getHours()
  const greeting =
    hour < 12
      ? t('Good morning', 'सुप्रभात')
      : hour < 17
        ? t('Good afternoon', 'नमस्कार')
        : t('Good evening', 'शुभ संध्या')

  const openAlerts = () => {
    setAlertsOpen(true)
    if (unread > 0) dispatch({ type: 'alerts/read', now })
  }

  return (
    <>
      <header className="topbar">
        <Logo size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow">{greeting}</p>
          <p style={{ fontWeight: 740, fontSize: '1.08rem', letterSpacing: '-0.015em' }}>
            {state.profile.name || t('Traveller', 'यात्री')}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('Switch language', 'भाषा बदलें')}
          onClick={() => {
            const next = lang === 'en' ? 'hi' : 'en'
            dispatch({ type: 'profile/update', now, patch: { lang: next } })
            toast(next === 'hi' ? 'भाषा हिन्दी में बदली गई' : 'Language switched to English')
          }}
        >
          <Icon name="globe" size={20} />
        </button>
        <button
          type="button"
          className="icon-btn"
          style={{ position: 'relative' }}
          aria-label={t('Alerts', 'अलर्ट')}
          onClick={openAlerts}
        >
          <Icon name="bell" size={20} />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 999,
                background: 'var(--saath-danger-strong)',
                color: '#fff',
                fontSize: '0.62rem',
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                border: '2px solid var(--saath-surface)',
              }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </header>

      <div className="screen">
        {!online ? (
          <Banner tone="warn" icon="wifiOff" title={t('You’re offline', 'आप ऑफ़लाइन हैं')}>
            {t(
              'Live routing and simulated delivery are paused. The demo dataset, saved contacts and journey timers still work.',
              'लाइव रूटिंग और सिम्युलेटेड डिलीवरी रुकी हुई है। डेमो डेटा, सहेजे संपर्क और यात्रा टाइमर अभी भी काम करते हैं।',
            )}
          </Banner>
        ) : null}

        {state.profile.permissions.location === 'denied' ? (
          <Banner
            tone="neutral"
            icon="pin"
            title={t('Location is off', 'लोकेशन बंद है')}
            action={
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onClick={() => navigate('/plan')}
              >
                {t('Use manual places', 'मैन्युअल जगहें उपयोग करें')}
              </button>
            }
          >
            {t(
              'You can still plan with saved places and run the demo journey. Journey Mode will show simulated movement.',
              'आप सहेजी जगहों से योजना बना सकते हैं और डेमो यात्रा चला सकते हैं। यात्रा मोड सिम्युलेटेड गति दिखाएगा।',
            )}
          </Banner>
        ) : null}

        {pending ? (
          <button
            type="button"
            className="card"
            style={{ textAlign: 'left', borderColor: 'color-mix(in srgb, var(--saath-warn) 55%, transparent)', background: 'color-mix(in srgb, var(--saath-warn) 8%, var(--saath-surface))' }}
            onClick={() => navigate('/journey')}
          >
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--saath-warn)', marginTop: 2 }}>
                  <Icon name="clock" size={22} />
                </span>
                <div>
                  <p style={{ fontWeight: 720 }}>{t('Check-in waiting', 'चेक-इन प्रतीक्षा में')}</p>
                  <p className="hint">
                    {t('Saath is not treating this as danger. Please let your contacts know you are okay.', 'साथ इसे ख़तरे के रूप में नहीं ले रहा। कृपया अपने संपर्कों को बताएं कि आप ठीक हैं।')}
                  </p>
                </div>
              </div>
              <Icon name="chevronRight" size={19} />
            </div>
          </button>
        ) : null}

        {active && journey ? (
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row-between">
              <Chip tone={journey.status === 'paused' ? 'warn' : 'brand'} icon="route">
                {journey.status === 'paused' ? t('Paused', 'रुका हुआ') : t('Journey active', 'यात्रा सक्रिय')}
              </Chip>
              <span className="hint">
                {sharingLive ? t('Sharing simulated', 'साझा सिम्युलेटेड') : t('Not sharing', 'साझा नहीं')}
              </span>
            </div>
            <div>
              <p className="section-title">{journey.destination.label}</p>
              <p className="hint">{journey.route.label}</p>
            </div>
            <div className="row" style={{ gap: 22 }}>
              <div className="stat">
                <span className="stat-value">{formatEta(journeyEtaAt(journey, now), now, lang)}</span>
                <span className="stat-label">{t('To arrival', 'आगमन तक')}</span>
              </div>
              <div className="stat">
                <span className="stat-value">{formatTime(journeyEtaAt(journey, now), lang)}</span>
                <span className="stat-label">{t('Estimated arrival', 'अनुमानित आगमन')}</span>
              </div>
              <div className="stat">
                <span className="stat-value">{Math.round(journey.progress * 100)}%</span>
                <span className="stat-label">{t('Complete', 'पूर्ण')}</span>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/journey')}>
              {t('Resume journey', 'यात्रा फिर खोलें')}
              <Icon name="chevronRight" size={18} />
            </button>
          </section>
        ) : null}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="eyebrow">{t('What do you need?', 'आपको क्या चाहिए?')}</p>

          <div className="home-grid">
            <button
              type="button"
              className="action-tile action-tile-primary"
              onClick={() => navigate('/plan')}
            >
              <span className="tile-icon" aria-hidden="true">
                <Icon name="map" size={26} />
              </span>
              <div style={{ flex: 1 }}>
                <p className="eyebrow" style={{ color: 'var(--saath-brand-strong)' }}>
                  {t('Plan a journey', 'यात्रा की योजना')}
                </p>
                <h2 className="h2" style={{ marginTop: 3, fontSize: '1.08rem' }}>
                  {t('Compare evening routes', 'शाम के मार्गों की तुलना')}
                </h2>
                <p className="hint" style={{ marginTop: 4 }}>
                  {t('Time, lighting, walkways, transport and freshness — before you leave.', 'समय, रोशनी, फुटपाथ, परिवहन और ताज़गी — निकलने से पहले।')}
                </p>
              </div>
              <span className="chip chip-brand" style={{ alignSelf: 'flex-start' }}>
                {t('Open planner', 'प्लानर खोलें')} →
              </span>
            </button>

            <button
              type="button"
              className="action-tile action-tile-sos"
              onClick={() => navigate('/sos')}
            >
              <span className="tile-icon tile-icon-sos" aria-hidden="true">
                <Icon name="shield" size={26} />
              </span>
              <div style={{ flex: 1 }}>
                <p className="eyebrow" style={{ color: 'var(--saath-danger)' }}>
                  {t('Emergency assistance', 'आपातकालीन सहायता')}
                </p>
                <h2 className="h2" style={{ marginTop: 3, fontSize: '1.08rem' }}>
                  {t('Share, call, or get help', 'साझा करें, कॉल करें, या मदद लें')}
                </h2>
                <p className="hint" style={{ marginTop: 4 }}>
                  {t('Hold for SOS, call a contact, or hear the simulated AI assistant.', 'SOS के लिए दबाए रखें, संपर्क को कॉल करें, या सिम्युलेटेड AI सुनें।')}
                </p>
              </div>
              <span className="chip chip-danger" style={{ alignSelf: 'flex-start' }}>
                {t('Open emergency', 'आपातकालीन खोलें')} →
              </span>
            </button>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row-between">
            <p className="eyebrow">{t('Shortcuts', 'शॉर्टकट')}</p>
            <button
              type="button"
              className="hint"
              style={{ background: 'none', border: 0, textDecoration: 'underline' }}
              onClick={() => navigate('/contacts')}
            >
              {t('Manage contacts', 'संपर्क प्रबंधित करें')}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              {
                icon: 'route' as const,
                label: active ? t('Resume journey', 'यात्रा फिर खोलें') : t('No active journey', 'कोई सक्रिय यात्रा नहीं'),
                onClick: () => navigate(active ? '/journey' : '/plan'),
              },
              { icon: 'share' as const, label: t('Sharing status', 'साझा स्थिति'), onClick: () => navigate('/share') },
              { icon: 'flag' as const, label: t('Report a concern', 'चिंता रिपोर्ट करें'), onClick: () => navigate('/reports') },
              { icon: 'sparkles' as const, label: t('Demo walkthrough', 'डेमो वॉकथ्रू'), onClick: () => navigate('/demo') },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className="card card-interactive"
                onClick={item.onClick}
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 7, padding: 13, minHeight: 90 }}
              >
                <span style={{ color: 'var(--saath-brand)' }}>
                  <Icon name={item.icon} size={21} />
                </span>
                <span style={{ fontWeight: 620, fontSize: '0.9rem', lineHeight: 1.3 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="row-between">
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Your trusted circle', 'आपका भरोसेमंद दायरा')}</p>
            <Chip tone="neutral">{countContacts(priority.length, lang)}</Chip>
          </div>
          {priority.length === 0 ? (
            <EmptyState
              icon="users"
              title={t('No contacts saved', 'कोई संपर्क सहेजा नहीं')}
              body={t('Add one or two people who should hear from you during a journey.', 'एक-दो लोग जोड़ें जिन्हें यात्रा के दौरान आपकी जानकारी मिलनी चाहिए।')}
              action={
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/contacts')}>
                  {t('Add a contact', 'संपर्क जोड़ें')}
                </button>
              }
            />
          ) : (
            <>
              {priority.slice(0, 3).map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => navigate('/contacts')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, padding: '3px 0', textAlign: 'left' }}
                >
                  <Avatar name={contact.name} size={36} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 620, fontSize: '0.92rem' }}>{contact.name}</span>
                    <span className="hint" style={{ display: 'block' }}>
                      {contact.relation} · {t('priority', 'प्राथमिकता')} {contact.priority}
                    </span>
                  </span>
                  {contact.aiConsent ? <Chip tone="neutral" icon="sparkles">{t('AI consent', 'AI सहमति')}</Chip> : null}
                </button>
              ))}
            </>
          )}
        </section>

        <Banner tone="warn" icon="info" title={t('Demo build', 'डेमो बिल्ड')}>
          {t(
            'Routes use sample observations for one small area. Sharing, delivery and AI calls are simulated. Saath is not connected to emergency services.',
            'मार्ग एक छोटे क्षेत्र के नमूना अवलोकनों का उपयोग करते हैं। साझा करना, डिलीवरी और AI कॉल सिम्युलेटेड हैं। साथ आपातकालीन सेवाओं से जुड़ा नहीं है।',
          )}
        </Banner>
      </div>

      <Sheet open={alertsOpen} onClose={() => setAlertsOpen(false)} title={t('In-app alerts', 'ऐप के भीतर अलर्ट')}>
        {state.alerts.length === 0 ? (
          <EmptyState icon="bell" title={t('No alerts yet', 'अभी कोई अलर्ट नहीं')} body={t('Journey and check-in updates will appear here.', 'यात्रा और चेक-इन अपडेट यहाँ दिखेंगे।')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.alerts.map((alert) => (
              <div
                key={alert.id}
                className="card-soft"
                style={{ borderLeft: `3px solid ${alert.severity === 'danger' ? 'var(--saath-danger-strong)' : alert.severity === 'warn' ? 'var(--saath-warn)' : 'var(--saath-brand)'}` }}
              >
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <p style={{ fontWeight: 680, fontSize: '0.92rem' }}>{lang === 'hi' ? alert.titleHi : alert.title}</p>
                  <span className="hint" style={{ whiteSpace: 'nowrap' }}>{formatTime(alert.at, lang)}</span>
                </div>
                <p className="hint" style={{ marginTop: 3 }}>{lang === 'hi' ? alert.bodyHi : alert.body}</p>
              </div>
            ))}
            <p className="hint">
              {t('Alerts are stored only on this device. No push service is configured.', 'अलर्ट केवल इस डिवाइस पर सहेजे जाते हैं। कोई पुश सेवा कॉन्फ़िगर नहीं है।')}
            </p>
          </div>
        )}
      </Sheet>
    </>
  )
}

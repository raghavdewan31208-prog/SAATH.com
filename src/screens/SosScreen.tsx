import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, Sheet, SosStateChip, TopBar } from '../components/ui'
import { HoldToActivate } from '../components/HoldToActivate'
import { formatAge } from '@shared/recommend'
import { formatTime } from '../lib/i18n'
import { shareIsLive } from '@shared/tokens'
import type { Contact, SosAction, SosActionKind } from '@shared/types'

const ACTION_TITLE: Record<SosActionKind, [string, string]> = {
  share: ['Share location and journey details', 'लोकेशन और यात्रा विवरण साझा करें'],
  call: ['Call a trusted contact', 'भरोसेमंद संपर्क को कॉल करें'],
  ai: ['Ask the AI assistant to contact a trusted person', 'AI सहायक से भरोसेमंद व्यक्ति को संपर्क करने को कहें'],
  dialer: ['Open the device emergency-calling option', 'डिवाइस का आपातकालीन कॉल विकल्प खोलें'],
}

const ACTION_ICON: Record<SosActionKind, 'share' | 'phone' | 'sparkles' | 'alert'> = {
  share: 'share',
  call: 'phone',
  ai: 'sparkles',
  dialer: 'alert',
}

const CANCEL_REASONS: { id: string; label: [string, string] }[] = [
  { id: 'accidental', label: ['Activated by accident', 'गलती से सक्रिय हुआ'] },
  { id: 'safe', label: ['I am safe now', 'मैं अब सुरक्षित हूँ'] },
  { id: 'test', label: ['This was a demonstration', 'यह प्रदर्शन था'] },
]

export default function SosScreen() {
  const { state, dispatch, t, lang, now, online, toast } = useApp()
  const navigate = useNavigate()
  const sos = state.sos
  const active = sos?.status === 'active'
  const previous = sos && sos.status !== 'active' ? sos : null
  const [twoStep, setTwoStep] = useState(false)
  const [armed, setArmed] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0].id)
  const [dialer, setDialer] = useState<{ actionId?: string; phone?: string; kind: 'contact' | 'emergency' } | null>(null)
  const contacts = [...state.contacts].sort((a, b) => a.priority - b.priority)
  const priority = contacts[0] ?? null
  const consenting = contacts.find((contact) => contact.aiConsent) ?? null
  const enabledCount = Object.values(state.settings.sos).filter(Boolean).length

  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 10_000)
    return () => window.clearTimeout(timer)
  }, [armed])

  const activate = () => {
    if (active) return
    dispatch({ type: 'sos/activate', now: Date.now() })
    setArmed(false)
    navigator.vibrate?.([20, 60, 30])
    toast(t('SOS activated. Delivery is simulated in this build.', 'SOS सक्रिय। इस बिल्ड में डिलीवरी सिम्युलेटेड है।'), 'danger')
    window.scrollTo({ top: 0 })
  }

  const attemptDialer = () => {
    const target = dialer
    if (!target) return
    setDialer(null)
    if (target.actionId) {
      dispatch({
        type: 'sos/action',
        now: Date.now(),
        actionId: target.actionId,
        state: 'opened',
        note: 'Dialler attempt made. Saath cannot confirm that the dialler opened or that a call connected.',
      })
    }
    const phone = target.phone?.replace(/[^\d+]/g, '') ?? ''
    toast(
      t(
        'Opening your phone’s dialler. Saath cannot confirm a call and does not contact anyone itself.',
        'आपका फ़ोन डायलर खोला जा रहा है। साथ कॉल की पुष्टि नहीं कर सकता और स्वयं किसी से संपर्क नहीं करता।',
      ),
    )
    window.setTimeout(() => {
      try {
        window.location.href = `tel:${phone}`
      } catch {
        // Some desktop browsers do not support tel: links.
      }
    }, 80)
  }

  const contactFor = (action: SosAction): Contact | null =>
    action.contactId ? state.contacts.find((contact) => contact.id === action.contactId) ?? null : null

  const elapsed = sos ? Math.max(0, now - sos.activatedAt) : 0
  const elapsedLabel = `${Math.floor(elapsed / 60000)}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}`

  return (
    <>
      <TopBar
        title={t('Emergency assistance', 'आपातकालीन सहायता')}
        subtitle={active ? t('Alert active', 'अलर्ट सक्रिय') : t('SOS and contacts', 'SOS और संपर्क')}
        back="/"
      />
      <div className="screen">
        {!active ? (
          <>
            {previous ? (
              <Banner tone="neutral" icon="slashCircle" title={t('Previous alert cancelled', 'पिछला अलर्ट रद्द')}>
                {t('Cancelled at', 'रद्द हुआ')} {previous.cancelledAt ? formatTime(previous.cancelledAt, lang) : '—'} ·{' '}
                {previous.cancelReason ?? t('No reason recorded', 'कोई कारण दर्ज नहीं')}. {t('Starting a new alert creates a new session.', 'नया अलर्ट नया सत्र बनाता है।')}
              </Banner>
            ) : null}

            <Banner tone="warn" icon="info" title={t('Demonstration build', 'प्रदर्शन बिल्ड')}>
              {t(
                'Saath does not contact emergency services. Sharing, delivery and AI calls are simulated. Your device’s own emergency-calling option remains available below.',
                'साथ आपातकालीन सेवाओं से संपर्क नहीं करता। साझा करना, डिलीवरी और AI कॉल सिम्युलेटेड हैं। आपके डिवाइस का आपातकालीन कॉल विकल्प नीचे उपलब्ध है।',
              )}
            </Banner>

            {contacts.length === 0 ? (
              <Banner
                tone="warn"
                icon="users"
                title={t('No trusted contacts yet', 'अभी कोई भरोसेमंद संपर्क नहीं')}
                action={
                  <button type="button" className="btn btn-sm btn-secondary" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => navigate('/contacts')}>
                    {t('Add a contact', 'संपर्क जोड़ें')}
                  </button>
                }
              >
                {t(
                  'SOS will still show simulated failures instead of pretending to reach someone. Add a consenting contact for the full demo.',
                  'संपर्क न होने पर SOS किसी तक पहुँचने का दिखावा नहीं करेगा, बल्कि सिम्युलेटेड विफलता दिखाएगा। पूरा डेमो देखने के लिए सहमति वाला संपर्क जोड़ें।',
                )}
              </Banner>
            ) : null}

            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row-between">
                <p className="section-title" style={{ fontSize: '1rem' }}>{t('When you activate SOS', 'SOS सक्रिय करने पर')}</p>
                <Chip tone="neutral">{enabledCount}/4 {t('actions', 'क्रियाएँ')}</Chip>
              </div>
              {enabledCount === 0 ? (
                <Banner tone="warn" icon="alert">{t('No SOS actions are configured. You can still open your device dialler, but nothing else will run.', 'कोई SOS क्रिया कॉन्फ़िगर नहीं है। आप डिवाइस डायलर खोल सकते हैं, बाकी कुछ नहीं चलेगा।')}</Banner>
              ) : null}
              {[
                { key: 'shareLocation' as const, label: ACTION_TITLE.share, detail: t('Simulated, to contacts who allow location.', 'सिम्युलेटेड, लोकेशन अनुमति वाले संपर्कों को।') },
                { key: 'callPriority' as const, label: ACTION_TITLE.call, detail: priority ? priority.name : t('No contact saved', 'कोई संपर्क सहेजा नहीं') },
                { key: 'aiCall' as const, label: ACTION_TITLE.ai, detail: consenting ? `${consenting.name} · ${t('consent on file', 'सहमति दर्ज')}` : t('No consenting contact', 'कोई सहमति वाला संपर्क नहीं') },
                { key: 'openDialer' as const, label: ACTION_TITLE.dialer, detail: t('Dialler only — not a call placed by Saath.', 'केवल डायलर — साथ कॉल नहीं करता।') },
              ].map((item) => (
                <div key={item.key} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ color: state.settings.sos[item.key] ? 'var(--saath-brand)' : 'var(--saath-muted)', marginTop: 1 }}>
                    <Icon name={state.settings.sos[item.key] ? 'check' : 'x'} size={16} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{lang === 'hi' ? item.label[1] : item.label[0]}</p>
                    <p className="hint">{item.detail}</p>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/settings')}>
                {t('Change SOS actions', 'SOS क्रियाएँ बदलें')}
              </button>
            </section>

            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ color: 'var(--saath-danger)' }}><Icon name="shield" size={22} /></span>
                <div>
                  <p className="section-title">{t('Hold to activate', 'सक्रिय करने के लिए दबाए रखें')}</p>
                  <p className="hint">{t('A deliberate 3-second hold reduces accidental activation.', 'जानबूझकर 3 सेकंड दबाने से गलती से सक्रिय होना कम होता है।')}</p>
                </div>
              </div>
              <HoldToActivate
                label={t('Hold to activate SOS', 'SOS सक्रिय करने के लिए दबाए रखें')}
                holdingLabel={t('Activating in', 'सक्रिय होने में')}
                hint={t('Keep holding. Release early to cancel. Nothing has been sent yet.', 'दबाए रखें। जल्दी छोड़ने पर रद्द। अभी कुछ नहीं भेजा गया।')}
                onComplete={activate}
              />
              {!twoStep ? (
                <button
                  type="button"
                  className="hint"
                  style={{ background: 'none', border: 0, textDecoration: 'underline', alignSelf: 'flex-start' }}
                  onClick={() => setTwoStep(true)}
                >
                  {t('Use two-step activation instead', 'इसके बजाय दो-चरण सक्रियण उपयोग करें')}
                </button>
              ) : (
                <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <p className="hint">
                    {t('Two-step mode: the first tap arms SOS for 10 seconds, the second confirms.', 'दो-चरण मोड: पहला टैप SOS को 10 सेकंड के लिए तैयार करता है, दूसरा पुष्टि करता है।')}
                  </p>
                  <button
                    type="button"
                    className={`btn ${armed ? 'btn-danger' : 'btn-secondary'} btn-block`}
                    onClick={() => {
                      if (armed) activate()
                      else setArmed(true)
                    }}
                  >
                    <Icon name="shield" size={19} />
                    {armed ? t('Tap again to confirm SOS', 'SOS की पुष्टि के लिए फिर टैप करें') : t('Arm SOS (step 1 of 2)', 'SOS तैयार करें (चरण 1/2)')}
                  </button>
                  {armed ? (
                    <button type="button" className="hint" style={{ background: 'none', border: 0, textDecoration: 'underline' }} onClick={() => setArmed(false)}>
                      {t('Cancel arming', 'तैयारी रद्द करें')}
                    </button>
                  ) : null}
                </div>
              )}
              <p className="hint">
                {t(
                  'Nothing is sent until activation completes. If you are in immediate danger, use your phone’s emergency call option now.',
                  'सक्रियण पूरा होने तक कुछ नहीं भेजा जाता। तत्काल ख़तरे में अभी अपने फ़ोन का आपातकालीन कॉल विकल्प उपयोग करें।',
                )}
              </p>
            </section>

            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('If the AI fails or you have no network', 'अगर AI विफल हो या नेटवर्क न हो')}</p>
              <p className="hint">
                {t(
                  'Your device’s emergency calling and your contacts remain available. Saath never blocks or replaces them.',
                  'आपके डिवाइस का आपातकालीन कॉल और आपके संपर्क उपलब्ध रहते हैं। साथ उन्हें कभी नहीं रोकता या बदलता।',
                )}
              </p>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setDialer({ kind: 'emergency' })}>
                <Icon name="phone" size={18} />
                {t('Open device dialler', 'डिवाइस डायलर खोलें')}
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate('/sos/operator')}>
                <Icon name="headset" size={18} />
                {t('Simulated operator conversation (demo)', 'सिम्युलेटेड ऑपरेटर बातचीत (डेमो)')}
              </button>
            </section>
          </>
        ) : sos ? (
          <>
            <div className="card" style={{ borderColor: 'var(--saath-danger-strong)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row-between">
                <div className="row" style={{ gap: 9 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--saath-danger-soft)', color: 'var(--saath-danger)', display: 'grid', placeItems: 'center' }}
                    className="pulse-soft"
                  >
                    <Icon name="shield" size={23} />
                  </span>
                  <div>
                    <p className="section-title">{t('SOS is active', 'SOS सक्रिय है')}</p>
                    <p className="hint">{t('Simulated — no emergency service contacted', 'सिम्युलेटेड — किसी आपातकालीन सेवा से संपर्क नहीं')}</p>
                  </div>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 750, fontSize: '1.05rem' }}>{elapsedLabel}</span>
              </div>
              <div className="progress-track" style={{ height: 4 }} aria-hidden="true">
                <div className="progress-fill progress-fill-danger" style={{ width: '100%' }} />
              </div>
              <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                <Chip tone="danger">{t('Alert running', 'अलर्ट चालू')}</Chip>
                <Chip tone={online ? 'brand' : 'warn'}>{online ? t('Online', 'ऑनलाइन') : t('Offline — queued', 'ऑफ़लाइन — कतार में')}</Chip>
                <Chip tone="neutral" icon="users">{sos.sharedFacts.contactsNotified} {t('recipients', 'प्राप्तकर्ता')}</Chip>
              </div>
              {!online ? (
                <Banner tone="warn" icon="wifiOff">
                  {t('Simulated sends wait while offline. Nothing is queued on a server because none is configured.', 'ऑफ़लाइन रहने पर सिम्युलेटेड भेजना रुकता है। कोई सर्वर कॉन्फ़िगर नहीं है, इसलिए सर्वर पर कुछ कतार में नहीं है।')}
                </Banner>
              ) : null}
            </div>

            <Banner tone="danger" icon="alert" title={t('Help is not automatically on the way', 'मदद अपने आप नहीं आ रही')}>
              {t(
                'A recipient answering or acknowledging does not confirm that anyone is coming. For immediate danger, use your phone’s emergency call option now.',
                'किसी का जवाब देना या पुष्टि करना यह साबित नहीं करता कि कोई मदद के लिए आ रहा है। तत्काल ख़तरे में अभी अपने फ़ोन का आपातकालीन कॉल विकल्प उपयोग करें।',
              )}
            </Banner>

            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row-between">
                <p className="section-title" style={{ fontSize: '1rem' }}>{t('What the assistant may say', 'सहायक क्या कह सकता है')}</p>
                <Chip tone="neutral" icon="lock">{t('Authorised facts', 'अधिकृत तथ्य')}</Chip>
              </div>
              {sos.sharedFacts.location && sos.sharedFacts.locationAt ? (
                <div className="row-between">
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 620 }}>{sos.sharedFacts.location.lat.toFixed(5)}, {sos.sharedFacts.location.lng.toFixed(5)}</p>
                    <p className="hint">{formatAge(sos.sharedFacts.locationAt, now, lang)} · {t('last shared location', 'अंतिम साझा लोकेशन')}</p>
                  </div>
                  <Icon name="pin" size={18} />
                </div>
              ) : (
                <p className="hint">{t('No location available — the assistant will say it is unknown.', 'कोई लोकेशन उपलब्ध नहीं — सहायक कहेगा कि यह अज्ञात है।')}</p>
              )}
              <div className="row-between">
                <span className="hint">{t('Journey', 'यात्रा')}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {sos.sharedFacts.destination ?? t('Not shared', 'साझा नहीं')} · {sos.sharedFacts.journeyActive ? t('active', 'सक्रिय') : t('not active', 'सक्रिय नहीं')}
                </span>
              </div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="eyebrow">{t('Actions', 'क्रियाएँ')}</p>
              {sos.actions.length === 0 ? (
                <Banner tone="warn" icon="alert" title={t('No actions configured', 'कोई क्रिया कॉन्फ़िगर नहीं')}>
                  {t('Open your device dialler below, and enable SOS actions in Settings.', 'नीचे डिवाइस डायलर खोलें, और सेटिंग्स में SOS क्रियाएँ सक्रिय करें।')}
                </Banner>
              ) : null}
              {sos.actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  contact={contactFor(action)}
                  onOpenDialer={() => {
                    const contact = contactFor(action)
                    setDialer({ kind: 'contact', actionId: action.id, phone: contact?.phone })
                  }}
                  onRetry={() => dispatch({ type: 'sos/retry', now: Date.now(), actionId: action.id })}
                  onAnswered={() =>
                    dispatch({
                      type: 'sos/action',
                      now: Date.now(),
                      actionId: action.id,
                      state: 'answered',
                      note: 'They answered. Saath cannot confirm that help is on the way.',
                    })
                  }
                  onUnanswered={() =>
                    dispatch({
                      type: 'sos/action',
                      now: Date.now(),
                      actionId: action.id,
                      state: 'unanswered',
                      note: 'No answer recorded by you.',
                    })
                  }
                  onOpenAssistant={() => navigate('/sos/assist')}
                  onPreviewShare={() => navigate('/share')}
                  onManage={() => navigate(action.kind === 'ai' ? '/contacts' : '/settings')}
                />
              ))}
            </section>

            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row-between">
                <p className="section-title" style={{ fontSize: '1rem' }}>{t('Acknowledgement', 'पुष्टि')}</p>
                <Chip tone={sos.ack ? 'ok' : 'neutral'} icon={sos.ack ? 'check' : 'clock'}>
                  {sos.ack ? t('Received', 'प्राप्त') : t('Not yet', 'अभी नहीं')}
                </Chip>
              </div>
              {sos.ack ? (
                <>
                  <p style={{ fontSize: '0.92rem', fontWeight: 620 }}>
                    {state.contacts.find((contact) => contact.id === sos.ack?.byContactId)?.name ?? t('Contact', 'संपर्क')} · {formatTime(sos.ack.at, lang)}
                  </p>
                  <p className="hint">
                    {t('An acknowledgement only means the alert was received in the simulation. It does not confirm that help is coming.', 'पुष्टि का अर्थ केवल यह है कि सिम्युलेशन में अलर्ट मिला। यह पुष्टि नहीं करता कि मदद आ रही है।')}
                  </p>
                </>
              ) : (
                <p className="hint">
                  {t('Run the simulated assistant call to hear a contact acknowledge the alert. Unanswered calls stay unanswered.', 'अलर्ट की पुष्टि सुनने के लिए सिम्युलेटेड सहायक कॉल चलाएँ। बिना उत्तर वाली कॉल अनुत्तरित रहती हैं।')}
                </p>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => navigate('/sos/assist')}
                disabled={!consenting}
              >
                <Icon name="sparkles" size={19} />
                {t('Talk to Saath’s AI assistant (simulated)', 'साथ के AI सहायक से बात करें (सिम्युलेटेड)')}
              </button>
              {!consenting ? (
                <p className="hint">
                  {t('No contact has consented to AI calls. Add consent in Contacts — consent is never assumed.', 'किसी संपर्क ने AI कॉल के लिए सहमति नहीं दी। संपर्कों में सहमति जोड़ें — सहमति मानी नहीं जाती।')}
                </p>
              ) : null}
            </section>

            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('Emergency calling remains yours', 'आपातकालीन कॉल आपके पास है')}</p>
              <button type="button" className="btn btn-danger-soft btn-block" onClick={() => setDialer({ kind: 'emergency' })}>
                <Icon name="phone" size={19} />
                {t('Open device dialler (not a call by Saath)', 'डिवाइस डायलर खोलें (साथ द्वारा कॉल नहीं)')}
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate('/sos/operator')}>
                <Icon name="headset" size={18} />
                {t('Demo emergency-operator conversation', 'डेमो आपातकालीन ऑपरेटर बातचीत')}
              </button>
            </section>

            <button type="button" className="btn btn-secondary btn-block" onClick={() => setCancelOpen(true)}>
              <Icon name="slashCircle" size={18} />
              {t('Cancel this alert', 'यह अलर्ट रद्द करें')}
            </button>
            <p className="hint" style={{ textAlign: 'center' }}>
              {t('Cancelling stops new simulated sends and revokes the SOS share session.', 'रद्द करने पर नई सिम्युलेटेड भेजना रुकता है और SOS साझा सत्र रद्द होता है।')}
            </p>
          </>
        ) : null}
      </div>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('Cancel this alert?', 'यह अलर्ट रद्द करें?')}>
        <p className="hint">
          {t(
            'This cancels pending simulated actions and revokes the share session. Contacts who already received details may still have them. Calling your device’s emergency number is not affected.',
            'यह लंबित सिम्युलेटेड क्रियाएँ रद्द करता है और साझा सत्र रद्द करता है। जिन संपर्कों को जानकारी मिल चुकी है, उनके पास वह रह सकती है। आपके डिवाइस का आपातकालीन कॉल प्रभावित नहीं होता।',
          )}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason.id}
              type="button"
              className="card-soft"
              style={{
                textAlign: 'left',
                borderColor: cancelReason === reason.id ? 'var(--saath-brand)' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
              onClick={() => setCancelReason(reason.id)}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: `2px solid ${cancelReason === reason.id ? 'var(--saath-brand)' : 'var(--saath-line)'}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {cancelReason === reason.id ? <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--saath-brand)' }} /> : null}
              </span>
              <span>{lang === 'hi' ? reason.label[1] : reason.label[0]}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setCancelOpen(false)}>
            {t('Keep active', 'सक्रिय रखें')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const label = CANCEL_REASONS.find((reason) => reason.id === cancelReason)
              dispatch({
                type: 'sos/cancel',
                now: Date.now(),
                reason: label ? (lang === 'hi' ? label.label[1] : label.label[0]) : 'Cancelled',
              })
              setCancelOpen(false)
              toast(t('Alert cancelled. Sharing was revoked.', 'अलर्ट रद्द। साझा करना रद्द हुआ।'))
            }}
          >
            {t('Cancel alert', 'अलर्ट रद्द करें')}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={dialer !== null}
        onClose={() => setDialer(null)}
        title={dialer?.kind === 'emergency' ? t('Open device dialler', 'डिवाइस डायलर खोलें') : t('Open phone dialler', 'फ़ोन डायलर खोलें')}
      >
        <Banner tone="danger" icon="alert" title={t('This is not a call made by Saath', 'यह साथ द्वारा की गई कॉल नहीं है')}>
          {t(
            'Saath can only ask your phone to open its dialler. It cannot place a call, confirm that the dialler opened, or know whether anyone answered. Opening the dialler is not a completed call.',
            'साथ केवल आपके फ़ोन से डायलर खुलवा सकता है। वह कॉल नहीं कर सकता, डायलर खुलने की पुष्टि नहीं कर सकता, या यह नहीं जान सकता कि किसी ने उत्तर दिया। डायलर खोलना पूरी कॉल नहीं है।',
          )}
        </Banner>
        {dialer?.kind === 'contact' ? (
          <p className="hint">
            {t('Contact:', 'संपर्क:')} {dialer.phone ? dialer.phone : t('No number saved', 'कोई नंबर सहेजा नहीं')}.{' '}
            {t('Demonstration numbers will not connect.', 'प्रदर्शन नंबर नहीं जुड़ेंगे।')}
          </p>
        ) : (
          <p className="hint">
            {t(
              'For a real emergency, dial your local emergency number yourself. This demo deliberately does not pre-fill an emergency number.',
              'वास्तविक आपात स्थिति के लिए स्वयं अपना स्थानीय आपातकालीन नंबर डायल करें। यह डेमो जानबूझकर आपातकालीन नंबर पहले से नहीं भरता।',
            )}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setDialer(null)}>
            {t('Go back', 'वापस जाएँ')}
          </button>
          <button type="button" className="btn btn-danger" onClick={attemptDialer} disabled={dialer?.kind === 'contact' && !dialer.phone}>
            <Icon name="phone" size={18} />
            {t('Open dialler', 'डायलर खोलें')}
          </button>
        </div>
        {dialer?.kind === 'contact' && !dialer.phone ? (
          <p className="hint">{t('Add a phone number in Contacts before calling.', 'कॉल से पहले संपर्कों में फ़ोन नंबर जोड़ें।')}</p>
        ) : null}
      </Sheet>
    </>
  )
}

function ActionCard({
  action,
  contact,
  onOpenDialer,
  onRetry,
  onAnswered,
  onUnanswered,
  onOpenAssistant,
  onPreviewShare,
  onManage,
}: {
  action: SosAction
  contact: Contact | null
  onOpenDialer: () => void
  onRetry: () => void
  onAnswered: () => void
  onUnanswered: () => void
  onOpenAssistant: () => void
  onPreviewShare: () => void
  onManage: () => void
}) {
  const { t, lang, state } = useApp()
  const title = ACTION_TITLE[action.kind]
  const retryable = action.state === 'failed' || action.state === 'unanswered'
  const shareLive = state.sos?.share ? shareIsLive(state.sos.share, Date.now()) : false

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 15 }}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: action.kind === 'dialer' ? 'var(--saath-danger-soft)' : 'var(--saath-brand-soft)',
              color: action.kind === 'dialer' ? 'var(--saath-danger)' : 'var(--saath-brand)',
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
            }}
          >
            <Icon name={ACTION_ICON[action.kind]} size={19} />
          </span>
          <div>
            <p style={{ fontWeight: 680, fontSize: '0.94rem', lineHeight: 1.3 }}>{lang === 'hi' ? title[1] : title[0]}</p>
            {contact ? <p className="hint">{contact.name} · {contact.phone}</p> : null}
          </div>
        </div>
        <SosStateChip state={action.state} />
      </div>

      {action.note ? <p className="hint">{action.note}</p> : null}
      {action.attempts > 1 ? <p className="hint">{t('Attempts', 'प्रयास')}: {action.attempts}</p> : null}

      {action.kind === 'share' ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onPreviewShare}>
            {t('View simulated share', 'सिम्युलेटेड साझा देखें')}
          </button>
          {retryable ? <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>{t('Retry', 'पुनः प्रयास')}</button> : null}
          {action.state === 'failed' ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onManage}>{t('Manage contacts', 'संपर्क प्रबंधित करें')}</button>
          ) : null}
          {state.sos?.share ? (
            <span className="hint" style={{ alignSelf: 'center' }}>{shareLive ? t('Session active', 'सत्र सक्रिय') : t('Session ended', 'सत्र समाप्त')}</span>
          ) : null}
        </div>
      ) : null}

      {action.kind === 'call' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contact && ['pending', 'failed'].includes(action.state) ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenDialer}>
              <Icon name="phone" size={16} />
              {t('Open dialler for', 'डायलर खोलें')} {contact.name}
            </button>
          ) : null}
          {action.state === 'opened' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={onUnanswered}>{t('No answer', 'कोई उत्तर नहीं')}</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={onAnswered}>{t('They answered', 'उन्होंने उत्तर दिया')}</button>
            </div>
          ) : null}
          {retryable ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>{t('Retry', 'पुनः प्रयास')}</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={onManage}>{t('Change contact', 'संपर्क बदलें')}</button>
            </div>
          ) : null}
          {action.state === 'answered' ? (
            <p className="hint">{t('Answering is not acknowledgement, and Saath cannot confirm that help is on the way.', 'उत्तर देना पुष्टि नहीं है, और साथ पुष्टि नहीं कर सकता कि मदद आ रही है।')}</p>
          ) : null}
        </div>
      ) : null}

      {action.kind === 'ai' ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {contact && ['pending', 'calling', 'answered'].includes(action.state) ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenAssistant}>
              <Icon name="sparkles" size={16} />
              {t('Open simulated AI call', 'सिम्युलेटेड AI कॉल खोलें')}
            </button>
          ) : null}
          {retryable ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>{t('Retry', 'पुनः प्रयास')}</button>
          ) : null}
          {action.state === 'failed' ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onManage}>{t('Manage AI consent', 'AI सहमति प्रबंधित करें')}</button>
          ) : null}
        </div>
      ) : null}

      {action.kind === 'dialer' ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenDialer}>
            <Icon name="phone" size={16} />
            {t('Open device dialler', 'डिवाइस डायलर खोलें')}
          </button>
          {retryable ? <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>{t('Retry', 'पुनः प्रयास')}</button> : null}
        </div>
      ) : null}
    </div>
  )
}

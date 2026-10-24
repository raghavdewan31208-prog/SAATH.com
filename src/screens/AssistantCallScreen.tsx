import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AssistantTurn, SosEvent } from '@shared/types'
import {
  ASSISTANT_ACTION_LABEL,
  assistantQuickPrompts,
  assistantReply,
  isAcknowledgement,
  openingLine,
} from '@shared/assistant'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, EmptyState, TopBar } from '../components/ui'
import { getHealth, requestRemoteAssistantTurn, type HealthResponse } from '../lib/ai'
import { formatAge } from '@shared/recommend'
import { formatTime } from '../lib/i18n'

type Turn = {
  id: string
  role: 'assistant' | 'contact'
  text: string
  action?: AssistantTurn['action']
  usedFacts?: string[]
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void
  onerror: () => void
  onend: () => void
  start: () => void
  stop: () => void
}

type RecognitionCtor = new () => SpeechRecognitionLike

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function AssistantCallScreen() {
  const { state, dispatch, t, lang, now, toast } = useApp()
  const navigate = useNavigate()
  const sos = state.sos
  const active = sos?.status === 'active'
  const contacts = [...state.contacts].sort((a, b) => a.priority - b.priority)
  const aiAction = sos?.actions.find((action) => action.kind === 'ai') ?? null
  const contact =
    (aiAction?.contactId ? contacts.find((item) => item.id === aiAction.contactId) : null) ??
    contacts.find((item) => item.aiConsent) ??
    null
  const allowed = active && contact && contact.aiConsent && state.settings.aiCallsAllowed

  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [voiceOn, setVoiceOn] = useState(true)
  const [listening, setListening] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [providerNote, setProviderNote] = useState<string | null>(null)
  const [micUnsupported, setMicUnsupported] = useState(false)
  const [sending, setSending] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const facts: SosEvent['sharedFacts'] = sos?.sharedFacts ?? {
    location: null,
    locationAt: null,
    destination: null,
    journeyActive: false,
    contactsNotified: 0,
  }

  useEffect(() => {
    let mounted = true
    getHealth().then((result) => {
      if (mounted) setHealth(result)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel()
      recognitionRef.current?.stop()
    }
  }, [speechSupported])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const speak = (text: string) => {
    if (!voiceOn || !speechSupported) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    utterance.rate = 0.98
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const appendTurn = (turn: Turn) => setTurns((current) => [...current, turn])

  const handleAssistantTurn = (turn: AssistantTurn) => {
    appendTurn({
      id: `turn-${Date.now()}-a`,
      role: 'assistant',
      text: turn.reply,
      action: turn.action,
      usedFacts: turn.usedFacts,
    })
    speak(turn.reply)
    if (turn.action.kind === 'end_call') setEnded(true)
  }

  const startCall = () => {
    if (!contact) return
    setStarted(true)
    setEnded(false)
    if (aiAction && ['pending', 'calling'].includes(aiAction.state)) {
      dispatch({
        type: 'sos/action',
        now: Date.now(),
        actionId: aiAction.id,
        state: 'calling',
        note: 'Simulated AI call in progress',
      })
    }
    const opening = openingLine(contact.name, lang)
    handleAssistantTurn(opening)
  }

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || !contact || ended) return
    setInput('')
    appendTurn({ id: `turn-${Date.now()}-c`, role: 'contact', text: message })
    // Deterministic: only the contact's explicit words record an acknowledgement.
    if (contact && !sos?.ack && isAcknowledgement(message, lang)) {
      dispatch({ type: 'sos/ack', now: Date.now(), contactId: contact.id })
    }
    setSending(true)
    try {
      let reply: AssistantTurn | null = null
      if (health?.ai.configured) {
        reply = await requestRemoteAssistantTurn({ facts, contactName: contact.name, lang, input: message })
        if (!reply) setProviderNote(t('Provider unavailable — fell back to the on-device simulation.', 'प्रदाता उपलब्ध नहीं — ऑन-डिवाइस सिम्युलेशन पर लौटा।'))
      }
      if (!reply) {
        reply = assistantReply(facts, contact.name, lang, message, Date.now())
      }
      handleAssistantTurn(reply)
    } finally {
      setSending(false)
    }
  }

  const endWithoutAck = () => {
    setEnded(true)
    if (speechSupported) window.speechSynthesis.cancel()
    if (aiAction && !sos?.ack && !['acknowledged', 'unanswered'].includes(aiAction.state)) {
      dispatch({
        type: 'sos/action',
        now: Date.now(),
        actionId: aiAction.id,
        state: 'answered',
        note: 'Simulated call ended without acknowledgement. Answering is not confirmation that help is coming.',
      })
    }
  }

  const simulateNoAnswer = () => {
    if (aiAction) {
      dispatch({
        type: 'sos/action',
        now: Date.now(),
        actionId: aiAction.id,
        state: 'unanswered',
        note: 'Simulated contact did not answer.',
      })
    }
    setEnded(true)
    toast(t('Recorded as unanswered. No delivery is claimed.', 'अनुत्तरित दर्ज। किसी डिलीवरी का दावा नहीं।'), 'danger')
  }

  const startListening = () => {
    const Ctor = getRecognition()
    if (!Ctor) {
      setMicUnsupported(true)
      return
    }
    try {
      const recognition = new Ctor()
      recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? ''
        if (transcript) setInput(transcript)
      }
      recognition.onerror = () => {
        dispatch({ type: 'permission/set', key: 'microphone', value: 'denied' })
        setListening(false)
        toast(t('Microphone input was unavailable. Please type instead.', 'माइक्रोफ़ोन इनपुट उपलब्ध नहीं। कृपया टाइप करें।'), 'danger')
      }
      recognition.onend = () => setListening(false)
      recognitionRef.current = recognition
      recognition.start()
      dispatch({ type: 'permission/set', key: 'microphone', value: 'granted' })
      setListening(true)
    } catch {
      setMicUnsupported(true)
      setListening(false)
    }
  }

  if (!active) {
    return (
      <>
        <TopBar title={t('AI assistant call', 'AI सहायक कॉल')} back="/sos" />
        <div className="screen">
          <EmptyState
            icon="sparkles"
            title={t('No active SOS alert', 'कोई सक्रिय SOS अलर्ट नहीं')}
            body={t('The simulated assistant call is only available while an SOS alert is active.', 'सिम्युलेटेड सहायक कॉल केवल सक्रिय SOS अलर्ट के दौरान उपलब्ध है।')}
            action={
              <button type="button" className="btn btn-primary" onClick={() => navigate('/sos')}>
                {t('Open SOS screen', 'SOS स्क्रीन खोलें')}
              </button>
            }
          />
        </div>
      </>
    )
  }

  if (!allowed || !contact) {
    return (
      <>
        <TopBar title={t('AI assistant call', 'AI सहायक कॉल')} back="/sos" />
        <div className="screen">
          <Banner tone="warn" icon="lock" title={t('No consented contact for an AI call', 'AI कॉल के लिए सहमति वाला संपर्क नहीं')}>
            {!state.settings.aiCallsAllowed
              ? t('AI calls are turned off in Settings.', 'सेटिंग्स में AI कॉल बंद हैं।')
              : t(
                  'Saath only demonstrates AI calls with a contact who explicitly consented. Consent is never assumed, even for a demo.',
                  'साथ केवल उसी संपर्क के साथ AI कॉल का प्रदर्शन करता है जिसने स्पष्ट सहमति दी हो। डेमो के लिए भी सहमति नहीं मानी जाती।',
                )}
            </Banner>
          <EmptyState
            icon="users"
            title={t('Consent is required', 'सहमति आवश्यक है')}
            body={t('Add or edit a trusted contact and enable “Consent to simulated AI calls”.', 'भरोसेमंद संपर्क जोड़ें या बदलें और “सिम्युलेटेड AI कॉल के लिए सहमति” सक्रिय करें।')}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/contacts')}>
                  {t('Manage contacts', 'संपर्क प्रबंधित करें')}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>
                  {t('Open settings', 'सेटिंग्स खोलें')}
                </button>
              </div>
            }
          />
        </div>
      </>
    )
  }

  const providerConfigured = Boolean(health?.ai.configured)
  const ackRecorded = Boolean(sos?.ack)
  const aiState = aiAction?.state

  return (
    <>
      <TopBar
        title={t('Simulated AI call', 'सिम्युलेटेड AI कॉल')}
        subtitle={contact.name}
        back="/sos"
        right={
          <Chip tone="warn" icon="info">
            {t('No phone network', 'फ़ोन नेटवर्क नहीं')}
          </Chip>
        }
      />
      <div className="screen" style={{ paddingBottom: 32 }}>
        <Banner tone="danger" icon="alert" title={t('Simulation only — no real call', 'केवल सिम्युलेशन — वास्तविक कॉल नहीं')}>
          {t(
            'No telephony provider is configured. Audio is spoken by your device’s speech synthesis. This assistant cannot contact emergency services, and no response team is involved.',
            'कोई टेलीफ़ोनी प्रदाता कॉन्फ़िगर नहीं है। ऑडियो आपके डिवाइस की स्पीच सिंथेसिस से बोला जाता है। यह सहायक आपातकालीन सेवाओं से संपर्क नहीं कर सकता और कोई प्रतिक्रिया दल शामिल नहीं है।',
          )}
        </Banner>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="row-between">
            <div className="row" style={{ gap: 10 }}>
              <span
                aria-hidden="true"
                style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--saath-brand-soft)', color: 'var(--saath-brand)', display: 'grid', placeItems: 'center' }}
              >
                <Icon name="sparkles" size={21} />
              </span>
              <div>
                <p style={{ fontWeight: 700 }}>{t('Saath automated AI assistant', 'साथ स्वचालित AI सहायक')}</p>
                <p className="hint">{t('Consent on file', 'सहमति दर्ज')} · {contact.isDemo ? t('fictional demo contact', 'काल्पनिक डेमो संपर्क') : t('trusted contact', 'भरोसेमंद संपर्क')}</p>
              </div>
            </div>
            <Chip tone={providerConfigured ? 'brand' : 'neutral'} icon={providerConfigured ? 'key' : 'info'}>
              {providerConfigured ? t('Server provider configured', 'सर्वर प्रदाता कॉन्फ़िगर') : t('On-device simulation', 'ऑन-डिवाइस सिम्युलेशन')}
            </Chip>
          </div>
          <p className="hint">
            {t(
              'The assistant introduces itself as AI, names Saath, states that an alert was activated, and may only use the facts below. It cannot invent incident details, locations or acknowledgements.',
              'सहायक स्वयं को AI बताता है, साथ का नाम लेता है, अलर्ट सक्रिय होने की बात कहता है, और केवल नीचे दिए तथ्य उपयोग कर सकता है। यह घटना विवरण, लोकेशन या पुष्टि नहीं गढ़ सकता।',
            )}
          </p>
          <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
            <Chip tone="brand" icon="lock">{t('Small fixed action set', 'छोटा निश्चित क्रिया सेट')}</Chip>
            <Chip tone="neutral">{lang === 'hi' ? 'हिन्दी' : 'English'}</Chip>
            {speechSupported ? <Chip tone="neutral" icon="volume">{t('Device speech', 'डिवाइस वाणी')}</Chip> : <Chip tone="warn">{t('No speech output', 'वाणी आउटपुट नहीं')}</Chip>}
          </div>
        </div>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="row-between">
            <p className="section-title" style={{ fontSize: '0.98rem' }}>{t('Authorised facts only', 'केवल अधिकृत तथ्य')}</p>
            <Icon name="lock" size={17} />
          </div>
          <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <span className="hint">{t('Latest location', 'नवीनतम लोकेशन')}</span>
            <span style={{ textAlign: 'right', fontSize: '0.88rem', fontWeight: 600 }}>
              {facts.location && facts.locationAt
                ? `${facts.location.lat.toFixed(4)}, ${facts.location.lng.toFixed(4)} · ${formatAge(facts.locationAt, now, lang)}`
                : t('Unknown', 'अज्ञात')}
            </span>
          </div>
          <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <span className="hint">{t('Destination', 'गंतव्य')}</span>
            <span style={{ textAlign: 'right', fontSize: '0.88rem', fontWeight: 600 }}>{facts.destination ?? t('Unknown', 'अज्ञात')}</span>
          </div>
          <div className="row-between">
            <span className="hint">{t('Journey active', 'यात्रा सक्रिय')}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{facts.journeyActive ? t('Yes', 'हाँ') : t('No', 'नहीं')}</span>
          </div>
          <div className="row-between">
            <span className="hint">{t('Contacts notified', 'सूचित संपर्क')}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{facts.contactsNotified}</span>
          </div>
        </section>

        {!started ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Before the simulated call', 'सिम्युलेटेड कॉल से पहले')}</p>
            <p className="hint">
              {t(
                'You are playing the role of the contact. The assistant will speak first and may ask you to acknowledge the alert. Acknowledgements are recorded locally and do not confirm that help is coming.',
                'आप संपर्क की भूमिका में हैं। सहायक पहले बोलेगा और अलर्ट की पुष्टि माँग सकता है। पुष्टि स्थानीय रूप से दर्ज होती है और मदद आने की पुष्टि नहीं करती।',
              )}
            </p>
            <label className="row" style={{ gap: 9, fontSize: '0.9rem' }}>
              <input type="checkbox" checked={voiceOn} onChange={(event) => setVoiceOn(event.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--saath-brand-strong)' }} />
              {t('Read replies aloud with device speech', 'डिवाइस वाणी से उत्तर पढ़ें')}
            </label>
            <button type="button" className="btn btn-primary btn-block" onClick={startCall}>
              <Icon name="phone" size={19} />
              {t('Start simulated call', 'सिम्युलेटेड कॉल शुरू करें')}
            </button>
            <p className="hint">
              {t(
                'This feature is for demonstration only. Use it with consenting test contacts and a provider that permits the use case. It must not be used for emergency dispatching.',
                'यह सुविधा केवल प्रदर्शन के लिए है। सहमति वाले परीक्षण संपर्कों और उपयोग की अनुमति देने वाले प्रदाता के साथ उपयोग करें। आपातकालीन डिस्पैच के लिए इसका उपयोग न करें।',
              )}
            </p>
          </div>
        ) : (
          <>
            {ended ? (
              <Banner tone="warn" icon="phoneOff" title={t('Simulated call ended', 'सिम्युलेटेड कॉल समाप्त')}>
                {ackRecorded
                  ? t('An acknowledgement was recorded. It does not confirm that help is on the way.', 'पुष्टि दर्ज हुई। यह पुष्टि नहीं करती कि मदद आ रही है।')
                  : aiState === 'unanswered'
                    ? t('This call is recorded as unanswered. No delivery is claimed.', 'यह कॉल अनुत्तरित दर्ज है। किसी डिलीवरी का दावा नहीं।')
                    : t('The call ended without an acknowledgement. Contact the person directly or use your device’s emergency call option.', 'कॉल बिना पुष्टि के समाप्त। सीधे संपर्क करें या डिवाइस का आपातकालीन कॉल विकल्प उपयोग करें।')}
              </Banner>
            ) : null}

            <section
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 280 }}
              aria-live="polite"
            >
              <div className="row-between">
                <p className="section-title" style={{ fontSize: '0.98rem' }}>{t('Call transcript', 'कॉल ट्रांसक्रिप्ट')}</p>
                <Chip tone={ended ? 'neutral' : 'warn'} icon={ended ? 'phoneOff' : 'phone'}>
                  {ended ? t('Ended', 'समाप्त') : t('In call (simulated)', 'कॉल में (सिम्युलेटेड)')}
                </Chip>
              </div>
              <div
                ref={scrollRef}
                style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 330, overflowY: 'auto', paddingRight: 3 }}
              >
                {turns.map((turn) => (
                  <div key={turn.id} className={turn.role === 'contact' ? 'speaker' : 'speaker'}>
                    {turn.role === 'assistant' ? (
                      <span
                        aria-hidden="true"
                        style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--saath-brand-soft)', color: 'var(--saath-brand)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}
                      >
                        <Icon name="sparkles" size={16} />
                      </span>
                    ) : null}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <div className={`speaker-bubble ${turn.role === 'contact' ? 'speaker-bubble-user' : ''}`}>
                        <p>{turn.text}</p>
                        {turn.action ? (
                          <p className="hint" style={{ marginTop: 6, display: 'flex', gap: 5, alignItems: 'center' }}>
                            <Icon name="sparkles" size={12} />
                            {t('Action', 'क्रिया')}: {ASSISTANT_ACTION_LABEL[turn.action.kind][lang === 'hi' ? 1 : 0]}
                          </p>
                        ) : null}
                        {turn.usedFacts && turn.usedFacts.length > 0 ? (
                          <p className="hint" style={{ marginTop: 4 }}>
                            {t('Facts used', 'उपयोग किए तथ्य')}: {turn.usedFacts.join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {sending ? <p className="hint pulse-soft">{t('Assistant is responding…', 'सहायक उत्तर दे रहा है…')}</p> : null}
              </div>
              {providerNote ? <Banner tone="warn" icon="alert">{providerNote}</Banner> : null}
            </section>

            {ackRecorded ? (
              <Banner tone="brand" icon="check" title={t('Acknowledgement recorded', 'पुष्टि दर्ज हुई')}>
                {t(
                  'Recorded at',
                  'दर्ज समय',
                )} {sos?.ack ? formatTime(sos.ack.at, lang) : '—'}. {t('This does not mean the contact is coming to help.', 'इसका अर्थ यह नहीं कि संपर्क मदद के लिए आ रहा है।')}
              </Banner>
            ) : null}

            {!ended ? (
              <>
                <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                  {assistantQuickPrompts(lang).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="chip chip-neutral"
                      style={{ border: '1px solid var(--saath-line)' }}
                      onClick={() => void send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void send(input)
                  }}
                  style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
                >
                  <label htmlFor="assistant-input" className="sr-only-focusable" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                    {t('Your reply as the contact', 'संपर्क के रूप में आपका उत्तर')}
                  </label>
                  <textarea
                    id="assistant-input"
                    className="textarea"
                    style={{ minHeight: 52, maxHeight: 110 }}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={t('Reply as the contact…', 'संपर्क के रूप में उत्तर दें…')}
                    rows={2}
                  />
                  <button type="submit" className="icon-btn" aria-label={t('Send reply', 'उत्तर भेजें')} disabled={!input.trim() || sending}>
                    <Icon name="send" size={19} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Speak your reply', 'बोलकर उत्तर दें')}
                    onClick={startListening}
                    disabled={listening}
                    title={micUnsupported ? t('Speech input is not available in this browser', 'इस ब्राउज़र में वाणी इनपुट उपलब्ध नहीं') : undefined}
                  >
                    <Icon name={listening ? 'volume' : 'mic'} size={19} />
                  </button>
                </form>
                {micUnsupported ? <p className="hint">{t('Speech input is not available in this browser. Typing works everywhere.', 'इस ब्राउज़र में वाणी इनपुट उपलब्ध नहीं। टाइपिंग हर जगह काम करती है।')}</p> : null}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <button type="button" className="btn btn-secondary" onClick={endWithoutAck}>
                    {t('End call', 'कॉल समाप्त')}
                  </button>
                  <button type="button" className="btn btn-danger-soft" onClick={simulateNoAnswer}>
                    {t('Simulate no answer', 'कोई उत्तर नहीं सिम्युलेट')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/sos')}>
                  {t('Back to SOS', 'SOS पर लौटें')}
                </button>
                {aiState === 'unanswered' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    onClick={() => {
                      if (aiAction) dispatch({ type: 'sos/retry', now: Date.now(), actionId: aiAction.id })
                      setStarted(false)
                      setEnded(false)
                      setTurns([])
                      setProviderNote(null)
                    }}
                  >
                    <Icon name="refresh" size={17} />
                    {t('Retry the simulated call', 'सिम्युलेटेड कॉल फिर आज़माएँ')}
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

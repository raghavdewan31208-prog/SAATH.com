import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Icon, Logo } from '../components/Icon'
import { Banner, Chip, Sheet, SwitchRow } from '../components/ui'
import { WelcomeIllustration } from '../components/Illustrations'
import { Avatar } from '../components/Avatar'
import { ContactForm } from '../components/ContactForm'
import { requestPosition, GeoError } from '../lib/geo'
import type { Contact } from '@shared/types'

const STEP_COUNT = 8

export default function OnboardingScreen() {
  const { state, dispatch, t, lang, toast } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(state.profile.name)
  const [contactSheet, setContactSheet] = useState(false)
  const [permissionBusy, setPermissionBusy] = useState<'location' | 'notifications' | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const setLang = (next: 'en' | 'hi') => {
    dispatch({ type: 'profile/update', now: Date.now(), patch: { lang: next } })
  }

  const next = () => setStep((current) => Math.min(STEP_COUNT - 1, current + 1))
  const back = () => setStep((current) => Math.max(0, current - 1))

  const finish = () => {
    dispatch({
      type: 'profile/update',
      now: Date.now(),
      patch: { name: name.trim() || (lang === 'hi' ? 'मित्र' : 'Friend'), onboardedAt: Date.now() },
    })
    navigate('/', { replace: true })
  }

  const skipAll = () => {
    dispatch({
      type: 'profile/update',
      now: Date.now(),
      patch: { onboardedAt: Date.now(), name: name.trim() || (lang === 'hi' ? 'मित्र' : 'Friend') },
    })
    navigate('/', { replace: true })
  }

  const addContact = (contact: Contact) => {
    dispatch({ type: 'contacts/add', contact })
    setContactSheet(false)
    toast(t('Contact added to your trusted circle.', 'संपर्क आपके भरोसेमंद दायरे में जोड़ा गया।'))
  }

  const askLocation = async () => {
    setPermissionBusy('location')
    setPermissionError(null)
    try {
      await requestPosition()
      dispatch({ type: 'permission/set', key: 'location', value: 'granted' })
      toast(t('Location permission granted. Saath only reads it while you ask.', 'लोकेशन अनुमति मिल गई। साथ इसे केवल तब पढ़ता है जब आप कहें।'))
    } catch (error) {
      const code = error instanceof GeoError ? error.code : 'unavailable'
      dispatch({
        type: 'permission/set',
        key: 'location',
        value: code === 'denied' ? 'denied' : code === 'unsupported' ? 'unsupported' : 'unknown',
      })
      setPermissionError(
        code === 'denied'
          ? t(
              'Location permission was denied. You can keep exploring and enter places manually.',
              'लोकेशन अनुमति अस्वीकृत हुई। आप बिना लोकेशन के भी ऐप देख सकते हैं और जगहें मैन्युअल रूप से डाल सकते हैं।',
            )
          : t(
              'Your location could not be read. This is not an error in Saath; manual entry still works.',
              'आपकी लोकेशन नहीं पढ़ी जा सकी। यह साथ की गलती नहीं है; मैन्युअल प्रविष्टि अभी भी काम करती है।',
            ),
      )
    } finally {
      setPermissionBusy(null)
    }
  }

  const askNotifications = async () => {
    if (!('Notification' in window)) {
      dispatch({ type: 'permission/set', key: 'notifications', value: 'unsupported' })
      toast(t('Notifications are not supported in this browser.', 'इस ब्राउज़र में सूचनाएँ समर्थित नहीं हैं।'))
      return
    }
    setPermissionBusy('notifications')
    try {
      const result = await Notification.requestPermission()
      dispatch({ type: 'permission/set', key: 'notifications', value: result === 'granted' ? 'granted' : 'denied' })
      toast(
        result === 'granted'
          ? t(
              'Notifications allowed. Saath has no push server, so alerts stay in-app for now.',
              'सूचनाएँ अनुमत। साथ के पास पुश सर्वर नहीं है, इसलिए अलर्ट अभी ऐप में ही दिखेंगे।',
            )
          : t('Notification permission was not granted. In-app alerts still work.', 'सूचना अनुमति नहीं मिली। ऐप के भीतर अलर्ट अभी भी काम करते हैं।'),
      )
    } finally {
      setPermissionBusy(null)
    }
  }

  const toggleSos = (key: keyof typeof state.settings.sos, value: boolean) => {
    dispatch({ type: 'settings/sos', patch: { [key]: value } })
  }

  return (
    <div className="screen" style={{ gap: 22, paddingBottom: 40 }}>
      <div className="row-between">
        <div className="row" style={{ gap: 10 }}>
          <Logo size={38} />
          <div>
            <p style={{ fontWeight: 780, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Saath</p>
            <p className="hint" style={{ fontSize: '0.72rem' }}>{t('travel with company', 'साथ चलने का भरोसा')}</p>
          </div>
        </div>
        <div className="segmented" style={{ width: 116 }} role="group" aria-label={t('Language', 'भाषा')}>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            EN
          </button>
          <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>
            हिं
          </button>
        </div>
      </div>

      <div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }} />
        </div>
        <div className="row-between" style={{ marginTop: 7 }}>
          <span className="hint">
            {t('Step', 'चरण')} {step + 1} / {STEP_COUNT}
          </span>
          {step === 0 ? (
            <button type="button" className="hint" style={{ textDecoration: 'underline', background: 'none', border: 0 }} onClick={skipAll}>
              {t('Explore without setup', 'सेटअप के बिना देखें')}
            </button>
          ) : (
            <button type="button" className="hint" style={{ textDecoration: 'underline', background: 'none', border: 0 }} onClick={skipAll}>
              {t('Skip setup', 'सेटअप छोड़ें')}
            </button>
          )}
        </div>
      </div>

      {step === 0 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WelcomeIllustration />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Chip tone="brand" icon="sparkles">
              {t('Evening travel companion', 'शाम की यात्रा साथी')}
            </Chip>
            <h1 className="h1">{t('Go out. Stay connected. Never alone.', 'बाहर जाएँ। जुड़े रहें। अकेले नहीं।')}</h1>
            <p className="muted">
              {t(
                'Saath helps you compare evening routes, share a journey with people you trust, and reach help if something feels wrong.',
                'साथ आपको शाम के मार्गों की तुलना करने, भरोसेमंद लोगों के साथ यात्रा साझा करने और कुछ गलत लगने पर मदद तक पहुँचने में मदद करता है।',
              )}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                icon: 'route' as const,
                title: t('Plan the walk home', 'घर लौटने का मार्ग'),
                body: t('Compare lighting, walkways, transport and time-stamped observations.', 'रोशनी, फुटपाथ, परिवहन और समय-चिह्नित अवलोकनों की तुलना करें।'),
              },
              {
                icon: 'share' as const,
                title: t('Share the journey', 'यात्रा साझा करें'),
                body: t('Choose who sees your location, journey and notes — and revoke anytime.', 'चुनें कि कौन आपकी लोकेशन, यात्रा और नोट्स देखे — कभी भी रद्द करें।'),
              },
              {
                icon: 'shield' as const,
                title: t('Ask for help', 'मदद माँगें'),
                body: t('A deliberate hold starts SOS. The AI speaks only from your shared facts.', 'जानबूझकर दबाने पर SOS शुरू होता है। AI केवल साझा तथ्य बोलता है।'),
              },
            ].map((item) => (
              <div key={item.title} className="card" style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: 14 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    background: 'var(--saath-brand-soft)',
                    color: 'var(--saath-brand)',
                    display: 'grid',
                    placeItems: 'center',
                    flex: '0 0 auto',
                  }}
                >
                  <Icon name={item.icon} size={22} />
                </span>
                <div>
                  <p style={{ fontWeight: 700 }}>{item.title}</p>
                  <p className="hint">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <Banner tone="warn" icon="info" title={t('What Saath cannot do', 'साथ क्या नहीं कर सकता')}>
            {t(
              'Saath is not an emergency service. It cannot dispatch police or an ambulance, guarantee safety, or confirm that help is coming. In immediate danger, call local emergency services from your phone.',
              'साथ आपातकालीन सेवा नहीं है। यह पुलिस या एम्बुलेंस नहीं भेज सकता, सुरक्षा की गारंटी नहीं दे सकता, या मदद पहुँचने की पुष्टि नहीं कर सकता। तत्काल ख़तरे में अपने फ़ोन से स्थानीय आपातकालीन सेवा को कॉल करें।',
            )}
          </Banner>
        </section>
      ) : null}

      {step === 1 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('What should we call you?', 'हम आपको क्या कहें?')}</h1>
          <p className="muted">
            {t('This name appears only on this device and in your own sharing screens.', 'यह नाम केवल इस डिवाइस और आपकी साझा स्क्रीन पर दिखता है।')}
          </p>
          <div className="field">
            <label className="field-label" htmlFor="display-name">
              {t('Display name', 'प्रदर्शित नाम')}
            </label>
            <input
              id="display-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('e.g. Aanya', 'जैसे आन्या')}
              autoComplete="given-name"
              maxLength={40}
            />
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Preferred language', 'पसंदीदा भाषा')}</p>
            <div className="segmented" role="group" aria-label={t('Preferred language', 'पसंदीदा भाषा')}>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>
                हिन्दी
              </button>
            </div>
            <p className="hint">
              {t('You can switch language anytime from Settings. Map labels stay in English.', 'आप सेटिंग्स से कभी भी भाषा बदल सकते हैं। मानचित्र के लेबल अंग्रेज़ी में रहते हैं।')}
            </p>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('Add people you trust', 'भरोसेमंद लोग जोड़ें')}</h1>
          <p className="muted">
            {t(
              'Contacts receive journey updates only if you choose them, and only while sharing is active. Priority order decides who is called first.',
              'संपर्कों को यात्रा अपडेट केवल तब मिलते हैं जब आप उन्हें चुनें और साझा करना सक्रिय हो। प्राथमिकता तय करती है कि पहले किसे कॉल किया जाए।',
            )}
          </p>
          {state.contacts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...state.contacts].sort((a, b) => a.priority - b.priority).map((contact) => (
                <div key={contact.id} className="card row-between" style={{ padding: 13 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={contact.name} size={38} />
                    <div>
                      <div className="row" style={{ gap: 6 }}>
                        <p style={{ fontWeight: 650 }}>{contact.name}</p>
                        <span className="chip chip-brand">
                          {t('Priority', 'प्राथमिकता')} {contact.priority}
                        </span>
                      </div>
                      <p className="hint">{contact.relation} · {contact.phone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('Remove', 'हटाएँ')} ${contact.name}`}
                    onClick={() => dispatch({ type: 'contacts/remove', id: contact.id, now: Date.now() })}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 18 }}>
              <p style={{ fontWeight: 650 }}>{t('No contacts yet', 'अभी कोई संपर्क नहीं')}</p>
              <p className="hint" style={{ marginTop: 4 }}>
                {t('You can add them now or later. SOS works with fewer features without contacts.', 'अभी या बाद में जोड़ सकते हैं। संपर्कों के बिना भी SOS कुछ सुविधाओं के साथ काम करता है।')}
              </p>
            </div>
          )}
          <button type="button" className="btn btn-primary btn-block" onClick={() => setContactSheet(true)}>
            <Icon name="plus" size={19} />
            {t('Add a trusted contact', 'भरोसेमंद संपर्क जोड़ें')}
          </button>
          {state.contacts.length === 0 ? (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                dispatch({ type: 'members/demo', now: Date.now() })
                toast(t('Fictional demo contacts added.', 'काल्पनिक डेमो संपर्क जोड़े गए।'))
              }}
            >
              <Icon name="sparkles" size={18} />
              {t('Use fictional demo contacts', 'काल्पनिक डेमो संपर्क उपयोग करें')}
            </button>
          ) : null}
          <p className="hint">
            {t(
              'Demo contacts use fictional names and placeholder numbers. Never test emergency actions with a stranger’s number.',
              'डेमो संपर्क काल्पनिक नाम और प्लेसहोल्डर नंबर उपयोग करते हैं। किसी अजनबी के नंबर पर आपातकालीन कार्रवाई का परीक्षण न करें।',
            )}
          </p>
        </section>
      ) : null}

      {step === 3 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('Choose what SOS does', 'चुनें कि SOS क्या करे')}</h1>
          <p className="muted">
            {t(
              'These actions run only after a deliberate hold. Nothing is sent when you open this screen.',
              'ये क्रियाएँ केवल जानबूझकर दबाने के बाद चलती हैं। इस स्क्रीन को खोलने पर कुछ नहीं भेजा जाता।',
            )}
          </p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SwitchRow
              label={t('Share location and journey details', 'लोकेशन और यात्रा विवरण साझा करें')}
              description={t('Simulated in this build. Recipients see only what you allowed.', 'इस बिल्ड में सिम्युलेटेड। प्राप्तकर्ता केवल वही देखते हैं जो आपने अनुमति दी।')}
              checked={state.settings.sos.shareLocation}
              onChange={(next) => toggleSos('shareLocation', next)}
            />
            <SwitchRow
              label={t('Open a call to your priority contact', 'प्राथमिकता संपर्क को कॉल खोलें')}
              description={t('Opens your phone dialler. Saath cannot confirm the call connected.', 'आपका फ़ोन डायलर खुलता है। साथ कॉल जुड़ने की पुष्टि नहीं कर सकता।')}
              checked={state.settings.sos.callPriority}
              onChange={(next) => toggleSos('callPriority', next)}
            />
            <SwitchRow
              label={t('Let the AI assistant call a consenting contact', 'AI सहायक सहमति वाले संपर्क को कॉल करे')}
              description={t('Simulated for now, and only with explicit contact consent.', 'अभी सिम्युलेटेड, और केवल स्पष्ट संपर्क सहमति के साथ।')}
              checked={state.settings.sos.aiCall}
              onChange={(next) => toggleSos('aiCall', next)}
            />
            <SwitchRow
              label={t('Show the device emergency-calling option', 'डिवाइस का आपातकालीन कॉल विकल्प दिखाएँ')}
              description={t('Opens the dialler only. This build never places or routes emergency calls.', 'केवल डायलर खोलता है। यह बिल्ड आपातकालीन कॉल नहीं करता या रूट नहीं करता।')}
              checked={state.settings.sos.openDialer}
              onChange={(next) => toggleSos('openDialer', next)}
            />
          </div>
          <Banner tone="neutral" icon="lock">
            {t(
              'Recipient answers are not proof that help is coming. Saath never promises a response.',
              'प्राप्तकर्ता का उत्तर इस बात का प्रमाण नहीं है कि मदद आ रही है। साथ कभी किसी प्रतिक्रिया का वादा नहीं करता।',
            )}
          </Banner>
        </section>
      ) : null}

      {step === 4 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('Set gentle check-ins', 'हल्के चेक-इन सेट करें')}</h1>
          <p className="muted">
            {t(
              'A deviation, unexpected stop or late arrival can prompt a check-in. It is never treated as proof of danger.',
              'मार्ग से हटना, अचानक रुकना या देर से पहुँचना चेक-इन के लिए कह सकता है। इसे कभी ख़तरे का प्रमाण नहीं माना जाता।',
            )}
          </p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SwitchRow
              label={t('Safety check-ins during journeys', 'यात्रा के दौरान सुरक्षा चेक-इन')}
              description={t('Shows “I’m okay”, “Update my journey” and “I need help”.', '“मैं ठीक हूँ”, “यात्रा अपडेट करें” और “मुझे मदद चाहिए” दिखाता है।')}
              checked={state.settings.safetyCheckins}
              onChange={(next) => dispatch({ type: 'settings/update', patch: { safetyCheckins: next } })}
            />
            <div className="field">
              <span className="field-label">{t('Ask for a check-in every', 'हर इतने समय में चेक-इन पूछें')}</span>
              <div className="segmented" role="group" aria-label={t('Check-in interval', 'चेक-इन अंतराल')}>
                {[10, 15, 20, 30].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={state.settings.checkin.intervalMin === minutes}
                    onClick={() => dispatch({ type: 'settings/checkin', patch: { intervalMin: minutes } })}
                  >
                    {minutes} {t('min', 'मि')}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">{t('Unexpected stop after', 'अचानक रुकावट इतने समय बाद')}</span>
              <div className="segmented" role="group" aria-label={t('Unexpected stop threshold', 'अचानक रुकावट सीमा')}>
                {[4, 6, 10].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={state.settings.checkin.stopMinutes === minutes}
                    onClick={() => dispatch({ type: 'settings/checkin', patch: { stopMinutes: minutes } })}
                  >
                    {minutes} {t('min', 'मि')}
                  </button>
                ))}
              </div>
            </div>
            <SwitchRow
              label={t('Send one limited escalation if I don’t reply', 'जवाब न देने पर एक सीमित एस्केलेशन भेजें')}
              description={t(
                'After 90 seconds of no reply, Saath sends one simulated check-in request to your priority contact. It never repeats automatically.',
                '90 सेकंड तक जवाब न मिलने पर साथ आपके प्राथमिकता संपर्क को एक सिम्युलेटेड चेक-इन अनुरोध भेजता है। यह स्वतः दोहराया नहीं जाता।',
              )}
              checked={state.settings.checkin.escalate}
              onChange={(next) => dispatch({ type: 'settings/checkin', patch: { escalate: next } })}
            />
          </div>
          <Banner tone="neutral" icon="info">
            {t(
              'Default: 15-minute check-ins, 6-minute stop threshold, deviation alerts and one escalation. You can change all of this later.',
              'डिफ़ॉल्ट: 15 मिनट का चेक-इन, 6 मिनट की रुकावट सीमा, मार्ग विचलन अलर्ट और एक एस्केलेशन। आप इन्हें बाद में बदल सकते हैं।',
            )}
          </Banner>
        </section>
      ) : null}

      {step === 5 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('Decide what contacts can see', 'तय करें संपर्क क्या देख सकते हैं')}</h1>
          <p className="muted">
            {t('These are defaults for new contacts. Each contact can be adjusted separately.', 'ये नए संपर्कों के लिए डिफ़ॉल्ट हैं। हर संपर्क अलग से बदला जा सकता है।')}
          </p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SwitchRow
              label={t('Latest location and timestamp', 'नवीनतम लोकेशन और समय')}
              description={t('A single point while sharing is live. Never a public map of users.', 'साझा करते समय एक बिंदु। उपयोगकर्ताओं का सार्वजनिक मैप कभी नहीं।')}
              checked={state.settings.contactDefaults.location}
              onChange={(next) => dispatch({ type: 'settings/contactDefaults', patch: { location: next } })}
            />
            <SwitchRow
              label={t('Destination and estimated arrival', 'गंतव्य और अनुमानित आगमन')}
              description={t('Route name, progress and ETA — useful context without exposing your history.', 'मार्ग का नाम, प्रगति और ETA — आपका इतिहास खोले बिना उपयोगी संदर्भ।')}
              checked={state.settings.contactDefaults.journey}
              onChange={(next) => dispatch({ type: 'settings/contactDefaults', patch: { journey: next } })}
            />
            <SwitchRow
              label={t('Notes you add', 'आपके जोड़े नोट्स')}
              description={t('Off by default. You can add a short note from Journey Mode.', 'डिफ़ॉल्ट रूप से बंद। आप यात्रा मोड से छोटा नोट जोड़ सकते हैं।')}
              checked={state.settings.contactDefaults.notes}
              onChange={(next) => dispatch({ type: 'settings/contactDefaults', patch: { notes: next } })}
            />
          </div>
          <Banner tone="brand" icon="lock">
            {t(
              'Location links in this build are simulated. They use unguessable tokens and expire automatically, but no server is sending them. You still get revoke controls.',
              'इस बिल्ड में लोकेशन लिंक सिम्युलेटेड हैं। वे अनुमान लगाने में कठिन टोकन उपयोग करते हैं और स्वतः समाप्त होते हैं, पर कोई सर्वर उन्हें नहीं भेजता। रद्द नियंत्रण फिर भी उपलब्ध हैं।',
            )}
          </Banner>
        </section>
      ) : null}

      {step === 6 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('Permissions, only when you need them', 'अनुमतियाँ, केवल जब ज़रूरत हो')}</h1>
          <p className="muted">
            {t(
              'You can use Saath without granting location or notifications. The app asks only when an action needs the permission.',
              'आप लोकेशन या सूचना अनुमति के बिना साथ उपयोग कर सकते हैं। ऐप केवल तब माँगता है जब किसी क्रिया को अनुमति चाहिए।',
            )}
          </p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row" style={{ gap: 11 }}>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--saath-brand-soft)', color: 'var(--saath-brand)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <Icon name="pin" size={21} />
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 650 }}>{t('Location', 'लोकेशन')}</p>
                <p className="hint">
                  {t('Used for your current starting point and journey updates. Simulated movement is used when permission is off.', 'वर्तमान प्रारंभ बिंदु और यात्रा अपडेट के लिए। अनुमति बंद होने पर सिम्युलेटेड गति उपयोग होती है।')}
                </p>
              </div>
              <Chip tone={state.profile.permissions.location === 'granted' ? 'ok' : state.profile.permissions.location === 'denied' ? 'warn' : 'neutral'}>
                {state.profile.permissions.location === 'granted'
                  ? t('Allowed', 'अनुमत')
                  : state.profile.permissions.location === 'denied'
                    ? t('Denied', 'अस्वीकृत')
                    : t('Not asked', 'नहीं पूछा')}
              </Chip>
            </div>
            <button type="button" className="btn btn-secondary btn-block" onClick={askLocation} disabled={permissionBusy !== null}>
              <Icon name="pin" size={18} />
              {permissionBusy === 'location' ? t('Checking…', 'जाँच हो रही है…') : t('Allow location', 'लोकेशन अनुमति दें')}
            </button>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row" style={{ gap: 11 }}>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--saath-surface-2)', color: 'var(--saath-brand)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <Icon name="bell" size={21} />
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 650 }}>{t('Notifications', 'सूचनाएँ')}</p>
                <p className="hint">
                  {t('No push service is configured in this MVP. Alerts stay in-app even if you allow notifications.', 'इस MVP में कोई पुश सेवा कॉन्फ़िगर नहीं है। अनुमति देने पर भी अलर्ट ऐप में ही रहते हैं।')}
                </p>
              </div>
              <Chip tone={state.profile.permissions.notifications === 'granted' ? 'ok' : state.profile.permissions.notifications === 'denied' ? 'warn' : 'neutral'}>
                {state.profile.permissions.notifications === 'granted'
                  ? t('Allowed', 'अनुमत')
                  : state.profile.permissions.notifications === 'denied'
                    ? t('Denied', 'अस्वीकृत')
                    : t('Not asked', 'नहीं पूछा')}
              </Chip>
            </div>
            <button type="button" className="btn btn-secondary btn-block" onClick={askNotifications} disabled={permissionBusy !== null}>
              <Icon name="bell" size={18} />
              {permissionBusy === 'notifications' ? t('Asking…', 'पूछा जा रहा है…') : t('Allow notifications', 'सूचनाएँ अनुमत करें')}
            </button>
          </div>

          {permissionError ? (
            <Banner tone="warn" icon="alert" title={t('Permission not granted', 'अनुमति नहीं मिली')}>
              {permissionError}
            </Banner>
          ) : null}
          <Banner tone="neutral" icon="info">
            {t(
              'Background location is not supported in this PWA. Journey updates stop when the app is fully closed. Keep Saath open on the journey screen.',
              'इस PWA में बैकग्राउंड लोकेशन समर्थित नहीं है। ऐप पूरी तरह बंद होने पर यात्रा अपडेट रुक जाते हैं। यात्रा स्क्रीन पर साथ खुला रखें।',
            )}
          </Banner>
        </section>
      ) : null}

      {step === 7 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="h1">{t('You’re ready to travel with company', 'अब आप साथ के साथ यात्रा के लिए तैयार हैं')}</h1>
          <p className="muted">
            {t(
              'You can change every setting later. Saath starts in demo mode because no live condition data or sharing backend is configured.',
              'आप बाद में हर सेटिंग बदल सकते हैं। कोई लाइव स्थिति डेटा या शेयरिंग बैकएंड कॉन्फ़िगर न होने के कारण साथ डेमो मोड में शुरू होता है।',
            )}
          </p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              [t('Name', 'नाम'), name.trim() || (lang === 'hi' ? 'मित्र' : 'Friend')],
              [t('Language', 'भाषा'), lang === 'hi' ? 'हिन्दी' : 'English'],
              [t('Trusted contacts', 'भरोसेमंद संपर्क'), String(state.contacts.length)],
              [
                t('SOS actions', 'SOS क्रियाएँ'),
                String(Object.values(state.settings.sos).filter(Boolean).length) + ' ' + t('enabled', 'सक्रिय'),
              ],
              [t('Check-ins', 'चेक-इन'), state.settings.safetyCheckins ? `${state.settings.checkin.intervalMin} ${t('min', 'मि')}` : t('Off', 'बंद')],
            ].map(([label, value]) => (
              <div key={label} className="row-between">
                <span className="hint">{label}</span>
                <span style={{ fontWeight: 650 }}>{value}</span>
              </div>
            ))}
          </div>
          <Banner tone="warn" icon="shield" title={t('Emergency reminder', 'आपातकालीन याद')}>
            {t(
              'This is a demonstration build. Emergency dialling opens your phone app; AI calls and delivery are simulated. Do not rely on Saath for a real emergency.',
              'यह प्रदर्शन बिल्ड है। आपातकालीन डायलिंग आपका फ़ोन ऐप खोलती है; AI कॉल और डिलीवरी सिम्युलेटेड हैं। वास्तविक आपात स्थिति में साथ पर निर्भर न रहें।',
            )}
          </Banner>
        </section>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
        {step > 0 ? (
          <button type="button" className="btn btn-secondary" style={{ flex: '0 0 34%' }} onClick={back}>
            <Icon name="arrowLeft" size={18} />
            {t('Back', 'पीछे')}
          </button>
        ) : null}
        {step < STEP_COUNT - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={next}
            disabled={step === 1 && name.trim().length < 1}
          >
            {t('Continue', 'आगे बढ़ें')}
            <Icon name="chevronRight" size={18} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={finish}>
            <Icon name="check" size={19} />
            {t('Start exploring', 'देखना शुरू करें')}
          </button>
        )}
      </div>

      <Sheet open={contactSheet} onClose={() => setContactSheet(false)} title={t('Add trusted contact', 'भरोसेमंद संपर्क जोड़ें')}>
        <ContactForm
          submitLabel={t('Add contact', 'संपर्क जोड़ें')}
          onCancel={() => setContactSheet(false)}
          onSubmit={addContact}
        />
      </Sheet>
    </div>
  )
}

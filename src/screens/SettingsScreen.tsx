import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, Sheet, SwitchRow, TopBar } from '../components/ui'
import { requestPosition } from '../lib/geo'
import { getHealth, type HealthResponse } from '../lib/ai'
import { clearStorage } from '../lib/storage'
import type { ThemePref } from '@shared/types'

export default function SettingsScreen() {
  const { state, dispatch, t, lang, toast, installAvailable, promptInstall, standalone } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(state.profile.name)
  const [resetOpen, setResetOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [permissionBusy, setPermissionBusy] = useState<'location' | 'notifications' | null>(null)

  useEffect(() => {
    setName(state.profile.name)
  }, [state.profile.name])

  const refreshHealth = async () => {
    setChecking(true)
    setHealth(await getHealth())
    setChecking(false)
  }

  useEffect(() => {
    void refreshHealth()
  }, [])

  const askLocation = async () => {
    setPermissionBusy('location')
    try {
      await requestPosition()
      dispatch({ type: 'permission/set', key: 'location', value: 'granted' })
      toast(t('Location permission granted. Journey Mode can use device position.', 'लोकेशन अनुमति मिली। यात्रा मोड डिवाइस लोकेशन उपयोग कर सकता है।'))
    } catch {
      dispatch({ type: 'permission/set', key: 'location', value: 'denied' })
      toast(t('Location was not granted. Manual places and simulation still work.', 'लोकेशन नहीं मिली। मैन्युअल जगहें और सिम्युलेशन अभी भी काम करते हैं।'), 'danger')
    } finally {
      setPermissionBusy(null)
    }
  }

  const askNotifications = async () => {
    if (!('Notification' in window)) {
      dispatch({ type: 'permission/set', key: 'notifications', value: 'unsupported' })
      toast(t('Notifications are not supported in this browser.', 'इस ब्राउज़र में सूचनाएँ समर्थित नहीं।'))
      return
    }
    setPermissionBusy('notifications')
    try {
      const result = await Notification.requestPermission()
      dispatch({ type: 'permission/set', key: 'notifications', value: result === 'granted' ? 'granted' : 'denied' })
      toast(
        result === 'granted'
          ? t('Allowed. No push service exists, so alerts stay in-app.', 'अनुमत। कोई पुश सेवा नहीं, इसलिए अलर्ट ऐप में ही रहते हैं।')
          : t('Notifications were not allowed. In-app alerts still work.', 'सूचनाएँ अनुमत नहीं। ऐप के अंदर अलर्ट अभी भी काम करते हैं।'),
      )
    } finally {
      setPermissionBusy(null)
    }
  }

  const setTheme = (theme: ThemePref) =>
    dispatch({ type: 'profile/update', now: Date.now(), patch: { theme } })

  const setLang = (next: 'en' | 'hi') =>
    dispatch({ type: 'profile/update', now: Date.now(), patch: { lang: next } })

  const sos = state.settings.sos
  const setSos = (key: keyof typeof sos, value: boolean) =>
    dispatch({ type: 'settings/sos', patch: { [key]: value } })

  const consenting = state.contacts.filter((contact) => contact.aiConsent)
  const locPermission = state.profile.permissions.location
  const notifPermission = state.profile.permissions.notifications

  return (
    <>
      <TopBar title={t('Settings', 'सेटिंग्स')} back="/" />
      <div className="screen">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Profile', 'प्रोफ़ाइल')}</p>
          <div className="field">
            <label className="field-label" htmlFor="settings-name">{t('Display name', 'प्रदर्शित नाम')}</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="settings-name" className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  dispatch({ type: 'profile/update', now: Date.now(), patch: { name: name.trim() || t('Friend', 'मित्र') } })
                  toast(t('Name saved on this device.', 'नाम इस डिवाइस पर सहेजा गया।'))
                }}
              >
                {t('Save', 'सहेजें')}
              </button>
            </div>
            <p className="hint">{t('Stored locally. No account or email is created.', 'स्थानीय रूप से सहेजा। कोई खाता या ईमेल नहीं बनाया जाता।')}</p>
          </div>

          <div className="field">
            <span className="field-label">{t('Language', 'भाषा')}</span>
            <div className="segmented" role="group" aria-label={t('Language', 'भाषा')}>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
              <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>हिन्दी</button>
            </div>
            <p className="hint">{t('Map labels and third-party map data remain in English.', 'मानचित्र लेबल और तृतीय-पक्ष मानचित्र डेटा अंग्रेज़ी में रहते हैं।')}</p>
          </div>

          <div className="field">
            <span className="field-label">{t('Appearance', 'रूप')}</span>
            <div className="segmented" role="group" aria-label={t('Appearance', 'रूप')}>
              {[
                { id: 'system' as const, label: t('System', 'सिस्टम'), icon: 'monitor' as const },
                { id: 'light' as const, label: t('Light', 'हल्का'), icon: 'sun' as const },
                { id: 'dark' as const, label: t('Dark', 'गहरा'), icon: 'moon' as const },
              ].map((option) => (
                <button key={option.id} type="button" aria-pressed={state.profile.theme === option.id} onClick={() => setTheme(option.id)}>
                  <span className="row" style={{ justifyContent: 'center', gap: 5 }}>
                    <Icon name={option.icon} size={15} />
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
          <div>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('SOS actions', 'SOS क्रियाएँ')}</p>
            <p className="hint" style={{ marginTop: 2 }}>{t('These run only after a deliberate 3-second hold.', 'ये केवल जानबूझकर 3 सेकंड दबाने के बाद चलती हैं।')}</p>
          </div>
          <SwitchRow
            label={t('Share location and journey details', 'लोकेशन और यात्रा विवरण साझा करें')}
            description={t('Simulated delivery in this build.', 'इस बिल्ड में सिम्युलेटेड डिलीवरी।')}
            checked={sos.shareLocation}
            onChange={(value) => setSos('shareLocation', value)}
          />
          <SwitchRow
            label={t('Call priority contact', 'प्राथमिकता संपर्क को कॉल करें')}
            description={t('Opens the dialler. Saath cannot confirm a call was placed or answered.', 'डायलर खोलता है। साथ कॉल होने या उत्तर की पुष्टि नहीं कर सकता।')}
            checked={sos.callPriority}
            onChange={(value) => setSos('callPriority', value)}
          />
          <SwitchRow
            label={t('AI assistant call', 'AI सहायक कॉल')}
            description={t('Simulated, only with a contact’s explicit consent.', 'सिम्युलेटेड, केवल संपर्क की स्पष्ट सहमति से।')}
            checked={sos.aiCall}
            onChange={(value) => setSos('aiCall', value)}
            badge={<Chip tone="warn">{t('Simulation', 'सिम्युलेशन')}</Chip>}
            disabled={!state.settings.aiCallsAllowed}
          />
          <SwitchRow
            label={t('Show device emergency-calling option', 'डिवाइस का आपातकालीन कॉल विकल्प दिखाएँ')}
            description={t('Always available manually on the SOS screen. Never places a call from Saath.', 'SOS स्क्रीन पर मैन्युअल रूप से हमेशा उपलब्ध। साथ से कभी कॉल नहीं होती।')}
            checked={sos.openDialer}
            onChange={(value) => setSos('openDialer', value)}
          />
          <SwitchRow
            label={t('Allow simulated AI calls at all', 'सिम्युलेटेड AI कॉल की अनुमति')}
            description={
              consenting.length > 0
                ? `${consenting.length} ${t('contact(s) have consented.', 'संपर्कों ने सहमति दी है।')}`
                : t('No contact has consented yet. AI calls stay blocked.', 'अभी किसी ने सहमति नहीं दी। AI कॉल बंद रहेंगी।')
            }
            checked={state.settings.aiCallsAllowed}
            onChange={(value) => dispatch({ type: 'settings/update', patch: { aiCallsAllowed: value } })}
          />
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/contacts')}>
            <Icon name="users" size={16} />
            {t('Manage AI consent in Contacts', 'संपर्कों में AI सहमति प्रबंधित करें')}
          </button>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Check-ins and escalation', 'चेक-इन और एस्केलेशन')}</p>
            <p className="hint" style={{ marginTop: 2 }}>
              {t('Prompts are never treated as proof of danger. Escalation happens at most once per check-in.', 'अनुरोध कभी ख़तरे का प्रमाण नहीं माने जाते। प्रति चेक-इन अधिकतम एक बार एस्केलेशन होता है।')}
            </p>
          </div>
          <SwitchRow
            label={t('Safety check-ins', 'सुरक्षा चेक-इन')}
            checked={state.settings.safetyCheckins}
            onChange={(value) => dispatch({ type: 'settings/update', patch: { safetyCheckins: value } })}
          />
          <div className="field">
            <span className="field-label">{t('Check-in interval', 'चेक-इन अंतराल')}</span>
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
            <span className="field-label">{t('Unexpected stop threshold', 'अचानक रुकावट सीमा')}</span>
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
          <div className="field">
            <span className="field-label">{t('Deviation threshold', 'मार्ग विचलन सीमा')}</span>
            <div className="segmented" role="group" aria-label={t('Deviation threshold', 'मार्ग विचलन सीमा')}>
              {[150, 300, 500].map((meters) => (
                <button
                  key={meters}
                  type="button"
                  aria-pressed={state.settings.checkin.deviationMeters === meters}
                  onClick={() => dispatch({ type: 'settings/checkin', patch: { deviationMeters: meters } })}
                >
                  {meters} m
                </button>
              ))}
            </div>
            <p className="hint">{t('Used by the simulation. Live GPS deviation detection is not implemented in this PWA.', 'सिम्युलेशन में उपयोग होता है। इस PWA में लाइव GPS विचलन पहचान लागू नहीं है।')}</p>
          </div>
          <SwitchRow
            label={t('One limited escalation', 'एक सीमित एस्केलेशन')}
            description={`${t('After', 'बाद')} ${state.settings.checkin.graceSeconds}s. ${t('Simulated message to your priority contact, never repeated automatically.', 'प्राथमिकता संपर्क को सिम्युलेटेड संदेश, स्वतः कभी दोहराया नहीं।')}`}
            checked={state.settings.checkin.escalate}
            onChange={(value) => dispatch({ type: 'settings/checkin', patch: { escalate: value } })}
          />
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Default sharing for new contacts', 'नए संपर्कों के लिए डिफ़ॉल्ट साझा')}</p>
            <p className="hint" style={{ marginTop: 2 }}>{t('Each contact can still override these.', 'हर संपर्क इन्हें बदल सकता है।')}</p>
          </div>
          <SwitchRow
            label={t('Latest location', 'नवीनतम लोकेशन')}
            checked={state.settings.contactDefaults.location}
            onChange={(value) => dispatch({ type: 'settings/contactDefaults', patch: { location: value } })}
          />
          <SwitchRow
            label={t('Journey details', 'यात्रा विवरण')}
            checked={state.settings.contactDefaults.journey}
            onChange={(value) => dispatch({ type: 'settings/contactDefaults', patch: { journey: value } })}
          />
          <SwitchRow
            label={t('Notes', 'नोट्स')}
            checked={state.settings.contactDefaults.notes}
            onChange={(value) => dispatch({ type: 'settings/contactDefaults', patch: { notes: value } })}
          />
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Permissions', 'अनुमतियाँ')}</p>
          <div className="row-between" style={{ gap: 10 }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>{t('Location', 'लोकेशन')}</p>
              <p className="hint">
                {locPermission === 'granted'
                  ? t('Allowed for current position while you use the app.', 'ऐप उपयोग के दौरान वर्तमान स्थिति के लिए अनुमत।')
                  : locPermission === 'denied'
                    ? t('Denied. Manual places and simulated movement are used.', 'अस्वीकृत। मैन्युअल जगहें और सिम्युलेटेड गति उपयोग होती है।')
                    : t('Not requested yet. Everything works without it.', 'अभी नहीं माँगी। इसके बिना सब काम करता है।')}
              </p>
            </div>
            <Chip tone={locPermission === 'granted' ? 'ok' : locPermission === 'denied' ? 'warn' : 'neutral'}>
              {locPermission === 'granted' ? t('Allowed', 'अनुमत') : locPermission === 'denied' ? t('Denied', 'अस्वीकृत') : t('Not asked', 'नहीं पूछा')}
            </Chip>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={askLocation} disabled={permissionBusy !== null}>
              <Icon name="pin" size={16} />
              {permissionBusy === 'location' ? t('Checking…', 'जाँच…') : t('Allow / retry location', 'लोकेशन अनुमति दें / पुनः प्रयास')}
            </button>
          </div>
          <hr className="divider" />
          <div className="row-between" style={{ gap: 10 }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>{t('Notifications', 'सूचनाएँ')}</p>
              <p className="hint">
                {notifPermission === 'granted'
                  ? t('Allowed, but no push service is configured. Alerts stay in-app.', 'अनुमत, पर कोई पुश सेवा नहीं। अलर्ट ऐप में ही रहते हैं।')
                  : notifPermission === 'denied'
                    ? t('Denied. In-app alerts still appear.', 'अस्वीकृत। ऐप के अंदर अलर्ट अभी भी दिखते हैं।')
                    : t('Not requested yet.', 'अभी नहीं माँगी।')}
              </p>
            </div>
            <Chip tone={notifPermission === 'granted' ? 'ok' : notifPermission === 'denied' ? 'warn' : 'neutral'}>
              {notifPermission === 'granted' ? t('Allowed', 'अनुमत') : notifPermission === 'denied' ? t('Denied', 'अस्वीकृत') : t('Not asked', 'नहीं पूछा')}
            </Chip>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={askNotifications} disabled={permissionBusy !== null}>
            <Icon name="bell" size={16} />
            {permissionBusy === 'notifications' ? t('Asking…', 'पूछा जा रहा है…') : t('Ask for notifications', 'सूचनाओं की अनुमति माँगें')}
          </button>
          <p className="hint">
            {t('Microphone is requested only when you use voice input for the AI assistant.', 'माइक्रोफ़ोन केवल तब माँगा जाता है जब आप AI सहायक के लिए वाणी इनपुट उपयोग करें।')}
          </p>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row-between">
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Integration status', 'एकीकरण स्थिति')}</p>
            <button type="button" className="icon-btn" aria-label={t('Refresh integration status', 'एकीकरण स्थिति रीफ़्रेश करें')} onClick={() => void refreshHealth()} disabled={checking}>
              <Icon name="refresh" size={17} className={checking ? 'pulse-soft' : undefined} />
            </button>
          </div>
          <p className="hint">
            {t(
              'Only server-configured integrations are labelled “Configured”. The UI never says “connected” for missing services.',
              'केवल सर्वर पर कॉन्फ़िगर एकीकरण “कॉन्फ़िगर” कहे जाते हैं। अनुपलब्ध सेवाओं के लिए UI “कनेक्टेड” नहीं कहता।',
            )}
          </p>
          {[
            {
              icon: 'sparkles' as const,
              label: t('AI assistant provider', 'AI सहायक प्रदाता'),
              configured: Boolean(health?.ai.configured),
              detail: health
                ? health.ai.configured
                  ? `${t('Configured server-side', 'सर्वर पर कॉन्फ़िगर')}: ${health.ai.provider ?? '—'}`
                  : t('Not configured — on-device simulation is used.', 'कॉन्फ़िगर नहीं — ऑन-डिवाइस सिम्युलेशन उपयोग होता है।')
                : t('Status unavailable (offline or API not running). Simulation fallback is active.', 'स्थिति उपलब्ध नहीं (ऑफ़लाइन या API नहीं चल रहा)। सिम्युलेशन फ़ॉलबैक सक्रिय।'),
            },
            {
              icon: 'volume' as const,
              label: t('Cloud voice provider', 'क्लाउड वाणी प्रदाता'),
              configured: Boolean(health?.voice.configured),
              detail: health
                ? health.voice.configured
                  ? health.voice.provider
                  : t('Not configured — device speech synthesis only.', 'कॉन्फ़िगर नहीं — केवल डिवाइस वाणी संश्लेषण।')
                : t('Status unavailable.', 'स्थिति उपलब्ध नहीं।'),
            },
            {
              icon: 'share' as const,
              label: t('Location sharing backend', 'लोकेशन शेयरिंग बैकएंड'),
              configured: Boolean(health?.sharing.configured),
              detail: t('Not configured — all sharing is explicitly simulated.', 'कॉन्फ़िगर नहीं — सभी साझा करना स्पष्ट रूप से सिम्युलेटेड है।'),
            },
            {
              icon: 'alert' as const,
              label: t('Emergency services integration', 'आपातकालीन सेवा एकीकरण'),
              configured: false,
              detail: t('Not available. Saath never contacts police, ambulance or dispatchers.', 'उपलब्ध नहीं। साथ पुलिस, एम्बुलेंस या डिस्पैचर से कभी संपर्क नहीं करता।'),
            },
          ].map((item) => (
            <div key={item.label} className="row-between" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div className="row" style={{ gap: 9, alignItems: 'flex-start', flex: 1 }}>
                <span style={{ color: 'var(--saath-muted)', marginTop: 2 }}><Icon name={item.icon} size={17} /></span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</p>
                  <p className="hint">{item.detail}</p>
                </div>
              </div>
              <Chip tone={item.configured ? 'ok' : 'neutral'}>{item.configured ? t('Configured', 'कॉन्फ़िगर') : t('Not configured', 'कॉन्फ़िगर नहीं')}</Chip>
            </div>
          ))}
          {health?.voice.note ? <p className="hint">{health.voice.note}</p> : null}
          <p className="hint">
            {t(
              'Future integration note: a consenting, commercially permitted voice provider could place AI calls. ElevenLabs-style voice agents do not provide emergency-service calling and must never be presented as doing so.',
              'भविष्य का नोट: सहमति देने वाला, व्यावसायिक रूप से अनुमत वाणी प्रदाता AI कॉल कर सकता है। ElevenLabs जैसे वॉइस एजेंट आपातकालीन सेवा कॉल प्रदान नहीं करते और उन्हें ऐसा कभी नहीं बताया जाना चाहिए।',
            )}
          </p>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Install and offline', 'इंस्टॉल और ऑफ़लाइन')}</p>
          {installAvailable ? (
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={async () => {
                const outcome = await promptInstall()
                toast(
                  outcome === 'accepted'
                    ? t('Saath is being installed.', 'साथ इंस्टॉल हो रहा है।')
                    : t('Install was dismissed. You can use your browser menu to install.', 'इंस्टॉल बंद हुआ। ब्राउज़र मेनू से इंस्टॉल कर सकते हैं।'),
                )
              }}
            >
              <Icon name="download" size={18} />
              {t('Install Saath on this device', 'इस डिवाइस पर साथ इंस्टॉल करें')}
            </button>
          ) : (
            <p className="hint">
              {standalone
                ? t('Saath is running as an installed app.', 'साथ इंस्टॉल ऐप के रूप में चल रहा है।')
                : t(
                    'Installation is not available yet. Use your browser menu → “Add to Home Screen”. Installation requires HTTPS or localhost in a production build.',
                    'इंस्टॉल अभी उपलब्ध नहीं। ब्राउज़र मेनू → “होम स्क्रीन पर जोड़ें” उपयोग करें। इंस्टॉल के लिए उत्पादन बिल्ड में HTTPS या localhost आवश्यक है।',
                  )}
            </p>
          )}
          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('PWA limitations you should know', 'PWA की सीमाएँ जो आपको पता होनी चाहिए')}</p>
            <p className="hint">
              {t(
                'Background location tracking is not supported. Journey progress, sharing updates and check-in timers pause when the browser or installed app is fully closed. Keep Saath open on the Journey screen.',
                'बैकग्राउंड लोकेशन ट्रैकिंग समर्थित नहीं है। ब्राउज़र या इंस्टॉल ऐप पूरी तरह बंद होने पर यात्रा प्रगति, साझा अपडेट और चेक-इन टाइमर रुक जाते हैं। साथ को यात्रा स्क्रीन पर खुला रखें।',
              )}
            </p>
            <p className="hint">
              {t(
                'Offline app-shell caching works in production builds after the first visit. The development preview does not install the service worker. Live routing and simulated delivery pause offline.',
                'ऑफ़लाइन ऐप-शेल कैशिंग पहली विज़िट के बाद उत्पादन बिल्ड में काम करती है। डेवलपमेंट प्रीव्यू सर्विस वर्कर इंस्टॉल नहीं करता। ऑफ़लाइन होने पर लाइव रूटिंग और सिम्युलेटेड डिलीवरी रुकती है।',
              )}
            </p>
            <p className="hint">
              {t(
                'iOS may limit storage and may evict it. The app has no server backup, so clearing browser data deletes your contacts and reports.',
                'iOS संग्रहण सीमित कर सकता है और हटा सकता है। ऐप का सर्वर बैकअप नहीं है, इसलिए ब्राउज़र डेटा साफ़ करने पर संपर्क और रिपोर्ट हट जाती हैं।',
              )}
            </p>
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Data and privacy', 'डेटा और गोपनीयता')}</p>
          <p className="hint">
            {t(
              'Contacts, journeys, reports, alerts and preferences are stored in this browser only. Request logs do not include names, contact numbers or precise locations.',
              'संपर्क, यात्राएँ, रिपोर्ट, अलर्ट और प्राथमिकताएँ केवल इस ब्राउज़र में सहेजे जाते हैं। अनुरोध लॉग में नाम, संपर्क नंबर या सटीक लोकेशन शामिल नहीं होते।',
            )}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/reports')}>
              <Icon name="flag" size={16} />
              {t('Manage reports', 'रिपोर्ट प्रबंधित करें')}
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setClearOpen(true)}>
              <Icon name="trash" size={16} />
              {t('Clear journeys and alerts', 'यात्राएँ और अलर्ट साफ़ करें')}
            </button>
          </div>
          <button type="button" className="btn btn-danger-soft btn-block" onClick={() => setResetOpen(true)}>
            {t('Delete all app data', 'सारा ऐप डेटा हटाएँ')}
          </button>
          <p className="hint">
            {t(
              'Deleting all data removes contacts, journeys, reports, alerts and settings from this browser. It cannot be undone.',
              'सारा डेटा हटाने पर इस ब्राउज़र से संपर्क, यात्राएँ, रिपोर्ट, अलर्ट और सेटिंग्स हट जाती हैं। इसे वापस नहीं लिया जा सकता।',
            )}
          </p>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('About this MVP', 'इस MVP के बारे में')}</p>
          <div className="row-between">
            <span className="hint">{t('Version', 'संस्करण')}</span>
            <span style={{ fontSize: '0.88rem' }}>0.1.0 · MVP</span>
          </div>
          <div className="row-between">
            <span className="hint">{t('Route data', 'मार्ग डेटा')}</span>
            <span style={{ fontSize: '0.88rem' }}>{t('Sample dataset + live OSRM geometry', 'नमूना डेटासेट + लाइव OSRM ज्यामिति')}</span>
          </div>
          <div className="row-between">
            <span className="hint">{t('Maps', 'मानचित्र')}</span>
            <span style={{ fontSize: '0.88rem' }}>OpenStreetMap · CARTO</span>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/demo')}>
            <Icon name="sparkles" size={16} />
            {t('Open demo walkthrough', 'डेमो वॉकथ्रू खोलें')}
          </button>
          <p className="hint">
            {t(
              'Saath is a demonstration, not an emergency service. It does not guarantee safety, measure crowds or predict crime. AI cannot invent incidents, locations, responses or acknowledgements.',
              'साथ एक प्रदर्शन है, आपातकालीन सेवा नहीं। यह सुरक्षा की गारंटी नहीं देता, भीड़ नहीं मापता या अपराध का अनुमान नहीं लगाता। AI घटनाएँ, स्थान, प्रतिक्रियाएँ या पुष्टि नहीं गढ़ सकता।',
            )}
          </p>
        </section>
      </div>

      <Sheet open={clearOpen} onClose={() => setClearOpen(false)} title={t('Clear journeys and alerts?', 'यात्राएँ और अलर्ट साफ़ करें?')}>
        <p className="hint">
          {t(
            'This removes your journey history, SOS state, alerts and reports, but keeps your contacts and settings.',
            'यह आपकी यात्रा इतिहास, SOS स्थिति, अलर्ट और रिपोर्ट हटाता है, पर संपर्क और सेटिंग्स रखता है।',
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setClearOpen(false)}>{t('Cancel', 'रद्द करें')}</button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              dispatch({ type: 'data/clear', now: Date.now() })
              setClearOpen(false)
              toast(t('Journeys, alerts and reports cleared.', 'यात्राएँ, अलर्ट और रिपोर्ट साफ़ हुए।'))
            }}
          >
            {t('Clear', 'साफ़ करें')}
          </button>
        </div>
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={t('Delete all app data?', 'सारा ऐप डेटा हटाएँ?')}>
        <Banner tone="danger" icon="alert" title={t('This cannot be undone', 'इसे वापस नहीं लिया जा सकता')}>
          {t(
            'Your contacts, journey, SOS state, reports, alerts and preferences will be deleted from this browser. You will return to onboarding.',
            'आपके संपर्क, यात्रा, SOS स्थिति, रिपोर्ट, अलर्ट और प्राथमिकताएँ इस ब्राउज़र से हट जाएंगी। आप ऑनबोर्डिंग पर लौटेंगे।',
          )}
        </Banner>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setResetOpen(false)}>{t('Keep data', 'डेटा रखें')}</button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              clearStorage()
              dispatch({ type: 'data/reset', now: Date.now() })
              setResetOpen(false)
              toast(t('All app data deleted from this browser.', 'इस ब्राउज़र से सारा ऐप डेटा हटाया गया।'))
            }}
          >
            {t('Delete everything', 'सब कुछ हटाएँ')}
          </button>
        </div>
      </Sheet>
    </>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_DESTINATION, DEMO_START } from '@shared/demo'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, TopBar } from '../components/ui'
import { buildDemoPlan } from '../lib/planner'
import { formatTime } from '../lib/i18n'
import { shareExpired } from '@shared/tokens'

export default function DemoScreen() {
  const { state, dispatch, t, lang, now, online, forcedOffline, setForcedOffline, toast } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const journey = state.journey
  const sos = state.sos
  const plan = state.plan

  const history = journey?.checkin.history ?? []
  const shareStepDone = Boolean(
    sos?.actions.some((action) => action.kind === 'share' && ['sent', 'delivered', 'acknowledged'].includes(action.state)),
  )
  const aiStepDone = Boolean(
    sos?.actions.some((action) => action.kind === 'ai' && ['calling', 'answered', 'acknowledged', 'unanswered'].includes(action.state)),
  )
  const steps = useMemo(
    () => [
      {
        n: 1,
        en: 'Compare two routes',
        hi: 'दो मार्गों की तुलना',
        body: t(
          'Open the planner with the sample area loaded and check the recommendation reasons.',
          'नमूना क्षेत्र के साथ प्लानर खोलें और सुझाव के कारण देखें।',
        ),
        done: Boolean(plan && plan.routes.length >= 2),
        action: t('Open comparison', 'तुलना खोलें'),
      },
      {
        n: 2,
        en: 'Start Journey Mode',
        hi: 'यात्रा मोड शुरू करें',
        body: t('Start the recommended route and begin simulated sharing.', 'सुझाया मार्ग शुरू करें और सिम्युलेटेड साझा शुरू करें।'),
        done: Boolean(journey),
        action: t('Start journey', 'यात्रा शुरू करें'),
      },
      {
        n: 3,
        en: 'Simulate a route deviation',
        hi: 'मार्ग विचलन सिम्युलेट करें',
        body: t('Inject an off-route event. It raises a check-in, never a danger label.', 'मार्ग से हटने की घटना जोड़ें। यह चेक-इन माँगती है, ख़तरे का लेबल नहीं।'),
        done: history.some((event) => event.kind === 'deviation'),
        action: t('Simulate deviation', 'विचलन सिम्युलेट'),
      },
      {
        n: 4,
        en: 'Trigger a check-in',
        hi: 'चेक-इन ट्रिगर करें',
        body: t('See the prompt with “I’m okay”, “Update my journey” and “I need help”.', '“मैं ठीक हूँ”, “यात्रा अपडेट” और “मदद चाहिए” के साथ अनुरोध देखें।'),
        done: history.length > 0,
        action: t('Open check-in', 'चेक-इन खोलें'),
      },
      {
        n: 5,
        en: 'Activate SOS',
        hi: 'SOS सक्रिय करें',
        body: t('Use the deliberate hold gesture. Nothing is sent until the hold completes.', 'जानबूझकर दबाए रखें। पूरा होने तक कुछ नहीं भेजा जाता।'),
        done: Boolean(sos),
        action: t('Open SOS', 'SOS खोलें'),
      },
      {
        n: 6,
        en: 'Share a simulated location',
        hi: 'सिम्युलेटेड लोकेशन साझा करें',
        body: t('Watch the share action move from pending to sent to simulated delivery.', 'साझा क्रिया को लंबित से भेजा और सिम्युलेटेड डिलीवरी तक जाते देखें।'),
        done: shareStepDone,
        action: t('Open sharing', 'साझा खोलें'),
      },
      {
        n: 7,
        en: 'Run the AI conversation',
        hi: 'AI बातचीत चलाएँ',
        body: t('Start the simulated assistant call with a consenting contact.', 'सहमति वाले संपर्क के साथ सिम्युलेटेड सहायक कॉल शुरू करें।'),
        done: aiStepDone,
        action: t('Open AI call', 'AI कॉल खोलें'),
      },
      {
        n: 8,
        en: 'Receive an acknowledgement',
        hi: 'पुष्टि प्राप्त करें',
        body: t('Reply as the contact that you acknowledge the alert. The caveat stays visible.', 'संपर्क के रूप में अलर्ट की पुष्टि करें। स्पष्टीकरण दिखता रहेगा।'),
        done: Boolean(sos?.ack),
        action: t('Open AI call', 'AI कॉल खोलें'),
      },
      {
        n: 9,
        en: 'End the journey and revoke sharing',
        hi: 'यात्रा समाप्त करें और साझा रद्द करें',
        body: t('Ending must stop the journey sharing session immediately.', 'समाप्त करने पर यात्रा साझा सत्र तुरंत बंद होना चाहिए।'),
        done: Boolean(journey?.status === 'ended' && journey.sharing.revokedAt),
        action: t('End journey', 'यात्रा समाप्त'),
      },
    ],
    [plan, journey, sos, history, shareStepDone, aiStepDone, t],
  )

  const completed = steps.filter((step) => step.done).length

  const ensurePlan = () => {
    const existing = state.plan
    if (existing) return existing
    const created = buildDemoPlan(DEMO_START, DEMO_DESTINATION, state.reports, Date.now())
    dispatch({ type: 'plan/set', plan: created })
    return created
  }

  const runStep = (n: number) => {
    setBusy(true)
    window.setTimeout(() => setBusy(false), 350)
    switch (n) {
      case 1: {
        dispatch({ type: 'demo/seed', now: Date.now() })
        const created = buildDemoPlan(DEMO_START, DEMO_DESTINATION, state.reports, Date.now())
        dispatch({ type: 'plan/set', plan: created })
        navigate('/plan')
        return
      }
      case 2: {
        if (journey && journey.status !== 'ended') {
          navigate('/journey')
          return
        }
        const prepared = ensurePlan()
        const route = prepared.routes.find((item) => item.id === prepared.recommendedId) ?? prepared.routes[0]
        dispatch({
          type: 'journey/start',
          now: Date.now(),
          route,
          start: prepared.start,
          destination: prepared.destination,
        })
        navigate('/journey')
        return
      }
      case 3: {
        if (!journey || journey.status !== 'active') {
          toast(t('Start the demo journey first (step 2).', 'पहले डेमो यात्रा शुरू करें (चरण 2)।'))
          return
        }
        dispatch({ type: 'journey/simulate', now: Date.now(), kind: 'deviation' })
        navigate('/journey')
        toast(t('Deviation simulated. One check-in prompt was created.', 'विचलन सिम्युलेटेड। एक चेक-इन अनुरोध बना।'))
        return
      }
      case 4:
        navigate('/journey')
        return
      case 5:
        navigate('/sos')
        return
      case 6:
        navigate('/share')
        return
      case 7:
      case 8:
        navigate('/sos/assist')
        return
      case 9:
        if (!journey) {
          toast(t('Start the demo journey first.', 'पहले डेमो यात्रा शुरू करें।'))
          return
        }
        dispatch({ type: 'journey/end', now: Date.now() })
        navigate('/journey')
        toast(t('Journey ended. Sharing was revoked.', 'यात्रा समाप्त। साझा करना रद्द हुआ।'))
        return
      default:
        return
    }
  }

  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const alert of state.alerts) {
      if (seen.has(alert.dedupeKey)) duplicates.push(alert.dedupeKey)
      seen.add(alert.dedupeKey)
    }
    return duplicates
  }, [state.alerts])

  const sessions = [state.journey?.sharing, state.sos?.share].filter(Boolean)
  const anyExpired = sessions.some((session) => session && shareExpired(session, now))
  const activeSos = sos?.status === 'active'
  const journeyActive = journey?.status === 'active'

  const startOver = () => {
    if (journey && journey.status !== 'ended') dispatch({ type: 'journey/end', now: Date.now() })
    if (activeSos) dispatch({ type: 'sos/cancel', now: Date.now(), reason: 'Demo reset' })
    dispatch({ type: 'plan/set', plan: null })
    toast(t('Demo journey and alert reset. Contacts stay saved.', 'डेमो यात्रा और अलर्ट रीसेट। संपर्क सहेजे रहे।'))
  }

  return (
    <>
      <TopBar title={t('Demo walkthrough', 'डेमो वॉकथ्रू')} subtitle={`${completed}/9 ${t('steps complete', 'चरण पूर्ण')}`} back="/" />
      <div className="screen">
        <Banner tone="warn" icon="sparkles" title={t('Fictional data, local simulation', 'काल्पनिक डेटा, स्थानीय सिम्युलेशन')}>
          {t(
            'This walkthrough uses fictional contacts, sample route observations and scripted AI calls. No real contact, telephony provider or emergency service is involved.',
            'यह वॉकथ्रू काल्पनिक संपर्क, नमूना मार्ग अवलोकन और स्क्रिप्टेड AI कॉल उपयोग करता है। कोई वास्तविक संपर्क, टेलीफ़ोनी प्रदाता या आपातकालीन सेवा शामिल नहीं है।',
          )}
        </Banner>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="row-between">
            <div>
              <p className="section-title">{t('Nine-step journey', 'नौ-चरणीय यात्रा')}</p>
              <p className="hint">{t('Each step checks the real app state, not a slide deck.', 'हर चरण वास्तविक ऐप स्थिति जाँचता है, स्लाइड नहीं।')}</p>
            </div>
            <Chip tone={completed === 9 ? 'ok' : 'brand'}>{completed}/9</Chip>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${(completed / 9) * 100}%` }} />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                dispatch({ type: 'demo/seed', now: Date.now() })
                toast(t('Fictional demo contacts and sample reports loaded.', 'काल्पनिक डेमो संपर्क और नमूना रिपोर्ट लोड हुए।'))
              }}
            >
              <Icon name="users" size={16} />
              {t('Load demo data', 'डेमो डेटा लोड करें')}
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={startOver}>
              <Icon name="undo" size={16} />
              {t('Reset demo run', 'डेमो रन रीसेट')}
            </button>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((step) => (
            <div
              key={step.n}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                borderColor: step.done ? 'color-mix(in srgb, var(--saath-ok) 45%, var(--saath-line))' : undefined,
                padding: 15,
              }}
            >
              <div className="row-between" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      flex: '0 0 auto',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 750,
                      fontSize: '0.85rem',
                      background: step.done ? 'color-mix(in srgb, var(--saath-ok) 18%, transparent)' : 'var(--saath-surface-2)',
                      color: step.done ? 'var(--saath-ok)' : 'var(--saath-muted)',
                      border: '1px solid var(--saath-line)',
                    }}
                  >
                    {step.done ? <Icon name="check" size={15} /> : step.n}
                  </span>
                  <div>
                    <p style={{ fontWeight: 680, fontSize: '0.94rem' }}>{lang === 'hi' ? step.hi : step.en}</p>
                    <p className="hint" style={{ marginTop: 2 }}>{step.body}</p>
                  </div>
                </div>
                {step.done ? <Chip tone="ok">{t('Done', 'पूर्ण')}</Chip> : null}
              </div>
              {!step.done ? (
                <button type="button" className="btn btn-sm btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => runStep(step.n)} disabled={busy}>
                  {step.action}
                  <Icon name="chevronRight" size={15} />
                </button>
              ) : null}
              {step.n === 6 && !step.done ? (
                <p className="hint">{t('Wait a few seconds on the SOS screen for the simulated delivery state to advance.', 'सिम्युलेटेड डिलीवरी स्थिति बढ़ने के लिए SOS स्क्रीन पर कुछ सेकंड रुकें।')}</p>
              ) : null}
            </div>
          ))}
        </div>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Edge-case checks', 'सीमा-स्थिति जाँच')}</p>
            <p className="hint" style={{ marginTop: 2 }}>
              {t('These controls make failure states easy to inspect. They are demonstrations, not live conditions.', 'ये नियंत्रण विफलता स्थितियाँ देखना आसान बनाते हैं। ये प्रदर्शन हैं, वास्तविक स्थितियाँ नहीं।')}
            </p>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('Permission denial', 'अनुमति अस्वीकृति')}</p>
              <Chip tone={state.profile.permissions.location === 'denied' ? 'warn' : 'neutral'}>
                {state.profile.permissions.location === 'denied' ? t('Denied', 'अस्वीकृत') : t('Not denied', 'अस्वीकृत नहीं')}
              </Chip>
            </div>
            <p className="hint">{t('Explains manual entry and simulated movement without location permission.', 'लोकेशन अनुमति के बिना मैन्युअल प्रविष्टि और सिम्युलेटेड गति समझाता है।')}</p>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                dispatch({ type: 'permission/set', key: 'location', value: 'denied' })
                toast(t('Location permission recorded as denied (local simulation).', 'लोकेशन अनुमति अस्वीकृत दर्ज (स्थानीय सिम्युलेशन)।'))
              }}
            >
              {t('Simulate denial', 'अस्वीकृति सिम्युलेट')}
            </button>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('Network loss', 'नेटवर्क हानि')}</p>
              <Chip tone={online ? 'ok' : 'warn'}>{online ? t('Online', 'ऑनलाइन') : t('Offline', 'ऑफ़लाइन')}</Chip>
            </div>
            <p className="hint">{t('Forces the offline UI and pauses simulated delivery. Check-in timers continue locally. Your actual network is not changed.', 'ऑफ़लाइन UI बाध्य करता है और सिम्युलेटेड डिलीवरी रोकता है। चेक-इन टाइमर स्थानीय रूप से चलते हैं। वास्तविक नेटवर्क नहीं बदलता।')}</p>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setForcedOffline(!forcedOffline)}>
              {forcedOffline ? t('Restore simulated network', 'सिम्युलेटेड नेटवर्क बहाल करें') : t('Simulate network loss', 'नेटवर्क हानि सिम्युलेट')}
            </button>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('Unanswered calls', 'अनुत्तरित कॉल')}</p>
              <Chip tone={sos?.actions.some((action) => action.state === 'unanswered') ? 'warn' : 'neutral'}>
                {sos?.actions.some((action) => action.state === 'unanswered') ? t('Recorded', 'दर्ज') : t('Not recorded', 'दर्ज नहीं')}
              </Chip>
            </div>
            <p className="hint">{t('Marked explicitly. Saath never infers delivery or an answer.', 'स्पष्ट रूप से चिह्नित। साथ डिलीवरी या उत्तर का अनुमान नहीं लगाता।')}</p>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/sos')}>
              {t('Open call states', 'कॉल स्थितियाँ खोलें')}
            </button>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('Duplicate triggers', 'डुप्लिकेट ट्रिगर')}</p>
              <Chip tone={duplicateKeys.length === 0 ? 'ok' : 'danger'}>
                {duplicateKeys.length === 0 ? t('No duplicates', 'कोई डुप्लिकेट नहीं') : `${duplicateKeys.length} ${t('duplicates', 'डुप्लिकेट')}`}
              </Chip>
            </div>
            <p className="hint">
              {state.alerts.length} {t('alerts stored. Overlapping check-in events share one dedupe key by design.', 'अलर्ट सहेजे। ओवरलैपिंग चेक-इन घटनाएँ एक ही डिडुप्लिकेशन कुंजी साझा करती हैं।')}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!journeyActive || Boolean(journey?.checkin.pending)}
              onClick={() => {
                const at = Date.now()
                dispatch({ type: 'journey/simulate', now: at, kind: 'deviation' })
                dispatch({ type: 'journey/simulate', now: at + 1, kind: 'deviation' })
                toast(t('Triggered twice. Only one pending check-in exists.', 'दो बार ट्रिगर। केवल एक लंबित चेक-इन है।'))
              }}
            >
              {t('Fire duplicate trigger', 'डुप्लिकेट ट्रिगर चलाएँ')}
            </button>
            {!journeyActive ? <p className="hint">{t('Run steps 2–3 first.', 'पहले चरण 2–3 चलाएँ।')}</p> : null}
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('Expired and revoked links', 'समाप्त और रद्द लिंक')}</p>
              <Chip tone={anyExpired ? 'warn' : 'neutral'}>{anyExpired ? t('Expired', 'समाप्त') : t('Not expired', 'समाप्त नहीं')}</Chip>
            </div>
            <p className="hint">
              {t(
                'Sessions expire after 4 h (journey) or 2 h (SOS) and can be revoked immediately. Unit tests cover expiry and revocation; the Share screen shows the live countdown.',
                'सत्र 4 घंटे (यात्रा) या 2 घंटे (SOS) बाद समाप्त होते हैं और तुरंत रद्द किए जा सकते हैं। यूनिट टेस्ट समाप्ति और रद्दीकरण कवर करते हैं; साझा स्क्रीन लाइव काउंटडाउन दिखाती है।',
              )}
            </p>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/share')}>
              {t('Inspect sharing session', 'साझा सत्र देखें')}
            </button>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-between">
              <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{t('Cancellation', 'रद्दीकरण')}</p>
              <Chip tone={sos?.status === 'cancelled' ? 'neutral' : 'brand'}>
                {sos?.status === 'cancelled' ? t('Cancelled', 'रद्द') : sos?.status === 'active' ? t('SOS active', 'SOS सक्रिय') : t('No alert', 'कोई अलर्ट नहीं')}
              </Chip>
            </div>
            <p className="hint">{t('Cancellation revokes the SOS share session and stops pending simulated sends.', 'रद्द करने से SOS साझा सत्र रद्द होता है और लंबित सिम्युलेटेड भेजना रुकता है।')}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/sos')}>
                {t('Open SOS', 'SOS खोलें')}
              </button>
              {activeSos ? (
                <button
                  type="button"
                  className="btn btn-sm btn-danger-soft"
                  onClick={() => {
                    dispatch({ type: 'sos/cancel', now: Date.now(), reason: 'Demo cancellation check' })
                    toast(t('SOS cancelled for the demo. Sharing was revoked.', 'डेमो के लिए SOS रद्द। साझा करना रद्द हुआ।'))
                  }}
                >
                  {t('Cancel SOS now', 'SOS अभी रद्द करें')}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('Current demo state', 'वर्तमान डेमो स्थिति')}</p>
          {[
            [t('Plan', 'योजना'), plan ? `${plan.routes.length} ${t('routes', 'मार्ग')} · ${formatTime(plan.createdAt, lang)}` : t('None', 'कोई नहीं')],
            [t('Journey', 'यात्रा'), journey ? journey.status : t('None', 'कोई नहीं')],
            [t('Sharing', 'साझा'), journey?.sharing.revokedAt ? t('Revoked', 'रद्द') : journey ? t('Journey session', 'यात्रा सत्र') : t('None', 'कोई नहीं')],
            [t('SOS', 'SOS'), sos ? sos.status : t('None', 'कोई नहीं')],
            [t('Acknowledgement', 'पुष्टि'), sos?.ack ? formatTime(sos.ack.at, lang) : t('None', 'कोई नहीं')],
          ].map(([label, value]) => (
            <div key={label} className="row-between">
              <span className="hint">{label}</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

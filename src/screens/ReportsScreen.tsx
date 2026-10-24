import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LatLng, Report, ReportAiSuggestion, ReportCategory } from '@shared/types'
import {
  REPORT_CATEGORIES,
  categoryLabel,
  findDuplicates,
  interpretReportLocally,
  redactForDisplay,
} from '@shared/reporting'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, ReportStatusChip, Sheet, SwitchRow, TopBar } from '../components/ui'
import { formatDateTime, formatTime } from '../lib/i18n'
import { getHealth, requestRemoteReportSuggestion } from '../lib/ai'
import { requestPosition } from '../lib/geo'

export default function ReportsScreen() {
  const { state, dispatch, t, lang, now, toast } = useApp()
  const navigate = useNavigate()
  const [category, setCategory] = useState<ReportCategory>('lighting')
  const [description, setDescription] = useState('')
  const [areaLabel, setAreaLabel] = useState(t('Koramangala 5th Block, coarse area', 'कोरमंगला 5वाँ ब्लॉक, मोटा क्षेत्र'))
  const [attachLocation, setAttachLocation] = useState(false)
  const [coarseLocation, setCoarseLocation] = useState<LatLng | null>(null)
  const [shareWithRoutes, setShareWithRoutes] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ report: Report; suggestion: ReportAiSuggestion; duplicates: Report[] } | null>(null)
  const [providerConfigured, setProviderConfigured] = useState(false)
  const [moderating, setModerating] = useState<Report | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null)

  useEffect(() => {
    getHealth().then((health) => setProviderConfigured(Boolean(health?.ai.configured)))
  }, [])

  const pending = state.reports.filter((report) => report.status === 'pending')
  const approved = state.reports.filter((report) => report.status === 'approved')
  const rejected = state.reports.filter((report) => report.status === 'rejected')
  const myReports = [...state.reports].sort((a, b) => b.createdAt - a.createdAt)

  const toggleLocation = async (next: boolean) => {
    if (!next) {
      setAttachLocation(false)
      setCoarseLocation(null)
      return
    }
    try {
      const position = await requestPosition()
      setAttachLocation(true)
      setCoarseLocation({
        lat: Math.round(position.lat * 1000) / 1000,
        lng: Math.round(position.lng * 1000) / 1000,
      })
      dispatch({ type: 'permission/set', key: 'location', value: 'granted' })
    } catch {
      setAttachLocation(false)
      setError(
        t(
          'Approximate location could not be attached because permission was not available. You can still submit without it.',
          'अनुमति उपलब्ध न होने के कारण अनुमानित लोकेशन नहीं जुड़ी। आप बिना इसके भी रिपोर्ट भेज सकते हैं।',
        ),
      )
    }
  }

  const submit = async () => {
    setError(null)
    if (description.trim().length < 15) {
      setError(t('Please describe the concern in at least 15 characters.', 'कृपया चिंता कम से कम 15 अक्षरों में बताएँ।'))
      return
    }
    if (!acknowledged) {
      setError(t('Please confirm that you have not included names or identifying details.', 'कृपया पुष्टि करें कि आपने नाम या पहचान की जानकारी शामिल नहीं की।'))
      return
    }
    setSubmitting(true)
    try {
      const local = interpretReportLocally({
        description,
        category,
        reports: state.reports,
        location: coarseLocation,
        now,
        lang,
      })
      let suggestion: ReportAiSuggestion = local
      if (providerConfigured) {
        const remote = await requestRemoteReportSuggestion({
          description,
          category,
          lang,
          existing: state.reports.slice(0, 30).map((report) => ({
            id: report.id,
            category: report.category,
            description: report.description,
          })),
        })
        if (remote) suggestion = remote
      }
      const duplicates = findDuplicates(state.reports, suggestion.category, coarseLocation, now)
      const id = `report-${crypto.randomUUID()}`
      const report: Report = {
        id,
        createdAt: now,
        category: suggestion.category,
        description: description.trim(),
        areaLabel: areaLabel.trim() || t('Area not specified', 'क्षेत्र नहीं बताया'),
        coarseLocation,
        status: 'pending',
        anonymous: true,
        aiSuggestion: suggestion,
        moderation: null,
        shareWithRoutes,
      }
      dispatch({ type: 'report/add', report })
      setResult({ report, suggestion, duplicates })
      setDescription('')
      setAcknowledged(false)
      setAttachLocation(false)
      setCoarseLocation(null)
    } finally {
      setSubmitting(false)
    }
  }

  const moderate = (report: Report, decision: 'approved' | 'rejected') => {
    dispatch({
      type: 'report/moderate',
      id: report.id,
      now: Date.now(),
      decision,
      reason: decision === 'approved' ? 'Demo moderator review' : 'Demo moderator rejected',
    })
    setModerating(null)
    toast(
      decision === 'approved'
        ? t('Report approved in the demo queue. Re-compare routes to include it.', 'डेमो कतार में रिपोर्ट स्वीकृत। शामिल करने के लिए मार्ग फिर तुलना करें।')
        : t('Report rejected. It will not appear publicly or affect routes.', 'रिपोर्ट अस्वीकृत। यह सार्वजनिक नहीं दिखेगी या मार्गों को प्रभावित नहीं करेगी।'),
    )
  }

  return (
    <>
      <TopBar
        title={t('Community reports', 'समुदाय रिपोर्ट')}
        subtitle={t('Anonymous, moderated, never public immediately', 'गुमनाम, मॉडरेटेड, तुरंत सार्वजनिक नहीं')}
        back="/"
      />
      <div className="screen">
        <Banner tone="brand" icon="lock" title={t('Report the place, not a person', 'जगह की रिपोर्ट करें, व्यक्ति की नहीं')}>
          {t(
            'Reports are anonymous and voluntary. Do not include names, descriptions of people or exact home addresses. Nothing appears publicly until a moderator approves it.',
            'रिपोर्ट गुमनाम और स्वैच्छिक हैं। नाम, लोगों का विवरण या सटीक घर का पता शामिल न करें। मॉडरेटर स्वीकृति तक कुछ सार्वजनिक नहीं होता।',
          )}
        </Banner>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <p className="section-title">{t('Report an environment concern', 'पर्यावरण संबंधी चिंता रिपोर्ट करें')}</p>
            <p className="hint" style={{ marginTop: 3 }}>
              {t('Lighting, walkways, a blocked path, harassment or a transport stop. Your identity is not stored.', 'रोशनी, फुटपाथ, बंद रास्ता, उत्पीड़न या परिवहन स्टॉप। आपकी पहचान सहेजी नहीं जाती।')}
            </p>
          </div>

          <div className="field">
            <span className="field-label">{t('Category', 'श्रेणी')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {REPORT_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip ${category === item.id ? 'chip-brand' : 'chip-neutral'}`}
                  style={{ minHeight: 36, paddingInline: 12, borderWidth: 1 }}
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                >
                  {item.label[lang === 'hi' ? 1 : 0]}
                </button>
              ))}
            </div>
            <p className="hint">{REPORT_CATEGORIES.find((item) => item.id === category)?.hint[lang === 'hi' ? 1 : 0]}</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="report-description">{t('What did you notice?', 'आपने क्या देखा?')}</label>
            <textarea
              id="report-description"
              className="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              placeholder={t('E.g. two street lights are out beside the park gate; the lane is dark for about 40 metres.', 'जैसे पार्क गेट के पास दो स्ट्रीट लाइट बंद हैं; गली लगभग 40 मीटर अंधेरी है।')}
            />
            <div className="row-between">
              <span className="hint">{t('No names, phone numbers or identifying details.', 'कोई नाम, फ़ोन नंबर या पहचान की जानकारी नहीं।')}</span>
              <span className="hint">{description.length}/280</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="report-area">{t('Approximate area', 'अनुमानित क्षेत्र')}</label>
            <input id="report-area" className="input" value={areaLabel} onChange={(event) => setAreaLabel(event.target.value)} maxLength={80} />
            <p className="hint">{t('Describe a street or landmark, not a home address.', 'घर का पता नहीं, गली या पहचान-चिह्न बताएँ।')}</p>
          </div>

          <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SwitchRow
              label={t('Attach approximate location', 'अनुमानित लोकेशन जोड़ें')}
              description={
                coarseLocation
                  ? `${coarseLocation.lat.toFixed(3)}, ${coarseLocation.lng.toFixed(3)} · ${t('rounded to about 110 m', 'लगभग 110 मी तक पूर्णांकित')}`
                  : t('Rounded to roughly 110 m. Permission is requested only if you enable this.', 'लगभग 110 मी तक पूर्णांकित। सक्रिय करने पर ही अनुमति माँगी जाएगी।')
              }
              checked={attachLocation}
              onChange={(next) => void toggleLocation(next)}
            />
            <SwitchRow
              label={t('Allow this report to inform route comparisons after approval', 'स्वीकृति के बाद इसे मार्ग तुलना में उपयोग करने दें')}
              description={t('Only approved reports are used. Reports never change a route automatically.', 'केवल स्वीकृत रिपोर्ट उपयोग होती हैं। रिपोर्ट मार्ग स्वतः नहीं बदलती।')}
              checked={shareWithRoutes}
              onChange={setShareWithRoutes}
            />
          </div>

          <label className="row" style={{ alignItems: 'flex-start', gap: 9, fontSize: '0.87rem' }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--saath-brand-strong)', flex: '0 0 auto' }}
            />
            <span>
              {t(
                'This is an environment concern, not an accusation against an identifiable person. I have removed names and identifying details.',
                'यह पर्यावरण संबंधी चिंता है, किसी पहचान योग्य व्यक्ति पर आरोप नहीं। मैंने नाम और पहचान की जानकारी हटा दी है।',
              )}
            </span>
          </label>

          {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}

          <button type="button" className="btn btn-primary btn-block" onClick={() => void submit()} disabled={submitting}>
            <Icon name="flag" size={19} />
            {submitting ? t('Sending to moderation…', 'मॉडरेशन को भेजा जा रहा है…') : t('Send to moderation queue', 'मॉडरेशन कतार में भेजें')}
          </button>
          <p className="hint">
            {t('Your report stays private and pending until a moderator reviews it. Saath never publishes a precise journey or an accusation.', 'मॉडरेटर समीक्षा तक रिपोर्ट निजी और लंबित रहती है। साथ सटीक यात्रा या आरोप कभी सार्वजनिक नहीं करता।')}
          </p>
        </section>

        {result ? (
          <Sheet open={Boolean(result)} onClose={() => setResult(null)} title={t('Report in moderation queue', 'रिपोर्ट मॉडरेशन कतार में')}>
            <Banner tone="brand" icon="clock" title={t('Not public yet', 'अभी सार्वजनिक नहीं')}>
              {t('A moderator must review this before it can appear publicly or affect a route comparison.', 'सार्वजनिक होने या मार्ग तुलना को प्रभावित करने से पहले मॉडरेटर को इसे देखना होगा।')}
            </Banner>
            <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <p style={{ fontWeight: 650 }}>{categoryLabel(result.suggestion.category, lang)}</p>
              <p className="hint">{redactForDisplay(result.report.description)}</p>
              <p className="hint">{result.report.areaLabel} · {formatDateTime(result.report.createdAt, lang)}</p>
            </div>
            <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="row-between">
                <p style={{ fontWeight: 650, fontSize: '0.92rem' }}>{t('Interpretation assistant', 'व्याख्या सहायक')}</p>
                <Chip tone={result.suggestion.source === 'provider' ? 'brand' : 'neutral'}>
                  {result.suggestion.source === 'provider' ? t('AI provider', 'AI प्रदाता') : t('On-device rules', 'ऑन-डिवाइस नियम')}
                </Chip>
              </div>
              <p className="hint">{result.suggestion.note}</p>
              {result.duplicates.length > 0 ? (
                <div>
                  <p className="hint" style={{ fontWeight: 650 }}>{t('Possible related reports', 'संभावित संबंधित रिपोर्ट')}</p>
                  {result.duplicates.map((duplicate) => (
                    <p key={duplicate.id} className="hint">
                      · {redactForDisplay(duplicate.description)} ({formatTime(duplicate.createdAt, lang)})
                    </p>
                  ))}
                  <p className="hint">{t('Nothing is merged automatically. A moderator decides.', 'कुछ भी स्वतः नहीं मिलाया जाता। मॉडरेटर तय करता है।')}</p>
                </div>
              ) : null}
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setResult(null)}>
              {t('Done', 'ठीक है')}
            </button>
          </Sheet>
        ) : null}

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row-between">
            <div>
              <p className="section-title" style={{ fontSize: '1rem' }}>{t('Moderation queue', 'मॉडरेशन कतार')}</p>
              <p className="hint">{t('Demo moderator controls', 'डेमो मॉडरेटर नियंत्रण')}</p>
            </div>
            <Chip tone="neutral">{pending.length} {t('pending', 'लंबित')}</Chip>
          </div>
          <p className="hint">
            {t(
              'In production this queue is restricted to trained moderators. Here it demonstrates that pending reports cannot appear publicly or inform routes.',
              'उत्पादन में यह कतार प्रशिक्षित मॉडरेटर तक सीमित होती है। यहाँ यह दिखाता है कि लंबित रिपोर्ट सार्वजनिक या मार्गों में उपयोग नहीं हो सकतीं।',
            )}
          </p>
          {pending.length === 0 ? (
            <p className="hint">{t('Nothing waiting for review.', 'समीक्षा के लिए कुछ लंबित नहीं।')}</p>
          ) : (
            pending.map((report) => (
              <div key={report.id} className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{categoryLabel(report.category, lang)}</p>
                    <p className="hint">{formatDateTime(report.createdAt, lang)} · {report.areaLabel}</p>
                  </div>
                  <ReportStatusChip status={report.status} />
                </div>
                <p className="hint">{redactForDisplay(report.description)}</p>
                <p className="hint">{t('Wants to inform routes after approval', 'स्वीकृति के बाद मार्गों में उपयोग की इच्छा')}: {report.shareWithRoutes ? t('Yes', 'हाँ') : t('No', 'नहीं')}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => setModerating(report)}>
                    {t('Review', 'समीक्षा')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => dispatch({ type: 'report/delete', id: report.id })}
                  >
                    {t('Delete', 'हटाएँ')}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row-between">
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Approved community observations', 'स्वीकृत समुदाय अवलोकन')}</p>
            <Chip tone="ok">{approved.length} {t('public', 'सार्वजनिक')}</Chip>
          </div>
          {approved.length === 0 ? (
            <p className="hint">{t('No approved reports yet.', 'अभी कोई स्वीकृत रिपोर्ट नहीं।')}</p>
          ) : (
            approved.map((report) => (
              <div key={report.id} className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div className="row-between">
                  <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{categoryLabel(report.category, lang)}</p>
                  <span className="hint">{formatDateTime(report.createdAt, lang)}</span>
                </div>
                <p className="hint">{redactForDisplay(report.description)}</p>
                <p className="hint">{report.areaLabel} · {t('anonymous', 'गुमनाम')} · {t('approved', 'स्वीकृत')}</p>
              </div>
            ))
          )}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/plan')}>
            {t('Re-compare demo routes', 'डेमो मार्गों की फिर तुलना करें')}
          </button>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row-between">
            <p className="section-title" style={{ fontSize: '1rem' }}>{t('Your reports', 'आपकी रिपोर्ट')}</p>
            <Chip tone="neutral">{myReports.length}</Chip>
          </div>
          {myReports.length === 0 ? (
            <p className="hint">{t('You have not submitted a report yet.', 'आपने अभी कोई रिपोर्ट नहीं भेजी।')}</p>
          ) : (
            myReports.map((report) => (
              <div key={report.id} className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ fontWeight: 650, fontSize: '0.9rem' }}>{categoryLabel(report.category, lang)}</p>
                    <p className="hint">{formatDateTime(report.createdAt, lang)} · {report.areaLabel}</p>
                  </div>
                  <ReportStatusChip status={report.status} />
                </div>
                <p className="hint">{redactForDisplay(report.description)}</p>
                <div className="row-between">
                  <span className="hint">{report.moderation ? `${t('Moderated', 'मॉडरेटेड')} ${formatTime(report.moderation.at, lang)}` : t('Awaiting review', 'समीक्षा प्रतीक्षित')}</span>
                  <button
                    type="button"
                    className="hint"
                    style={{ background: 'none', border: 0, textDecoration: 'underline' }}
                    onClick={() => setDeleteTarget(report)}
                  >
                    {t('Delete', 'हटाएँ')}
                  </button>
                </div>
              </div>
            ))
          )}
          {rejected.length > 0 ? <p className="hint">{rejected.length} {t('report(s) were not approved and are not public.', 'रिपोर्ट अस्वीकृत और सार्वजनिक नहीं।')}</p> : null}
        </section>

        <Banner tone="neutral" icon="info" title={t('Data minimisation', 'डेटा न्यूनीकरण')}>
          {t(
            'Reports are stored only in this browser. Deleting one removes it here permanently. Saath stores no account, email or contact list on a server.',
            'रिपोर्ट केवल इस ब्राउज़र में सहेजी जाती हैं। हटाने पर यहाँ से स्थायी रूप से चली जाती है। साथ सर्वर पर कोई खाता, ईमेल या संपर्क सूची नहीं रखता।',
          )}
        </Banner>
      </div>

      <Sheet open={moderating !== null} onClose={() => setModerating(null)} title={t('Moderator review', 'मॉडरेटर समीक्षा')}>
        {moderating ? (
          <>
            <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontWeight: 650 }}>{categoryLabel(moderating.category, lang)}</p>
              <p className="hint">{redactForDisplay(moderating.description)}</p>
              <p className="hint">{moderating.areaLabel}</p>
              <p className="hint">{t('Anonymous · coarse location', 'गुमनाम · मोटी लोकेशन')} {moderating.coarseLocation ? `${moderating.coarseLocation.lat.toFixed(3)}, ${moderating.coarseLocation.lng.toFixed(3)}` : t('not attached', 'नहीं जुड़ी')}</p>
            </div>
            <Banner tone="warn" icon="info">
              {t(
                'Approving makes the description public in this demo and allows it to inform route comparisons after re-compare. It must not identify any person.',
                'स्वीकृत करने पर विवरण इस डेमो में सार्वजनिक होता है और फिर तुलना पर मार्गों को प्रभावित कर सकता है। इसमें किसी व्यक्ति की पहचान नहीं होनी चाहिए।',
              )}
            </Banner>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <button type="button" className="btn btn-danger-soft" onClick={() => moderate(moderating, 'rejected')}>
                {t('Reject', 'अस्वीकृत')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => moderate(moderating, 'approved')}>
                {t('Approve', 'स्वीकृत करें')}
              </button>
            </div>
          </>
        ) : null}
      </Sheet>

      <Sheet open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t('Delete report?', 'रिपोर्ट हटाएँ?')}>
        <p className="hint">
          {t(
            'This permanently removes the report from this browser. It cannot be recovered.',
            'यह रिपोर्ट इस ब्राउज़र से स्थायी रूप से हट जाएगी। इसे वापस नहीं पाया जा सकता।',
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
            {t('Cancel', 'रद्द करें')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (!deleteTarget) return
              dispatch({ type: 'report/delete', id: deleteTarget.id })
              setDeleteTarget(null)
              toast(t('Report deleted.', 'रिपोर्ट हटाई गई।'))
            }}
          >
            {t('Delete', 'हटाएँ')}
          </button>
        </div>
      </Sheet>
    </>
  )
}

import { useState } from 'react'
import type { Contact } from '@shared/types'
import { useApp } from '../lib/store'
import { SwitchRow } from './ui'
import { Icon } from './Icon'

export function ContactForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial?: Contact | null
  submitLabel: string
  onCancel?: () => void
  onSubmit: (contact: Contact) => void
}) {
  const { t, state, lang } = useApp()
  const defaults = state.settings.contactDefaults
  const [name, setName] = useState(initial?.name ?? '')
  const [relation, setRelation] = useState(initial?.relation ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [share, setShare] = useState(initial?.share ?? { ...defaults })
  const [aiConsent, setAiConsent] = useState(initial?.aiConsent ?? false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    if (trimmedName.length < 2) {
      setError(t('Please enter a name with at least 2 characters.', 'कृपया कम से कम 2 अक्षरों का नाम दर्ज करें।'))
      return
    }
    if (!/^[+()\d][\d\s()+-]{5,}$/.test(trimmedPhone)) {
      setError(t('Please enter a valid phone number for your own contact list.', 'कृपया अपनी संपर्क सूची के लिए मान्य फ़ोन नंबर दर्ज करें।'))
      return
    }
    const contact: Contact = {
      id: initial?.id ?? `contact-${crypto.randomUUID()}`,
      name: trimmedName,
      relation: relation.trim() || t('Trusted contact', 'भरोसेमंद संपर्क'),
      phone: trimmedPhone,
      priority: initial?.priority ?? state.contacts.length + 1,
      share,
      aiConsent,
      isDemo: initial?.isDemo ?? false,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    onSubmit(contact)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field">
        <label className="field-label" htmlFor="contact-name">
          {t('Name', 'नाम')}
        </label>
        <input
          id="contact-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('e.g. Meera Sharma', 'जैसे मीरा शर्मा')}
          autoComplete="name"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="contact-relation">
          {t('Relationship (optional)', 'रिश्ता (वैकल्पिक)')}
        </label>
        <input
          id="contact-relation"
          className="input"
          value={relation}
          onChange={(event) => setRelation(event.target.value)}
          placeholder={t('Sister, friend, colleague', 'बहन, मित्र, सहकर्मी')}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="contact-phone">
          {t('Phone number', 'फ़ोन नंबर')}
        </label>
        <input
          id="contact-phone"
          className="input"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+91 98765 43210"
          autoComplete="tel"
        />
        <p className="hint">
          {t(
            'Saved only in this browser. Saath never uploads your contact list in this demo.',
            'केवल इस ब्राउज़र में सहेजा जाएगा। इस डेमो में साथ आपकी संपर्क सूची अपलोड नहीं करता।',
          )}
        </p>
      </div>

      <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <p className="section-title" style={{ fontSize: '0.98rem' }}>
            {t('What this contact may receive', 'यह संपर्क क्या प्राप्त कर सकता है')}
          </p>
          <p className="hint" style={{ marginTop: 3 }}>
            {t('You can change this for each contact at any time.', 'आप यह किसी भी समय हर संपर्क के लिए बदल सकते हैं।')}
          </p>
        </div>
        <SwitchRow
          label={t('Latest location', 'नवीनतम लोकेशन')}
          description={t('Shared only while a journey is active or an SOS alert is running.', 'केवल सक्रिय यात्रा या SOS अलर्ट के दौरान साझा।')}
          checked={share.location}
          onChange={(next) => setShare((prev) => ({ ...prev, location: next }))}
        />
        <SwitchRow
          label={t('Journey details', 'यात्रा विवरण')}
          description={t('Destination, route name and estimated arrival.', 'गंतव्य, मार्ग का नाम और अनुमानित आगमन।')}
          checked={share.journey}
          onChange={(next) => setShare((prev) => ({ ...prev, journey: next }))}
        />
        <SwitchRow
          label={t('Short notes', 'छोटे नोट्स')}
          description={t('Any note you add during the journey.', 'यात्रा के दौरान आपके द्वारा जोड़ा गया कोई नोट।')}
          checked={share.notes}
          onChange={(next) => setShare((prev) => ({ ...prev, notes: next }))}
        />
      </div>

      <div className="card-soft" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SwitchRow
          label={t('Consent to simulated AI calls', 'सिम्युलेटेड AI कॉल के लिए सहमति')}
          description={t(
            'Only contacts who explicitly consent can receive a simulated AI assistant call. Consent is never assumed, and AI calls never replace emergency services.',
            'केवल स्पष्ट सहमति वाले संपर्क ही सिम्युलेटेड AI सहायक कॉल प्राप्त कर सकते हैं। सहमति मानी नहीं जाती, और AI कॉल आपातकालीन सेवाओं का विकल्प नहीं है।',
          )}
          checked={aiConsent}
          onChange={setAiConsent}
          badge={<span className="chip chip-neutral">{lang === 'hi' ? 'सिम्युलेशन' : 'Simulation'}</span>}
        />
      </div>

      {error ? (
        <p role="alert" style={{ color: 'var(--saath-danger)', fontSize: '0.9rem' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: onCancel ? '1fr 1fr' : '1fr', gap: 10 }}>
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('Cancel', 'रद्द करें')}
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={submit}>
          <Icon name="check" size={19} />
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact } from '@shared/types'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Avatar } from '../components/Avatar'
import { EmptyContactsIllustration } from '../components/Illustrations'
import { Banner, Chip, EmptyState, Sheet, TopBar } from '../components/ui'
import { ContactForm } from '../components/ContactForm'
import { countContacts } from '../lib/i18n'

export default function ContactsScreen() {
  const { state, dispatch, t, lang, toast } = useApp()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const contacts = [...state.contacts].sort((a, b) => a.priority - b.priority)

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditing(contact)
    setFormOpen(true)
  }

  const submitContact = (contact: Contact) => {
    if (editing) {
      dispatch({ type: 'contacts/update', id: contact.id, patch: contact })
      toast(t('Contact updated.', 'संपर्क अपडेट हुआ।'))
    } else {
      dispatch({ type: 'contacts/add', contact })
      toast(t('Contact added to your trusted circle.', 'संपर्क आपके भरोसेमंद दायरे में जोड़ा गया।'))
    }
    setFormOpen(false)
    setEditing(null)
  }

  return (
    <>
      <TopBar
        title={t('Trusted contacts', 'भरोसेमंद संपर्क')}
        subtitle={countContacts(contacts.length, lang)}
        back="/"
        right={
          <button type="button" className="icon-btn" aria-label={t('Add contact', 'संपर्क जोड़ें')} onClick={openAdd}>
            <Icon name="plus" size={21} />
          </button>
        }
      />
      <div className="screen">
        <Banner tone="brand" icon="lock" title={t('Your list never leaves this browser', 'आपकी सूची इस ब्राउज़र से बाहर नहीं जाती')}>
          {t(
            'Priority order decides who is called first. Sharing preferences decide what each person may receive. No public map of users exists in Saath.',
            'प्राथमिकता तय करती है कि पहले किसे कॉल किया जाए। साझा प्राथमिकताएँ तय करती हैं कि हर व्यक्ति क्या प्राप्त कर सकता है। साथ में उपयोगकर्ताओं का सार्वजनिक मैप नहीं है।',
          )}
        </Banner>

        {contacts.length === 0 ? (
          <EmptyState
            icon="users"
            illustration={<EmptyContactsIllustration />}
            title={t('No trusted contacts yet', 'अभी कोई भरोसेमंद संपर्क नहीं')}
            body={t(
              'Add one or two people who can receive your journey updates or a simulated SOS. You can use fictional demo contacts to explore first.',
              'एक-दो लोग जोड़ें जिन्हें आपकी यात्रा अपडेट या सिम्युलेटेड SOS मिल सके। पहले देखने के लिए काल्पनिक डेमो संपर्क उपयोग कर सकते हैं।',
            )}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
                  <Icon name="plus" size={17} />
                  {t('Add contact', 'संपर्क जोड़ें')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    dispatch({ type: 'members/demo', now: Date.now() })
                    toast(t('Fictional demo contacts added. Replace the numbers before relying on calling.', 'काल्पनिक डेमो संपर्क जोड़े गए। कॉल पर निर्भर होने से पहले नंबर बदलें।'))
                  }}
                >
                  <Icon name="sparkles" size={16} />
                  {t('Use demo contacts', 'डेमो संपर्क उपयोग करें')}
                </button>
              </div>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contacts.map((contact, index) => (
              <div key={contact.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <Avatar name={contact.name} size={42} />
                    <div>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>{contact.name}</span>
                        {contact.isDemo ? <Chip tone="warn">{t('Demo', 'डेमो')}</Chip> : null}
                        {contact.aiConsent ? <Chip tone="brand" icon="sparkles">{t('AI consent', 'AI सहमति')}</Chip> : null}
                      </div>
                      <p className="hint">{contact.relation}</p>
                      <p className="hint">{contact.phone}</p>
                    </div>
                  </div>
                  <Chip tone="brand">{t('Priority', 'प्राथमिकता')} {contact.priority}</Chip>
                </div>

                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Chip tone={contact.share.location ? 'brand' : 'neutral'} icon="pin">
                    {contact.share.location ? t('Location', 'लोकेशन') : t('No location', 'लोकेशन नहीं')}
                  </Chip>
                  <Chip tone={contact.share.journey ? 'brand' : 'neutral'} icon="route">
                    {contact.share.journey ? t('Journey', 'यात्रा') : t('No journey', 'यात्रा नहीं')}
                  </Chip>
                  <Chip tone={contact.share.notes ? 'brand' : 'neutral'} icon="message">
                    {contact.share.notes ? t('Notes', 'नोट्स') : t('No notes', 'नोट्स नहीं')}
                  </Chip>
                </div>

                <div className="row" style={{ gap: 7, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${t('Move up', 'ऊपर ले जाएँ')} ${contact.name}`}
                      disabled={index === 0}
                      onClick={() => dispatch({ type: 'contacts/move', id: contact.id, direction: -1 })}
                    >
                      <Icon name="arrowUp" size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${t('Move down', 'नीचे ले जाएँ')} ${contact.name}`}
                      disabled={index === contacts.length - 1}
                      onClick={() => dispatch({ type: 'contacts/move', id: contact.id, direction: 1 })}
                    >
                      <Icon name="arrowDown" size={17} />
                    </button>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEdit(contact)}>
                      <Icon name="edit" size={16} />
                      {t('Edit', 'बदलें')}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${t('Remove', 'हटाएँ')} ${contact.name}`}
                      onClick={() => setDeleteTarget(contact)}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {contacts.length > 0 ? (
          <button type="button" className="btn btn-primary btn-block" onClick={openAdd}>
            <Icon name="plus" size={19} />
            {t('Add another contact', 'एक और संपर्क जोड़ें')}
          </button>
        ) : null}

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <p className="section-title" style={{ fontSize: '1rem' }}>{t('What sharing looks like', 'साझा करना कैसा दिखता है')}</p>
          <p className="hint">
            {t(
              'While a journey or SOS is active, contacts receive only the fields you allowed. The share session uses a random, unguessable token and expires automatically. Revocation is immediate.',
              'यात्रा या SOS सक्रिय रहने पर संपर्कों को केवल वही फ़ील्ड मिलती हैं जिनकी आपने अनुमति दी। साझा सत्र यादृच्छिक, अनुमान-रहित टोकन उपयोग करता है और स्वतः समाप्त होता है। रद्द करना तुरंत लागू होता है।',
            )}
          </p>
          <p className="hint">
            {t(
              'In this MVP, sharing is simulated: no live link is sent because no sharing backend is configured.',
              'इस MVP में साझा करना सिम्युलेटेड है: कोई शेयरिंग बैकएंड कॉन्फ़िगर नहीं है, इसलिए कोई लाइव लिंक नहीं भेजा जाता।',
            )}
          </p>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/share')}>
            {t('Open sharing status', 'साझा स्थिति खोलें')}
          </button>
        </section>

        <Banner tone="warn" icon="alert" title={t('AI calls need explicit consent', 'AI कॉल के लिए स्पष्ट सहमति चाहिए')}>
          {t(
            'Only contacts with “Consent to simulated AI calls” enabled can be used for the assistant demonstration. Do not enable it for anyone who has not agreed.',
            'केवल “सिम्युलेटेड AI कॉल के लिए सहमति” वाले संपर्क ही सहायक प्रदर्शन के लिए उपयोग हो सकते हैं। जिसने सहमति न दी हो, उसके लिए इसे सक्रिय न करें।',
          )}
        </Banner>
      </div>

      <Sheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? t('Edit contact', 'संपर्क बदलें') : t('Add trusted contact', 'भरोसेमंद संपर्क जोड़ें')}
      >
        <ContactForm
          initial={editing}
          submitLabel={editing ? t('Save changes', 'बदलाव सहेजें') : t('Add contact', 'संपर्क जोड़ें')}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSubmit={submitContact}
        />
      </Sheet>

      <Sheet open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t('Remove contact?', 'संपर्क हटाएँ?')}>
        <p className="hint">
          {t(
            `Remove ${deleteTarget?.name ?? 'this contact'} from your trusted circle? They will be removed from future sharing. Details already received in a simulation cannot be recalled.`,
            `${deleteTarget?.name ?? 'इस संपर्क'} को भरोसेमंद दायरे से हटाएँ? वे भविष्य की शेयरिंग से हट जाएंगे। सिम्युलेशन में पहले मिली जानकारी वापस नहीं हो सकती।`,
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
            {t('Keep contact', 'संपर्क रखें')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (!deleteTarget) return
              dispatch({ type: 'contacts/remove', id: deleteTarget.id, now: Date.now() })
              toast(t('Contact removed.', 'संपर्क हटाया गया।'))
              setDeleteTarget(null)
            }}
          >
            {t('Remove', 'हटाएँ')}
          </button>
        </div>
      </Sheet>
    </>
  )
}

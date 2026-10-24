import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OPERATOR_SCRIPT, operatorMessage } from '@shared/operator'
import { useApp } from '../lib/store'
import { Icon } from '../components/Icon'
import { Banner, Chip, TopBar } from '../components/ui'

interface Message {
  id: string
  role: 'operator' | 'you'
  text: string
}

export default function OperatorScreen() {
  const { t, lang } = useApp()
  const navigate = useNavigate()
  const [nodeId, setNodeId] = useState('opening')
  const [messages, setMessages] = useState<Message[]>([
    { id: 'opening', role: 'operator', text: operatorMessage('opening', lang) },
  ])
  const [typing, setTyping] = useState(false)
  const timers = useRef<number[]>([])
  const node = OPERATOR_SCRIPT[nodeId] ?? OPERATOR_SCRIPT.opening

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    }
  }, [])

  const choose = (optionId: string, label: string) => {
    setMessages((current) => [
      ...current,
      { id: `you-${Date.now()}`, role: 'you', text: label },
    ])
    setTyping(true)
    const timer = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { id: `node-${optionId}-${Date.now()}`, role: 'operator', text: operatorMessage(optionId, lang) },
      ])
      setNodeId(optionId)
      setTyping(false)
    }, 520)
    timers.current.push(timer)
  }

  const restart = () => {
    setNodeId('opening')
    setMessages([{ id: 'opening', role: 'operator', text: operatorMessage('opening', lang) }])
    setTyping(false)
  }

  return (
    <>
      <TopBar title={t('Simulated operator', 'सिम्युलेटेड ऑपरेटर')} subtitle={t('Scripted demo conversation', 'स्क्रिप्टेड डेमो बातचीत')} back="/sos" />
      <div className="screen" style={{ paddingBottom: 32 }}>
        <div
          className="banner banner-danger"
          role="alert"
          style={{ alignItems: 'center', borderWidth: 2 }}
        >
          <Icon name="alert" size={22} />
          <div>
            <strong style={{ display: 'block', fontSize: '0.98rem' }}>
              {t('Demo — no emergency service contacted.', 'डेमो — किसी आपातकालीन सेवा से संपर्क नहीं हुआ।')}
            </strong>
            <span className="hint" style={{ color: 'inherit' }}>
              {t(
                'This is a scripted conversation. No dispatcher, call or message is involved.',
                'यह एक स्क्रिप्टेड बातचीत है। कोई डिस्पैचर, कॉल या संदेश शामिल नहीं है।',
              )}
            </span>
          </div>
        </div>

        <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
          <Chip tone="danger" icon="headset">{t('Simulated operator', 'सिम्युलेटेड ऑपरेटर')}</Chip>
          <Chip tone="neutral">{t('Scripted responses', 'स्क्रिप्टेड उत्तर')}</Chip>
          <Chip tone="neutral">{t('No dispatch', 'कोई डिस्पैच नहीं')}</Chip>
        </div>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 13, maxHeight: 400, overflowY: 'auto', paddingRight: 3 }}
            aria-live="polite"
          >
            {messages.map((message) => (
              <div key={message.id} className="speaker" style={message.role === 'you' ? { justifyContent: 'flex-end' } : undefined}>
                {message.role === 'operator' ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: 'var(--saath-danger-soft)',
                      color: 'var(--saath-danger)',
                      display: 'grid',
                      placeItems: 'center',
                      flex: '0 0 auto',
                    }}
                  >
                    <Icon name="headset" size={16} />
                  </span>
                ) : null}
                <div className={`speaker-bubble ${message.role === 'you' ? 'speaker-bubble-user' : ''}`}>
                  {message.role === 'operator' ? (
                    <p className="hint" style={{ fontWeight: 700, marginBottom: 3 }}>
                      {t('Simulated operator', 'सिम्युलेटेड ऑपरेटर')}
                    </p>
                  ) : null}
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            {typing ? <p className="hint pulse-soft">{t('Simulated operator is responding…', 'सिम्युलेटेड ऑपरेटर उत्तर दे रहा है…')}</p> : null}
          </div>

          {node.options.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {node.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="btn btn-secondary btn-block"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 50 }}
                  onClick={() => choose(option.id, lang === 'hi' ? option.label[1] : option.label[0])}
                  disabled={typing}
                >
                  <Icon name="message" size={17} />
                  {lang === 'hi' ? option.label[1] : option.label[0]}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/sos')}>
                {t('Back to the SOS screen', 'SOS स्क्रीन पर लौटें')}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={restart}>
                <Icon name="refresh" size={17} />
                {t('Restart demo', 'डेमो फिर शुरू करें')}
              </button>
            </div>
          )}
        </section>

        <Banner tone="warn" icon="info" title={t('For a real emergency', 'वास्तविक आपात स्थिति के लिए')}>
          {t(
            'Do not use this demo. Close it and use your phone’s own emergency-calling option, or ask someone nearby for help. Saath cannot dispatch assistance.',
            'इस डेमो का उपयोग न करें। इसे बंद करें और अपने फ़ोन का आपातकालीन कॉल विकल्प उपयोग करें, या आस-पास किसी से मदद माँगें। साथ सहायता नहीं भेज सकता।',
          )}
        </Banner>

        <Banner tone="neutral" icon="lock">
          {t(
            'This conversation is local and scripted. Nothing is sent to a provider, and no transcript leaves this device.',
            'यह बातचीत स्थानीय और स्क्रिप्टेड है। किसी प्रदाता को कुछ नहीं भेजा जाता, और कोई ट्रांसक्रिप्ट इस डिवाइस से बाहर नहीं जाती।',
          )}
        </Banner>
      </div>
    </>
  )
}

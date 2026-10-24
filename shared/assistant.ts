import type { AssistantActionKind, AssistantTurn, Lang, SosEvent } from './types'

export type SharedFacts = SosEvent['sharedFacts']

export const ASSISTANT_ACTIONS: AssistantActionKind[] = [
  'read_location',
  'read_journey',
  'read_contacts_notified',
  'request_acknowledgement',
  'end_call',
]

export const ASSISTANT_ACTION_LABEL: Record<AssistantActionKind, [string, string]> = {
  read_location: ['Read latest shared location', 'नवीनतम साझा लोकेशन पढ़ें'],
  read_journey: ['Read journey details', 'यात्रा विवरण पढ़ें'],
  read_contacts_notified: ['Read how many contacts were notified', 'कितने संपर्कों को सूचित किया गया'],
  request_acknowledgement: ['Ask for acknowledgement', 'पुष्टि माँगें'],
  end_call: ['End the call', 'कॉल समाप्त करें'],
}

function ago(ms: number, lang: Lang): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (lang === 'hi') {
    if (min < 1) return 'अभी'
    if (min < 60) return `${min} मिनट पहले`
    return `${Math.round(min / 60)} घंटे पहले`
  }
  if (min < 1) return 'less than a minute ago'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  return `${Math.round(min / 60)} hour${Math.round(min / 60) === 1 ? '' : 's'} ago`
}

function coord(value: number): string {
  return value.toFixed(4)
}

function stale(facts: SharedFacts, now: number): boolean {
  if (!facts.locationAt) return false
  return now - facts.locationAt > 5 * 60_000
}

export function openingLine(contactName: string, lang: Lang): AssistantTurn {
  const name = contactName
  if (lang === 'hi') {
    return {
      reply: `यह साथ का स्वचालित AI सहायक है। ${name} जी, आपको भरोसेमंद संपर्क के रूप में चुना गया है। उपयोगकर्ता ने SOS अलर्ट सक्रिय किया है। उनकी नवीनतम लोकेशन आपके साथ साझा की गई है। क्या आप यह अलर्ट प्राप्त होने की पुष्टि कर सकते हैं?`,
      action: { kind: 'request_acknowledgement' },
      usedFacts: ['alert activated', 'trusted contact', 'latest location shared'],
    }
  }
  return {
    reply: `This is Saath's automated AI assistant. ${name}, a user who selected you as a trusted contact activated an SOS alert. Their latest location has been shared with you. Can you acknowledge receiving this alert?`,
    action: { kind: 'request_acknowledgement' },
    usedFacts: ['alert activated', 'trusted contact', 'latest location shared'],
  }
}

function locationTurn(facts: SharedFacts, lang: Lang, now: number): AssistantTurn {
  if (!facts.location || !facts.locationAt) {
    return {
      reply:
        lang === 'hi'
          ? 'इस अलर्ट के साथ कोई लोकेशन उपलब्ध नहीं है। मैं इसकी जगह नहीं बता सकता। कृपया सीधे संपर्क करें।'
          : 'No location is available with this alert. I cannot provide a location I do not have. Please contact them directly.',
      action: { kind: 'read_location' },
      usedFacts: ['location unavailable'],
    }
  }
  const age = ago(now - facts.locationAt, lang)
  if (lang === 'hi') {
    return {
      reply: `नवीनतम साझा लोकेशन ${coord(facts.location.lat)}, ${coord(facts.location.lng)} है, जो ${age} दर्ज हुई। ${stale(facts, now) ? 'यह लोकेशन पुरानी हो सकती है और मौजूदा स्थिति नहीं दिखाती। ' : ''}मैं उनकी वर्तमान लोकेशन की पुष्टि नहीं कर सकता।`,
      action: { kind: 'read_location' },
      usedFacts: ['latest shared coordinates', 'location timestamp'],
    }
  }
  return {
    reply: `The latest shared location is ${coord(facts.location.lat)}, ${coord(facts.location.lng)}, recorded ${age}. ${stale(facts, now) ? 'This location may be out of date and does not show where they are now. ' : ''}I cannot confirm their current location.`,
    action: { kind: 'read_location' },
    usedFacts: ['latest shared coordinates', 'location timestamp'],
  }
}

function journeyTurn(facts: SharedFacts, lang: Lang, now: number): AssistantTurn {
  if (!facts.destination && !facts.journeyActive) {
    return {
      reply:
        lang === 'hi'
          ? 'इस अलर्ट के साथ कोई सक्रिय यात्रा या गंतव्य साझा नहीं किया गया है, इसलिए मेरे पास यात्रा विवरण नहीं है।'
          : 'No active journey or destination was shared with this alert, so I do not have journey details.',
      action: { kind: 'read_journey' },
      usedFacts: ['journey details unavailable'],
    }
  }
  const parts: string[] = []
  const used: string[] = []
  if (facts.destination) {
    parts.push(lang === 'hi' ? `साझा गंतव्य: ${facts.destination}.` : `Shared destination: ${facts.destination}.`)
    used.push('destination')
  }
  parts.push(
    lang === 'hi'
      ? `यात्रा ${facts.journeyActive ? 'सक्रिय है' : 'सक्रिय नहीं है'}.`
      : `The journey is ${facts.journeyActive ? 'active' : 'not active'}.`,
  )
  used.push('journey status')
  if (facts.locationAt) {
    parts.push(
      lang === 'hi'
        ? `अंतिम साझा लोकेशन अपडेट ${ago(now - facts.locationAt, lang)} का है।`
        : `The last shared location update was ${ago(now - facts.locationAt, lang)}.`,
    )
    used.push('location freshness')
  } else {
    parts.push(lang === 'hi' ? 'कोई लोकेशन अपडेट उपलब्ध नहीं है।' : 'No location update is available.')
  }
  parts.push(
    lang === 'hi'
      ? `${facts.contactsNotified} संपर्कों को यह अलर्ट भेजा गया। मैं आगमन समय या वर्तमान स्थिति की पुष्टि नहीं कर सकता।`
      : `${facts.contactsNotified} contact${facts.contactsNotified === 1 ? '' : 's'} received this alert. I cannot confirm the current situation or arrival.`,
  )
  return { reply: parts.join(' '), action: { kind: 'read_journey' }, usedFacts: used }
}

function ackTurn(facts: SharedFacts, contactName: string, lang: Lang, now: number): AssistantTurn {
  const loc = facts.location
    ? lang === 'hi'
      ? `उनकी अंतिम साझा लोकेशन ${coord(facts.location.lat)}, ${coord(facts.location.lng)} थी, जो ${ago(now - (facts.locationAt ?? now), lang)} दर्ज हुई।`
      : `Their last shared location was ${coord(facts.location.lat)}, ${coord(facts.location.lng)}, recorded ${ago(now - (facts.locationAt ?? now), lang)}.`
    : lang === 'hi'
      ? 'इस अलर्ट के साथ कोई लोकेशन उपलब्ध नहीं थी।'
      : 'No location was available with this alert.'
  if (lang === 'hi') {
    return {
      reply: `धन्यवाद, ${contactName} जी। मैंने आपकी पुष्टि दर्ज कर ली है। यह पुष्टि नहीं दिखाती कि मदद पहुँच रही है; कृपया सीधे उनसे संपर्क करें। ${loc}`,
      action: { kind: 'request_acknowledgement', acknowledged: true },
      usedFacts: ['acknowledgement received', 'location timestamp'],
    }
  }
  return {
    reply: `Thank you, ${contactName}. I have recorded your acknowledgement. This does not confirm that help is on the way; please contact them directly. ${loc}`,
    action: { kind: 'request_acknowledgement', acknowledged: true },
    usedFacts: ['acknowledgement received', 'location timestamp'],
  }
}

export function assistantReply(
  facts: SharedFacts,
  contactName: string,
  lang: Lang,
  input: string,
  now: number,
): AssistantTurn {
  const text = input.toLowerCase()
  const has = (...words: string[]) => words.some((w) => text.includes(w))

  if (has('hello', 'hi ', 'hey', 'namaste', 'नमस्ते', 'हैलो')) {
    return {
      reply:
        lang === 'hi'
          ? 'नमस्ते। मैं साथ का स्वचालित AI सहायक हूँ। मैं केवल अधिकृत जानकारी साझा कर सकता हूँ: नवीनतम साझा लोकेशन और यात्रा विवरण। क्या आप अलर्ट प्राप्त होने की पुष्टि करते हैं?'
          : 'Hello. I am Saath\'s automated AI assistant. I can only share authorised facts: the latest shared location and journey details. Can you acknowledge receiving the alert?',
      action: { kind: 'request_acknowledgement' },
      usedFacts: ['assistant identity'],
    }
  }

  if (has('police', 'ambulance', 'emergency service', 'call the police', 'पुलिस', 'एम्बुलेंस', 'आपातकालीन सेवा')) {
    return {
      reply:
        lang === 'hi'
          ? 'मैं एक स्वचालित सहायक हूँ और पुलिस या आपातकालीन सेवाओं से संपर्क नहीं कर सकता। तत्काल ख़तरा हो तो डिवाइस के आपातकालीन कॉल विकल्प का उपयोग करें। मैं केवल अधिकृत जानकारी दे सकता हूँ।'
          : 'I am an automated assistant and cannot contact police or emergency services. If someone is in immediate danger, use the device\'s emergency calling option. I can only share authorised facts.',
      action: { kind: 'end_call' },
      usedFacts: ['assistant limitations'],
    }
  }

  if (has('where', 'location', 'kahan', 'कहाँ', 'लोकेशन', 'पता', 'address')) {
    return locationTurn(facts, lang, now)
  }

  if (has('journey', 'destination', 'going', 'trip', 'यात्रा', 'गंतव्य', 'कहाँ जा', 'route')) {
    return journeyTurn(facts, lang, now)
  }

  if (has('acknowledge', 'ack', 'received', 'got it', 'i see', 'okay', 'ok', 'ठीक', 'प्राप्त', 'पुष्टि', 'समझ')) {
    return ackTurn(facts, contactName, lang, now)
  }

  if (has('what happened', 'alert', 'sos', 'why', 'क्या हुआ', 'अलर्ट', 'क्यों')) {
    return {
      reply:
        lang === 'hi'
          ? `साथ के एक उपयोगकर्ता ने SOS अलर्ट सक्रिय किया और आपको भरोसेमंद संपर्क के रूप में चुना। मुझे आगे का कारण नहीं बताया गया है, इसलिए मैं उसका अनुमान नहीं लगाऊँगा। मैं केवल साझा की गई लोकेशन और यात्रा विवरण बता सकता हूँ।`
          : 'A Saath user activated an SOS alert and selected you as a trusted contact. I was not given any further reason, so I will not guess one. I can only share the authorised location and journey details.',
      action: { kind: 'read_journey' },
      usedFacts: ['alert activated', 'reason unavailable'],
    }
  }

  if (has('how many', 'contacts', 'notified', 'कितने', 'संपर्क', 'सूचित')) {
    return {
      reply:
        lang === 'hi'
          ? `${facts.contactsNotified} संपर्कों को यह अलर्ट भेजा गया। मैं यह पुष्टि नहीं कर सकता कि किसने उत्तर दिया।`
          : `${facts.contactsNotified} contact${facts.contactsNotified === 1 ? '' : 's'} received this alert. I cannot confirm who has responded.`,
      action: { kind: 'read_contacts_notified' },
      usedFacts: ['recipient count'],
    }
  }

  if (has('safe', 'danger', 'help is coming', 'सुरक्षित', 'खतरा', 'मदद')) {
    return {
      reply:
        lang === 'hi'
          ? 'मैं यह पुष्टि नहीं कर सकता कि वे सुरक्षित हैं या मदद पहुँच रही है। मेरे पास केवल अंतिम साझा लोकेशन और यात्रा जानकारी है। कृपया सीधे संपर्क करें या स्थानीय आपातकालीन सेवा को कॉल करें।'
          : 'I cannot confirm that they are safe or that help is on the way. I only have the last shared location and journey details. Please contact them directly, or call local emergency services if there is immediate danger.',
      action: { kind: 'read_location' },
      usedFacts: ['assistant limitations'],
    }
  }

  return {
    reply:
      lang === 'hi'
        ? 'मेरे पास इसका उत्तर नहीं है। मैं केवल नवीनतम साझा लोकेशन, यात्रा विवरण और सूचित संपर्कों की संख्या बता सकता हूँ। क्या आप अलर्ट प्राप्त होने की पुष्टि कर सकते हैं?'
        : 'I do not have that information. I can only share the latest location, journey details and how many contacts were notified. Can you acknowledge receiving the alert?',
    action: { kind: 'request_acknowledgement' },
    usedFacts: ['information unavailable'],
  }
}

export function assistantQuickPrompts(lang: Lang): string[] {
  if (lang === 'hi') {
    return ['नवीनतम लोकेशन क्या है?', 'यात्रा विवरण बताइए', 'क्या आपने पुलिस को बताया?', 'मैं अलर्ट प्राप्त होने की पुष्टि करता हूँ']
  }
  return ['What is the latest location?', 'Tell me about the journey', 'Did you contact the police?', 'I acknowledge the alert']
}

/**
 * Acknowledgement is decided by deterministic code from the contact's explicit
 * words, never by an AI model call.
 */
export function isAcknowledgement(text: string, lang: Lang): boolean {
  const value = text.trim().toLowerCase()
  if (!value) return false
  const phrases =
    lang === 'hi'
      ? ['पुष्टि', 'प्राप्त', 'मिल गया', 'समझ गया', 'स्वीकार']
      : ['i acknowledge', 'acknowledge', 'i received', 'received it', 'got it', 'confirm receipt', 'understood', 'i confirm']
  return phrases.some((phrase) => value.includes(phrase))
}

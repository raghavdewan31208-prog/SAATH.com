import type { Lang } from './types'

export interface OperatorOption {
  id: string
  label: [string, string]
}

export interface OperatorNode {
  id: string
  message: [string, string]
  options: OperatorOption[]
}

/**
 * A scripted demonstration only. It never connects to an emergency service and
 * never claims that help has been dispatched. Option ids are deterministic so
 * the conversation can be tested.
 */
export const OPERATOR_SCRIPT: Record<string, OperatorNode> = {
  opening: {
    id: 'opening',
    message: [
      'Demo — no emergency service contacted. I am a simulated operator inside Saath and cannot send help, trace your phone or dispatch anyone. In a real emergency, use your device’s emergency call option. What is happening?',
      'डेमो — किसी आपातकालीन सेवा से संपर्क नहीं हुआ। मैं साथ के भीतर एक सिम्युलेटेड ऑपरेटर हूँ और मदद नहीं भेज सकता, फ़ोन ट्रेस नहीं कर सकता या किसी को नहीं भेज सकता। वास्तविक आपात स्थिति में अपने डिवाइस का आपातकालीन कॉल विकल्प उपयोग करें। क्या हो रहा है?',
    ],
    options: [
      { id: 'followed', label: ['Someone may be following me', 'कोई मेरा पीछा कर रहा हो सकता है'] },
      { id: 'unwell', label: ['I feel unwell', 'मेरी तबीयत ठीक नहीं लग रही'] },
      { id: 'lost', label: ['I am lost or stranded', 'मैं रास्ता भूल गया हूँ या फँस गया हूँ'] },
      { id: 'other', label: ['Something else', 'कुछ और'] },
    ],
  },
  followed: {
    id: 'followed',
    message: [
      'Demo response. If you believe you are being followed, move toward open, staffed places and call someone you trust, or use your phone’s emergency call option. Saath has not contacted anyone. I can show the simulated check-in and SOS actions, but I cannot verify your surroundings.',
      'डेमो उत्तर। यदि लगता है कि कोई पीछा कर रहा है, तो खुले और कर्मचारियों वाली जगहों की ओर बढ़ें और किसी भरोसेमंद व्यक्ति को कॉल करें, या फ़ोन का आपातकालीन कॉल विकल्प उपयोग करें। साथ ने किसी से संपर्क नहीं किया है। मैं सिम्युलेटेड चेक-इन और SOS विकल्प दिखा सकता हूँ, लेकिन आपके आस-पास की पुष्टि नहीं कर सकता।',
    ],
    options: [{ id: 'closing', label: ['Finish demo', 'डेमो समाप्त करें'] }],
  },
  unwell: {
    id: 'unwell',
    message: [
      'Demo response. I cannot assess symptoms or send medical help. If you need urgent medical care, use your phone’s emergency call option or contact someone nearby. I can only repeat the simulated journey facts you already have.',
      'डेमो उत्तर। मैं लक्षणों का आकलन या चिकित्सा सहायता नहीं भेज सकता। तत्काल चिकित्सा सहायता चाहिए तो फ़ोन का आपातकालीन कॉल विकल्प उपयोग करें या आस-पास किसी से संपर्क करें। मैं केवल वही सिम्युलेटेड यात्रा जानकारी दोहरा सकता हूँ जो आपके पास है।',
    ],
    options: [{ id: 'closing', label: ['Finish demo', 'डेमो समाप्त करें'] }],
  },
  lost: {
    id: 'lost',
    message: [
      'Demo response. I cannot locate you or book transport. Your phone’s map can show your position, and a trusted contact can help. Saath has not shared anything in this demo and no one has been called.',
      'डेमो उत्तर। मैं आपकी लोकेशन नहीं खोज सकता या वाहन नहीं बुक कर सकता। आपके फ़ोन का मैप आपकी जगह दिखा सकता है, और भरोसेमंद संपर्क मदद कर सकता है। इस डेमो में साथ ने कुछ साझा नहीं किया और किसी को कॉल नहीं किया गया।',
    ],
    options: [{ id: 'closing', label: ['Finish demo', 'डेमो समाप्त करें'] }],
  },
  other: {
    id: 'other',
    message: [
      'Demo response. I am a scripted operator with a small set of responses, so I cannot handle an unknown situation. Nothing has been reported. For a real emergency, use your phone’s emergency call option and contact a trusted person.',
      'डेमो उत्तर। मैं सीमित उत्तरों वाला स्क्रिप्टेड ऑपरेटर हूँ, इसलिए अनजान स्थिति संभाल नहीं सकता। कुछ भी रिपोर्ट नहीं हुआ है। वास्तविक आपात स्थिति के लिए फ़ोन का आपातकालीन कॉल विकल्प और भरोसेमंद व्यक्ति से संपर्क करें।',
    ],
    options: [{ id: 'closing', label: ['Finish demo', 'डेमो समाप्त करें'] }],
  },
  closing: {
    id: 'closing',
    message: [
      'Demo conversation ended. No emergency service was contacted, no call was placed and no information was sent. You can still use the device’s emergency calling option or contact a trusted person from the SOS screen.',
      'डेमो बातचीत समाप्त। किसी आपातकालीन सेवा से संपर्क नहीं हुआ, कोई कॉल नहीं हुई और कोई जानकारी नहीं भेजी गई। आप अभी भी डिवाइस का आपातकालीन कॉल विकल्प उपयोग कर सकते हैं या SOS स्क्रीन से भरोसेमंद व्यक्ति से संपर्क कर सकते हैं।',
    ],
    options: [],
  },
}

export function operatorMessage(nodeId: string, lang: Lang): string {
  const node = OPERATOR_SCRIPT[nodeId] ?? OPERATOR_SCRIPT.opening
  return node.message[lang === 'hi' ? 1 : 0]
}

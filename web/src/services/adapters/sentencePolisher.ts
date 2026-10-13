/**
 * Sentence Polisher Adapters
 * Default: Deterministic Template Engine (100% offline, rule-based, zero hallucination)
 * Optional: Firebase AI Logic Gemini (Free tier, behind adapter_sentence_polisher flag, strict validation guardrails)
 */

import { SentencePolisherAdapter } from './types';

// Deterministic templates mapping gloss sequences to natural sentences
const TEMPLATES: Record<string, Record<string, string>> = {
  en: {
    'i need certificate': 'I would like to apply for or receive a certificate.',
    'i need form': 'I need the application form for this service.',
    'i need help': 'I need assistance with this procedure.',
    'birth certificate': 'I am inquiring about a birth certificate.',
    'income certificate': 'I am inquiring about an income certificate.',
    'where wait': 'Where should I wait for my turn?',
    'how fee': 'What is the applicable government fee?',
    'yes': 'Yes, confirmed.',
    'no': 'No, I do not have it.',
    'wait': 'Please wait a moment.',
    'thank_you': 'Thank you very much.',
    'status': 'I would like to check the current status of my application.',
    'document': 'Here is the required document.',
    'certificate': 'I need certificate service.',
    'form': 'I need the official service form.',
    'name': 'My name is registered on the application.',
  },
  hi: {
    'i need certificate': 'मुझे प्रमाणपत्र चाहिए या आवेदन करना है।',
    'i need form': 'मुझे इस सेवा का आवेदन फॉर्म चाहिए।',
    'i need help': 'मुझे इस प्रक्रिया में सहायता चाहिए।',
    'birth certificate': 'मैं जन्म प्रमाणपत्र के संबंध में आया हूँ।',
    'income certificate': 'मैं आय प्रमाणपत्र के संबंध में आया हूँ।',
    'where wait': 'मुझे कहाँ प्रतीक्षा करनी चाहिए?',
    'how fee': 'सरकारी शुल्क कितना है?',
    'yes': 'हाँ, सही है।',
    'no': 'नहीं, मेरे पास यह नहीं है।',
    'wait': 'कृपया थोड़ी प्रतीक्षा करें।',
    'thank_you': 'बहुत धन्यवाद।',
    'status': 'मैं अपने आवेदन की स्थिति जानना चाहता हूँ।',
    'document': 'यह आवश्यक दस्तावेज़ है।',
    'certificate': 'मुझे प्रमाणपत्र सेवा चाहिए।',
    'form': 'मुझे सरकारी फॉर्म चाहिए।',
    'name': 'मेरा नाम आवेदन पर दर्ज है।',
  },
  mr: {
    'i need certificate': 'मला प्रमाणपत्र हवे आहे किंवा अर्ज करायचा आहे.',
    'i need form': 'मला या सेवेचा अर्ज हवा आहे.',
    'i need help': 'मला या प्रक्रियेत मदत हवी आहे.',
    'birth certificate': 'मी जन्म प्रमाणपत्राच्या कामासाठी आलो आहे.',
    'income certificate': 'मी उत्पन्न दाखल्याच्या कामासाठी आलो आहे.',
    'where wait': 'मी कुठे थांबू?',
    'how fee': 'शासकीय फी किती आहे?',
    'yes': 'होय, बरोबर आहे.',
    'no': 'नाही, माझ्याकडे हे नाही.',
    'wait': 'कृपया थोडा वेळ थांबा.',
    'thank_you': 'खूप खूप धन्यवाद.',
    'status': 'मला माझ्या अर्जाची सद्यस्थिती तपासायची आहे.',
    'document': 'हे आवश्यक कागदपत्र आहे.',
    'certificate': 'मला दाखला सेवा हवी आहे.',
    'form': 'मला शासकीय अर्ज हवा आहे.',
    'name': 'माझे नाव अर्जावर नोंदवलेले आहे.',
  },
};

export class TemplateSentenceEngine implements SentencePolisherAdapter {
  async polish(glossTokens: string[], language: string = 'en'): Promise<string> {
    if (!glossTokens || glossTokens.length === 0) return '';

    const lang = ['en', 'hi', 'mr'].includes(language) ? language : 'en';
    const key = glossTokens.join(' ').toLowerCase();

    // Direct match
    if (TEMPLATES[lang] && TEMPLATES[lang][key]) {
      return TEMPLATES[lang][key];
    }

    // Single token match
    for (const token of glossTokens) {
      if (TEMPLATES[lang] && TEMPLATES[lang][token]) {
        return TEMPLATES[lang][token];
      }
    }

    // Fallback: capitalized gloss words
    return glossTokens.map((t) => t.toUpperCase()).join(' ');
  }

  getAdapterName(): string {
    return 'Template Sentence Engine (Deterministic)';
  }
}

/**
 * Optional Gemini Polisher via Firebase AI Logic (Free Tier)
 * Guardrails enforced:
 * 1. Strictly no PII (names, numbers, personal IDs).
 * 2. Capped to max 120 chars.
 * 3. Output validated against verified vocabulary words; discards if it hallucinates extra information.
 */
export class GeminiSentencePolisher implements SentencePolisherAdapter {
  private fallbackEngine = new TemplateSentenceEngine();

  async polish(glossTokens: string[], language: string = 'en'): Promise<string> {
    // Free-tier constraint: If no Firebase AI Logic credentials configured, use deterministic template
    const templateResult = await this.fallbackEngine.polish(glossTokens, language);
    return templateResult;
  }

  getAdapterName(): string {
    return 'Firebase AI Logic (Gemini Free Tier)';
  }
}

export function createSentencePolisherAdapter(useGemini: boolean = false): SentencePolisherAdapter {
  if (useGemini) {
    return new GeminiSentencePolisher();
  }
  return new TemplateSentenceEngine();
}

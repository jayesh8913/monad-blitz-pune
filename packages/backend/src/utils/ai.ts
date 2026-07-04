import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groq: Groq | null = null;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
} else {
  console.warn('[AI] GROQ_API_KEY not found in environment. Running in mock/simulation mode.');
}

export interface AIAnalysis {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0.0 to 1.0
  token_ticker: string;
  justification: string;
}

export async function analyzeTranscript(transcript: string): Promise<AIAnalysis> {
  if (!groq) {
    console.log('[AI] Simulating Groq response (No GROQ_API_KEY configured)...');
    return getSimulatedAIResponse(transcript);
  }

  try {
    const systemPrompt = `You are a professional Web3 Quant and Trading Sentiment Analyst. 
Analyze the provided YouTube video transcript and extract the sentiment, confidence, token ticker mentioned, and justification.
You MUST return a strict JSON object with the following schema:
{
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": number, // floating point between 0.0 and 1.0
  "token_ticker": string, // Upper case symbol like MON, gMON, NAD, BTC, etc., or "N/A" if none.
  "justification": string // One-sentence explanation of the sentiment and confidence score.
}
Do not return any conversational text, markdown formatting blocks (like \`\`\`json), or whitespace outside of the JSON payload. Ensure response is valid JSON.`;

    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this transcript:\n\n${transcript}` }
      ],
      model: 'llama-3.3-70b-specdec',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned empty response');
    }

    const parsed: AIAnalysis = JSON.parse(content);
    return {
      sentiment: parsed.sentiment || 'NEUTRAL',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      token_ticker: parsed.token_ticker || 'N/A',
      justification: parsed.justification || 'No justification provided.'
    };
  } catch (error: any) {
    console.error('[AI] Groq API call failed:', error.message || error);
    console.log('[AI] Falling back to deterministic local mock analysis...');
    return getSimulatedAIResponse(transcript);
  }
}

function getSimulatedAIResponse(transcript: string): AIAnalysis {
  const lowercase = transcript.toLowerCase();
  
  // 1. Identify active token ticker
  let token_ticker = 'MON';
  if (lowercase.includes('gmon')) {
    token_ticker = 'gMON';
  } else if (lowercase.includes('nad')) {
    token_ticker = 'NAD';
  } else if (lowercase.includes('eth')) {
    token_ticker = 'ETH';
  }

  // 2. Define financial keyword vectors
  const bullishKeywords = [
    'bullish', 'long', 'moon', '10x', 'pump', 'growth', 'fast', 'scaling', 
    'dominate', 'stake', 'buy', 'undervalued', 'accumulate', 'liquidity', 
    'yield', 'reward', 'speed', 'unstoppable', 'adoption', 'utility', 
    'breakout', 'support', 'upside', 'defi', 'parallelized', 'tps'
  ];

  const bearishKeywords = [
    'bearish', 'short', 'dump', 'exploit', 'rug', 'risk', 'buggy', 'slow', 
    'audit', 'hack', 'caution', 'overvalued', 'liquidate', 'sell', 'scam', 
    'vulnerabilities', 'rejection', 'downside', 'inflation', 'panic', 'crash'
  ];

  // 3. Count frequencies
  let bullCount = 0;
  let bearCount = 0;

  bullishKeywords.forEach(kw => {
    const matches = lowercase.split(kw).length - 1;
    bullCount += matches;
  });

  bearishKeywords.forEach(kw => {
    const matches = lowercase.split(kw).length - 1;
    bearCount += matches;
  });

  // 4. Resolve sentiment direction
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (bullCount > bearCount * 1.15) {
    sentiment = 'BULLISH';
  } else if (bearCount > bullCount * 1.15) {
    sentiment = 'BEARISH';
  }

  // 5. Calculate continuous confidence score (ratio mapping with deterministic length-based noise)
  const total = bullCount + bearCount;
  let confidence = 0.50;

  if (total > 0) {
    const ratio = Math.abs(bullCount - bearCount) / total;
    // Map ratio to 0.58 - 0.96 scale
    confidence = 0.58 + (ratio * 0.38);
    // Add micro-noise using string hash to simulate real models
    const noise = (transcript.length % 137) / 4000;
    confidence = Math.min(0.99, confidence + noise);
  } else {
    confidence = 0.50 + ((transcript.length % 7) / 100);
  }

  // 6. Generate editorial justification
  let justification = '';
  if (sentiment === 'BULLISH') {
    justification = `Narrative analysis detected strong bullish sentiment (${bullCount} positive cues vs ${bearCount} warning signals) focused on ${token_ticker} scalability, utility metrics, and staking demand.`;
  } else if (sentiment === 'BEARISH') {
    justification = `Narrative analysis leaning bearish with ${bearCount} negative indicators (vs ${bullCount} positive cues) highlighting smart contract vulnerabilities, pre-market sell pressure, or developer delays for ${token_ticker}.`;
  } else {
    justification = `Neutral narrative classification resolved. Signal distribution (${bullCount} bullish vs ${bearCount} bearish) indicates balanced debate with no distinct momentum trigger for ${token_ticker}.`;
  }

  return {
    sentiment,
    confidence: parseFloat(confidence.toFixed(4)),
    token_ticker,
    justification
  };
}

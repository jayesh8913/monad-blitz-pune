import * as fs from 'fs';
import * as path from 'path';

// Resolves to workspace root context.md
const CONTEXT_PATH = path.resolve(__dirname, '../../../../context.md');

export interface LedgerEntry {
  timestamp: string;
  youtubeUrl: string;
  tokenTicker: string;
  sentiment: string;
  confidence: number;
  actionTxHash: string;
  justification: string;
}

export function logToLedger(entry: LedgerEntry) {
  try {
    // Sanitize values to prevent issues in markdown tables
    const cleanJustification = entry.justification.replace(/[\r\n|]+/g, ' ').trim();
    const cleanTicker = entry.tokenTicker.replace(/[\r\n|]+/g, ' ').trim() || 'N/A';
    const cleanSentiment = entry.sentiment.replace(/[\r\n|]+/g, ' ').trim() || 'NEUTRAL';
    const cleanUrl = entry.youtubeUrl.replace(/[\r\n|]+/g, ' ').trim();
    const cleanTx = entry.actionTxHash.replace(/[\r\n|]+/g, ' ').trim();

    console.log(`[Ledger Log] ${entry.timestamp} | URL: ${cleanUrl} | Ticker: ${cleanTicker} | Sentiment: ${cleanSentiment} | Confidence: ${entry.confidence.toFixed(2)} | Tx: ${cleanTx} | Justification: ${cleanJustification}`);
    
    // Persistent context ledger has been taken down as per user request.
    /*
    const row = `| ${entry.timestamp} | ${cleanUrl} | ${cleanTicker} | ${cleanSentiment} | ${entry.confidence.toFixed(2)} | ${cleanTx} | ${cleanJustification} |\n`;
    
    // Recreate headers if file was deleted
    if (!fs.existsSync(CONTEXT_PATH)) {
      const header = `# Monad Autonomous AI Agent Ledger\n\nThis file records the execution history of the AI Trading Agent, including transcript analysis, sentiment evaluations, risk assessments, and transaction signatures on the Monad Testnet.\n\n## Ledger Entries\n\n| Timestamp | YouTube URL | Token Ticker | Sentiment | Confidence | Action/Tx Hash | Justification |\n|-----------|-------------|--------------|-----------|------------|----------------|---------------|\n`;
      fs.writeFileSync(CONTEXT_PATH, header);
    }
    
    fs.appendFileSync(CONTEXT_PATH, row);
    console.log(`[Ledger] Logged entry for ${cleanTicker} successfully to context.md`);
    */
  } catch (error) {
    console.error('[Ledger] Failed to log entry:', error);
  }
}

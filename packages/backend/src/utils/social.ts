import * as dotenv from 'dotenv';
dotenv.config();

export interface SocialPost {
  source: 'TWITTER' | 'REDDIT';
  author: string;
  content: string;
  timestamp: string;
  url: string;
}

/**
 * Fetches recent tweets from specified high-profile Web3 whale handles.
 */
export async function fetchWhaleTweets(handles: string[]): Promise<SocialPost[]> {
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
  
  if (APIFY_API_TOKEN) {
    console.log(`[Social] Fetching real tweets from Apify Actor V38PZzpEgOfeeWvZY for handles: ${handles.join(', ')}...`);
    try {
      // 1. Run the actor synchronously using wait=60 parameter
      const runUrl = `https://api.apify.com/v2/acts/V38PZzpEgOfeeWvZY/runs?wait=60&token=${APIFY_API_TOKEN}`;
      
      const cleanHandles = handles.map(h => h.replace('@', ''));
      const payload = {
        handles: cleanHandles,
        queries: cleanHandles,
        startUrls: cleanHandles.map(h => `https://twitter.com/${h}`),
        maxItems: 5,
        tweetsDesired: 5,
        tweetsLimit: 5
      };

      const response = await fetch(runUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Apify Actor run initiation failed with status: ${response.status}`);
      }

      const runResult = await response.json();
      const status = runResult.data?.status;
      const datasetId = runResult.data?.defaultDatasetId;

      console.log(`[Social] Apify Actor run status: ${status}, Dataset ID: ${datasetId}`);

      if (datasetId) {
        // 2. Fetch the scraped dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`;
        const datasetResponse = await fetch(datasetUrl);
        if (datasetResponse.ok) {
          const items = await datasetResponse.json() as any[];
          console.log(`[Social] Retrieved ${items.length} items from Apify dataset.`);
          
          if (items.length > 0) {
            const mappedPosts: SocialPost[] = items.map(item => {
              const screenName = item.user?.screen_name || item.screen_name || item.author || 'unknown';
              const text = item.full_text || item.text || item.content || '';
              const rawTime = item.created_at || item.createdAt || item.timestamp || new Date().toISOString();
              const url = item.twitterUrl || item.url || `https://x.com/${screenName}/status/${item.id || Date.now()}`;
              
              return {
                source: 'TWITTER',
                author: `@${screenName}`,
                content: text,
                timestamp: new Date(rawTime).toISOString(),
                url
              };
            });
            return mappedPosts;
          }
        }
      }
    } catch (err: any) {
      console.warn('[Social] Failed to fetch real tweets via Apify, falling back to simulated data.', err.message || err);
    }
  }

  // Fallback to high-fidelity mock data representing top Monad whales
  console.log(`[Social] Simulating whale tweets scan for: ${handles.join(', ')}`);
  return getSimulatedTweets(handles);
}

/**
 * Fetches recent posts from specified subreddits.
 */
export async function fetchRedditPosts(subreddits: string[]): Promise<SocialPost[]> {
  try {
    const posts: SocialPost[] = [];
    for (const sub of subreddits) {
      console.log(`[Social] Fetching recent posts from r/${sub} via public JSON feed...`);
      const response = await fetch(`https://www.reddit.com/r/${sub}/new.json?limit=5`);
      if (response.ok) {
        const data = await response.json();
        const children = data.data?.children || [];
        for (const child of children) {
          posts.push({
            source: 'REDDIT',
            author: child.data.author,
            content: `${child.data.title}\n\n${child.data.selftext || ''}`,
            timestamp: new Date(child.data.created_utc * 1000).toISOString(),
            url: `https://reddit.com${child.data.permalink}`
          });
        }
      }
    }
    if (posts.length > 0) return posts;
  } catch (err) {
    console.warn('[Social] Failed to fetch Reddit posts via public JSON. Using mock fallback.');
  }

  return getSimulatedRedditPosts(subreddits);
}

function getSimulatedTweets(handles: string[]): SocialPost[] {
  const allSimulated: Record<string, SocialPost[]> = {
    'keonehd': [
      {
        source: 'TWITTER',
        author: '@keoneHD',
        content: 'Monad devnet performance is exceeding expectations. DB read latencies are down to sub-millisecond ranges thanks to MonadDB. Parallel execution pipeline is stable. 10k TPS is just the baseline.',
        timestamp: new Date().toISOString(),
        url: 'https://x.com/keoneHD/status/12345678'
      },
      {
        source: 'TWITTER',
        author: '@keoneHD',
        content: 'Working closely with early builders. The gas fee structure on Monad is designed to stay predictable even during high traffic congestion. Super excited for mainnet launches.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        url: 'https://x.com/keoneHD/status/12345679'
      }
    ],
    'monad_xyz': [
      {
        source: 'TWITTER',
        author: '@monad_xyz',
        content: 'Ecosystem growth is accelerating! Monad Testnet has successfully processed over 500 million transactions. Builders are launching lending protocols, AMMs, and liquidity pools daily. Join the blitz!',
        timestamp: new Date().toISOString(),
        url: 'https://x.com/monad_xyz/status/98765432'
      }
    ],
    'cryptowhale': [
      {
        source: 'TWITTER',
        author: '@CryptoWhale',
        content: 'Watching MONAD closely. If they deliver true parallel EVM execution at scale, it completely reshapes the L1 narrative. Liquidity will migrate fast from alternative chains. Extremely bullish on this setup.',
        timestamp: new Date().toISOString(),
        url: 'https://x.com/CryptoWhale/status/54321098'
      }
    ]
  };

  const results: SocialPost[] = [];
  handles.forEach(h => {
    const key = h.toLowerCase().replace('@', '');
    if (allSimulated[key]) {
      results.push(...allSimulated[key]);
    } else {
      // Generic mock tweet
      results.push({
        source: 'TWITTER',
        author: h,
        content: `Just reviewed the recent Monad Testnet upgrades. Parallel execution handles heavy DeFi loads smoothly. Swapping MON is fast and gas costs are practically zero. Bullish narrative.`,
        timestamp: new Date().toISOString(),
        url: `https://x.com/${key}/status/11223344`
      });
    }
  });

  return results;
}

function getSimulatedRedditPosts(subreddits: string[]): SocialPost[] {
  const results: SocialPost[] = [];
  subreddits.forEach(sub => {
    results.push({
      source: 'REDDIT',
      author: 'u/monad_maxi',
      content: `Monad vs Ethereum L2s: Why parallel execution changes the game. L2s are cool but they fragment liquidity. Monad achieves high throughput while keeping a single state. Swapped 100 USDC for MON instantly on Testnet.`,
      timestamp: new Date().toISOString(),
      url: `https://reddit.com/r/${sub}/comments/12345`
    });
    results.push({
      source: 'REDDIT',
      author: 'u/defi_giga',
      content: `Warning: Some testnet DEXs are showing high slippage due to lack of USDC liquidity pool depth. Be careful when swapping large amounts of MON during peak hours. Leaning slightly cautious today.`,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      url: `https://reddit.com/r/${sub}/comments/67890`
    });
  });
  return results;
}

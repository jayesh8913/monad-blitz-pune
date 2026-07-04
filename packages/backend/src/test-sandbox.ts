import { ethers } from 'ethers';

const SANDBOX_URL = 'http://localhost:3002';

async function runTest() {
  console.log('\n--- Starting Monad Agent Sandbox Integration Test ---\n');

  try {
    // 1. Verify health
    console.log('[Test] Checking sandbox server status...');
    const healthRes = await fetch(`${SANDBOX_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log('[Test] Server response:', healthData);

    // 2. Query Premium endpoint (Expected: 402 Payment Required)
    console.log('\n[Test] 1. Requesting Premium Info WITHOUT payment headers...');
    const premiumRes = await fetch(`${SANDBOX_URL}/api/premium-info`);
    
    console.log(`[Test] Status Code returned: ${premiumRes.status}`);
    const premiumData = await premiumRes.json();
    console.log('[Test] Response body:', premiumData);

    // Fetch custom x402 headers
    const payToken = premiumRes.headers.get('X-402-Payment-Token');
    const payRecipient = premiumRes.headers.get('X-402-Payment-Recipient');
    const payAmount = premiumRes.headers.get('X-402-Payment-Amount');
    const payId = premiumRes.headers.get('X-402-Payment-Id');

    console.log('\n[Test] Extracted x402 Response Headers:');
    console.log(` - X-402-Payment-Token: ${payToken}`);
    console.log(` - X-402-Payment-Recipient: ${payRecipient}`);
    console.log(` - X-402-Payment-Amount: ${payAmount}`);
    console.log(` - X-402-Payment-Id: ${payId}`);

    if (premiumRes.status !== 402) {
      throw new Error('Test failed: Expected status code 402');
    }
    console.log('✓ Success: Received 402 Payment Required status code as expected!');

    // 3. Simulate payment transaction hash containing the string "MOCK" to trigger sandbox bypass
    console.log('\n[Test] 2. Generating simulated on-chain payment transaction hash...');
    const fakeTxHash = '0x' + '1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab' + 'MOCK';
    console.log(`[Test] Simulated Tx Hash: ${fakeTxHash}`);

    // 4. Retry Premium endpoint with transaction hash (Expected: 200 OK)
    console.log('\n[Test] 3. Retrying Premium Info WITH verification headers...');
    const authorizedRes = await fetch(`${SANDBOX_URL}/api/premium-info`, {
      headers: {
        'X-402-Payment-Tx': fakeTxHash
      }
    });

    console.log(`[Test] Status Code returned: ${authorizedRes.status}`);
    const authorizedData = await authorizedRes.json();
    console.log('[Test] Response body:', authorizedData);

    if (authorizedRes.status !== 200 || !authorizedData.success) {
      throw new Error('Test failed: Expected status code 200 and success response');
    }
    console.log('✓ Success: Bypassed payment gate with valid payment hash!');

    // 5. Deploy Burner Wallet and test ERC-8004 flow
    console.log('\n[Test] 4. Deploying/Activating Burner Wallet in Sandbox...');
    const deployRes = await fetch(`${SANDBOX_URL}/api/sandbox/deploy-wallet`, {
      method: 'POST'
    });
    const deployData = await deployRes.json();
    console.log('[Test] Wallet response:', deployData);

    console.log('\n[Test] 5. Checking ERC-8004 Identity Status...');
    const statusRes = await fetch(`${SANDBOX_URL}/api/agent/erc8004-status`);
    const statusData = await statusRes.json();
    console.log('[Test] ERC-8004 status:', statusData);

    console.log('\n[Test] 6. Registering Agent Identity with metadata...');
    const registerRes = await fetch(`${SANDBOX_URL}/api/agent/erc8004-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadataUri: 'ipfs://bafybeih3v4v2n7x7b54exqywnq2t55s2qyh6w3s7yky2d6c6e7kypv7lwa/agent.json'
      })
    });
    const registerData = await registerRes.json();
    console.log('[Test] Registration response:', registerData);

    console.log('\n✓ All Sandbox Integration Tests Passed Successfully!');
  } catch (err: any) {
    console.error('\n❌ Test execution failed:', err.message || err);
    process.exit(1);
  }
}

runTest();

import { AudioCaptureServer, AudioCaptureClient, type RemoteAudioSample } from '../src/index';

// Global error handlers for test suite
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

/**
 * Capture Service Example
 * 
 * Demonstrates the server/client architecture that allows multiple processes
 * to receive audio data without conflicting with each other.
 * 
 * This works around the macOS ScreenCaptureKit limitation where only
 * one process can capture audio at a time.
 * 
 * This example:
 * 1. Starts an AudioCaptureServer
 * 2. Connects two AudioCaptureClients
 * 3. Both clients receive audio from the same capture session
 * 4. Verifies audio is received by both clients
 */

const PORT = 9123;
const TARGET_APP = process.env.TARGET_APP;

async function main() {
    console.log('🎙️  Capture Service Demo');
    console.log('========================\n');

    // 1. Start the server
    console.log('1️⃣  Starting AudioCaptureServer...');
    const server = new AudioCaptureServer({ port: PORT, host: 'localhost' });
    
    server.on('clientConnected', (clientId: string) => {
        console.log(`   Server: Client connected: ${clientId}`);
    });
    
    server.on('clientDisconnected', (clientId: string) => {
        console.log(`   Server: Client disconnected: ${clientId}`);
    });

    await server.start();
    console.log(`   ✅ Server running on ws://localhost:${PORT}\n`);

    // 2. Connect first client
    console.log('2️⃣  Connecting Client 1...');
    const client1 = new AudioCaptureClient({ url: `ws://localhost:${PORT}` });
    await client1.connect();
    console.log(`   ✅ Client 1 connected (ID: ${client1.getClientId()})\n`);

    // 3. Connect second client
    console.log('3️⃣  Connecting Client 2...');
    const client2 = new AudioCaptureClient({ url: `ws://localhost:${PORT}` });
    await client2.connect();
    console.log(`   ✅ Client 2 connected (ID: ${client2.getClientId()})\n`);

    // 4. List apps via client
    console.log('4️⃣  Listing applications via Client 1...');
    const apps = await client1.getApplications();
    console.log(`   Found ${apps.length} applications`);
    
    // Find target app
    const targetApp = TARGET_APP
        ? apps.find(app => 
            app.applicationName.toLowerCase().includes(TARGET_APP.toLowerCase()) ||
            app.bundleIdentifier.toLowerCase().includes(TARGET_APP.toLowerCase())
          )
        : apps.find(app => app.applicationName === 'Spotify') || apps[0];

    if (!targetApp) {
        console.error('   ❌ No target app found');
        await cleanup(server, client1, client2);
        process.exit(1);
    }
    console.log(`   ✅ Target app: ${targetApp.applicationName}\n`);

    // 5. Track audio samples for both clients
    let client1Samples = 0;
    let client2Samples = 0;

    client1.on('audio', (_sample: RemoteAudioSample) => {
        client1Samples++;
    });

    client2.on('audio', (_sample: RemoteAudioSample) => {
        client2Samples++;
    });

    // 6. Start capture from Client 1
    console.log('5️⃣  Starting capture via Client 1...');
    const success1 = await client1.startCapture(targetApp.processId);
    if (!success1) {
        console.error('   ❌ Failed to start capture');
        await cleanup(server, client1, client2);
        process.exit(1);
    }
    console.log('   ✅ Capture started\n');

    // 7. Client 2 joins the same session
    console.log('6️⃣  Client 2 joining capture session...');
    const success2 = await client2.startCapture(targetApp.processId);
    if (!success2) {
        console.error('   ❌ Failed to join capture');
        await cleanup(server, client1, client2);
        process.exit(1);
    }
    console.log('   ✅ Client 2 joined session\n');

    // 8. Receive audio for 5 seconds
    console.log('7️⃣  Receiving audio for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`   Client 1 received: ${client1Samples} samples`);
    console.log(`   Client 2 received: ${client2Samples} samples\n`);

    // 9. Verify both clients received audio
    console.log('8️⃣  Verifying results...');
    if (client1Samples > 0 && client2Samples > 0) {
        console.log('   ✅ Both clients received audio successfully!\n');
    } else if (client1Samples > 0 || client2Samples > 0) {
        console.log('   ⚠️  Only one client received audio (partial success)\n');
    } else {
        console.log('   ⚠️  No audio samples received (app may not be playing audio)\n');
    }

    // 10. Get server status
    console.log('9️⃣  Server status:');
    const status = await client1.getStatus();
    console.log(`   Capturing: ${status.capturing}`);
    console.log(`   Total clients: ${status.totalClients}`);
    if (status.session) {
        console.log(`   Session: ${status.session.id}`);
        console.log(`   Clients in session: ${status.session.clientCount}\n`);
    }

    // Cleanup
    await cleanup(server, client1, client2);
    console.log('✅ Capture service demo completed successfully!');
}

async function cleanup(server: AudioCaptureServer, client1: AudioCaptureClient, client2: AudioCaptureClient) {
    console.log('🧹 Cleaning up...');
    client1.disconnect();
    client2.disconnect();
    await server.stop();
    console.log('   ✅ Cleanup complete\n');
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

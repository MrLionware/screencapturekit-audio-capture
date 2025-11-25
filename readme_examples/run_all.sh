#!/bin/bash

# Run each example for a few seconds to verify it doesn't crash
# We use 'timeout' to stop them after a duration, but since they are node processes, 
# we might need to handle it carefully. Mac doesn't have 'timeout' by default usually, 
# so we'll use a perl one-liner or just rely on the internal timeouts I added to the scripts.

# I added setTimeout to all scripts to stop them automatically.
# So we can just run them sequentially.

echo "Running 01-quick-start.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/01-quick-start.ts
echo "-----------------------------------"

echo "Running 02-stt-integration.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/02-stt-integration.ts
echo "-----------------------------------"

echo "Running 03-voice-agent.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/03-voice-agent.ts
echo "-----------------------------------"

echo "Running 04-audio-recording.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/04-audio-recording.ts
echo "-----------------------------------"

echo "Running 05-robust-capture.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/05-robust-capture.ts
echo "-----------------------------------"

echo "Running 06-stream-basics.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/06-stream-basics.ts
echo "-----------------------------------"

echo "Running 07-stream-processing.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/07-stream-processing.ts
echo "-----------------------------------"

echo "Running 08-visualizer.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/08-visualizer.ts
echo "-----------------------------------"

echo "Running 09-volume-monitor.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/09-volume-monitor.ts
echo "-----------------------------------"

echo "Running 10-int16-capture.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/10-int16-capture.ts
echo "-----------------------------------"

echo "Running 11-find-apps.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/11-find-apps.ts
echo "-----------------------------------"

echo "Running 12-manual-processing.ts..."
npx ts-node --project readme_examples/tsconfig.json readme_examples/12-manual-processing.ts
echo "-----------------------------------"

echo "All examples finished."

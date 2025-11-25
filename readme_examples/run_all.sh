#!/bin/bash

# ============================================================================
# README Examples Test Runner
# ============================================================================
# Tests all readme examples against the screencapturekit-audio-capture package
# to catch regressions when changes are made to the SDK or native wrapper.
#
# Usage: ./run_all.sh [APP_NAME]
# Example: ./run_all.sh "Google Chrome"
#          ./run_all.sh Spotify
#          ./run_all.sh           # Interactive selection
# ============================================================================

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$SCRIPT_DIR/.test-logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Test tracking
declare -a PASSED_TESTS=()
declare -a FAILED_TESTS=()
declare -a FAILED_REASONS=()
declare -a TEST_DURATIONS=()
TOTAL_START_TIME=$(date +%s)

# Create log directory
mkdir -p "$LOG_DIR"

# Function to check if app is producing audio
check_audio() {
    local app_name="$1"
    
    # Run a quick 3-second capture and check for audio
    node -e "
const {AudioCapture} = require('$PROJECT_DIR/dist');
const capture = new AudioCapture();
const apps = capture.getAudioApps();
const app = apps.find(a => a.applicationName === '$app_name');
if (!app) { console.log('APP_NOT_FOUND'); process.exit(0); }

let hasAudio = false;
let sampleCount = 0;

capture.on('audio', (sample) => {
    sampleCount++;
    if (sample.rms > 0.001) hasAudio = true;
});

capture.startCapture(app.processId);

setTimeout(() => {
    capture.stopCapture();
    if (hasAudio) {
        console.log('AUDIO_DETECTED');
    } else if (sampleCount > 0) {
        console.log('SILENCE_DETECTED');
    } else {
        console.log('NO_SAMPLES');
    }
    process.exit(0);
}, 3000);
" 2>/dev/null
}

# Function to list apps and let user select
select_app_interactive() {
    echo "========================================="
    echo "📱 Available apps with audio capability:"
    echo "========================================="
    
    # Get list of apps and store in array
    local apps_json=$(node -e "
const {AudioCapture} = require('$PROJECT_DIR/dist');
const capture = new AudioCapture();
const apps = capture.getAudioApps();
console.log(JSON.stringify(apps.map(a => a.applicationName)));
" 2>/dev/null)
    
    if [ -z "$apps_json" ] || [ "$apps_json" = "[]" ]; then
        echo "❌ No audio apps found. Make sure to build first: npm run build:ts"
        exit 1
    fi
    
    # Parse JSON array and display numbered list
    local i=1
    local app_names=()
    while IFS= read -r app; do
        app_names+=("$app")
        echo "  $i) $app"
        ((i++))
    done < <(echo "$apps_json" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')).forEach(a => console.log(a))")
    
    echo ""
    echo "  0) Cancel"
    echo ""
    read -p "Select an app (1-$((i-1))): " selection
    
    if [ "$selection" = "0" ] || [ -z "$selection" ]; then
        echo "Cancelled."
        exit 0
    fi
    
    # Validate selection
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt $((i-1)) ]; then
        echo "❌ Invalid selection."
        exit 1
    fi
    
    # Get selected app name
    export TARGET_APP="${app_names[$((selection-1))]}"
    echo ""
    echo "✅ Selected: $TARGET_APP"
}

# Function to run a single test and track results
run_test() {
    local test_name="$1"
    local test_file="$2"
    local log_file="$LOG_DIR/${test_name}_${TIMESTAMP}.log"
    
    echo -ne "${BLUE}▶${NC} Running ${BOLD}$test_name${NC}..."
    
    local start_time=$(date +%s)
    
    # Run the test and capture output
    local output
    local exit_code
    output=$(TARGET_APP="$TARGET_APP" npx ts-node --project readme_examples/tsconfig.json "$test_file" 2>&1)
    exit_code=$?
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    TEST_DURATIONS+=("$duration")
    
    # Save full output to log file
    echo "=== Test: $test_name ===" > "$log_file"
    echo "File: $test_file" >> "$log_file"
    echo "Target App: $TARGET_APP" >> "$log_file"
    echo "Exit Code: $exit_code" >> "$log_file"
    echo "Duration: ${duration}s" >> "$log_file"
    echo "Timestamp: $(date)" >> "$log_file"
    echo "---" >> "$log_file"
    echo "$output" >> "$log_file"
    
    if [ $exit_code -eq 0 ]; then
        PASSED_TESTS+=("$test_name")
        echo -e "\r${GREEN}✓${NC} ${BOLD}$test_name${NC} ${CYAN}(${duration}s)${NC}                    "
    else
        FAILED_TESTS+=("$test_name")
        
        # Extract error message (last few lines usually contain the error)
        local error_hint=$(echo "$output" | grep -i -E "(error|exception|failed|cannot|undefined|null)" | head -3)
        if [ -z "$error_hint" ]; then
            error_hint=$(echo "$output" | tail -5)
        fi
        FAILED_REASONS+=("$error_hint")
        
        echo -e "\r${RED}✗${NC} ${BOLD}$test_name${NC} ${RED}FAILED${NC} ${CYAN}(${duration}s)${NC}     "
        echo -e "  ${YELLOW}Log: $log_file${NC}"
    fi
}

# Function to print test summary
print_summary() {
    local total_end_time=$(date +%s)
    local total_duration=$((total_end_time - TOTAL_START_TIME))
    local total_tests=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]}))
    
    echo ""
    echo "=============================================="
    echo -e "${BOLD}📊 TEST SUMMARY${NC}"
    echo "=============================================="
    echo ""
    echo -e "Target App:    ${CYAN}$TARGET_APP${NC}"
    echo -e "Total Tests:   ${BOLD}$total_tests${NC}"
    echo -e "Passed:        ${GREEN}${#PASSED_TESTS[@]}${NC}"
    echo -e "Failed:        ${RED}${#FAILED_TESTS[@]}${NC}"
    echo -e "Duration:      ${CYAN}${total_duration}s${NC}"
    echo ""
    
    if [ ${#PASSED_TESTS[@]} -gt 0 ]; then
        echo -e "${GREEN}✓ Passed Tests:${NC}"
        for test in "${PASSED_TESTS[@]}"; do
            echo -e "  ${GREEN}•${NC} $test"
        done
        echo ""
    fi
    
    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        echo -e "${RED}✗ Failed Tests:${NC}"
        for i in "${!FAILED_TESTS[@]}"; do
            echo -e "  ${RED}•${NC} ${FAILED_TESTS[$i]}"
            if [ -n "${FAILED_REASONS[$i]}" ]; then
                echo -e "    ${YELLOW}Hint:${NC}"
                echo "${FAILED_REASONS[$i]}" | sed 's/^/      /'
            fi
        done
        echo ""
        echo -e "${YELLOW}📁 Full logs available in: $LOG_DIR${NC}"
        echo ""
    fi
    
    # Final status
    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        echo "=============================================="
        echo -e "${GREEN}${BOLD}✅ ALL TESTS PASSED${NC}"
        echo "=============================================="
        return 0
    else
        echo "=============================================="
        echo -e "${RED}${BOLD}❌ ${#FAILED_TESTS[@]} TEST(S) FAILED${NC}"
        echo "=============================================="
        echo ""
        echo "To debug a failed test, check the log file or run it directly:"
        echo -e "  ${CYAN}TARGET_APP=\"$TARGET_APP\" npx ts-node --project readme_examples/tsconfig.json readme_examples/<example>.ts${NC}"
        return 1
    fi
}

# Main logic
if [ -n "$1" ]; then
    export TARGET_APP="$1"
    echo "========================================="
    echo "🎯 Target app: $TARGET_APP"
    echo "========================================="
else
    select_app_interactive
fi

echo ""
echo "🔊 Checking if \"$TARGET_APP\" is producing audio (3 seconds)..."

# Check if app produces audio
audio_status=$(check_audio "$TARGET_APP")

case "$audio_status" in
    "APP_NOT_FOUND")
        echo "❌ App \"$TARGET_APP\" not found in running applications."
        echo ""
        echo "Available apps:"
        node -e "const {AudioCapture} = require('$PROJECT_DIR/dist'); const c = new AudioCapture(); c.getAudioApps().forEach(a => console.log('  - ' + a.applicationName));" 2>/dev/null
        exit 1
        ;;
    "SILENCE_DETECTED")
        echo "⚠️  App \"$TARGET_APP\" is not producing audio."
        echo "   Please play some audio in the app and try again."
        exit 1
        ;;
    "NO_SAMPLES")
        echo "⚠️  Could not get audio samples from \"$TARGET_APP\"."
        echo "   Make sure the app is running and has audio permissions."
        exit 1
        ;;
    "AUDIO_DETECTED")
        echo "✅ Audio detected from \"$TARGET_APP\"!"
        echo ""
        ;;
    *)
        echo "⚠️  Unexpected result: $audio_status"
        echo "   Continuing anyway..."
        echo ""
        ;;
esac

echo "========================================="
echo -e "🚀 ${BOLD}Starting Test Suite${NC}"
echo "========================================="
echo -e "Target App: ${CYAN}$TARGET_APP${NC}"
echo -e "Log Dir:    ${CYAN}$LOG_DIR${NC}"
echo "========================================="
echo ""

# Run all tests
run_test "01-quick-start"      "readme_examples/01-quick-start.ts"
run_test "02-stt-integration"  "readme_examples/02-stt-integration.ts"
run_test "03-voice-agent"      "readme_examples/03-voice-agent.ts"
run_test "04-audio-recording"  "readme_examples/04-audio-recording.ts"
run_test "05-robust-capture"   "readme_examples/05-robust-capture.ts"
run_test "06-stream-basics"    "readme_examples/06-stream-basics.ts"
run_test "07-stream-processing" "readme_examples/07-stream-processing.ts"
run_test "08-visualizer"       "readme_examples/08-visualizer.ts"
run_test "09-volume-monitor"   "readme_examples/09-volume-monitor.ts"
run_test "10-int16-capture"    "readme_examples/10-int16-capture.ts"
run_test "11-find-apps"        "readme_examples/11-find-apps.ts"
run_test "12-manual-processing" "readme_examples/12-manual-processing.ts"

# Print summary and exit with appropriate code
print_summary
exit $?

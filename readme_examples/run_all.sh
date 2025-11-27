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
    
    # Store app names for second app selection
    AVAILABLE_APP_NAMES=("${app_names[@]}")
}

# Function to select a second app for multi-app examples
select_second_app_interactive() {
    echo ""
    echo "========================================="
    echo "📱 Select a SECOND app for multi-app tests:"
    echo "========================================="
    
    # Get list of apps again
    local apps_json=$(node -e "
const {AudioCapture} = require('$PROJECT_DIR/dist');
const capture = new AudioCapture();
const apps = capture.getAudioApps();
console.log(JSON.stringify(apps.map(a => a.applicationName)));
" 2>/dev/null)
    
    if [ -z "$apps_json" ] || [ "$apps_json" = "[]" ]; then
        echo "⚠️  No other audio apps found. Multi-app tests will use fallback."
        return
    fi
    
    # Parse JSON array and display numbered list (excluding first app)
    local i=1
    local app_names=()
    while IFS= read -r app; do
        if [ "$app" != "$TARGET_APP" ]; then
            app_names+=("$app")
            echo "  $i) $app"
            ((i++))
        fi
    done < <(echo "$apps_json" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')).forEach(a => console.log(a))")
    
    if [ ${#app_names[@]} -eq 0 ]; then
        echo "⚠️  No other audio apps available. Multi-app tests will use fallback."
        return
    fi
    
    echo ""
    echo "  0) Skip (use fallback for multi-app tests)"
    echo ""
    read -p "Select second app (1-$((i-1)), or 0 to skip): " selection
    
    if [ "$selection" = "0" ] || [ -z "$selection" ]; then
        echo "Skipped. Multi-app tests will use fallback."
        return
    fi
    
    # Validate selection
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt $((i-1)) ]; then
        echo "⚠️  Invalid selection. Multi-app tests will use fallback."
        return
    fi
    
    # Get selected second app name
    export TARGET_APP_2="${app_names[$((selection-1))]}"
    export TARGET_APPS="$TARGET_APP,$TARGET_APP_2"
    echo ""
    echo "✅ Second app selected: $TARGET_APP_2"
    echo "✅ TARGET_APPS=$TARGET_APPS"
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
    output=$(TARGET_APP="$TARGET_APP" npx tsx "$test_file" 2>&1)
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
        echo -e "  ${CYAN}TARGET_APP=\"$TARGET_APP\" npx tsx readme_examples/<example>.ts${NC}"
        return 1
    fi
}

# Main logic
if [ -n "$1" ]; then
    export TARGET_APP="$1"
    echo "========================================="
    echo "🎯 Target app: $TARGET_APP"
    echo "========================================="
    
    # Check for second app argument
    if [ -n "$2" ]; then
        export TARGET_APP_2="$2"
        export TARGET_APPS="$TARGET_APP,$TARGET_APP_2"
        echo "🎯 Second app: $TARGET_APP_2"
        echo "🎯 TARGET_APPS: $TARGET_APPS"
        echo "========================================="
    fi
else
    select_app_interactive
fi

# If no second app specified, ask interactively
if [ -z "$TARGET_APPS" ]; then
    select_second_app_interactive
fi

# Select window for window capture tests
select_window_interactive() {
    echo ""
    echo "========================================="
    echo "🪟  Select a WINDOW for window capture tests:"
    echo "========================================="
    
    local windows_json=$(node -e "
const {AudioCapture} = require('$PROJECT_DIR/dist');
const capture = new AudioCapture();
const windows = capture.getWindows().filter(w => w.title && w.title.length > 0).slice(0, 20);
console.log(JSON.stringify(windows.map(w => ({id: w.windowId, app: w.owningApplicationName || 'Unknown', title: w.title}))));
" 2>/dev/null)
    
    if [ -z "$windows_json" ] || [ "$windows_json" = "[]" ]; then
        echo "⚠️  No windows found. Window tests will use auto-selection."
        return
    fi
    
    local i=1
    local window_ids=()
    while IFS= read -r line; do
        local id=$(echo "$line" | cut -d'|' -f1)
        local app=$(echo "$line" | cut -d'|' -f2)
        local title=$(echo "$line" | cut -d'|' -f3)
        window_ids+=("$id")
        # Truncate title if too long
        if [ ${#title} -gt 40 ]; then
            title="${title:0:37}..."
        fi
        echo "  $i) [$app] $title"
        ((i++))
    done < <(echo "$windows_json" | node -e "
const data = JSON.parse(require('fs').readFileSync(0,'utf8'));
data.forEach(w => console.log(w.id + '|' + w.app + '|' + w.title));
")
    
    echo ""
    echo "  0) Skip (use auto-selection)"
    echo ""
    read -p "Select window (1-$((i-1)), or 0 to skip): " selection
    
    if [ "$selection" = "0" ] || [ -z "$selection" ]; then
        echo "Skipped. Window tests will use auto-selection."
        return
    fi
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt $((i-1)) ]; then
        echo "⚠️  Invalid selection. Window tests will use auto-selection."
        return
    fi
    
    export TARGET_WINDOW="${window_ids[$((selection-1))]}"
    echo ""
    echo "✅ Window selected: ID $TARGET_WINDOW"
}

# Select display for display capture tests
select_display_interactive() {
    echo ""
    echo "========================================="
    echo "🖥️  Select a DISPLAY for display capture tests:"
    echo "========================================="
    
    local displays_json=$(node -e "
const {AudioCapture} = require('$PROJECT_DIR/dist');
const capture = new AudioCapture();
const displays = capture.getDisplays();
console.log(JSON.stringify(displays.map(d => ({id: d.displayId, width: d.width, height: d.height, main: d.isMainDisplay}))));
" 2>/dev/null)
    
    if [ -z "$displays_json" ] || [ "$displays_json" = "[]" ]; then
        echo "⚠️  No displays found. Display tests will use auto-selection."
        return
    fi
    
    local i=1
    local display_ids=()
    while IFS= read -r line; do
        local id=$(echo "$line" | cut -d'|' -f1)
        local res=$(echo "$line" | cut -d'|' -f2)
        local main=$(echo "$line" | cut -d'|' -f3)
        display_ids+=("$id")
        local main_badge=""
        if [ "$main" = "true" ]; then
            main_badge=" ★ Main"
        fi
        echo "  $i) Display $id - ${res}${main_badge}"
        ((i++))
    done < <(echo "$displays_json" | node -e "
const data = JSON.parse(require('fs').readFileSync(0,'utf8'));
data.forEach(d => console.log(d.id + '|' + d.width + 'x' + d.height + '|' + d.main));
")
    
    echo ""
    echo "  0) Skip (use auto-selection)"
    echo ""
    read -p "Select display (1-$((i-1)), or 0 to skip): " selection
    
    if [ "$selection" = "0" ] || [ -z "$selection" ]; then
        echo "Skipped. Display tests will use auto-selection."
        return
    fi
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt $((i-1)) ]; then
        echo "⚠️  Invalid selection. Display tests will use auto-selection."
        return
    fi
    
    export TARGET_DISPLAY="${display_ids[$((selection-1))]}"
    echo ""
    echo "✅ Display selected: ID $TARGET_DISPLAY"
}

# Ask user to select window and display
select_window_interactive
select_display_interactive

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
echo -e "Target App:   ${CYAN}$TARGET_APP${NC}"
if [ -n "$TARGET_APPS" ]; then
    echo -e "Multi-App:    ${CYAN}$TARGET_APPS${NC}"
fi
if [ -n "$TARGET_WINDOW" ]; then
    echo -e "Window ID:    ${CYAN}$TARGET_WINDOW${NC}"
fi
if [ -n "$TARGET_DISPLAY" ]; then
    echo -e "Display ID:   ${CYAN}$TARGET_DISPLAY${NC}"
fi
echo -e "Log Dir:      ${CYAN}$LOG_DIR${NC}"
echo "========================================="
echo ""

# Run all tests by category

echo ""
echo -e "${BOLD}📁 Category: Basics${NC}"
echo "-------------------------------------------"
run_test "01-quick-start"      "readme_examples/basics/01-quick-start.ts"
run_test "05-robust-capture"   "readme_examples/basics/05-robust-capture.ts"
run_test "11-find-apps"        "readme_examples/basics/11-find-apps.ts"

echo ""
echo -e "${BOLD}📁 Category: Voice & STT${NC}"
echo "-------------------------------------------"
run_test "02-stt-integration"  "readme_examples/voice/02-stt-integration.ts"
run_test "03-voice-agent"      "readme_examples/voice/03-voice-agent.ts"
run_test "04-audio-recording"  "readme_examples/voice/04-audio-recording.ts"

echo ""
echo -e "${BOLD}📁 Category: Streams${NC}"
echo "-------------------------------------------"
run_test "06-stream-basics"    "readme_examples/streams/06-stream-basics.ts"
run_test "07-stream-processing" "readme_examples/streams/07-stream-processing.ts"

echo ""
echo -e "${BOLD}📁 Category: Processing${NC}"
echo "-------------------------------------------"
run_test "08-visualizer"       "readme_examples/processing/08-visualizer.ts"
run_test "09-volume-monitor"   "readme_examples/processing/09-volume-monitor.ts"
run_test "10-int16-capture"    "readme_examples/processing/10-int16-capture.ts"
run_test "12-manual-processing" "readme_examples/processing/12-manual-processing.ts"

echo ""
echo -e "${BOLD}📁 Category: Capture Targets${NC}"
echo "-------------------------------------------"
run_test "13-multi-app-capture" "readme_examples/capture-targets/13-multi-app-capture.ts"
run_test "14-per-app-streams" "readme_examples/capture-targets/14-per-app-streams.ts"
run_test "15-window-capture" "readme_examples/capture-targets/15-window-capture.ts"
run_test "16-display-capture" "readme_examples/capture-targets/16-display-capture.ts"
run_test "17-multi-window-capture" "readme_examples/capture-targets/17-multi-window-capture.ts"
run_test "18-multi-display-capture" "readme_examples/capture-targets/18-multi-display-capture.ts"

echo ""
echo -e "${BOLD}📁 Category: Advanced${NC}"
echo "-------------------------------------------"
run_test "19-advanced-methods" "readme_examples/advanced/19-advanced-methods.ts"
run_test "20-capture-service" "readme_examples/advanced/20-capture-service.ts"
run_test "21-graceful-cleanup" "readme_examples/advanced/21-graceful-cleanup.ts"

# Print summary and exit with appropriate code
print_summary
exit $?

/**
 * Artifact Pusher Module
 * 
 * Monitors the active thread's artifact directory and pushes new
 * images and videos directly to Telegram.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getActiveThreadId } = require('./cdp_controller');

let isEnabled = false;
let lastThreadId = null;
let pushedFiles = new Set();
let checkInterval = null;

const BRAIN_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

/**
 * Start monitoring for new artifacts.
 * @param {object} bot - Telegraf bot instance
 * @param {string} chatId - Chat ID to send pushed artifacts to
 */
function startArtifactPusher(bot, chatId) {
    if (!chatId) return;
    
    isEnabled = process.env.PUSH_ARTIFACTS === 'true';
    if (!isEnabled) return;

    const doPushCheck = async () => {
        try {
            const activeId = await getActiveThreadId(process.env.DEBUGGING_PORT || 9333);
            if (!activeId) return;

            // If thread changed, reset pushed files set
            if (activeId !== lastThreadId) {
                lastThreadId = activeId;
                pushedFiles.clear();
                
                // Pre-populate with existing files so we don't spam old ones on thread switch
                const threadDir = path.join(BRAIN_PATH, activeId);
                if (fs.existsSync(threadDir)) {
                    const files = fs.readdirSync(threadDir);
                    files.forEach(f => pushedFiles.add(path.join(threadDir, f)));
                    
                    const scratchDir = path.join(threadDir, 'scratch');
                    if (fs.existsSync(scratchDir)) {
                        const sFiles = fs.readdirSync(scratchDir);
                        sFiles.forEach(f => pushedFiles.add(path.join(scratchDir, f)));
                    }
                }
                return;
            }

            const threadDir = path.join(BRAIN_PATH, activeId);
            if (!fs.existsSync(threadDir)) return;

            const checkDir = (dir) => {
                if (!fs.existsSync(dir)) return;
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (pushedFiles.has(fullPath)) continue;
                    
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) continue;
                    
                    // Only push images and videos
                    const ext = path.extname(file).toLowerCase();
                    const isMedia = ['.png', '.jpg', '.jpeg', '.mp4', '.mov'].includes(ext);
                    
                    if (isMedia) {
                        // Wait a bit to ensure the file is fully written
                        setTimeout(async () => {
                            try {
                                if (ext === '.mp4' || ext === '.mov') {
                                    await bot.telegram.sendVideo(chatId, { source: fullPath }, { caption: `🎥 New Artifact: ${file}` });
                                } else {
                                    await bot.telegram.sendPhoto(chatId, { source: fullPath }, { caption: `🖼️ New Artifact: ${file}` });
                                }
                                console.log(`[artifact-pusher] Pushed: ${file}`);
                            } catch (err) {
                                console.error(`[artifact-pusher] Failed to push ${file}:`, err.message);
                            }
                        }, 2000);
                    }
                    
                    pushedFiles.add(fullPath);
                }
            };

            checkDir(threadDir);
            checkDir(path.join(threadDir, 'scratch'));

        } catch (e) {
            console.debug(`[artifact-pusher] check failed: ${e.message}`);
        }
    };

    // Periodic check every 15 seconds
    checkInterval = setInterval(doPushCheck, 15000);
}

function setEnabled(val) {
    isEnabled = val;
    process.env.PUSH_ARTIFACTS = val ? 'true' : 'false';
}

function getStatus() {
    return isEnabled;
}

module.exports = {
    startArtifactPusher,
    setEnabled,
    getStatus
};

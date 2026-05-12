const {
    selectModel,
    sendViaCDP,
    snapshotChatState,
    waitForAgentResponse,
    getFullLatestResponse,
} = require('./cdp_controller');

/**
 * Runs the Multi-Agent "Agents Council" workflow.
 * Phase 1: Planning (Claude)
 * Phase 2: Execution (Gemini)
 * Phase 3: Review (Claude)
 * Phase 4: Fix (Gemini) [Conditional]
 */
async function runTurboOrchestration(query, CDP_PORT, explicitTargetId, ctx, createProgressHandler, stripQueryFromResponse) {
    let statusMsgId = null;

    try {
        // Send initial status
        const statusMsg = await ctx.reply('🚀 <b>Turbo Mod Başlatıldı:</b>\n\n⏳ <b>Faz 1:</b> Model seçiliyor (Claude)...', { parse_mode: 'HTML' });
        statusMsgId = statusMsg.message_id;

        // --- PHASE 1: PLANNING (Claude) ---
        await selectModel(CDP_PORT, "Claude Opus 4.6 (Thinking)");
        await new Promise(r => setTimeout(r, 800));

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsgId, null,
            '🚀 <b>Turbo Mod Başlatıldı:</b>\n\n⏳ <b>Faz 1:</b> Claude planı hazırlıyor...',
            { parse_mode: 'HTML' }
        ).catch(() => {});

        const pmPrompt = `You are the Project Manager and Lead Architect. Create a detailed, step-by-step implementation plan for the following request. List the files to create/modify, the architecture decisions, and define clear tasks. Do NOT write the final code yet.\n\nUser Request: ${query}`;
        
        const sentTargetId = await sendViaCDP(pmPrompt, CDP_PORT, explicitTargetId);
        await new Promise(r => setTimeout(r, 2000));
        await snapshotChatState(CDP_PORT).catch(() => {});
        
        let isDone = await waitForAgentResponse(CDP_PORT, 600000, createProgressHandler(ctx), sentTargetId);
        if (!isDone) throw new Error("Claude planlama aşamasında zaman aşımına uğradı.");

        let planText = await getFullLatestResponse(CDP_PORT, sentTargetId);
        planText = stripQueryFromResponse(planText, pmPrompt);

        // Update Telegram Status
        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsgId, null,
            '🚀 <b>Turbo Mod Aktif:</b>\n\n✅ <b>Faz 1:</b> Claude planı tamamladı.\n⏳ <b>Faz 2:</b> Model değiştiriliyor (Gemini)...',
            { parse_mode: 'HTML' }
        ).catch(() => {});

        // --- PHASE 2: EXECUTION (Gemini) ---
        await selectModel(CDP_PORT, "Gemini 3.1 Pro (High)");
        await new Promise(r => setTimeout(r, 800));

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsgId, null,
            '🚀 <b>Turbo Mod Aktif:</b>\n\n✅ <b>Faz 1:</b> Claude planı tamamladı.\n⏳ <b>Faz 2:</b> Gemini kodları yazıyor...',
            { parse_mode: 'HTML' }
        ).catch(() => {});

        const coderPrompt = `You are the Lead Developer. The Project Manager (Claude) has created the following implementation plan. Execute it precisely — write the code, create/modify the files as specified. Follow the plan strictly.\n\n--- PLAN ---\n${planText}\n--- END PLAN ---`;
        
        const sentTargetId2 = await sendViaCDP(coderPrompt, CDP_PORT, sentTargetId);
        await new Promise(r => setTimeout(r, 2000));
        await snapshotChatState(CDP_PORT).catch(() => {});
        
        isDone = await waitForAgentResponse(CDP_PORT, 600000, createProgressHandler(ctx), sentTargetId2);
        if (!isDone) throw new Error("Gemini kodlama aşamasında zaman aşımına uğradı.");

        let finalText = await getFullLatestResponse(CDP_PORT, sentTargetId2);
        finalText = stripQueryFromResponse(finalText, coderPrompt);

        // --- PHASE 3: REVIEW (Claude) ---
        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsgId, null,
            '🚀 <b>Turbo Mod Aktif:</b>\n\n✅ <b>Faz 1:</b> Planlama\n✅ <b>Faz 2:</b> Kodlama\n⏳ <b>Faz 3:</b> Model değiştiriliyor (Claude) - İnceleme...',
            { parse_mode: 'HTML' }
        ).catch(() => {});

        await selectModel(CDP_PORT, "Claude Opus 4.6 (Thinking)");
        await new Promise(r => setTimeout(r, 800));

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsgId, null,
            '🚀 <b>Turbo Mod Aktif:</b>\n\n✅ <b>Faz 1:</b> Planlama\n✅ <b>Faz 2:</b> Kodlama\n⏳ <b>Faz 3:</b> Claude yazılan kodu inceliyor...',
            { parse_mode: 'HTML' }
        ).catch(() => {});

        const reviewPrompt = `You are the Security Auditor and Code Reviewer. Review the code that was just written.\nIf you find critical bugs or security issues, list them clearly with "ISSUES_FOUND: true".\nIf everything looks good, respond with "ISSUES_FOUND: false".`;
        
        const sentTargetId3 = await sendViaCDP(reviewPrompt, CDP_PORT, sentTargetId2);
        await new Promise(r => setTimeout(r, 2000));
        await snapshotChatState(CDP_PORT).catch(() => {});
        
        isDone = await waitForAgentResponse(CDP_PORT, 600000, createProgressHandler(ctx), sentTargetId3);
        if (!isDone) throw new Error("Claude inceleme aşamasında zaman aşımına uğradı.");

        let reviewText = await getFullLatestResponse(CDP_PORT, sentTargetId3);
        reviewText = stripQueryFromResponse(reviewText, reviewPrompt);
        
        finalText = reviewText;

        const hasIssues = reviewText.includes("ISSUES_FOUND: true");

        if (hasIssues) {
            // --- PHASE 4: FIX (Gemini) ---
            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsgId, null,
                '🚀 <b>Turbo Mod Aktif:</b>\n\n✅ <b>Faz 1:</b> Planlama\n✅ <b>Faz 2:</b> Kodlama\n⚠️ <b>Faz 3:</b> Hatalar bulundu!\n⏳ <b>Faz 4:</b> Model değiştiriliyor (Gemini) - Düzeltme...',
                { parse_mode: 'HTML' }
            ).catch(() => {});

            await selectModel(CDP_PORT, "Gemini 3.1 Pro (High)");
            await new Promise(r => setTimeout(r, 800));

            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsgId, null,
                '🚀 <b>Turbo Mod Aktif:</b>\n\n✅ <b>Faz 1:</b> Planlama\n✅ <b>Faz 2:</b> Kodlama\n⚠️ <b>Faz 3:</b> Hatalar bulundu!\n⏳ <b>Faz 4:</b> Gemini hataları düzeltiyor...',
                { parse_mode: 'HTML' }
            ).catch(() => {});

            const fixPrompt = `You are the Lead Developer. The Security Auditor found issues in the previous implementation. Please fix all the issues mentioned by the Auditor.`;
            
            const sentTargetId4 = await sendViaCDP(fixPrompt, CDP_PORT, sentTargetId3);
            await new Promise(r => setTimeout(r, 2000));
            await snapshotChatState(CDP_PORT).catch(() => {});
            
            isDone = await waitForAgentResponse(CDP_PORT, 600000, createProgressHandler(ctx), sentTargetId4);
            if (!isDone) throw new Error("Gemini düzeltme aşamasında zaman aşımına uğradı.");

            let fixText = await getFullLatestResponse(CDP_PORT, sentTargetId4);
            finalText = stripQueryFromResponse(fixText, fixPrompt);

            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsgId, null,
                '🚀 <b>Turbo Mod Tamamlandı:</b>\n\n✅ <b>Faz 1:</b> Planlama (Claude)\n✅ <b>Faz 2:</b> Kodlama (Gemini)\n⚠️ <b>Faz 3:</b> İnceleme (Claude)\n✅ <b>Faz 4:</b> Düzeltme (Gemini)\n\n✨ Sonuçlar geliyor...',
                { parse_mode: 'HTML' }
            ).catch(() => {});

        } else {
            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsgId, null,
                '🚀 <b>Turbo Mod Tamamlandı:</b>\n\n✅ <b>Faz 1:</b> Planlama (Claude)\n✅ <b>Faz 2:</b> Kodlama (Gemini)\n✅ <b>Faz 3:</b> İnceleme - Sorun Yok (Claude)\n\n✨ Sonuçlar geliyor...',
                { parse_mode: 'HTML' }
            ).catch(() => {});
        }

        return finalText;

    } catch (err) {
        console.error('[turbo] Orchestration error:', err.message);
        if (statusMsgId) {
            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsgId, null,
                `❌ <b>Turbo Mod Hatası:</b>\n\n${err.message}`,
                { parse_mode: 'HTML' }
            ).catch(() => {});
        }
        throw err;
    }
}

module.exports = {
    runTurboOrchestration
};

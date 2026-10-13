**ROLE & OBJECTIVE**
Act as a Principal Full-Stack Software Engineer and Lead Narrative Game Designer. Build "Corporate Bunker", a premium, real-time multiplayer web application for exactly 15 players + 1 Host. This is a high-stakes, state-driven psychological corporate survival game based on Patrick Lencioni's "The Five Dysfunctions of a Team".

**TECH STACK & ARCHITECTURE**
*   **Frontend:** Next.js (React), Tailwind CSS, Framer Motion (crucial for cinematic layout transitions, full-screen text reveals, and micro-interactions).
*   **Backend/State Management:** Use a robust real-time sync solution (Supabase, Firebase, or WebSockets/Socket.io). State must sync instantly across all clients.
*   **Deployment:** Production-ready (e.g., Vercel).

**DYNAMIC "PARASITE" MECHANIC (SECRET FLAWS)**
Exactly 5 players get a **Secret Flaw** (Distributed: 1 Head, 2 TLs, 2 Managers). Flawed players WIN if they survive all 5 rounds without getting fired.
*   **Flaw Burnout (Graduation):** Flawed players DO NOT get constructive options during a crisis. They receive 3 toxic options: Light, Medium, Hard. If they select "Light" (e.g., stay silent), it BURNS and becomes unavailable for future crises. They are forced into Medium/Hard actions (sabotage) later.
*   **Superpowers:** Unlocked at Crisis 3. It acts as an "Ultimate" (e.g., "Team Shield" to block a vote against them, or "Veto" to stop a vote).
*   **The Alibi System:** Immediately after a Flawed player submits a toxic choice, their UI displays an "Alibi" script (e.g., "Tell everyone you did this to protect the team from burnout") to help them lie during the verbal debrief.

**THE 7-PHASE GAME LOOP**

*   **PHASE 1: SECURE LOBBY & INTRO**
    *   Players visit `/`. Enter Room Code, Name, and select available Role/Department. Dynamic limits prevent over-selection (e.g., Max 2 Heads). Normal users cannot see Host creation tools.
    *   Host (via `/admin`) clicks "Start". Cinematic text scrolls: *"We were thriving. Suddenly, the market collapsed. We must purge the rot to survive."*
*   **PHASE 2: FOCUS MODE UI (PROFILE ACKNOWLEDGMENT)**
    *   Players read their Lore & Flaw. They MUST click a green "Ознайомився" (Acknowledged) button. 
    *   *UI Polish:* The massive profile UI smoothly collapses into a thin, expandable top bar (Focus Mode) to clear visual clutter.
*   **PHASE 3: CINEMATIC CRISIS TRIGGER**
    *   Host launches 1 of 5 Crises. Starts at Heads level.
    *   *UI Polish:* Screen darkens, Crisis text appears centrally, large and cinematic. Player reads, clicks "Understood", and ONLY THEN do action buttons appear.
*   **PHASE 4: THE CASCADE & CORPORATE SPLIT**
    *   Info flows: Heads ➔ Team Leads ➔ Managers. ALL players in a tier must vote. Majority rules.
    *   *Corporate Split:* If the 2 Heads vote for different solutions, the system randomly splits the company: Half the Team Leads receive Head A's directive, the other half receive Head B's.
*   **PHASE 5: THE TRIBUNE DEBRIEF (Sequential Speaking)**
    *   Host triggers Debrief. A 7:00 countdown starts.
    *   *Sequential UI:* The UI dictates whose turn it is to speak verbally. Screen shows: "Current Speaker: Head 1. Up next: Team Lead 2." The active speaker's screen prompts: "You chose [Action]. Justify it!". The active speaker clicks "Defended / Pass Turn" to pass the spotlight. Host can force-skip.
*   **PHASE 6: 3-STEP PURGE VOTING**
    *   Prompt: "Ready to vote? [Yes/No]". If ANY player clicks "No", add exactly +1:00. If all click "Yes", voting begins.
    *   Vote UI: 1) Select Department. 2) Select Person. 3) Text input: "Why did they make the wrong choice?". Player with most votes is fired.
    *   *Endgame:* 5 rounds = 5 fired. If 1+ Flawed players survive to the end, the company loses.
*   **PHASE 7: GHOST MODE**
    *   Fired players turn grayscale (Read-Only). They watch the cascade.
    *   They have a "Ghost Chat" input. Messages go directly to the Host Command Center to be read aloud.

**HOST COMMAND CENTER (Admin Panel)**
*   **Live Node Tree (Visual Map):** Visual hierarchy map (2 Heads -> 4 TLs -> 9 Managers). Instead of a cluttered text log, generate a visual Node Tree where Green lines show constructive paths and Red lines show flawed/toxic paths.
*   **Kick Functionality:** Disconnect any player instantly.

**IMPLEMENTATION INSTRUCTIONS**
1. Design a strictly normalized DB schema / State Machine capable of handling the 3-tier Consensus Engine, Corporate Splits, and Ghost mode.
2. Build the UI with a "Dark Cyberpunk / Corporate Thriller" aesthetic using glassmorphism.
3. Ensure bulletproof WebSocket reconnection logic (if a player refreshes, they instantly rejoin their exact state).
4. Output the complete, production-ready codebase separated by components.
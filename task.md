CRITICAL UPDATE 2: LOBBY REWORK, CONSENSUS ENGINE, AND SECURITY

Please implement the following critical updates to the game's architecture, flow, and UI/UX. These override any previous instructions regarding the login flow and state advancement.

1. Hidden Host Route & Security (No Player Room Creation)

- Remove the Host/Player toggle from the main landing page (`/`).
- The root page (`/`) must STRICTLY be a Player Join screen. Normal users should have absolutely no UI elements suggesting they can create a room.
- Host Access: Create a separate, hidden route (e.g., /host or `/admin`). The Game Master will navigate here directly to create and manage the room.

2. Two-Step Join Flow & Dynamic Role Limits

- Step 1 (Room Connect): The player goes to /, enters the Room Code, and clicks "Connect".
- Step 2 (Data & Role Selection): Once successfully connected to the room lobby, the player is prompted to enter their Name and select a Role/Department.
- Host Role Configuration: When the Host creates the room, they have a settings panel to define player limits for specific tiers (e.g., Max Heads: 2, Max Team Leads: 4, Managers: Unlimited).
- Dynamic UI: In the Player's Step 2 dropdown, if a role's limit is reached (e.g., 2 players have already claimed "Head"), that role is disabled/grayed out or hidden from the list.

3. Host Kick Functionality

- In the Host Command Center (both in the pre-game lobby and during the active game), the Host must have a "Kick" (Remove) button next to every player's name in the Node Tree/List.
- Clicking this instantly severs the WebSocket connection for that player, removes them from the DB state, and shows a "You have been removed by the Admin" screen on the player's device.

4. The Consensus Engine (Handling Multiple Players in the Same Role)

- The Bug: Currently, if there are 3 Team Leads, one person clicking a choice might advance the state for everyone. This is incorrect.
- The Fix: Implement a "Consensus Engine" for Phase progression. When a crisis hits a specific tier (e.g., Level 3 Managers in the Forward department), ALL active players in that specific group must submit their vote.
- UI Updates: While waiting, players who voted see: _"Waiting for other colleagues to decide..."_. The Host dashboard shows exactly who is pending (e.g., "Forward Managers: 2/3 voted").
- Resolution Logic: Once all votes in that tier are in, the system calculates the majority. The choice with the most votes wins and drives the narrative forward. If there is a tie, the system either randomly selects between the tied choices OR prompts the Host to break the tie manually.
- Flawed vs. Normal Dynamics: This means if 1 Flawed Manager votes for "Sabotage", but 2 Normal Managers vote for "Work Hard", the constructive choice wins (but the sabotage attempt is recorded in the Host's logs). If Flawed players hold the majority, the toxic choice wins.

Please explicitly confirm how you will structure the database/state schema to handle the Consensus Engine (tracking expected votes vs. submitted votes per department/tier).

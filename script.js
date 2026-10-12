/* ══════════════════════════════════════════════════════════════════
   КОРПОРАТИВНИЙ БУНКЕР — Game Logic (script.js)
   ══════════════════════════════════════════════════════════════════
   P2P multiplayer via PeerJS.
   Host acts as the "server" node; Players connect to Host's Peer ID.
   No backend database — all state is managed in-memory on the Host.

   Architecture:
   - Screen 1 (screen-login)  : Login & role selection
   - Screen 1.5 (screen-lobby): Player waiting room before game starts
   - Screen 2 (screen-host)   : Host dashboard / control center
   - Screen 3 (screen-player) : Player terminal / event feed

   Branching Crisis Logic:
   - Crisis events render DIFFERENT UI depending on the player's role.
   - Crisis 1: "Друга лінія" gets sabotage chat; others get read-only alert.
   - Crisis 2: "Методист" / "Ретеншн" get choice buttons; others get info block.
   - Crisis 3: Standard alert for all players.

   Cascade State Machine:
   - Host triggers crisis → Керівники receive first → they decide →
     Тімліди receive the directive → they decide →
     Менеджери receive the filtered message + potential sabotage options.
   ══════════════════════════════════════════════════════════════════ */


/* ╔══════════════════════════════════════════════╗
   ║              APPLICATION STATE               ║
   ╚══════════════════════════════════════════════╝ */

/** @type {Peer|null} PeerJS instance (both Host and Player use this) */
let peer = null;

/**
 * Host-only: Map of connected players.
 * Key = PeerJS peer ID, Value = { conn, name, level, role, flaw }
 * @type {Object.<string, {conn: DataConnection, name: string, level: string, role: string, flaw: object|null}>}
 */
let connections = {};

/** @type {DataConnection|null} Player's active connection to the Host */
let playerConn = null;

/** @type {string} Current player's display name */
let playerName = '';

/** @type {string} Current player's hierarchy level (Керівник/Тімлід/Менеджер) */
let playerLevel = '';

/** @type {string} Current player's department/role */
let playerRole = '';

/** @type {object|null} Current player's assigned secret flaw (or null) */
let playerFlaw = null;

/** @type {boolean} Whether this client is the Host */
let isHost = false;

/** @type {string} The room code (PeerJS ID) */
let roomCode = '';

/** @type {boolean} Whether the game has been started by the Host */
let gameStarted = false;


/* ╔══════════════════════════════════════════════╗
   ║            FLAWS DATABASE                    ║
   ║  Based on Lencioni's "Five Dysfunctions"     ║
   ╚══════════════════════════════════════════════╝ */

/**
 * All 5 secret flaws from the Lencioni model.
 * Each flaw grants the player a unique "superpower" (subversive action button).
 */
const FLAWS = [
  {
    name: 'Байдужість до результатів',
    power: 'Командний щит',
    description: 'Вас не хвилюють результати команди. Ви можете ігнорувати кризу.'
  },
  {
    name: 'Страх конфлікту',
    power: 'Право вето',
    description: 'Ви уникаєте конфліктів будь-якою ціною. Ви можете заблокувати рішення.'
  },
  {
    name: 'Безвідповідальність',
    power: 'Перевід стрілок',
    description: 'Ви уникаєте відповідальності. Ви можете перекласти провину на іншого.'
  },
  {
    name: 'Невимогливість',
    power: 'Тихий саботаж',
    description: 'Ви не вимагаєте якості від колег. Ви можете знизити стандарти.'
  },
  {
    name: 'Недовіра',
    power: 'Ініціація бунту',
    description: 'Ви не довіряєте нікому. Ви можете розпочати таємний бунт.'
  }
];


/* ╔══════════════════════════════════════════════╗
   ║            CRISIS DEFINITIONS                ║
   ║  Each crisis has role-specific branching.     ║
   ╚══════════════════════════════════════════════╝ */

const CRISES = {
  1: {
    id: 1,
    title: 'КРИЗА 1: САБОТАЖ ФОРВАРДА',
    color: 'red',
    icon: 'fa-explosion',
    hostLabel: 'Запустити Кризу 1 (Форвард + Саботаж)'
  },
  2: {
    id: 2,
    title: 'КРИЗА 2: ДЕШЕВІ ПАКЕТИ',
    color: 'amber',
    icon: 'fa-coins',
    hostLabel: 'Запустити Кризу 2 (Дешеві пакети)'
  },
  3: {
    id: 3,
    title: 'КРИЗА 3: ПОМИЛКА СТАТУСІВ',
    color: 'blue',
    icon: 'fa-bug',
    hostLabel: 'Запустити Кризу 3 (Помилка статусів)'
  }
};


/* ╔══════════════════════════════════════════════╗
   ║          SCREEN MANAGEMENT (SPA)             ║
   ║  Toggle .hidden class to switch screens.     ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Show a specific screen by ID and hide all others.
 * This is the core SPA navigation mechanism.
 * @param {string} screenId - The DOM ID of the screen to display.
 */
function showScreen(screenId) {
  // List of all screen IDs in the application
  var screens = ['screen-login', 'screen-lobby', 'screen-host', 'screen-player'];
  screens.forEach(function (id) {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}


/* ╔══════════════════════════════════════════════╗
   ║           TAB SWITCHING (LOGIN)              ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Switch between Host and Player tabs on the login screen.
 * Updates tab visual states and toggles the appropriate panel.
 * @param {'host'|'player'} mode - Which tab to activate.
 */
function switchTab(mode) {
  var tabHost = document.getElementById('tab-host');
  var tabPlayer = document.getElementById('tab-player');
  var panelHost = document.getElementById('panel-host');
  var panelPlayer = document.getElementById('panel-player');

  if (mode === 'host') {
    // Activate Host tab, deactivate Player tab
    tabHost.className = tabHost.className.replace('tab-inactive', 'tab-active');
    tabPlayer.className = tabPlayer.className.replace('tab-active', 'tab-inactive');
    panelHost.classList.remove('hidden');
    panelPlayer.classList.add('hidden');
  } else {
    // Activate Player tab, deactivate Host tab
    tabPlayer.className = tabPlayer.className.replace('tab-inactive', 'tab-active');
    tabHost.className = tabHost.className.replace('tab-active', 'tab-inactive');
    panelPlayer.classList.remove('hidden');
    panelHost.classList.add('hidden');
  }
}


/* ╔══════════════════════════════════════════════╗
   ║             UTILITY FUNCTIONS                ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Generate a random 4-digit room code in format "bunker-XXXX".
 * @returns {string} The generated room code.
 */
function generateCode() {
  var num = Math.floor(1000 + Math.random() * 9000);
  return 'bunker-' + num;
}

/**
 * Get a formatted timestamp string for log entries.
 * @returns {string} Time in HH:MM:SS format (Ukrainian locale).
 */
function timestamp() {
  var d = new Date();
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Display a status message on the login screen.
 * Uses Tailwind color classes for visual feedback.
 * @param {string} msg - The message to display.
 * @param {string} color - Tailwind color name (red, amber, green).
 */
function setStatus(msg, color) {
  var el = document.getElementById('login-status');
  el.textContent = msg;
  el.className = 'text-xs sm:text-sm font-mono h-6 text-' + color + '-400';
}


/* ╔══════════════════════════════════════════════╗
   ║         HOST: CREATE ROOM                    ║
   ║  Initializes PeerJS, registers as server     ║
   ║  node, transitions to Host Dashboard.        ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Create a new game room.
 * 1. Generate a unique room code.
 * 2. Initialize PeerJS with the room code as the Peer ID.
 * 3. Listen for incoming player connections.
 * 4. Transition to the Host Dashboard (Screen 2).
 */
function createRoom() {
  roomCode = generateCode();
  setStatus('Ініціалізація з\'єднання...', 'amber');
  isHost = true;

  // Create PeerJS instance with the room code as the Peer ID.
  // The Host's Peer ID IS the room code — players connect to this ID.
  peer = new Peer(roomCode, { debug: 1 });

  // When the PeerJS connection to the signaling server is established
  peer.on('open', function (id) {
    roomCode = id; // Use the actual assigned ID (may differ if code was taken)
    document.getElementById('host-room-code').textContent = roomCode;
    showScreen('screen-host');
    hostLog('SYSTEM', 'Кімнату створено: ' + roomCode, 'green');
    hostLog('SYSTEM', 'Очікування підключення гравців...', 'green');
  });

  // When a player connects to the Host
  peer.on('connection', function (conn) {
    handleHostConnection(conn);
  });

  // Handle PeerJS errors (e.g., ID already taken, network issues)
  peer.on('error', function (err) {
    // Show error on the login screen if still there
    setStatus('Помилка: ' + err.type, 'red');
    // Also log to Host terminal if already on that screen
    if (document.getElementById('screen-host').classList.contains('hidden') === false) {
      hostLog('ERROR', err.type + ' — ' + (err.message || 'Unknown error'), 'red');
    }
    // Show alert for critical errors
    alert('Помилка PeerJS: ' + err.type + '\n' + (err.message || ''));
  });
}


/* ╔══════════════════════════════════════════════╗
   ║    HOST: HANDLE INCOMING CONNECTION          ║
   ║  Process player join messages, track state,  ║
   ║  handle disconnections.                      ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Handle a new PeerJS data connection from a player.
 * Listens for 'join' and 'action' messages.
 * @param {DataConnection} conn - The PeerJS data connection.
 */
function handleHostConnection(conn) {
  conn.on('open', function () {
    // Connection opened — waiting for player to send their join info
  });

  conn.on('data', function (data) {
    // ── Player Join Message ──
    if (data.type === 'join') {
      // Store player info in the connections registry
      connections[conn.peer] = {
        conn: conn,
        name: data.name,
        level: data.level,
        role: data.role,
        flaw: null // Flaw will be assigned when game starts
      };
      updatePlayerCount();
      updatePlayerList();
      hostLog(
        data.name + ' (' + data.level + ' / ' + data.role + ')',
        'Підключився до бункеру',
        'green'
      );

      // If game already started, immediately send game-start to this late joiner
      if (gameStarted) {
        sendGameStartToPlayer(conn.peer);
      }
    }

    // ── Player Action Message ──
    // When a player clicks a button in their feed (accept, sabotage, etc.)
    else if (data.type === 'action') {
      // Check if the action text contains sabotage-related keywords
      var isSabotage = data.text && (
        data.text.includes('Саботаж') ||
        data.text.includes('бунт') ||
        data.text.includes('Підтримати')
      );
      hostLog(
        data.name + ' (' + data.level + ' / ' + data.role + ')',
        data.text,
        isSabotage ? 'red' : 'gray'
      );
    }

    // ── Cascade Response (Head/TeamLead decision forwarded) ──
    else if (data.type === 'cascade_response') {
      hostLog(
        data.name + ' (' + data.level + ' / ' + data.role + ')',
        'Рішення: ' + data.decision,
        'amber'
      );
      // Forward the cascade to the next tier
      handleCascade(data);
    }
  });

  // ── Handle Player Disconnect ──
  conn.on('close', function () {
    var info = connections[conn.peer];
    if (info) {
      hostLog(info.name + ' (' + info.level + ' / ' + info.role + ')', 'Від\'єднався', 'red');
      delete connections[conn.peer];
      updatePlayerCount();
      updatePlayerList();
    }
  });

  // ── Handle Connection Error ──
  conn.on('error', function (err) {
    hostLog('ERROR', 'Помилка з\'єднання з гравцем: ' + (err.message || err.type), 'red');
  });
}


/* ╔══════════════════════════════════════════════╗
   ║       HOST: START GAME                       ║
   ║  Assigns flaws, unlocks player screens,      ║
   ║  enables crisis buttons.                     ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Start the game. Called when the Host clicks "Запустити Гру".
 * 1. Randomly assigns 5 secret flaws among all connected players.
 * 2. Sends 'game_start' message to all players (with flaw data if applicable).
 * 3. Enables the crisis trigger buttons on the Host dashboard.
 */
function startGame() {
  var playerIds = Object.keys(connections);

  // Need at least 1 player to start
  if (playerIds.length === 0) {
    alert('Немає підключених гравців. Зачекайте поки хтось приєднається.');
    return;
  }

  gameStarted = true;

  // ── Randomly assign exactly 5 flaws (or fewer if less than 5 players) ──
  var flawCount = Math.min(5, playerIds.length);
  var shuffledIds = shuffleArray(playerIds.slice()); // Clone and shuffle
  var flawedPlayerIds = shuffledIds.slice(0, flawCount);

  // Assign a random flaw to each selected player
  flawedPlayerIds.forEach(function (peerId, index) {
    var flaw = FLAWS[index % FLAWS.length]; // Cycle through flaws if needed
    connections[peerId].flaw = flaw;
  });

  hostLog('SYSTEM', '══════════════════════════════════════', 'amber');
  hostLog('SYSTEM', 'ГРА РОЗПОЧАТА! Вади розподілені: ' + flawCount + ' гравців.', 'amber');
  hostLog('SYSTEM', '══════════════════════════════════════', 'amber');

  // Log which players got flaws (Host-only info)
  flawedPlayerIds.forEach(function (peerId) {
    var p = connections[peerId];
    hostLog('SYSTEM', '  ⚠ ' + p.name + ' → ' + p.flaw.name, 'amber');
  });

  // ── Notify all players that game has started ──
  playerIds.forEach(function (peerId) {
    sendGameStartToPlayer(peerId);
  });

  // ── Enable crisis buttons ──
  var crisisBtns = document.querySelectorAll('.crisis-btn');
  crisisBtns.forEach(function (btn) {
    btn.disabled = false;
  });

  // Hide the Start Game button
  document.getElementById('btn-start-game').classList.add('hidden');

  // Update player list to show flaw badges
  updatePlayerList();
}

/**
 * Send game_start message to a specific player.
 * Includes their flaw data if they have one assigned.
 * @param {string} peerId - The PeerJS ID of the player.
 */
function sendGameStartToPlayer(peerId) {
  var p = connections[peerId];
  if (!p || !p.conn) return;

  try {
    p.conn.send({
      type: 'game_start',
      flaw: p.flaw // null if player has no flaw
    });
  } catch (e) {
    hostLog('ERROR', 'Не вдалось надіслати старт до ' + p.name, 'red');
  }
}

/**
 * Fisher-Yates shuffle for arrays.
 * @param {Array} arr - The array to shuffle (mutates in place).
 * @returns {Array} The shuffled array.
 */
function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}


/* ╔══════════════════════════════════════════════╗
   ║        HOST: TERMINAL LOG                    ║
   ║  Scrolling log with timestamps & colors.     ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Append a log entry to the Host's monitoring terminal.
 * Format: [HH:MM:SS] [Sender]: Message
 * Sabotage-related messages are highlighted in red.
 * @param {string} sender - The sender label (player name or SYSTEM/ERROR).
 * @param {string} message - The message text.
 * @param {string} color - Color key: 'green', 'red', 'amber', 'blue', 'gray'.
 */
function hostLog(sender, message, color) {
  var log = document.getElementById('host-log');
  var entry = document.createElement('p');
  entry.classList.add('log-entry');

  var ts = timestamp();

  // Check if message contains sabotage-related keywords
  var isSabotage = message.includes('Саботаж') || message.includes('Підтримати Саботаж');

  if (isSabotage) {
    entry.classList.add('log-sabotage');
  }

  // Map color keys to Tailwind text color classes
  var colorClass = {
    green: 'text-green-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    gray: 'text-gray-300'
  }[color] || 'text-gray-300';

  entry.innerHTML =
    '<span class="text-gray-600">[' + ts + ']</span> ' +
    '<span class="' + colorClass + '">[' + sender + ']</span>: ' +
    '<span class="' + (isSabotage ? 'text-red-400 font-bold' : 'text-gray-400') + '">' + message + '</span>';

  log.appendChild(entry);
  // Auto-scroll to bottom to show latest entry
  log.scrollTop = log.scrollHeight;
}


/* ╔══════════════════════════════════════════════╗
   ║      HOST: PLAYER COUNT & LIST               ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Update the live player count display in the Host header.
 */
function updatePlayerCount() {
  document.getElementById('player-count').textContent = Object.keys(connections).length;
}

/**
 * Update the player list in the Host sidebar.
 * Shows name, level, role, and flaw badge if assigned.
 */
function updatePlayerList() {
  var list = document.getElementById('player-list');
  var peers = Object.values(connections);

  if (peers.length === 0) {
    list.innerHTML = '<p class="text-gray-600 italic">Очікування з\'єднань...</p>';
    return;
  }

  list.innerHTML = peers.map(function (p) {
    // Build the flaw badge HTML (only if flaw is assigned)
    var flawBadge = p.flaw
      ? '<span class="flaw-badge ml-auto">' + p.flaw.name.split(' ')[0] + '</span>'
      : '';

    return '<div class="player-tag">' +
      '<span class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>' +
      '<span class="text-green-400">' + p.name + '</span>' +
      '<span class="text-gray-500">·</span>' +
      '<span class="text-gray-400 text-xs">' + p.level + '</span>' +
      '<span class="text-gray-500">·</span>' +
      '<span class="text-gray-400 text-xs">' + p.role + '</span>' +
      flawBadge +
      '</div>';
  }).join('');
}


/* ╔══════════════════════════════════════════════╗
   ║       HOST: COPY ROOM CODE                   ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Copy the room code to clipboard.
 * Shows brief visual feedback on the code display.
 */
function copyRoomCode() {
  navigator.clipboard.writeText(roomCode).then(function () {
    var el = document.getElementById('host-room-code');
    var original = el.textContent;
    el.textContent = '✓ Скопійовано!';
    el.classList.add('text-green-300');
    setTimeout(function () {
      el.textContent = original;
      el.classList.remove('text-green-300');
    }, 1500);
  }).catch(function () {
    // Fallback: prompt user to copy manually
    alert('Код кімнати: ' + roomCode);
  });
}


/* ╔══════════════════════════════════════════════╗
   ║       HOST: TRIGGER CRISIS                   ║
   ║  Sends crisis event payload to all players.  ║
   ║  Includes the player's role so the client     ║
   ║  can render role-specific branching UI.       ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Trigger a crisis event. Broadcasts to all players with role-specific data.
 * Implements the Cascade State Machine:
 *   Phase 1: Host triggers → sent to Керівники (Heads)
 *   Phase 2: Heads choose → their decision cascades to Тімліди
 *   Phase 3: Тімліди choose → their decision cascades to Менеджери
 *
 * For simplicity in the P2P model, we send to Heads first.
 * When a Head responds, the Host forwards to TeamLeads, and so on.
 *
 * @param {number} id - The crisis ID (1, 2, or 3).
 */
function triggerCrisis(id) {
  var crisis = CRISES[id];
  if (!crisis) return;

  hostLog('SYSTEM', '══════════════════════════════════════', crisis.color);
  hostLog('SYSTEM', 'КРИЗУ ' + id + ' АКТИВОВАНО — ' + crisis.title, crisis.color);
  hostLog('SYSTEM', 'Фаза 1: Повідомлення Керівників...', crisis.color);
  hostLog('SYSTEM', '══════════════════════════════════════', crisis.color);

  // ── Phase 1: Send to Керівники (Heads) first ──
  var headsSent = 0;
  var othersSent = 0;

  Object.keys(connections).forEach(function (peerId) {
    var p = connections[peerId];

    // Build the payload with player-specific info
    var payload = {
      type: 'crisis',
      crisisId: id,
      title: crisis.title,
      color: crisis.color,
      icon: crisis.icon,
      timestamp: timestamp(),
      // Include the player's role & level so the client can branch its UI
      targetRole: p.role,
      targetLevel: p.level,
      // Include flaw info so the player can render sabotage buttons
      hasFlaw: p.flaw !== null,
      flawName: p.flaw ? p.flaw.name : null,
      flawPower: p.flaw ? p.flaw.power : null,
      // Phase tracking for cascade
      phase: p.level === 'Керівник' ? 1 : 0, // Heads get phase 1, others wait
      cascadeDecision: null // Will be filled by cascade forwarding
    };

    try {
      // Send to Heads immediately; others get notified with phase=0 (waiting)
      p.conn.send(payload);
      if (p.level === 'Керівник') {
        headsSent++;
      } else {
        othersSent++;
      }
    } catch (e) {
      hostLog('ERROR', 'Не вдалось надіслати дані до ' + p.name, 'red');
    }
  });

  hostLog('SYSTEM', 'Надіслано: ' + headsSent + ' Керівників, ' + othersSent + ' інших (очікують)', 'gray');
}


/* ╔══════════════════════════════════════════════╗
   ║      HOST: CASCADE STATE MACHINE             ║
   ║  Forward decisions down the hierarchy:       ║
   ║  Heads → Team Leads → Managers               ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Handle a cascade response from a player (Head or Team Lead).
 * Forwards their decision to the next tier.
 * @param {object} data - The cascade response payload.
 */
function handleCascade(data) {
  var crisisId = data.crisisId;
  var crisis = CRISES[crisisId];
  if (!crisis) return;

  // ── Head decided → Forward to Team Leads ──
  if (data.level === 'Керівник') {
    hostLog('SYSTEM', 'Фаза 2: Рішення Керівника → Тімліди отримують директиву...', 'amber');

    Object.keys(connections).forEach(function (peerId) {
      var p = connections[peerId];
      if (p.level === 'Тімлід') {
        try {
          p.conn.send({
            type: 'crisis',
            crisisId: crisisId,
            title: crisis.title,
            color: crisis.color,
            icon: crisis.icon,
            timestamp: timestamp(),
            targetRole: p.role,
            targetLevel: p.level,
            hasFlaw: p.flaw !== null,
            flawName: p.flaw ? p.flaw.name : null,
            flawPower: p.flaw ? p.flaw.power : null,
            phase: 2,
            cascadeDecision: data.decision // The Head's decision
          });
        } catch (e) {
          hostLog('ERROR', 'Не вдалось надіслати до Тімліда ' + p.name, 'red');
        }
      }
    });
  }

  // ── Team Lead decided → Forward to Managers ──
  else if (data.level === 'Тімлід') {
    hostLog('SYSTEM', 'Фаза 3: Рішення Тімліда → Менеджери отримують повідомлення...', 'amber');

    Object.keys(connections).forEach(function (peerId) {
      var p = connections[peerId];
      if (p.level === 'Менеджер') {
        try {
          p.conn.send({
            type: 'crisis',
            crisisId: crisisId,
            title: crisis.title,
            color: crisis.color,
            icon: crisis.icon,
            timestamp: timestamp(),
            targetRole: p.role,
            targetLevel: p.level,
            hasFlaw: p.flaw !== null,
            flawName: p.flaw ? p.flaw.name : null,
            flawPower: p.flaw ? p.flaw.power : null,
            phase: 3,
            cascadeDecision: data.decision // The Team Lead's decision
          });
        } catch (e) {
          hostLog('ERROR', 'Не вдалось надіслати до Менеджера ' + p.name, 'red');
        }
      }
    });
  }
}


/* ╔══════════════════════════════════════════════╗
   ║        PLAYER: JOIN ROOM                     ║
   ║  Connect to the Host's PeerJS ID,            ║
   ║  send join info, enter lobby.                ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Join an existing game room.
 * 1. Validate inputs (name, level, role, code).
 * 2. Create a PeerJS instance for this player.
 * 3. Connect to the Host's Peer ID.
 * 4. Send join payload and enter lobby/waiting room.
 */
function joinRoom() {
  playerName = document.getElementById('input-name').value.trim();
  playerLevel = document.getElementById('input-level').value;
  playerRole = document.getElementById('input-role').value;
  var code = document.getElementById('input-code').value.trim();

  // ── Input Validation ──
  if (!playerName) {
    setStatus('Введіть ваше ім\'я', 'red');
    alert('Будь ласка, введіть ваше ім\'я та прізвище.');
    return;
  }
  if (!playerLevel) {
    setStatus('Оберіть рівень ієрархії', 'red');
    alert('Будь ласка, оберіть рівень ієрархії.');
    return;
  }
  if (!playerRole) {
    setStatus('Оберіть департамент', 'red');
    alert('Будь ласка, оберіть департамент.');
    return;
  }
  if (!code) {
    setStatus('Введіть код кімнати', 'red');
    alert('Будь ласка, введіть код кімнати.');
    return;
  }

  // Validate "Above All" department — only for Heads
  if (playerRole === 'Над усіма' && playerLevel !== 'Керівник') {
    setStatus('"Над усіма" — тільки для Керівників', 'red');
    alert('Департамент "Над усіма" доступний тільки для Керівників.');
    return;
  }

  setStatus('Підключення до бункеру...', 'amber');

  // Create PeerJS instance for this player (auto-generated ID)
  peer = new Peer(undefined, { debug: 1 });

  peer.on('open', function () {
    // Connect to the Host's Peer ID (the room code)
    playerConn = peer.connect(code, { reliable: true });

    playerConn.on('open', function () {
      // ── Send join info to the Host ──
      playerConn.send({
        type: 'join',
        name: playerName,
        level: playerLevel,
        role: playerRole
      });

      // ── Show lobby/waiting room ──
      document.getElementById('lobby-player-name').textContent = playerName;
      document.getElementById('lobby-player-level').textContent = playerLevel;
      document.getElementById('lobby-player-role').textContent = playerRole;
      showScreen('screen-lobby');
    });

    // ── Listen for messages from the Host ──
    playerConn.on('data', function (data) {
      handlePlayerMessage(data);
    });

    // ── Handle connection close ──
    playerConn.on('close', function () {
      addFeedMessage('З\'єднання з Бункером втрачено.', 'red');
      alert('З\'єднання з Бункером втрачено!');
    });

    // ── Handle connection error ──
    playerConn.on('error', function (err) {
      setStatus('Помилка з\'єднання: ' + err.type, 'red');
      alert('Помилка з\'єднання: ' + err.type);
    });
  });

  // ── Handle PeerJS-level errors (wrong code, network, etc.) ──
  peer.on('error', function (err) {
    setStatus('Помилка: ' + err.type, 'red');
    // Show a user-friendly alert for common errors
    if (err.type === 'peer-unavailable') {
      alert('Кімнату не знайдено! Перевірте код кімнати та спробуйте знову.');
    } else {
      alert('Помилка підключення: ' + err.type + '\n' + (err.message || ''));
    }
  });
}


/* ╔══════════════════════════════════════════════╗
   ║   PLAYER: HANDLE MESSAGES FROM HOST          ║
   ║  Routes game_start and crisis events.        ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Handle incoming messages from the Host.
 * Routes to appropriate handler based on message type.
 * @param {object} data - The message payload from Host.
 */
function handlePlayerMessage(data) {
  // ── Game Start ──
  // Host has started the game. Transition from lobby to player terminal.
  if (data.type === 'game_start') {
    // Store the assigned flaw (or null)
    playerFlaw = data.flaw;

    // Setup the player terminal screen
    document.getElementById('player-display-name').textContent = playerName;
    document.getElementById('player-display-role').textContent = playerLevel + ' · ' + playerRole;

    // Show flaw section if player has a flaw
    if (playerFlaw) {
      document.getElementById('flaw-section').classList.remove('hidden');
      document.getElementById('flaw-name').textContent = playerFlaw.name;
      document.getElementById('flaw-power').textContent = playerFlaw.power;
    }

    showScreen('screen-player');
  }

  // ── Crisis Event ──
  else if (data.type === 'crisis') {
    renderCrisisEvent(data);
  }
}


/* ╔══════════════════════════════════════════════╗
   ║   PLAYER: TOGGLE SECRET FLAW ACCORDION       ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Toggle the secret flaw accordion open/closed.
 * Rotates the chevron icon 180° and shows/hides the content.
 */
function toggleFlaw() {
  var content = document.getElementById('flaw-content');
  var chevron = document.getElementById('flaw-chevron');
  content.classList.toggle('hidden');
  chevron.classList.toggle('flaw-open');
}


/* ╔══════════════════════════════════════════════════════════════════
   ║    PLAYER: RENDER CRISIS EVENT IN FEED                         ║
   ║                                                                ║
   ║    BRANCHING CRISIS LOGIC — the heart of the game.             ║
   ║    The UI rendered depends on the player's role AND level.     ║
   ║                                                                ║
   ║    Crisis 1 (Форвард + Саботаж):                               ║
   ║      - "Друга лінія" → Secret sabotage chat (spy block)       ║
   ║      - Others → Standard read-only alert                       ║
   ║                                                                ║
   ║    Crisis 2 (Дешеві пакети):                                   ║
   ║      - "Методист" / "Ретеншн" → Choice buttons                ║
   ║      - Others → Info-only block                                ║
   ║                                                                ║
   ║    Crisis 3 (Помилка статусів):                                ║
   ║      - All players → Standard system alert                     ║
   ║                                                                ║
   ║    Additionally, if player has phase=0 they are "waiting"      ║
   ║    for the cascade to reach their level.                       ║
   ╚══════════════════════════════════════════════════════════════════ */

/**
 * Render a crisis event block in the player's feed.
 * Uses branching logic based on crisis ID, player role, and level.
 * @param {object} data - The crisis event payload from Host.
 */
function renderCrisisEvent(data) {
  var feed = document.getElementById('player-feed');

  // Remove the "waiting for instructions" placeholder if present
  var placeholder = document.getElementById('feed-placeholder');
  if (placeholder) placeholder.remove();

  // ── Phase 0 = Waiting for cascade to reach this player's level ──
  if (data.phase === 0) {
    renderWaitingBlock(feed, data);
    return;
  }

  // ── Color Mapping ──
  var colorMap = {
    red:   { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', icon: 'text-red-500' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'text-amber-500' },
    blue:  { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'text-blue-500' }
  };
  var c = colorMap[data.color] || colorMap.red;

  // ── Branch by Crisis ID ──
  switch (data.crisisId) {
    case 1:
      renderCrisis1(feed, data, c);
      break;
    case 2:
      renderCrisis2(feed, data, c);
      break;
    case 3:
      renderCrisis3(feed, data, c);
      break;
    default:
      renderGenericCrisis(feed, data, c);
  }
}

/**
 * Render a "waiting for cascade" block.
 * Shown to non-Head players during Phase 1 when only Heads make decisions.
 */
function renderWaitingBlock(feed, data) {
  var block = document.createElement('div');
  block.className = 'crisis-event glass-card p-4 sm:p-5 border-l-4 border-gray-500 bg-gray-500/5 space-y-2';
  block.innerHTML =
    '<div class="flex items-center gap-3">' +
      '<i class="fa-solid fa-hourglass-half text-gray-400 text-xl animate-pulse"></i>' +
      '<div>' +
        '<h3 class="font-black uppercase tracking-wider text-gray-400 text-xs sm:text-sm">' + data.title + '</h3>' +
        '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
      '</div>' +
    '</div>' +
    '<p class="text-gray-500 text-xs sm:text-sm">Керівництво приймає рішення. Очікуйте директиву...</p>';

  feed.appendChild(block);
  feed.scrollTop = feed.scrollHeight;
}


/* ─── CRISIS 1: Форвард + Саботаж ───────────
   Branching:
   - "Друга лінія" → Secret spy chat with sabotage offer
   - All others   → Standard read-only alert               */

/**
 * Render Crisis 1 event with role-specific branching.
 * @param {HTMLElement} feed - The player feed container.
 * @param {object} data - Crisis event payload.
 * @param {object} c - Color classes object.
 */
function renderCrisis1(feed, data, c) {
  var block = document.createElement('div');

  if (data.targetRole === 'Друга лінія') {
    // ── SECRET CHAT BLOCK for "Друга лінія" ──
    // Dark red, spy icon, sabotage offer with two buttons
    block.className = 'crisis-event secret-chat-block glass-card p-4 sm:p-5 space-y-3 rounded-lg';

    var buttonsId = 'crisis1-btns-' + Date.now();

    block.innerHTML =
      '<div class="flex items-center gap-3">' +
        '<i class="fa-solid fa-user-secret text-red-500 text-2xl"></i>' +
        '<div>' +
          '<h3 class="font-black uppercase tracking-wider text-red-400 text-xs sm:text-sm">ТАЄМНИЙ ЧАТ</h3>' +
          '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="text-red-300 text-sm leading-relaxed">' +
        'План горить. Зарплата херня. Давайте всі звільнимось одним днем?' +
      '</p>' +
      '<div id="' + buttonsId + '" class="flex flex-wrap gap-2 pt-2">' +
        '<button onclick="handleCrisis1Choice(this, \'Підтримати Саботаж\', \'' + buttonsId + '\')" ' +
          'class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all">' +
          '<i class="fa-solid fa-fist-raised mr-1"></i> Підтримати Саботаж' +
        '</button>' +
        '<button onclick="handleCrisis1Choice(this, \'Відмовитись від саботажу\', \'' + buttonsId + '\')" ' +
          'class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded bg-gray-500/20 border border-gray-500/40 text-gray-400 hover:bg-gray-500/30 transition-all">' +
          '<i class="fa-solid fa-shield-halved mr-1"></i> Відмовитись' +
        '</button>' +
      '</div>';
  } else {
    // ── STANDARD ALERT for all other roles ──
    // Dark grey with red border, no interactive buttons
    block.className = 'crisis-event glass-card p-4 sm:p-5 border-l-4 border-red-500 bg-gray-800/30 space-y-3 rounded-lg';

    var cascadeInfo = data.cascadeDecision
      ? '<p class="text-xs text-amber-400 font-mono mt-2">Директива зверху: ' + data.cascadeDecision + '</p>'
      : '';

    block.innerHTML =
      '<div class="flex items-center gap-3">' +
        '<i class="fa-solid ' + data.icon + ' text-red-500 text-2xl"></i>' +
        '<div>' +
          '<h3 class="font-black uppercase tracking-wider text-red-400 text-xs sm:text-sm">' + data.title + '</h3>' +
          '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="text-gray-300 text-sm leading-relaxed">' +
        'Форвард забив розклад, 70% клієнтів не приходять. Друга лінія мовчить. Обговоріть ситуацію вголос.' +
      '</p>' +
      cascadeInfo +
      renderCascadeButtons(data) +
      renderFlawButton(data);
  }

  feed.appendChild(block);
  feed.scrollTop = feed.scrollHeight;
}


/* ─── CRISIS 2: Дешеві пакети ───────────────
   Branching:
   - "Методист" / "Ретеншн" → Amber alert with response buttons
   - All others             → Info-only block                     */

/**
 * Render Crisis 2 event with role-specific branching.
 */
function renderCrisis2(feed, data, c) {
  var block = document.createElement('div');

  if (data.targetRole === 'Методист' || data.targetRole === 'Ретеншн') {
    // ── INTERACTIVE AMBER BLOCK for Методист / Ретеншн ──
    block.className = 'crisis-event glass-card p-4 sm:p-5 border-l-4 border-amber-500 bg-amber-500/10 space-y-3 rounded-lg';

    var buttonsId = 'crisis2-btns-' + Date.now();

    var cascadeInfo = data.cascadeDecision
      ? '<p class="text-xs text-amber-400 font-mono mt-1">Директива: ' + data.cascadeDecision + '</p>'
      : '';

    block.innerHTML =
      '<div class="flex items-center gap-3">' +
        '<i class="fa-solid fa-coins text-amber-500 text-2xl"></i>' +
        '<div>' +
          '<h3 class="font-black uppercase tracking-wider text-amber-400 text-xs sm:text-sm">' + data.title + '</h3>' +
          '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="text-gray-300 text-sm leading-relaxed">' +
        'Методисти продали пакети за 2276 грн. Клієнти масово відмовляються від продовження.' +
      '</p>' +
      cascadeInfo +
      '<div id="' + buttonsId + '" class="flex flex-wrap gap-2 pt-2">' +
        '<button onclick="handleCrisis2Choice(this, \'Звинуватити Форвард\', \'' + buttonsId + '\')" ' +
          'class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-all">' +
          '<i class="fa-solid fa-hand-point-right mr-1"></i> Звинуватити Форвард' +
        '</button>' +
        '<button onclick="handleCrisis2Choice(this, \'Заборонити малі пакети\', \'' + buttonsId + '\')" ' +
          'class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-all">' +
          '<i class="fa-solid fa-ban mr-1"></i> Заборонити малі пакети' +
        '</button>' +
      '</div>' +
      renderFlawButton(data);
  } else {
    // ── INFO-ONLY BLOCK for other roles ──
    block.className = 'crisis-event glass-card p-4 sm:p-5 border-l-4 border-amber-500 bg-gray-800/30 space-y-3 rounded-lg';

    var cascadeInfo2 = data.cascadeDecision
      ? '<p class="text-xs text-amber-400 font-mono mt-2">Директива зверху: ' + data.cascadeDecision + '</p>'
      : '';

    block.innerHTML =
      '<div class="flex items-center gap-3">' +
        '<i class="fa-solid fa-coins text-amber-500 text-2xl"></i>' +
        '<div>' +
          '<h3 class="font-black uppercase tracking-wider text-amber-400 text-xs sm:text-sm">' + data.title + '</h3>' +
          '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="text-gray-300 text-sm leading-relaxed">' +
        'Фінансовий конфлікт між Ретеншн та Методистами.' +
      '</p>' +
      cascadeInfo2 +
      renderCascadeButtons(data) +
      renderFlawButton(data);
  }

  feed.appendChild(block);
  feed.scrollTop = feed.scrollHeight;
}


/* ─── CRISIS 3: Помилка статусів ────────────
   All roles get the same standard system alert.             */

/**
 * Render Crisis 3 event — same for all players.
 */
function renderCrisis3(feed, data, c) {
  var block = document.createElement('div');
  block.className = 'crisis-event glass-card p-4 sm:p-5 border-l-4 border-blue-500 bg-blue-500/10 space-y-3 rounded-lg';

  var cascadeInfo = data.cascadeDecision
    ? '<p class="text-xs text-amber-400 font-mono mt-2">Директива зверху: ' + data.cascadeDecision + '</p>'
    : '';

  block.innerHTML =
    '<div class="flex items-center gap-3">' +
      '<i class="fa-solid fa-bug text-blue-500 text-2xl"></i>' +
      '<div>' +
        '<h3 class="font-black uppercase tracking-wider text-blue-400 text-xs sm:text-sm">' + data.title + '</h3>' +
        '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
      '</div>' +
    '</div>' +
    '<p class="text-gray-300 text-sm leading-relaxed">' +
      'Система статусів збоїла. Всі клієнти отримали некоректні повідомлення. Потрібне швидке реагування.' +
    '</p>' +
    cascadeInfo +
    renderCascadeButtons(data) +
    renderFlawButton(data);

  feed.appendChild(block);
  feed.scrollTop = feed.scrollHeight;
}


/**
 * Render a generic crisis block (fallback).
 */
function renderGenericCrisis(feed, data, c) {
  var block = document.createElement('div');
  block.className = 'crisis-event glass-card p-4 sm:p-5 border-l-4 ' + c.border + ' ' + c.bg + ' space-y-3 rounded-lg';
  block.innerHTML =
    '<div class="flex items-center gap-3">' +
      '<i class="fa-solid ' + data.icon + ' ' + c.icon + ' text-2xl"></i>' +
      '<div>' +
        '<h3 class="font-black uppercase tracking-wider ' + c.text + ' text-xs sm:text-sm">' + data.title + '</h3>' +
        '<span class="text-xs text-gray-600 font-mono">' + data.timestamp + '</span>' +
      '</div>' +
    '</div>' +
    '<p class="text-gray-300 text-sm leading-relaxed">Системне повідомлення.</p>';
  feed.appendChild(block);
  feed.scrollTop = feed.scrollHeight;
}


/* ╔══════════════════════════════════════════════╗
   ║  PLAYER: CASCADE DECISION BUTTONS            ║
   ║  Rendered for Heads & Team Leads only.       ║
   ║  Their choices propagate down the hierarchy.  ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Generate HTML for cascade decision buttons.
 * Only shown to Керівники (phase 1) and Тімліди (phase 2).
 * @param {object} data - The crisis event data.
 * @returns {string} HTML string for buttons, or empty string.
 */
function renderCascadeButtons(data) {
  var buttonsId = 'cascade-btns-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

  // ── Керівники (Heads) — Phase 1: Strategic decisions ──
  if (data.targetLevel === 'Керівник' && data.phase === 1) {
    return '<div id="' + buttonsId + '" class="flex flex-wrap gap-2 pt-3 border-t border-gray-700 mt-3">' +
      '<p class="w-full text-xs text-amber-400 uppercase tracking-wider font-bold mb-1">' +
        '<i class="fa-solid fa-crown mr-1"></i> Ваше стратегічне рішення:' +
      '</p>' +
      '<button onclick="sendCascadeDecision(this, \'Зрізати бонуси команді\', ' + data.crisisId + ', \'' + buttonsId + '\')" ' +
        'class="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all">' +
        '<i class="fa-solid fa-scissors mr-1"></i> Зрізати бонуси' +
      '</button>' +
      '<button onclick="sendCascadeDecision(this, \'Тиск на відповідальний департамент\', ' + data.crisisId + ', \'' + buttonsId + '\')" ' +
        'class="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-all">' +
        '<i class="fa-solid fa-bullhorn mr-1"></i> Тиск на департамент' +
      '</button>' +
      '<button onclick="sendCascadeDecision(this, \'Зібрати нараду та обговорити\', ' + data.crisisId + ', \'' + buttonsId + '\')" ' +
        'class="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 transition-all">' +
        '<i class="fa-solid fa-comments mr-1"></i> Зібрати нараду' +
      '</button>' +
    '</div>';
  }

  // ── Тімліди (Team Leads) — Phase 2: How to relay to team ──
  if (data.targetLevel === 'Тімлід' && data.phase === 2) {
    return '<div id="' + buttonsId + '" class="flex flex-wrap gap-2 pt-3 border-t border-gray-700 mt-3">' +
      '<p class="w-full text-xs text-amber-400 uppercase tracking-wider font-bold mb-1">' +
        '<i class="fa-solid fa-arrows-down-to-line mr-1"></i> Як передати команді:' +
      '</p>' +
      '<button onclick="sendCascadeDecision(this, \'Вимагати суворе виконання\', ' + data.crisisId + ', \'' + buttonsId + '\')" ' +
        'class="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all">' +
        '<i class="fa-solid fa-gavel mr-1"></i> Суворе виконання' +
      '</button>' +
      '<button onclick="sendCascadeDecision(this, \'Захистити команду та спротивитись\', ' + data.crisisId + ', \'' + buttonsId + '\')" ' +
        'class="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 transition-all">' +
        '<i class="fa-solid fa-shield-halved mr-1"></i> Захистити команду' +
      '</button>' +
    '</div>';
  }

  // No cascade buttons for Менеджери or other phases
  return '';
}


/**
 * Generate HTML for the secret flaw "superpower" button.
 * Only shown if the player has an assigned flaw.
 * @param {object} data - The crisis event data.
 * @returns {string} HTML string for flaw button, or empty string.
 */
function renderFlawButton(data) {
  if (!data.hasFlaw) return '';

  var flawBtnId = 'flaw-btn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

  return '<div id="' + flawBtnId + '" class="pt-2">' +
    '<button onclick="useFlawPower(this, \'' + flawBtnId + '\')" ' +
      'class="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all animate-pulse">' +
      '<i class="fa-solid fa-bolt mr-1"></i> ' + data.flawPower + ' (Суперсила)' +
    '</button>' +
  '</div>';
}


/* ╔══════════════════════════════════════════════╗
   ║   PLAYER: ACTION HANDLERS                    ║
   ║   Handle button clicks in the player feed.   ║
   ║   Disable buttons after click, send to Host.  ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Handle Crisis 1 sabotage choice (Друга лінія only).
 * Disables both buttons after selection and sends choice to Host.
 * @param {HTMLElement} btn - The clicked button element.
 * @param {string} choice - The choice text.
 * @param {string} containerId - The buttons container ID for disabling.
 */
function handleCrisis1Choice(btn, choice, containerId) {
  if (!playerConn) return;

  // ── Disable all buttons in the container ──
  disableButtonGroup(containerId);

  // ── Send choice to Host log ──
  playerConn.send({
    type: 'action',
    name: playerName,
    level: playerLevel,
    role: playerRole,
    text: choice
  });

  // ── Show confirmation in player feed ──
  addFeedMessage('Ви обрали: ' + choice, choice.includes('Підтримати') ? 'red' : 'green');
}

/**
 * Handle Crisis 2 response choice (Методист / Ретеншн only).
 * @param {HTMLElement} btn - The clicked button element.
 * @param {string} choice - The choice text.
 * @param {string} containerId - The buttons container ID for disabling.
 */
function handleCrisis2Choice(btn, choice, containerId) {
  if (!playerConn) return;

  // ── Disable all buttons in the container ──
  disableButtonGroup(containerId);

  // ── Send choice to Host log ──
  playerConn.send({
    type: 'action',
    name: playerName,
    level: playerLevel,
    role: playerRole,
    text: choice
  });

  // ── Show confirmation in player feed ──
  addFeedMessage('Ви обрали: ' + choice, 'amber');
}

/**
 * Send a cascade decision from a Head or Team Lead.
 * This triggers the Host to forward the decision to the next tier.
 * @param {HTMLElement} btn - The clicked button.
 * @param {string} decision - The decision text.
 * @param {number} crisisId - The crisis ID.
 * @param {string} containerId - The buttons container ID for disabling.
 */
function sendCascadeDecision(btn, decision, crisisId, containerId) {
  if (!playerConn) return;

  // ── Disable all buttons in the container ──
  disableButtonGroup(containerId);

  // ── Send cascade response to Host ──
  playerConn.send({
    type: 'cascade_response',
    name: playerName,
    level: playerLevel,
    role: playerRole,
    crisisId: crisisId,
    decision: decision
  });

  // ── Show confirmation in player feed ──
  addFeedMessage('Рішення прийнято: ' + decision, 'amber');
}

/**
 * Use the player's secret flaw "superpower" button.
 * @param {HTMLElement} btn - The clicked button.
 * @param {string} containerId - The flaw button container ID.
 */
function useFlawPower(btn, containerId) {
  if (!playerFlaw || !playerConn) return;

  // ── Disable the flaw button ──
  disableButtonGroup(containerId);

  // ── Send superpower action to Host ──
  var text = 'Використав суперсилу: ' + playerFlaw.power + ' (' + playerFlaw.name + ')';
  playerConn.send({
    type: 'action',
    name: playerName,
    level: playerLevel,
    role: playerRole,
    text: text
  });

  addFeedMessage(text, 'amber');
}

/**
 * Send a generic action to the Host.
 * Used for simple action buttons.
 * @param {string} text - The action text to send.
 */
function sendAction(text) {
  if (!playerConn) return;

  playerConn.send({
    type: 'action',
    name: playerName,
    level: playerLevel,
    role: playerRole,
    text: text
  });

  addFeedMessage('Ви обрали: ' + text, text.includes('Саботаж') ? 'red' : 'green');
}

/**
 * Disable all buttons within a container element.
 * Adds visual disabled styling.
 * @param {string} containerId - The DOM ID of the button container.
 */
function disableButtonGroup(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var buttons = container.querySelectorAll('button');
  buttons.forEach(function (b) {
    b.disabled = true;
    b.classList.add('btn-disabled');
    b.onclick = null; // Remove click handler
  });
}


/* ╔══════════════════════════════════════════════╗
   ║   PLAYER: ADD MESSAGE TO FEED                ║
   ║   Utility for showing confirmation messages.  ║
   ╚══════════════════════════════════════════════╝ */

/**
 * Append a simple text message to the player's feed.
 * Used for action confirmations, connection status, etc.
 * @param {string} text - The message text.
 * @param {string} color - Color key: 'green', 'red', 'amber'.
 */
function addFeedMessage(text, color) {
  var feed = document.getElementById('player-feed');

  // Map color keys to Tailwind classes
  var colorClass = {
    green: 'text-green-400',
    red:   'text-red-400',
    amber: 'text-amber-400'
  }[color] || 'text-gray-400';

  var msg = document.createElement('div');
  msg.className = 'log-entry font-mono text-xs sm:text-sm py-2 px-3 rounded bg-white/5';
  msg.innerHTML =
    '<span class="text-gray-600">[' + timestamp() + ']</span> ' +
    '<span class="' + colorClass + '">' + text + '</span>';

  feed.appendChild(msg);
  feed.scrollTop = feed.scrollHeight;
}

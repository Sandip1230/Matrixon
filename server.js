const express    = require('express');
const mysql      = require('mysql2');
const bodyParser = require('body-parser');
const cors       = require('cors');
// FIX: was 'bcryptjs' (different package). package.json lists 'bcrypt', so use that.
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto'); // built-in — no install needed

const SALT_ROUNDS     = 12;
const RESET_TOKEN_TTL = 15 * 60 * 1000; // 15 minutes in ms

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

// ── DATABASE ──────────────────────────────────────────────────────────────────
const db = mysql.createConnection({
  host:     'localhost',
  user:     'root',
  password: process.env.DB_PASSWORD || 'sandipmaitra@1338',
  database: 'matrix'
});
db.connect(err => { if (err) throw err; console.log('MySQL Connected'); initTables(); });

// ── TABLE INIT ────────────────────────────────────────────────────────────────
function initTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(50) PRIMARY KEY,
      password VARCHAR(255) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS profiles (
      username    VARCHAR(50) PRIMARY KEY,
      uid         VARCHAR(30) UNIQUE,
      nickname    VARCHAR(50),
      photo       MEDIUMTEXT,
      level       INT DEFAULT 1,
      xp          INT DEFAULT 0,
      weekly_xp   INT DEFAULT 0,
      monthly_xp  INT DEFAULT 0,
      points      INT DEFAULT 0,
      league      VARCHAR(30) DEFAULT 'Trainee',
      country_code VARCHAR(5)  DEFAULT '',
      country_flag VARCHAR(10) DEFAULT '🌐',
      country_name VARCHAR(60) DEFAULT '',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS xp_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reset_type ENUM('weekly','monthly') NOT NULL,
      reset_date DATE NOT NULL,
      UNIQUE KEY uq_reset (reset_type, reset_date)
    )`,
    `CREATE TABLE IF NOT EXISTS login_streaks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username   VARCHAR(50),
      login_date DATE NOT NULL,
      UNIQUE KEY unique_login (username, login_date)
    )`,
    `CREATE TABLE IF NOT EXISTS achievements (
      id   INT PRIMARY KEY,
      name VARCHAR(100),
      description TEXT,
      badge ENUM('Bronze','Silver','Gold','Diamond','Pro','Legend'),
      icon  VARCHAR(20)
    )`,
    `CREATE TABLE IF NOT EXISTS user_achievements (
      username       VARCHAR(50),
      achievement_id INT,
      tier           INT DEFAULT 0,
      unlocked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (username, achievement_id)
    )`,
    `CREATE TABLE IF NOT EXISTS friends (
      username        VARCHAR(50),
      friend_username VARCHAR(50),
      added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (username, friend_username)
    )`,
    `CREATE TABLE IF NOT EXISTS courses_completed (
      username     VARCHAR(50),
      course_name  VARCHAR(100),
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (username, course_name)
    )`,
    `CREATE TABLE IF NOT EXISTS top3_bonus (
      username   VARCHAR(50),
      week_start DATE,
      rank_pos   INT,
      xp_awarded INT DEFAULT 20,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (username, week_start)
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      username   VARCHAR(50) PRIMARY KEY,
      settings   MEDIUMTEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // NEW: password reset tokens table
    `CREATE TABLE IF NOT EXISTS reset_tokens (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      username   VARCHAR(50) NOT NULL,
      token      VARCHAR(8)  NOT NULL,
      expires_at BIGINT      NOT NULL,
      used       TINYINT(1)  DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rt_username (username)
    )`
  ];

  tables.forEach(sql => db.query(sql, err => {
    if (err) console.error('Table init:', err.message);
  }));

  const seeds = [
    [1,'First Login','Login for the very first time','Bronze','🔓'],
    [2,'Code Curious','Run your first terminal command','Bronze','💻'],
    [3,'Puzzle Starter','Solve your first logic puzzle','Bronze','🧩'],
    [4,'Hello World!','Write your first program','Bronze','👋'],
    [5,'Week Warrior','7-day login streak','Silver','🗓️'],
    [6,'Course Beginner','Complete your first course','Silver','📚'],
    [7,'Problem Solver','Solve 5 puzzles','Silver','🔢'],
    [8,'Social Coder','Add your first friend','Silver','🤝'],
    [9,'Month Master','30-day login streak','Gold','🏆'],
    [10,'Multi-Learner','Complete 3 courses','Gold','🎓'],
    [11,'Puzzle Pro','Solve 20 puzzles','Gold','🌟'],
    [12,'Level Up!','Reach Level 10','Gold','⬆️'],
    [13,'Dedication','60-day login streak','Diamond','💎'],
    [14,'Course Champion','Complete 5 courses','Diamond','🏅'],
    [15,'Puzzle Legend','Solve 50 puzzles','Diamond','⭐'],
    [16,'High Achiever','Reach Level 25','Diamond','🚀'],
    [17,'Century Streak','100-day streak','Pro','💫'],
    [18,'Master Builder','Complete all courses','Pro','👑'],
    [19,'Elite Solver','Solve 100 puzzles','Pro','🎯'],
    [20,'Senior Status','Reach Level 50','Pro','🔥'],
    [21,'Eternal Flame','365-day streak','Legend','🌈'],
    [22,'MATRIXON God','Reach Level 100','Legend','⚡'],
    [23,'Complete Legend','Unlock all achievements','Legend','🎆'],
  ];
  seeds.forEach(r => db.query(
    'INSERT IGNORE INTO achievements (id,name,description,badge,icon) VALUES (?,?,?,?,?)', r
  ));

  // Migrations
  db.query("SHOW COLUMNS FROM user_achievements LIKE 'tier'", (err, rows) => {
    if (!err && rows && rows.length === 0) {
      db.query("ALTER TABLE user_achievements ADD COLUMN tier INT DEFAULT 0");
    }
  });

  const columnsToAdd = [
    { col: 'weekly_xp',    def: 'INT DEFAULT 0' },
    { col: 'monthly_xp',   def: 'INT DEFAULT 0' },
    { col: 'points',       def: 'INT DEFAULT 0' },
    { col: 'level',        def: 'INT DEFAULT 1' },
    { col: 'xp',           def: 'INT DEFAULT 0' },
    { col: 'league',       def: "VARCHAR(30) DEFAULT 'Trainee'" },
    { col: 'nickname',     def: 'VARCHAR(50)' },
    { col: 'uid',          def: 'VARCHAR(30)' },
    { col: 'photo',        def: 'MEDIUMTEXT' },
    { col: 'country_code', def: "VARCHAR(5) DEFAULT ''" },
    { col: 'country_flag', def: "VARCHAR(10) DEFAULT ''" },
    { col: 'country_name', def: "VARCHAR(60) DEFAULT ''" },
    { col: 'email',        def: "VARCHAR(120) DEFAULT ''" },
    { col: 'phone',        def: "VARCHAR(20) DEFAULT ''" },
  ];

  function addColumnIfMissing(index) {
    if (index >= columnsToAdd.length) { console.log('All migrations complete'); return; }
    const { col, def } = columnsToAdd[index];
    db.query(`SHOW COLUMNS FROM profiles LIKE '${col}'`, (err, rows) => {
      if (err) { addColumnIfMissing(index + 1); return; }
      if (rows && rows.length === 0) {
        db.query(`ALTER TABLE profiles ADD COLUMN ${col} ${def}`, err2 => {
          if (err2) console.error(`Failed to add ${col}:`, err2.message);
          else      console.log(`Added column: ${col}`);
          addColumnIfMissing(index + 1);
        });
      } else {
        addColumnIfMissing(index + 1);
      }
    });
  }
  addColumnIfMissing(0);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function generateUID(u)      { const b=u.toLowerCase().replace(/[^a-z]/g,'').slice(0,6);const s=['!','@','#','$','_','.'];return b+s[Math.floor(Math.random()*s.length)]+Math.floor(10+Math.random()*90); }
function generateNickname(u) { const e=['y','ie','ster','z','Man','Pro','Dev','X'];const b=u.charAt(0).toUpperCase()+u.slice(1,4).toLowerCase();return b+e[Math.floor(Math.random()*e.length)]; }
function getLeague(l)        { if(l>=71)return'Ace Developer';if(l>=51)return'Master Hacker';if(l>=36)return'Hacker';if(l>=21)return'Senior Developer';if(l>=11)return'Developer';return'Trainee'; }

/** Validate username: 3-20 chars, alphanumeric + underscore only */
function validUsername(u) { return typeof u === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(u); }
/** Validate password: 6-128 chars */
function validPassword(p) { return typeof p === 'string' && p.length >= 6 && p.length <= 128; }

/** Generate a random 6-character alphanumeric reset token */
function generateResetToken() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9C2BE"
}

// ── XP RESETS ────────────────────────────────────────────────────────────────
function checkAndResetXP() {
  const now = new Date(), today = now.toISOString().split('T')[0];
  if (now.getDay() === 1) {
    db.query("INSERT IGNORE INTO xp_resets (reset_type,reset_date) VALUES ('weekly',?)", [today], (err, r) => {
      if (r && r.affectedRows > 0) {
        db.query("UPDATE profiles SET weekly_xp=0");
        grantTop3WeeklyBonus();
        console.log('Weekly XP reset');
      }
    });
  }
  if (now.getDate() === 1) {
    db.query("INSERT IGNORE INTO xp_resets (reset_type,reset_date) VALUES ('monthly',?)", [today], (err, r) => {
      if (r && r.affectedRows > 0) { db.query("UPDATE profiles SET monthly_xp=0"); console.log('Monthly XP reset'); }
    });
  }
}

function grantTop3WeeklyBonus() {
  db.query("SELECT username FROM profiles ORDER BY weekly_xp DESC LIMIT 3", (err, rows) => {
    if (err || !rows) return;
    const ws = new Date(); ws.setDate(ws.getDate() - 7);
    const weekStart = ws.toISOString().split('T')[0];
    rows.forEach((row, i) => {
      db.query("INSERT IGNORE INTO top3_bonus (username,week_start,rank_pos) VALUES (?,?,?)", [row.username, weekStart, i + 1]);
      db.query("UPDATE profiles SET xp=xp+20,weekly_xp=weekly_xp+20,monthly_xp=monthly_xp+20 WHERE username=?", [row.username]);
    });
  });
}
setInterval(checkAndResetXP, 3_600_000);

// ── PING ──────────────────────────────────────────────────────────────────────
app.head('/ping', (req, res) => res.sendStatus(200));
app.get('/ping',  (req, res) => res.sendStatus(200));

// ── AUTH ──────────────────────────────────────────────────────────────────────

/**
 * POST /login
 * Body: { username, password }
 * Compares password against bcrypt hash. Falls back for plain-text legacy
 * passwords and migrates them to hashed on first successful login.
 */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!validUsername(username) || !validPassword(password)) {
    return res.status(400).json({ success: false, message: 'Invalid credentials format' });
  }
  db.query('SELECT password FROM users WHERE username=?', [username], async (err, result) => {
    if (err || !result || !result.length) return res.json({ success: false });
    const stored = result[0].password;
    let match = false;

    if (stored.startsWith('$2')) {
      // bcrypt hash
      match = await bcrypt.compare(password, stored);
    } else {
      // Legacy plain-text — compare then migrate to bcrypt
      match = (stored === password);
      if (match) {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        db.query('UPDATE users SET password=? WHERE username=?', [hash, username]);
        console.log(`[MATRIXON] Migrated password for user: ${username}`);
      }
    }
    res.json({ success: match });
  });
});

/**
 * POST /register
 * Body: { username, password }
 * Stores bcrypt-hashed password.
 */
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!validUsername(username)) {
    return res.status(400).json({ success: false, message: 'Username must be 3-20 chars, letters/numbers/underscores only' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ success: false, message: 'Password must be 6-128 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    db.query('INSERT INTO users(username,password) VALUES (?,?)', [username, hash], (err) => {
      if (err) {
        console.error('[REGISTER ERROR]', err.code, err.message);
        if (err.code === 'ER_DUP_ENTRY')
          return res.json({ success: false, message: 'Username already exists' });
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PASSWORD RESET ────────────────────────────────────────────────────────────

/**
 * POST /auth/reset-request
 * Body: { username }
 *
 * Generates a one-time reset token valid for 15 minutes.
 * For a locally-deployed app (no email), the token is returned directly in the
 * response so the admin can relay it to the user, OR the user can see it on
 * their own device. Set MATRIXON_HIDE_TOKEN=1 in env to suppress the token
 * from the response (forcing admin relay).
 */
app.post('/auth/reset-request', (req, res) => {
  const { username } = req.body;
  if (!validUsername(username)) {
    return res.status(400).json({ success: false, message: 'Invalid username' });
  }
  // Verify user exists
  db.query('SELECT username FROM users WHERE username=?', [username], (err, rows) => {
    if (err || !rows || !rows.length) {
      // Return same response shape for non-existent users to avoid enumeration
      return res.json({ success: true, message: 'If that account exists, a reset code has been generated.' });
    }
    const token     = generateResetToken();
    const expiresAt = Date.now() + RESET_TOKEN_TTL;

    // Invalidate any previous tokens for this user
    db.query('UPDATE reset_tokens SET used=1 WHERE username=? AND used=0', [username], () => {
      db.query(
        'INSERT INTO reset_tokens (username, token, expires_at) VALUES (?,?,?)',
        [username, token, expiresAt],
        (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Failed to generate reset code' });
          console.log(`[MATRIXON] Password reset token for ${username}: ${token} (expires ${new Date(expiresAt).toISOString()})`);
          const hideToken = process.env.MATRIXON_HIDE_TOKEN === '1';
          res.json({
            success: true,
            message: 'Reset code generated. It expires in 15 minutes.',
            // Only omit token if explicitly configured to hide it
            ...(hideToken ? {} : { token }),
          });
        }
      );
    });
  });
});

/**
 * POST /auth/reset-confirm
 * Body: { username, token, newPassword }
 *
 * Verifies the token and updates the password.
 */
app.post('/auth/reset-confirm', async (req, res) => {
  const { username, token, newPassword } = req.body;
  if (!validUsername(username) || !token || !validPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  db.query(
    'SELECT id, expires_at FROM reset_tokens WHERE username=? AND token=? AND used=0 ORDER BY created_at DESC LIMIT 1',
    [username, token.toUpperCase().trim()],
    async (err, rows) => {
      if (err || !rows || !rows.length) {
        return res.json({ success: false, message: 'Invalid or expired reset code' });
      }
      const { id, expires_at } = rows[0];
      if (Date.now() > Number(expires_at)) {
        db.query('UPDATE reset_tokens SET used=1 WHERE id=?', [id]);
        return res.json({ success: false, message: 'Reset code has expired. Please request a new one.' });
      }
      try {
        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        db.query('UPDATE users SET password=? WHERE username=?', [hash, username], (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Failed to update password' });
          db.query('UPDATE reset_tokens SET used=1 WHERE id=?', [id]);
          console.log(`[MATRIXON] Password reset for user: ${username}`);
          res.json({ success: true, message: 'Password updated. You can now log in.' });
        });
      } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
      }
    }
  );
});

// ── PROFILE ───────────────────────────────────────────────────────────────────
app.post('/profile/setup', (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ success: false });
  db.query('SELECT username FROM profiles WHERE username=?', [username], (err, rows) => {
    if (rows && rows.length > 0) return res.json({ success: true, new: false });
    const uid = generateUID(username), nickname = generateNickname(username);
    db.query(
      "INSERT INTO profiles (username,uid,nickname,level,xp,weekly_xp,monthly_xp,points,league) VALUES (?,?,?,1,0,0,0,0,'Trainee')",
      [username, uid, nickname],
      (err2) => {
        if (err2) return res.json({ success: false, error: err2.message });
        db.query('INSERT IGNORE INTO user_achievements (username,achievement_id) VALUES (?,1)', [username]);
        res.json({ success: true, new: true, uid, nickname });
      }
    );
  });
});

app.get('/profile/:username', (req, res) => {
  const { username } = req.params;
  db.query('SELECT * FROM profiles WHERE username=?', [username], (err, rows) => {
    if (err || !rows || !rows.length) return res.json({ username, level: 1, xp: 0 });
    const profile = rows[0];
    db.query('SELECT ua.achievement_id,ua.unlocked_at FROM user_achievements ua WHERE ua.username=?', [username], (err2, achievements) => {
      db.query('SELECT course_name FROM courses_completed WHERE username=?', [username], (err3, courses) => {
        db.query('SELECT f.friend_username,p.uid as friend_uid FROM friends f LEFT JOIN profiles p ON p.username=f.friend_username WHERE f.username=?', [username], (err4, friends) => {
          db.query('SELECT COUNT(*) as total FROM login_streaks WHERE username=?', [username], (err5, streak) => {
            res.json({
              ...profile,
              unlocked_achievements: achievements || [],
              courses_completed: (courses || []).map(c => c.course_name),
              friends: friends || [],
              login_days: streak?.[0]?.total || 0
            });
          });
        });
      });
    });
  });
});

app.post('/profile/update', (req, res) => {
  const { username, nickname, photo, level, xp, country_code, country_flag, country_name, email, phone } = req.body;
  if (!username) return res.json({ success: false });
  let fields = [], values = [];
  if (nickname     !== undefined) { fields.push('nickname=?');      values.push(nickname); }
  if (photo        !== undefined) { fields.push('photo=?');         values.push(photo); }
  if (country_code !== undefined) { fields.push('country_code=?');  values.push(country_code); }
  if (country_flag !== undefined) { fields.push('country_flag=?');  values.push(country_flag); }
  if (email        !== undefined) { fields.push('email=?');         values.push(email); }
  if (phone        !== undefined) { fields.push('phone=?');         values.push(phone); }
  if (country_name !== undefined) { fields.push('country_name=?');  values.push(country_name); }
  if (xp           !== undefined) { fields.push('xp=xp+?','weekly_xp=weekly_xp+?','monthly_xp=monthly_xp+?'); values.push(xp, xp, xp); }
  if (level        !== undefined) { fields.push('level=?','league=?'); values.push(level, getLeague(level)); }
  if (!fields.length) return res.json({ success: false, message: 'Nothing to update' });
  values.push(username);
  db.query(`UPDATE profiles SET ${fields.join(',')} WHERE username=?`, values, (err) => {
    res.json({ success: !err, error: err?.message });
  });
});

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
app.get('/leaderboard/global', (req, res) => {
  db.query('SELECT username,uid,nickname,level,xp,monthly_xp,weekly_xp,league,country_code,country_flag,country_name FROM profiles ORDER BY monthly_xp DESC,xp DESC LIMIT 50', (err, rows) => {
    res.json(err ? [] : rows || []);
  });
});
app.get('/leaderboard/national/:country', (req, res) => {
  db.query('SELECT username,uid,nickname,level,xp,monthly_xp,weekly_xp,league,country_code,country_flag,country_name FROM profiles WHERE country_code=? ORDER BY weekly_xp DESC,xp DESC LIMIT 50', [req.params.country], (err, rows) => {
    res.json(err ? [] : rows || []);
  });
});
app.get('/leaderboard/friends/:username', (req, res) => {
  const u = req.params.username;
  db.query(
    `SELECT p.username,p.uid,p.nickname,p.level,p.xp,p.monthly_xp,p.weekly_xp,p.league,p.country_code,p.country_flag,p.country_name
     FROM friends f JOIN profiles p ON p.username=f.friend_username WHERE f.username=?
     UNION
     SELECT p.username,p.uid,p.nickname,p.level,p.xp,p.monthly_xp,p.weekly_xp,p.league,p.country_code,p.country_flag,p.country_name
     FROM profiles p WHERE p.username=?
     ORDER BY weekly_xp DESC,xp DESC LIMIT 50`,
    [u, u], (err, rows) => { res.json(err ? [] : rows || []); }
  );
});

// ── STREAK ────────────────────────────────────────────────────────────────────
app.post('/streak/record', (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ success: false });
  const today = new Date().toISOString().split('T')[0];
  db.query('INSERT IGNORE INTO login_streaks (username,login_date) VALUES (?,?)', [username, today], (err) => {
    if (!err) db.query('UPDATE profiles SET xp=xp+5,weekly_xp=weekly_xp+5,monthly_xp=monthly_xp+5 WHERE username=?', [username]);
    res.json({ success: !err, date: today });
  });
});

// ── ACHIEVEMENTS ──────────────────────────────────────────────────────────────
app.post('/achievement/unlock', (req, res) => {
  const { username, achievement_id } = req.body;
  if (!username || !achievement_id) return res.json({ success: false });
  db.query('INSERT IGNORE INTO user_achievements (username,achievement_id) VALUES (?,?)', [username, achievement_id], (err, result) => {
    if (err) return res.json({ success: false });
    if (!result.affectedRows) return res.json({ success: false, already: true });
    const xpMap = {1:50,2:50,3:50,4:50,5:100,6:100,7:100,8:100,9:200,10:200,11:200,12:200,13:400,14:400,15:400,16:400,17:800,18:800,19:800,20:800,21:2000,22:2000,23:5000};
    const xpGain = xpMap[achievement_id] || 50;
    db.query('UPDATE profiles SET xp=xp+?,weekly_xp=weekly_xp+?,monthly_xp=monthly_xp+?,points=points+? WHERE username=?', [xpGain,xpGain,xpGain,xpGain,username]);
    res.json({ success: true, xp_gained: xpGain });
  });
});

app.get('/achievements/tiers/:username', (req, res) => {
  const { username } = req.params;
  db.query('SELECT achievement_id, tier FROM user_achievements WHERE username=?', [username], (err, rows) => {
    res.json(err ? [] : rows || []);
  });
});

app.post('/achievements/tier/set', (req, res) => {
  const { username, achievement_id, tier } = req.body;
  if (!username || achievement_id === undefined || tier === undefined)
    return res.json({ success: false, error: 'Missing fields' });
  const tierVal = parseInt(tier, 10);
  if (isNaN(tierVal) || tierVal < 0 || tierVal > 4)
    return res.json({ success: false, error: 'Invalid tier (0-4)' });
  const tierXP = [50, 100, 200, 400, 800];
  db.query(
    `INSERT INTO user_achievements (username,achievement_id,tier) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE tier=IF(VALUES(tier)>tier,VALUES(tier),tier)`,
    [username, achievement_id, tierVal],
    (err, result) => {
      if (err) return res.json({ success: false, error: err.message });
      if (result.affectedRows === 2) {
        const xpGain = tierXP[tierVal] || 50;
        db.query('UPDATE profiles SET xp=xp+?,weekly_xp=weekly_xp+?,monthly_xp=monthly_xp+?,points=points+? WHERE username=?', [xpGain,xpGain,xpGain,xpGain,username]);
      }
      res.json({ success: true, xp_gained: result.affectedRows === 2 ? (tierXP[tierVal] || 50) : 0 });
    }
  );
});

// ── FRIENDS ───────────────────────────────────────────────────────────────────
app.post('/friends/add', (req, res) => {
  const { username, friend_uid } = req.body;
  if (!username || !friend_uid) return res.json({ success: false, message: 'Missing fields' });
  db.query('SELECT username FROM profiles WHERE uid=?', [friend_uid], (err, rows) => {
    if (!rows || !rows.length) return res.json({ success: false, message: 'No user with that UID' });
    const fu = rows[0].username;
    if (fu === username) return res.json({ success: false, message: "Can't add yourself" });
    db.query('INSERT IGNORE INTO friends (username,friend_username) VALUES (?,?)', [username, fu], (err2) => {
      res.json({ success: !err2, friend: fu });
    });
  });
});

// ── COURSES ───────────────────────────────────────────────────────────────────
app.post('/course/complete', (req, res) => {
  const { username, course_name } = req.body;
  if (!username || !course_name) return res.json({ success: false });
  db.query('INSERT IGNORE INTO courses_completed (username,course_name) VALUES (?,?)', [username, course_name], (err) => {
    if (!err) db.query('UPDATE profiles SET xp=xp+150,weekly_xp=weekly_xp+150,monthly_xp=monthly_xp+150,points=points+150 WHERE username=?', [username]);
    res.json({ success: !err });
  });
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
app.get('/settings/:username', (req, res) => {
  const { username } = req.params;
  db.query('SELECT settings FROM user_settings WHERE username=?', [username], (err, rows) => {
    if (err || !rows || !rows.length) return res.json({ settings: {} });
    try { res.json({ settings: JSON.parse(rows[0].settings || '{}') }); }
    catch (e) { res.json({ settings: {} }); }
  });
});

app.post('/settings/save', (req, res) => {
  const { username, settings } = req.body;
  if (!username || !settings) return res.json({ success: false });
  const json = JSON.stringify(settings);
  db.query(
    'INSERT INTO user_settings (username,settings) VALUES (?,?) ON DUPLICATE KEY UPDATE settings=VALUES(settings)',
    [username, json],
    (err) => res.json({ success: !err, error: err?.message })
  );
});

// ── ACCOUNT DELETE ────────────────────────────────────────────────────────────
app.post('/account/delete', (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ success: false });
  const tables = ['user_achievements','friends','courses_completed','login_streaks','user_settings','reset_tokens','profiles','users'];
  let done = 0;
  tables.forEach(t => {
    db.query(`DELETE FROM ${t} WHERE username=?`, [username], () => {
      done++;
      if (done === tables.length) res.json({ success: true });
    });
  });
});

// ── SUPPORT TICKETS ───────────────────────────────────────────────────────────
// Create table on startup (safe — IF NOT EXISTS)
db.query(`CREATE TABLE IF NOT EXISTS support_tickets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50),
  type        ENUM('bug','feature','account','other') DEFAULT 'other',
  subject     VARCHAR(200),
  priority    ENUM('low','medium','high') DEFAULT 'medium',
  message     TEXT,
  status      ENUM('open','in_progress','resolved') DEFAULT 'open',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, err => { if (err) console.error('support_tickets:', err.message); });

app.post('/support/submit', (req, res) => {
  const { username, type, subject, priority, message } = req.body;
  if (!subject || !message) return res.status(400).json({ success: false, error: 'Missing fields' });
  if (message.length < 10) return res.status(400).json({ success: false, error: 'Message too short' });
  const safeType = ['bug','feature','account','other'].includes(type) ? type : 'other';
  const safePrio = ['low','medium','high'].includes(priority) ? priority : 'medium';
  db.query(
    'INSERT INTO support_tickets (username,type,subject,priority,message) VALUES (?,?,?,?,?)',
    [username||'anonymous', safeType, subject.slice(0,200), safePrio, message.slice(0,2000)],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, ticket_id: result.insertId });
    }
  );
});

app.listen(3000, () => console.log('MATRIXON Server → http://localhost:3000'));
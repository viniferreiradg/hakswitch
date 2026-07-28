-- HakSwitch Studio working library schema (better-sqlite3, local to the
-- Studio app only - the real HakSwitch .nro never reads this file; it
-- reads the plain folders/JSON that build-service.ts generates from it).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS platforms (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,   -- must match a real consoles/<name> folder, e.g. "Super Nintendo"
  logo          TEXT,                   -- caminho absoluto no PC do usuário
  background    TEXT
);

CREATE TABLE IF NOT EXISTS games (
  id             INTEGER PRIMARY KEY,
  title          TEXT NOT NULL,
  filename       TEXT NOT NULL,          -- caminho absoluto no PC do usuário
  platform_id    INTEGER NOT NULL REFERENCES platforms(id),
  cover          TEXT,
  logo           TEXT,
  video          TEXT,
  background     TEXT,
  description    TEXT,
  publisher      TEXT,
  developer      TEXT,
  genre          TEXT,
  year           INTEGER,
  region         TEXT,                   -- extraído do nome do arquivo na importação (ex "(USA)" -> "USA")
  players        INTEGER,
  favorite       INTEGER NOT NULL DEFAULT 0,
  play_count     INTEGER NOT NULL DEFAULT 0,
  last_played    TEXT,                   -- ISO 8601, NULL se nunca jogado
  category_path  TEXT                    -- ex "Nintendo/Mario", "SNES/RPG"
);

CREATE TABLE IF NOT EXISTS collections (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  is_smart   INTEGER NOT NULL DEFAULT 0, -- 0 = manual, 1 = regra automática
  rule_json  TEXT                        -- ex {"favorite":true} ou {"genre":"RPG"}, só usado se is_smart=1
);

CREATE TABLE IF NOT EXISTS collection_games (
  collection_id  INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  game_id        INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_platform    ON games(platform_id);
CREATE INDEX IF NOT EXISTS idx_games_favorite    ON games(favorite);
CREATE INDEX IF NOT EXISTS idx_games_last_played ON games(last_played);
CREATE INDEX IF NOT EXISTS idx_games_category    ON games(category_path);

-- Seed inicial de plataformas. Os quatro primeiros nomes têm que bater
-- exatamente com as pastas em consoles/ que o HakSwitch real já lê hoje;
-- os demais ficam disponíveis para quando o app ganhar suporte a eles.
INSERT OR IGNORE INTO platforms (name) VALUES
  ('Nintendo'),
  ('Super Nintendo'),
  ('Mega Drive'),
  ('Master System'),
  ('Game Boy'),
  ('Game Boy Color'),
  ('Game Boy Advance'),
  ('Arcade'),
  ('Nintendo 64'),
  ('PlayStation');

import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export function findSchemaPath(): string {
  // shared/schema/schema.sql vive um nivel acima de studio/ no monorepo.
  const candidates = [
    join(process.cwd(), '..', 'shared', 'schema', 'schema.sql'),
    join(app.getAppPath(), '..', 'shared', 'schema', 'schema.sql'),
    join(app.getAppPath(), 'shared', 'schema', 'schema.sql')
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error(`schema.sql nao encontrado. Caminhos tentados: ${candidates.join(', ')}`)
  }
  return found
}

let db: Database.Database | null = null

// CREATE TABLE IF NOT EXISTS no schema.sql não altera uma tabela que já
// existe de uma versão anterior do Studio - uma coluna nova ali fica
// invisível pro banco de trabalho até isso rodar uma vez. Só adiciona
// (nunca remove/renomeia), então nunca há dado pra perder.
function migrate(database: Database.Database): void {
  const columnExists = (table: string, column: string): boolean =>
    (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
      (col) => col.name === column
    )

  if (!columnExists('platforms', 'logo')) database.exec('ALTER TABLE platforms ADD COLUMN logo TEXT')
  if (!columnExists('platforms', 'background'))
    database.exec('ALTER TABLE platforms ADD COLUMN background TEXT')
  if (!columnExists('games', 'region')) database.exec('ALTER TABLE games ADD COLUMN region TEXT')
}

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'library.sqlite')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  const schema = readFileSync(findSchemaPath(), 'utf-8')
  db.exec(schema)
  migrate(db)

  return db
}

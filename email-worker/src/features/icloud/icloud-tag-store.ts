import type { Env } from '../../app/types'

const MAX_TAG_LENGTH = 40
const MAX_TAGS_PER_ALIAS = 20
const ALIAS_EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}$/

export class ICloudTagStoreError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

interface AliasTagRow {
  alias_email: string
  tag_name: string
}

export function normalizeTagName(value: unknown): string {
  const tag = (typeof value === 'string' ? value : '').trim()
  if (!tag) throw new ICloudTagStoreError(400, '请填写标签名称。')
  if (tag.length > MAX_TAG_LENGTH) {
    throw new ICloudTagStoreError(400, `标签名称不能超过 ${MAX_TAG_LENGTH} 个字符。`)
  }
  return tag
}

export function normalizeAliasEmail(value: unknown): string {
  const email = (typeof value === 'string' ? value : '').trim().toLowerCase()
  if (!email || !ALIAS_EMAIL.test(email)) {
    throw new ICloudTagStoreError(400, '隐藏邮箱地址无效。')
  }
  return email
}

// Local, user-owned labels for iCloud Hide My Email aliases. Tags never leave
// the user's OmniMail instance and are unrelated to Apple's alias metadata.
export class ICloudTagStore {
  constructor(
    private readonly env: Env,
    private readonly userId: string,
  ) {}

  private async assertAccount(accountId: string): Promise<void> {
    if (!accountId) throw new ICloudTagStoreError(400, '缺少 accountId。')
    const row = await this.env.DB.prepare(
      'SELECT 1 AS ok FROM icloud_accounts WHERE id = ? AND user_id = ?',
    ).bind(accountId, this.userId).first<{ ok: number }>()
    if (!row) throw new ICloudTagStoreError(404, 'iCloud 账号不存在。')
  }

  // Distinct tag names used across the account, for the filter suggestions.
  async listTags(accountId: string): Promise<string[]> {
    await this.assertAccount(accountId)
    const { results } = await this.env.DB.prepare(
      `SELECT DISTINCT tag_name FROM icloud_alias_tags
       WHERE user_id = ? AND icloud_account_id = ?
       ORDER BY tag_name COLLATE NOCASE`,
    ).bind(this.userId, accountId).all<{ tag_name: string }>()
    return results.map((row) => row.tag_name)
  }

  // Map of alias email -> its tag names, for rendering labels next to aliases.
  async listAliasTags(accountId: string): Promise<Record<string, string[]>> {
    await this.assertAccount(accountId)
    const { results } = await this.env.DB.prepare(
      `SELECT alias_email, tag_name FROM icloud_alias_tags
       WHERE user_id = ? AND icloud_account_id = ?
       ORDER BY alias_email, tag_name COLLATE NOCASE`,
    ).bind(this.userId, accountId).all<AliasTagRow>()
    const map: Record<string, string[]> = {}
    for (const row of results) {
      if (!map[row.alias_email]) map[row.alias_email] = []
      map[row.alias_email].push(row.tag_name)
    }
    return map
  }

  async addTag(accountId: string, aliasEmail: string, tagName: string): Promise<void> {
    await this.assertAccount(accountId)
    const existing = await this.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM icloud_alias_tags
       WHERE user_id = ? AND alias_email = ?`,
    ).bind(this.userId, aliasEmail).first<{ total: number }>()
    if (Number(existing?.total ?? 0) >= MAX_TAGS_PER_ALIAS) {
      throw new ICloudTagStoreError(400, `每个隐藏邮箱最多添加 ${MAX_TAGS_PER_ALIAS} 个标签。`)
    }
    const id = `itag_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
    // UNIQUE(user_id, alias_email, tag_name) makes a repeated tag a no-op.
    await this.env.DB.prepare(
      `INSERT OR IGNORE INTO icloud_alias_tags
        (id, user_id, icloud_account_id, alias_email, tag_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      this.userId,
      accountId,
      aliasEmail,
      tagName,
      new Date().toISOString(),
    ).run()
  }

  async removeTag(accountId: string, aliasEmail: string, tagName: string): Promise<boolean> {
    await this.assertAccount(accountId)
    const result = await this.env.DB.prepare(
      `DELETE FROM icloud_alias_tags
       WHERE user_id = ? AND icloud_account_id = ? AND alias_email = ? AND tag_name = ?`,
    ).bind(this.userId, accountId, aliasEmail, tagName).run()
    return Boolean(result.meta.changes)
  }
}

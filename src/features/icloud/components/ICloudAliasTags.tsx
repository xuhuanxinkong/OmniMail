import { Plus, Tag, X } from 'lucide-react'
import { useState } from 'react'
import { api, type ICloudAccount } from '../../../shared/api'
import { errorMessage } from '../../../shared/api/errorMessage'
import { t } from '../../../shared/i18n'

// Add/remove local labels for a single Hide My Email alias. Tags are stored
// only in this OmniMail instance and never sent to Apple.
export function ICloudAliasTags({ account, aliasEmail, tags, onChanged, onError }: {
  account: ICloudAccount
  aliasEmail: string
  tags: string[]
  onChanged: () => void | Promise<void>
  onError: (message: string) => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function addTag() {
    const tagName = value.trim()
    if (!tagName || busy) return
    setBusy(true)
    try {
      await api.addICloudAliasTag(account.id, aliasEmail, tagName)
      setValue('')
      await onChanged()
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function removeTag(tagName: string) {
    if (busy) return
    setBusy(true)
    try {
      await api.removeICloudAliasTag(account.id, aliasEmail, tagName)
      await onChanged()
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="icloud-alias-tags">
      <span className="icloud-alias-tags__label"><Tag size={13} aria-hidden="true" />{t('本地标签')}</span>
      <div className="icloud-alias-tags__list">
        {tags.length ? tags.map((tag) => (
          <span className="icloud-tag-chip" key={tag}>
            <span className="icloud-tag-chip__text">{tag}</span>
            <button type="button" disabled={busy} onClick={() => void removeTag(tag)}
              aria-label={t('移除标签：{tag}', { tag })} data-tooltip={t('移除标签')}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        )) : <span className="icloud-alias-tags__empty">{t('暂无标签，添加一个记录用途')}</span>}
      </div>
      <form className="icloud-alias-tags__add"
        onSubmit={(event) => { event.preventDefault(); void addTag() }}>
        <input type="text" value={value} maxLength={40} placeholder={t('添加标签，如 GitHub')}
          onChange={(event) => setValue(event.target.value)} aria-label={t('新标签名称')} />
        <button type="submit" disabled={busy || !value.trim()}
          aria-label={t('添加标签')} data-tooltip={t('添加标签')}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}

import { writeAudit } from '../../shared/audit/audit'
import {
  ICloudTagStore,
  ICloudTagStoreError,
  normalizeAliasEmail,
  normalizeTagName,
} from './icloud-tag-store'
import type { Env, SessionUser } from '../../app/types'

function responseError(error: unknown): Response {
  if (error instanceof ICloudTagStoreError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error('iCloud tag request failed', error)
  return Response.json({ error: 'iCloud 标签操作暂时无法完成。' }, { status: 500 })
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json<unknown>()
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
    return body as Record<string, unknown>
  } catch {
    throw new ICloudTagStoreError(400, '请求体必须是 JSON 对象。')
  }
}

function accountIdFromQuery(request: Request): string {
  const accountId = new URL(request.url).searchParams.get('accountId') || ''
  if (!accountId) throw new ICloudTagStoreError(400, '缺少 accountId。')
  return accountId
}

function accountIdField(value: unknown): string {
  const accountId = typeof value === 'string' ? value.trim() : ''
  if (!accountId) throw new ICloudTagStoreError(400, '缺少 accountId。')
  return accountId
}

function privateJson(body: unknown): Response {
  return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function listICloudTags(
  env: Env,
  user: SessionUser,
  request: Request,
): Promise<Response> {
  try {
    const accountId = accountIdFromQuery(request)
    const tags = await new ICloudTagStore(env, user.id).listTags(accountId)
    return privateJson({ tags })
  } catch (error) {
    return responseError(error)
  }
}

export async function listICloudAliasTags(
  env: Env,
  user: SessionUser,
  request: Request,
): Promise<Response> {
  try {
    const accountId = accountIdFromQuery(request)
    const tags = await new ICloudTagStore(env, user.id).listAliasTags(accountId)
    return privateJson({ tags })
  } catch (error) {
    return responseError(error)
  }
}

export async function addICloudAliasTag(
  env: Env,
  user: SessionUser,
  request: Request,
  ip: string,
): Promise<Response> {
  try {
    const body = await jsonBody(request)
    const accountId = accountIdField(body.accountId)
    const aliasEmail = normalizeAliasEmail(body.aliasEmail)
    const tagName = normalizeTagName(body.tagName)
    await new ICloudTagStore(env, user.id).addTag(accountId, aliasEmail, tagName)
    await writeAudit(env, user.id, 'icloud.alias.tag.add', accountId, ip, { aliasEmail, tagName })
    return Response.json({ ok: true, aliasEmail, tagName }, { status: 201 })
  } catch (error) {
    return responseError(error)
  }
}

export async function removeICloudAliasTag(
  env: Env,
  user: SessionUser,
  request: Request,
  ip: string,
): Promise<Response> {
  try {
    const body = await jsonBody(request)
    const accountId = accountIdField(body.accountId)
    const aliasEmail = normalizeAliasEmail(body.aliasEmail)
    const tagName = normalizeTagName(body.tagName)
    const removed = await new ICloudTagStore(env, user.id).removeTag(accountId, aliasEmail, tagName)
    if (!removed) throw new ICloudTagStoreError(404, '标签不存在。')
    await writeAudit(env, user.id, 'icloud.alias.tag.remove', accountId, ip, { aliasEmail, tagName })
    return Response.json({ ok: true })
  } catch (error) {
    return responseError(error)
  }
}

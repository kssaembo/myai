import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createCategory,
  createTag,
  createTagAlias,
  deleteTag,
  deleteTagAlias,
  readTaxonomy,
  setCategoryArchived,
  updateCategory,
  updateTag,
  type Category,
  type Tag,
  type TaxonomySnapshot,
} from '@/entities/taxonomy/api'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyDataError } from '@/shared/lib/display'
import { ErrorState, LoadingState } from '@/shared/ui/States'

type Tab = 'categories' | 'tags' | 'nodes' | 'relations'
const colors = ['#3B82F6', '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#64748B']

export function TaxonomyPage() {
  const { user } = useAuth()
  const [data, setData] = useState<TaxonomySnapshot | null>(null)
  const [tab, setTab] = useState<Tab>('categories')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [categoryDraft, setCategoryDraft] = useState({
    id: '',
    name: '',
    parentId: '',
    color: colors[0],
  })
  const [tagDraft, setTagDraft] = useState({ id: '', name: '', color: colors[1] })
  const [aliasDraft, setAliasDraft] = useState({ tagId: '', alias: '' })
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setData(await readTaxonomy())
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsLoading(false)
    }
  }, [])
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const roots = useMemo(
    () => data?.categories.filter((category) => !category.parent_id) ?? [],
    [data],
  )
  const editingHasChildren = (data?.categories ?? []).some(
    (category) => category.parent_id === categoryDraft.id,
  )
  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !categoryDraft.name.trim()) return
    setError('')
    setMessage('')
    try {
      const input = {
        name: categoryDraft.name,
        parentId: categoryDraft.parentId || null,
        color: categoryDraft.color,
      }
      if (categoryDraft.id) await updateCategory(categoryDraft.id, input)
      else await createCategory({ ownerId: user.id, ...input })
      setCategoryDraft({ id: '', name: '', parentId: '', color: colors[0] })
      setMessage('Category를 저장했습니다.')
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }
  const saveTag = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !tagDraft.name.trim()) return
    setError('')
    setMessage('')
    try {
      if (tagDraft.id) await updateTag(tagDraft.id, tagDraft.name, tagDraft.color)
      else await createTag(user.id, tagDraft.name, tagDraft.color)
      setTagDraft({ id: '', name: '', color: colors[1] })
      setMessage('Tag를 저장했습니다.')
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }
  const saveAlias = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !aliasDraft.tagId || !aliasDraft.alias.trim()) return
    setError('')
    setMessage('')
    try {
      await createTagAlias(user.id, aliasDraft.tagId, aliasDraft.alias)
      setAliasDraft({ tagId: '', alias: '' })
      setMessage('Tag 별칭을 추가했습니다.')
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }

  if (isLoading && !data) return <LoadingState label="분류 체계를 불러오는 중입니다" />
  if (!data)
    return (
      <ErrorState
        title="분류 체계를 열 수 없습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  return (
    <section className="page-section taxonomy-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Settings · Taxonomy</p>
          <h1>분류 체계</h1>
          <p>넓은 서랍인 Category와 교차 속성인 Tag를 관리하고, 시스템 사전을 확인합니다.</p>
        </div>
      </header>
      <div className="taxonomy-tabs" role="tablist">
        {(
          [
            ['categories', 'Categories'],
            ['tags', 'Tags & Aliases'],
            ['nodes', 'Node Types'],
            ['relations', 'Relation Types'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'active' : ''}
            onClick={() => {
              setTab(value)
              setError('')
              setMessage('')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="inline-success" role="status">
          {message}
        </p>
      )}

      {tab === 'categories' && (
        <div className="taxonomy-layout">
          <article className="content-card taxonomy-list-card">
            <header className="card-heading">
              <div>
                <p className="eyebrow">Category Tree</p>
                <h2>Category {data.categories.length}개</h2>
              </div>
            </header>
            <div className="category-tree">
              {roots.map((root) => (
                <div
                  className={`category-group${root.is_archived ? ' archived' : ''}`}
                  key={root.id}
                >
                  <CategoryRow
                    category={root}
                    onEdit={() =>
                      setCategoryDraft({
                        id: root.id,
                        name: root.name,
                        parentId: '',
                        color: root.color ?? colors[0],
                      })
                    }
                    onArchive={() =>
                      void (async () => {
                        try {
                          await setCategoryArchived(root.id, !root.is_archived)
                          await load()
                        } catch (caught) {
                          setError(friendlyDataError(caught))
                        }
                      })()
                    }
                  />
                  {data.categories
                    .filter((child) => child.parent_id === root.id)
                    .map((child) => (
                      <div className="category-child" key={child.id}>
                        <CategoryRow
                          category={child}
                          onEdit={() =>
                            setCategoryDraft({
                              id: child.id,
                              name: child.name,
                              parentId: root.id,
                              color: child.color ?? colors[0],
                            })
                          }
                          onArchive={() =>
                            void (async () => {
                              try {
                                await setCategoryArchived(child.id, !child.is_archived)
                                await load()
                              } catch (caught) {
                                setError(friendlyDataError(caught))
                              }
                            })()
                          }
                        />
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </article>
          <form
            className="content-card taxonomy-editor"
            onSubmit={(event) => void saveCategory(event)}
          >
            <p className="eyebrow">{categoryDraft.id ? 'Edit Category' : 'New Category'}</p>
            <h2>{categoryDraft.id ? 'Category 수정' : 'Category 추가'}</h2>
            <label>
              이름
              <input
                required
                value={categoryDraft.name}
                onChange={(event) =>
                  setCategoryDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="예: Classroom UX"
              />
            </label>
            <label>
              상위 Category
              <select
                value={categoryDraft.parentId}
                disabled={editingHasChildren}
                onChange={(event) =>
                  setCategoryDraft((draft) => ({ ...draft, parentId: event.target.value }))
                }
              >
                <option value="">최상위</option>
                {!editingHasChildren &&
                  roots
                    .filter((root) => root.id !== categoryDraft.id && !root.is_archived)
                    .map((root) => (
                      <option key={root.id} value={root.id}>
                        {root.name}
                      </option>
                    ))}
              </select>
              <small>최대 2단계까지만 지원합니다.</small>
            </label>
            <ColorPicker
              value={categoryDraft.color}
              onChange={(color) => setCategoryDraft((draft) => ({ ...draft, color }))}
            />
            <div className="form-actions">
              {categoryDraft.id && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setCategoryDraft({ id: '', name: '', parentId: '', color: colors[0] })
                  }
                >
                  취소
                </button>
              )}
              <button className="primary-button" type="submit">
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'tags' && (
        <div className="taxonomy-layout">
          <article className="content-card taxonomy-list-card">
            <header className="card-heading">
              <div>
                <p className="eyebrow">Tags</p>
                <h2>Tag {data.tags.length}개</h2>
              </div>
            </header>
            <div className="tag-management-list">
              {data.tags.length ? (
                data.tags.map((tag) => (
                  <div className="tag-management-row" key={tag.id}>
                    <div>
                      <span className="color-dot" style={{ background: tag.color ?? '#64748B' }} />
                      <strong>{tag.name}</strong>
                      <small>
                        {data.tagAliases
                          .filter((alias) => alias.tag_id === tag.id)
                          .map((alias) => (
                            <button
                              title="별칭 삭제"
                              type="button"
                              key={alias.id}
                              onClick={() =>
                                void (async () => {
                                  try {
                                    await deleteTagAlias(alias.id)
                                    await load()
                                  } catch (caught) {
                                    setError(friendlyDataError(caught))
                                  }
                                })()
                              }
                            >
                              {alias.alias} ×
                            </button>
                          ))}
                      </small>
                    </div>
                    <div>
                      <button
                        className="text-action"
                        type="button"
                        onClick={() =>
                          setTagDraft({ id: tag.id, name: tag.name, color: tag.color ?? colors[1] })
                        }
                      >
                        수정
                      </button>
                      <button
                        className="text-action danger"
                        type="button"
                        onClick={() => setDeleteTarget(tag)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="list-empty-copy">아직 Tag가 없습니다.</p>
              )}
            </div>
          </article>
          <div className="taxonomy-editor-stack">
            <form
              className="content-card taxonomy-editor"
              onSubmit={(event) => void saveTag(event)}
            >
              <p className="eyebrow">{tagDraft.id ? 'Edit Tag' : 'New Tag'}</p>
              <h2>{tagDraft.id ? 'Tag 수정' : 'Tag 추가'}</h2>
              <label>
                이름
                <input
                  required
                  value={tagDraft.name}
                  onChange={(event) =>
                    setTagDraft((draft) => ({ ...draft, name: event.target.value }))
                  }
                  placeholder="예: 태블릿"
                />
              </label>
              <ColorPicker
                value={tagDraft.color}
                onChange={(color) => setTagDraft((draft) => ({ ...draft, color }))}
              />
              <div className="form-actions">
                {tagDraft.id && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setTagDraft({ id: '', name: '', color: colors[1] })}
                  >
                    취소
                  </button>
                )}
                <button className="primary-button" type="submit">
                  저장
                </button>
              </div>
            </form>
            <form
              className="content-card taxonomy-editor"
              onSubmit={(event) => void saveAlias(event)}
            >
              <p className="eyebrow">Tag Alias</p>
              <h2>별칭 추가</h2>
              <label>
                대표 Tag
                <select
                  required
                  value={aliasDraft.tagId}
                  onChange={(event) =>
                    setAliasDraft((draft) => ({ ...draft, tagId: event.target.value }))
                  }
                >
                  <option value="">선택</option>
                  {data.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                별칭
                <input
                  required
                  value={aliasDraft.alias}
                  onChange={(event) =>
                    setAliasDraft((draft) => ({ ...draft, alias: event.target.value }))
                  }
                  placeholder="예: Web RTC"
                />
              </label>
              <button className="primary-button" type="submit">
                별칭 저장
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'nodes' && (
        <DictionaryGrid
          items={data.nodeTypes.map((node) => ({
            id: node.id,
            color: node.color,
            title: node.label_ko,
            subtitle: node.label_en,
            key: node.key,
            description: node.description,
          }))}
          note="시스템 Node Type은 V1에서 읽기 전용입니다."
        />
      )}
      {tab === 'relations' && (
        <DictionaryGrid
          items={data.relationTypes.map((relation) => ({
            id: relation.id,
            color: relation.color,
            title: relation.label_ko,
            subtitle: relation.inverse_label_ko,
            key: relation.key,
            description: relation.description,
            detail: relation.is_symmetric ? '대칭 관계' : '방향 관계',
          }))}
          note="시스템 Relation Type은 읽기 전용이며 실제 관계 생성은 후속 단계에서 활성화됩니다."
        />
      )}

      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <p className="eyebrow">Delete Tag</p>
            <h2>‘{deleteTarget.name}’ Tag를 삭제할까요?</h2>
            <p>
              모든 Knowledge Item에서 이 Tag 연결도 함께 제거됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button
                className="primary-button destructive-button"
                type="button"
                onClick={() =>
                  void (async () => {
                    try {
                      await deleteTag(deleteTarget.id)
                      setDeleteTarget(null)
                      await load()
                    } catch (caught) {
                      setDeleteTarget(null)
                      setError(friendlyDataError(caught))
                    }
                  })()
                }
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function CategoryRow({
  category,
  onEdit,
  onArchive,
}: {
  category: Category
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <div className="category-row">
      <div>
        <span className="color-dot" style={{ background: category.color ?? '#64748B' }} />
        <strong>{category.name}</strong>
        {category.is_archived && <span className="mini-badge">보관</span>}
      </div>
      <div>
        <button className="text-action" type="button" onClick={onEdit}>
          수정
        </button>
        <button className="text-action" type="button" onClick={onArchive}>
          {category.is_archived ? '복원' : '보관'}
        </button>
      </div>
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <fieldset className="color-picker">
      <legend>색상</legend>
      {colors.map((color) => (
        <button
          aria-label={color}
          aria-pressed={value === color}
          key={color}
          type="button"
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </fieldset>
  )
}

function DictionaryGrid({
  items,
  note,
}: {
  items: {
    id: string
    color: string
    title: string
    subtitle: string
    key: string
    description: string
    detail?: string
  }[]
  note: string
}) {
  return (
    <>
      <p className="taxonomy-note">{note}</p>
      <div className="dictionary-grid">
        {items.map((item) => (
          <article
            className="content-card dictionary-card"
            key={item.id}
            style={{ '--dictionary-color': item.color } as React.CSSProperties}
          >
            <div>
              <span>{item.key}</span>
              {item.detail && <small>{item.detail}</small>}
            </div>
            <h2>{item.title}</h2>
            <p className="dictionary-subtitle">{item.subtitle}</p>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </>
  )
}

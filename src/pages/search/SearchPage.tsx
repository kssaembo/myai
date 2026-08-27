import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { searchKnowledge, type SearchFilters } from '@/entities/search/api'
import { highlightText } from '@/entities/search/highlight'
import { readTaxonomy, type TaxonomySnapshot } from '@/entities/taxonomy/api'
import {
  formatDate,
  friendlyDataError,
  itemStatusLabels,
  verificationLabels,
} from '@/shared/lib/display'
import type {
  DocumentFormat,
  ItemStatus,
  Json,
  SearchKnowledgeRow,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/States'

const PAGE_SIZE = 20
const formats: DocumentFormat[] = ['md', 'txt', 'pdf', 'docx']

const emptyTaxonomy: TaxonomySnapshot = {
  nodeTypes: [],
  relationTypes: [],
  categories: [],
  tags: [],
  tagAliases: [],
}

function param(params: URLSearchParams, key: string) {
  return params.get(key) ?? ''
}

function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    query: param(params, 'q'),
    nodeTypeKey: param(params, 'type'),
    categoryId: param(params, 'category'),
    tagId: param(params, 'tag'),
    projectId: param(params, 'project'),
    format: param(params, 'format') as SearchFilters['format'],
    verificationStatus: param(params, 'verification') as SearchFilters['verificationStatus'],
    status: param(params, 'status') as SearchFilters['status'],
    dateFrom: param(params, 'from'),
    dateTo: param(params, 'to'),
    page: Math.max(Number(param(params, 'page')) || 1, 1),
    pageSize: PAGE_SIZE,
  }
}

function Highlight({ value, query }: { value: string; query: string }) {
  return highlightText(value, query).map((part, index) =>
    part.highlighted ? (
      <mark key={`${part.text}-${index}`}>{part.text}</mark>
    ) : (
      <span key={`${part.text}-${index}`}>{part.text}</span>
    ),
  )
}

interface ResultTag {
  id: string
  name: string
  color: string | null
}

function readTags(value: Json): ResultTag[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((tag) => {
    if (!tag || Array.isArray(tag) || typeof tag !== 'object') return []
    const { id, name, color } = tag
    return typeof id === 'string' && typeof name === 'string'
      ? [{ id, name, color: typeof color === 'string' ? color : null }]
      : []
  })
}

function sourceLocation(result: SearchKnowledgeRow) {
  const locator = result.locator
  if (!locator || Array.isArray(locator) || typeof locator !== 'object') return ''
  const page = locator.page
  const lineStart = locator.line_start
  const paragraph = locator.paragraph
  if (typeof page === 'number') return `PDF ${page}쪽`
  if (typeof lineStart === 'number') return `${lineStart}행 부근`
  if (typeof paragraph === 'number') return `${paragraph}번째 문단`
  return ''
}

function SearchResultCard({ result, query }: { result: SearchKnowledgeRow; query: string }) {
  const tags = readTags(result.tags)
  const sourceTarget = result.document_id ?? result.item_id
  const sourceQuery = result.version_id ? `?version=${result.version_id}` : ''
  const sourceHash = result.section_id ? `#section-${result.section_id}` : ''
  const heading = result.heading_path.join(' › ')
  const location = sourceLocation(result)

  return (
    <article className="search-result-card content-card">
      <div className="search-result-main">
        <div className="search-result-badges">
          <span
            className="type-badge"
            style={{ '--badge-color': result.node_type_color } as React.CSSProperties}
          >
            {result.node_type_label}
          </span>
          <span className={`status-chip status-${result.status}`}>
            {itemStatusLabels[result.status]}
          </span>
          <span className="status-chip">{verificationLabels[result.verification_status]}</span>
          {result.match_reason && <span className="match-reason">{result.match_reason}</span>}
        </div>
        <Link className="search-result-title" to={`/knowledge/${result.item_id}`}>
          <Highlight value={result.title} query={query} />
        </Link>
        {result.summary && (
          <p className="search-result-summary">
            <Highlight value={result.summary} query={query} />
          </p>
        )}
        <blockquote>
          <Highlight value={result.snippet} query={query} />
        </blockquote>
        <div className="search-result-metadata">
          {result.category_name && <span>{result.category_name}</span>}
          {result.project_title && <span>Project · {result.project_title}</span>}
          {tags.map((tag) => (
            <span key={tag.id}>#{tag.name}</span>
          ))}
          {result.format && <span>{result.format.toUpperCase()}</span>}
          <span>{formatDate(result.updated_at)}</span>
        </div>
      </div>
      <aside className="search-source-panel">
        <p className="eyebrow">Best Source</p>
        <strong>{heading || '항목 정보'}</strong>
        {location && <span>{location}</span>}
        {result.section_id ? (
          <Link to={`/knowledge/${sourceTarget}${sourceQuery}${sourceHash}`}>원문 위치 열기</Link>
        ) : (
          <Link to={`/knowledge/${result.item_id}`}>항목 열기</Link>
        )}
      </aside>
    </article>
  )
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams])
  const queryInputRef = useRef<HTMLInputElement>(null)
  const [taxonomy, setTaxonomy] = useState<TaxonomySnapshot>(emptyTaxonomy)
  const [projects, setProjects] = useState<KnowledgeRecord[]>([])
  const [results, setResults] = useState<SearchKnowledgeRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([readTaxonomy(), listKnowledge({ projectOnly: true })])
      .then(([nextTaxonomy, nextProjects]) => {
        if (!active) return
        setTaxonomy(nextTaxonomy)
        setProjects(nextProjects)
      })
      .catch((caught: unknown) => {
        if (active) setError(friendlyDataError(caught))
      })
    return () => {
      active = false
    }
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await searchKnowledge(filters)
      setResults(response.results)
      setTotal(response.total)
    } catch (caught) {
      setError(friendlyDataError(caught))
      setResults([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const submitQuery = (event: React.FormEvent) => {
    event.preventDefault()
    updateParam('q', queryInputRef.current?.value.trim() ?? '')
  }

  const resetFilters = () => {
    setSearchParams({})
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const hasCriteria = [...searchParams.keys()].some((key) => key !== 'page')

  return (
    <section className="page-section search-page">
      <header className="page-heading search-heading">
        <div>
          <p className="eyebrow">Integrated Search</p>
          <h1>전체 지식 검색</h1>
          <p>Node의 메타데이터와 REF 원문 Section을 한 번에 검색합니다.</p>
        </div>
        {!isLoading && (
          <strong className="search-count">{total.toLocaleString('ko-KR')}개 결과</strong>
        )}
      </header>

      <form className="search-query-card content-card" onSubmit={submitQuery}>
        <label>
          <span className="sr-only">통합 검색어</span>
          <input
            ref={queryInputRef}
            key={filters.query}
            autoFocus
            type="search"
            defaultValue={filters.query}
            placeholder="서비스명, 기술, 문제 증상, 교실 운영 표현 검색"
          />
        </label>
        <button className="primary-button" type="submit">
          검색
        </button>
      </form>

      <div className="search-workspace">
        <aside className="search-filters content-card">
          <div className="search-filter-heading">
            <div>
              <p className="eyebrow">Filters</p>
              <h2>결과 좁히기</h2>
            </div>
            {hasCriteria && (
              <button className="text-action" type="button" onClick={resetFilters}>
                초기화
              </button>
            )}
          </div>
          <label>
            Node 유형
            <select
              value={filters.nodeTypeKey}
              onChange={(event) => updateParam('type', event.target.value)}
            >
              <option value="">전체 유형</option>
              {taxonomy.nodeTypes.map((type) => (
                <option key={type.id} value={type.key}>
                  {type.label_ko}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={filters.categoryId}
              onChange={(event) => updateParam('category', event.target.value)}
            >
              <option value="">전체 Category</option>
              {taxonomy.categories
                .filter((category) => !category.is_archived)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent_id ? '↳ ' : ''}
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tag
            <select
              value={filters.tagId}
              onChange={(event) => updateParam('tag', event.target.value)}
            >
              <option value="">전체 Tag</option>
              {taxonomy.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Project
            <select
              value={filters.projectId}
              onChange={(event) => updateParam('project', event.target.value)}
            >
              <option value="">전체 Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            원본 형식
            <select
              value={filters.format}
              onChange={(event) => updateParam('format', event.target.value)}
            >
              <option value="">전체 형식</option>
              {formats.map((format) => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            확인 상태
            <select
              value={filters.verificationStatus}
              onChange={(event) => updateParam('verification', event.target.value)}
            >
              <option value="">전체 확인 상태</option>
              {(Object.entries(verificationLabels) as [VerificationStatus, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            항목 상태
            <select
              value={filters.status}
              onChange={(event) => updateParam('status', event.target.value)}
            >
              <option value="">전체 항목 상태</option>
              {(Object.entries(itemStatusLabels) as [ItemStatus, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="date-filter-grid">
            <label>
              수정일 시작
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateParam('from', event.target.value)}
              />
            </label>
            <label>
              수정일 종료
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateParam('to', event.target.value)}
              />
            </label>
          </div>
        </aside>

        <div className="search-results" aria-live="polite">
          {isLoading ? (
            <LoadingState label="지식과 원문을 검색하는 중입니다" />
          ) : error ? (
            <ErrorState
              title="검색하지 못했습니다"
              description={error}
              actionLabel="다시 시도"
              onAction={() => void load()}
            />
          ) : results.length ? (
            <>
              {results.map((result) => (
                <SearchResultCard key={result.item_id} result={result} query={filters.query} />
              ))}
              {totalPages > 1 && (
                <nav className="search-pagination" aria-label="검색 결과 페이지">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={filters.page <= 1}
                    onClick={() => updateParam('page', String(filters.page - 1), false)}
                  >
                    이전
                  </button>
                  <span>
                    {filters.page} / {totalPages}
                  </span>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={filters.page >= totalPages}
                    onClick={() => updateParam('page', String(filters.page + 1), false)}
                  >
                    다음
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="content-card">
              <EmptyState
                title={
                  hasCriteria ? '조건에 맞는 지식이 없습니다' : '검색할 지식을 준비하고 있습니다'
                }
                description={
                  hasCriteria
                    ? '검색 표현이나 필터를 변경해 보세요.'
                    : 'REF 문서를 구조화하거나 직접 지식을 추가하면 이곳에서 찾을 수 있습니다.'
                }
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

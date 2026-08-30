import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { VisualRelationshipFoundation } from '@/entities/visual-analysis/api'

import { KnowledgeConstellation } from './KnowledgeConstellation'

const foundation: VisualRelationshipFoundation = {
  schema_version: 'visual-relations-v1',
  insights: [
    {
      id: 'insight-1',
      analysis_id: 'analysis-1',
      insight_kind: 'commonality',
      dimension: 'architecture',
      title: '교사 중심 운영 구조',
      summary: '두 서비스 모두 교사가 진행 상태를 통제하는 구조를 사용합니다.',
      confidence: 0.92,
      importance: 4,
      status: 'proposed',
      origin: 'ai_proposed',
      properties: {},
      promoted_relation_id: null,
      items: [
        {
          item_id: 'project-1',
          title: '레이저 장기',
          summary: null,
          node_type_key: 'project',
          node_type_label: '프로젝트',
          node_type_color: '#397dcc',
          item_role: 'subject',
          ordinal: 0,
          weight: null,
        },
        {
          item_id: 'project-2',
          title: '독점게임',
          summary: null,
          node_type_key: 'project',
          node_type_label: '프로젝트',
          node_type_color: '#397dcc',
          item_role: 'subject',
          ordinal: 1,
          weight: null,
        },
      ],
      evidence: [
        {
          id: 'evidence-1',
          item_id: 'project-1',
          document_id: 'document-1',
          version_id: 'version-1',
          section_id: 'section-1',
          heading_path: ['운영 구조'],
          evidence_text: '교사 화면이 게임 진행을 통제한다.',
        },
      ],
    },
  ],
  existing_relations: [],
  dimensions: [{ dimension: 'architecture', count: 1, accepted_count: 0 }],
}

describe('KnowledgeConstellation relationship map', () => {
  it('reveals a concise insight only after selecting a visual relationship', () => {
    render(
      <MemoryRouter>
        <KnowledgeConstellation
          records={[]}
          graph={null}
          focusText=""
          activeSourceIds={new Set()}
          visualFoundation={foundation}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText('선택한 관계 요약')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /교사 중심 운영 구조/ }))
    expect(screen.getByLabelText('선택한 관계 요약')).toHaveTextContent(
      '두 서비스 모두 교사가 진행 상태를 통제하는 구조를 사용합니다.',
    )
    expect(screen.getByText('근거 1개')).toBeInTheDocument()
  })
})

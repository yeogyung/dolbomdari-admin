// 이력서 PDF 렌더러 테스트 — 바이트 출력·페이지 분할·빈 이력서
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { renderResumePdf } from '../server/utils/resume-pdf'
import type { Resume } from '../shared/resume-form'

const font = new Uint8Array(readFileSync('server/assets/fonts/NanumGothic.ttf'))

function makeResume(over: Partial<Resume> = {}): Resume {
  return {
    id: 'r1',
    user_id: 'u1',
    status: 'completed',
    name: '홍길동',
    birth_date: '1960-07-05',
    phone: '01012345678',
    base_address: '서울시 강남구',
    detail_address: '101동 202호',
    careers: [{ company: '가나요양원', start_ym: '2020-01', end_ym: null, duty: '방문요양' }],
    qualifications: [{ name: '요양보호사', acquired_ym: '2019-11', issuer: '보건복지부' }],
    trainings: [{ name: '치매교육', completed_ym: '2021-05', institution: '중앙치매센터' }],
    educations: [
      { school: '가나고', major: '인문', start_ym: '1976-03', end_ym: '1979-02', status: '졸업' },
    ],
    signature: { name: '홍길동', signed_at: '2026-09-01T00:00:00Z' },
    updated_at: '2026-09-01T00:00:00Z',
    ...over,
  }
}

describe('renderResumePdf', () => {
  it('PDF 바이트를 낸다', async () => {
    const bytes = await renderResumePdf(makeResume(), font)
    expect(bytes.length).toBeGreaterThan(1000)
    // PDF 매직넘버 %PDF
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
  })

  it('항목이 적으면 한 장이다', async () => {
    const bytes = await renderResumePdf(makeResume(), font)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('경력이 많으면 장이 늘어난다', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      company: `회사${i}`,
      start_ym: '2020-01',
      end_ym: '2021-01',
      duty: '업무',
    }))
    const bytes = await renderResumePdf(makeResume({ careers: many }), font)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })

  it('이력서가 비어 있어도 터지지 않는다', async () => {
    const empty = makeResume({
      careers: [],
      qualifications: [],
      trainings: [],
      educations: [],
      signature: null,
      birth_date: null,
    })
    const bytes = await renderResumePdf(empty, font)
    expect(bytes.length).toBeGreaterThan(1000)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  // 양식 대조용 덤프 — test-output/ 는 .gitignore 에 넣는다
  it('대조용 샘플을 test-output/ 에 남긴다', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      company: `가나요양원 ${i + 1}호점`,
      start_ym: '2020-01',
      end_ym: i === 0 ? null : '2021-12',
      duty: '방문요양 · 가사지원',
    }))
    const bytes = await renderResumePdf(makeResume({ careers: many }), font)
    mkdirSync('test-output', { recursive: true })
    writeFileSync('test-output/resume-sample.pdf', bytes)
    expect(bytes.length).toBeGreaterThan(1000)
  })
})

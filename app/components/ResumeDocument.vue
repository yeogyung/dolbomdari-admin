<!-- 이력서 서류 양식(읽기 전용) — hwp 원본과 같은 칸 구성 -->
<!--
  ⚠ 이 양식은 세 곳에 복제돼 있다. 하나를 고치면 셋을 모두 고쳐야 한다.
    · dolbomdari-admin/app/components/ResumeDocument.vue   (이 파일)
    · dolbomdari-link/app/components/ResumeDocument.vue    (복제)
    · dolbomdari-admin/server/utils/resume-pdf.ts          (PDF 렌더러)
-->
<script setup lang="ts">
import {
  addressText,
  birthText,
  RESUME_FORM,
  sectionRows,
  type Resume,
} from '#shared/resume-form'

const props = defineProps<{ resume: Resume }>()

// 양식은 기본 행 수를 갖되 항목이 넘치면 행을 늘린다 (설계 D9)
function rowsFor(key: (typeof RESUME_FORM)[number]['key'], minRows: number) {
  const rows = sectionRows(props.resume, key)
  const pad = Math.max(0, minRows - rows.length)
  return [...rows, ...Array.from({ length: pad }, () => ['', '', ''] as [string, string, string])]
}

const signedDate = computed(() => {
  const raw = props.resume.signature?.signed_at
  if (!raw) return { y: '', m: '', d: '' }
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return { y: '', m: '', d: '' }
  return { y: String(dt.getFullYear()), m: String(dt.getMonth() + 1), d: String(dt.getDate()) }
})
</script>

<template>
  <div class="resume-doc">
    <table class="doc">
      <colgroup>
        <col style="width: 9.3%" />
        <col style="width: 10.9%" />
        <col style="width: 30.9%" />
        <col style="width: 12.6%" />
        <col style="width: 11.5%" />
        <col style="width: 24.8%" />
      </colgroup>
      <tbody>
        <!-- 사진칸 ＋ 제목 -->
        <tr>
          <td rowspan="4" colspan="2" class="photo">사진</td>
          <td colspan="4" class="title">이 력 서</td>
        </tr>
        <tr>
          <th>성명</th>
          <td>{{ resume.name }}</td>
          <th>생년월일</th>
          <td>{{ birthText(resume.birth_date) }}</td>
        </tr>
        <tr>
          <th>휴대폰</th>
          <td colspan="3">{{ resume.phone }}</td>
        </tr>
        <tr>
          <th>주소</th>
          <td colspan="3">{{ addressText(resume.base_address, resume.detail_address) }}</td>
        </tr>

        <!-- 섹션 넷 -->
        <template v-for="s in RESUME_FORM" :key="s.key">
          <tr>
            <th :rowspan="rowsFor(s.key, s.minRows).length + 1" class="side">
              {{ s.label }}
            </th>
            <th colspan="2">{{ s.columns[0] }}</th>
            <th colspan="2">{{ s.columns[1] }}</th>
            <th>{{ s.columns[2] }}</th>
          </tr>
          <tr v-for="(row, i) in rowsFor(s.key, s.minRows)" :key="`${s.key}-${i}`">
            <td colspan="2">{{ row[0] }}</td>
            <td colspan="2">{{ row[1] }}</td>
            <td>{{ row[2] }}</td>
          </tr>
        </template>

        <!-- 서명 -->
        <tr>
          <td colspan="6" class="sign">
            <p>위에 기재한 사항은 사실과 틀림이 없습니다.</p>
            <p>{{ signedDate.y }}년 {{ signedDate.m }}월 {{ signedDate.d }}일</p>
            <p class="name">성명 : {{ resume.signature?.name ?? '' }} (서명)</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.resume-doc {
  overflow-x: auto;
}
.doc {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13px;
  color: #111;
  background: #fff;
}
.doc th,
.doc td {
  border: 1px solid #333;
  padding: 6px 8px;
  height: 30px;
  vertical-align: middle;
}
.doc th {
  background: #d9d9d9;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
}
.title {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 12px;
  height: 52px;
}
.photo {
  text-align: center;
  color: #aaa;
  background: #fff;
}
.side {
  width: 9.3%;
}
.sign {
  text-align: center;
  line-height: 1.9;
  padding: 14px 8px;
}
.sign .name {
  text-align: right;
  padding-right: 40px;
}
</style>

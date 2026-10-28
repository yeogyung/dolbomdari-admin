<!-- 이력서 서류 양식(읽기 전용) — hwp 원본과 같은 칸 구성을 A4 장으로 나눠 워터마크와 함께 보이고, 장을 PDF·PNG 로 저장한다 -->
<!--
  ⚠ 이 양식은 두 곳에 복제돼 있다. 하나를 고치면 둘을 모두 고쳐야 한다.
    · dolbomdari-admin/app/components/ResumeDocument.vue   (이 파일)
    · dolbomdari-link/app/components/ResumeDocument.vue    (복제)
  장 나누기(app/utils/resumePages.ts)·저장(app/utils/resumeExport.ts)도 같이 복제돼 있다.
-->
<script setup lang="ts">
import { addressText, birthText, type Resume } from '#shared/resume-form'
import { downloadResumePdf, downloadResumePng } from '~/utils/resumeExport'
import { docRows, PAGE_H, PAGE_PAD_X, PAGE_PAD_Y, PAGE_W, paginate } from '~/utils/resumePages'

const props = defineProps<{ resume: Resume }>()

/** 화면에서 장 사이 틈 */
const SHEET_GAP = 24

const root = ref<HTMLElement>()
/** 좁은 화면에서는 장을 통째로 줄여 보인다 — 장 안의 배치는 그대로라 저장 결과와 같다 */
const scale = ref(1)
const rows = computed(() => docRows(props.resume))
const heights = ref<number[]>([])

const pages = computed(() => {
  // 아직 재지 않았거나 이력서가 바뀌어 줄 수가 다르면 한 장에 다 담아 둔다
  const known = heights.value.length === rows.value.length
  return paginate(rows.value, known ? heights.value : rows.value.map(() => 0))
})
// 0번은 줄 높이를 재는 숨은 표(장을 나누지 않은 한 장), 1번부터 실제 장이다
const sheets = computed(() => [paginate(rows.value, rows.value.map(() => 0))[0]!, ...pages.value])
const stackHeight = computed(() => pages.value.length * PAGE_H + (pages.value.length - 1) * SHEET_GAP)

const signedDate = computed(() => {
  const raw = props.resume.signature?.signed_at
  if (!raw) return { y: '', m: '', d: '' }
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return { y: '', m: '', d: '' }
  return { y: String(dt.getFullYear()), m: String(dt.getMonth() + 1), d: String(dt.getDate()) }
})

async function measure() {
  await nextTick()
  await document.fonts?.ready
  const table = root.value?.querySelector<HTMLTableElement>('.measure table')
  if (!table?.offsetWidth) return
  // 장 묶음이 transform 으로 줄어 있다. 실제로 걸린 배율을 표 폭에서 읽어 화면 높이를 되돌린다
  // (scale 값은 DOM 반영보다 먼저 바뀔 수 있어 쓰지 않는다)
  const ratio = table.getBoundingClientRect().width / table.offsetWidth
  heights.value = [...table.tBodies[0]!.rows].map((tr) => tr.getBoundingClientRect().height / ratio)
}

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width ?? 0
    if (width > 0) scale.value = Math.min(1, width / PAGE_W)
  })
  if (root.value) observer.observe(root.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())
watch(rows, measure)

async function sheetElements() {
  await measure()
  await nextTick()
  return [...(root.value?.querySelectorAll<HTMLElement>('.sheet:not(.measure)') ?? [])]
}

const fileBase = computed(() => `이력서_${props.resume.name || '무명'}`)

defineExpose({
  savePdf: async () => downloadResumePdf(await sheetElements(), `${fileBase.value}.pdf`),
  savePng: async () => downloadResumePng(await sheetElements(), `${fileBase.value}.png`),
})
</script>

<template>
  <div ref="root" class="resume-doc">
    <div class="frame" :style="{ width: `${PAGE_W * scale}px`, height: `${stackHeight * scale}px` }">
      <div
        class="stack"
        :style="{ width: `${PAGE_W}px`, gap: `${SHEET_GAP}px`, transform: `scale(${scale})` }"
      >
        <div
          v-for="(sheetRows, s) in sheets"
          :key="s"
          class="sheet"
          :class="{ measure: s === 0 }"
          :aria-hidden="s === 0 || undefined"
          :style="{ width: `${PAGE_W}px`, height: s === 0 ? 'auto' : `${PAGE_H}px`, padding: `${PAGE_PAD_Y}px ${PAGE_PAD_X}px` }"
        >
          <table class="doc">
            <colgroup>
              <col style="width: 9.26%" />
              <col style="width: 11.57%" />
              <col style="width: 10.8%" />
              <col style="width: 30.86%" />
              <col style="width: 12.65%" />
              <col style="width: 24.85%" />
            </colgroup>
            <tbody>
              <tr v-for="(row, r) in sheetRows" :key="r">
                <!-- 사진칸 ＋ 제목, 인적사항 -->
                <template v-if="row.kind === 'head'">
                  <template v-if="row.part === 0">
                    <td rowspan="4" colspan="2" class="photo">사진</td>
                    <td colspan="4" class="title">이 력 서</td>
                  </template>
                  <template v-else-if="row.part === 1">
                    <th>성명</th>
                    <td>{{ resume.name }}</td>
                    <th>생년월일</th>
                    <td>{{ birthText(resume.birth_date) }}</td>
                  </template>
                  <template v-else-if="row.part === 2">
                    <th>휴대폰</th>
                    <td colspan="3">{{ resume.phone }}</td>
                  </template>
                  <template v-else>
                    <th>주소</th>
                    <td colspan="3">{{ addressText(resume.base_address, resume.detail_address) }}</td>
                  </template>
                </template>

                <!-- 섹션 넷 — 앞 장에서 이어지는 섹션은 라벨 칸이 빈 회색 칸이다 -->
                <template v-else-if="row.kind === 'columns' || row.kind === 'item'">
                  <th v-if="row.side" :rowspan="row.side.span" class="side">{{ row.side.label }}</th>
                  <template v-if="row.kind === 'columns'">
                    <th colspan="2">{{ row.section.columns[0] }}</th>
                    <th colspan="2">{{ row.section.columns[1] }}</th>
                    <th>{{ row.section.columns[2] }}</th>
                  </template>
                  <template v-else>
                    <td colspan="2">{{ row.cells[0] }}</td>
                    <td colspan="2">{{ row.cells[1] }}</td>
                    <td>{{ row.cells[2] }}</td>
                  </template>
                </template>

                <!-- 서명 -->
                <td v-else colspan="6" class="sign">
                  <p>위에 기재한 사항은 사실과 틀림이 없습니다.</p>
                  <p>{{ signedDate.y }}년 {{ signedDate.m }}월 {{ signedDate.d }}일</p>
                  <p class="name">성명 : {{ resume.signature?.name ?? '' }} (서명)</p>
                </td>
              </tr>
            </tbody>
          </table>

          <template v-if="s > 0">
            <!-- 돌봄다리 마크 워터마크 — 표 위에 옅게 얹어 회색 머리칸에도 가려지지 않는다 -->
            <svg class="wm" viewBox="105 175 324 324" aria-hidden="true">
              <rect x="113" y="302" width="68" height="161" fill="#81b7ff" />
              <rect x="353" y="302" width="68" height="161" fill="#81b7ff" />
              <path d="M113 302A154 154 0 0 0 421 302H353A86 86 0 0 1 181 302Z" fill="#0370ff" />
              <circle cx="147" cy="245" r="34" fill="#0370ff" />
              <circle cx="387" cy="245" r="34" fill="#0370ff" />
            </svg>
            <span v-if="pages.length > 1" class="pno">{{ s }} / {{ pages.length }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resume-doc {
  box-sizing: border-box;
  width: 100%;
  padding: 16px;
  border-radius: 8px;
  background: #e9ecf1;
}
.frame {
  position: relative;
  margin: 0 auto;
}
.stack {
  position: relative;
  display: flex;
  flex-direction: column;
  transform-origin: top left;
}
.sheet {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 18%);
}
.sheet.measure {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
}
.wm {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18%;
  opacity: 0.12;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.pno {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  color: #888;
}
/* 저장 그림과 글자 폭이 같도록 시스템 글꼴만 쓴다 (resumeExport.ts 의 skipFonts) */
.doc {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  font-size: 13px;
  color: #111;
}
.doc th,
.doc td {
  border: 1px solid #333;
  padding: 6px 8px;
  height: 30px;
  vertical-align: middle;
  overflow-wrap: anywhere;
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
}
/* 칸 폭이 고정이라 「경력 사항」이 넘치면 두 줄로 접는다 */
.doc th.side {
  padding: 6px 4px;
  white-space: normal;
  word-break: keep-all;
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

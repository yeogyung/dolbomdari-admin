<!-- 테이블 레지스트리 기반 생성/수정 폼 — 필드 타입별 입력 렌더링 및 배열 변환 -->
<script setup lang="ts">
import type { TableDef, FormField } from '#shared/tables'

const props = defineProps<{
  def: TableDef
  initial: Record<string, any>
  mode: 'create' | 'edit'
  submitting?: boolean
}>()

const emit = defineEmits<{ submit: [payload: Record<string, any>]; cancel: [] }>()

// 폼에 노출할 필드 (생성 시 createOnly 포함, 수정 시 제외)
const visibleFields = computed(() =>
  props.def.fields.filter((f) => (props.mode === 'create' ? !f.readonly : !f.readonly && !f.createOnly)),
)

// 읽기전용(참고용) 필드 — 수정 시 표시만
const readonlyFields = computed(() =>
  props.mode === 'edit' ? props.def.fields.filter((f) => f.readonly) : [],
)

function initValue(field: FormField): any {
  const raw = props.initial?.[field.name]
  if (field.type === 'array') return Array.isArray(raw) ? raw.join(', ') : (raw ?? '')
  if (field.type === 'boolean') return Boolean(raw)
  return raw ?? ''
}

const form = reactive<Record<string, any>>({})
watchEffect(() => {
  for (const field of props.def.fields) {
    form[field.name] = initValue(field)
  }
})

function buildPayload(): Record<string, any> {
  const payload: Record<string, any> = {}
  for (const field of visibleFields.value) {
    const value = form[field.name]
    if (field.type === 'array') {
      payload[field.name] = String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (field.type === 'number') {
      payload[field.name] = value === '' || value === null ? null : Number(value)
    } else {
      payload[field.name] = value
    }
  }
  return payload
}

function displayReadonly(field: FormField): string {
  const raw = props.initial?.[field.name]
  if (raw === null || raw === undefined) return '—'
  if (Array.isArray(raw)) return raw.join(', ')
  return String(raw)
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="emit('submit', buildPayload())">
    <div class="grid gap-5 md:grid-cols-2">
      <FormField
        v-for="field in visibleFields"
        :key="field.name"
        :label="field.label"
        :hint="field.type === 'array' ? '쉼표(,)로 구분해 여러 값을 입력하세요.' : undefined"
        :class="field.type === 'textarea' ? 'md:col-span-2' : ''"
      >
        <Toggle v-if="field.type === 'boolean'" v-model="form[field.name]" />

        <SelectField
          v-else-if="field.type === 'select'"
          v-model="form[field.name]"
          :options="field.options || []"
        />

        <AppTextarea v-else-if="field.type === 'textarea'" v-model="form[field.name]" :rows="4" />

        <TextField v-else-if="field.type === 'number'" v-model="form[field.name]" type="number" />

        <DateField v-else-if="field.type === 'date'" v-model="form[field.name]" />

        <TextField v-else v-model="form[field.name]" />
      </FormField>
    </div>

    <!-- 읽기전용 참고 필드 — 고칠 수 없는 값이라 입력칸과 섞지 않고 따로 묶는다 -->
    <div v-if="readonlyFields.length" class="rounded-2xl bg-surface-soft px-5 py-4">
      <p class="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-soft uppercase">참고</p>
      <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div v-for="field in readonlyFields" :key="field.name" class="flex gap-3">
          <dt class="w-28 shrink-0 text-muted">{{ field.label }}</dt>
          <dd class="min-w-0 break-words text-body">{{ displayReadonly(field) }}</dd>
        </div>
      </dl>
    </div>

    <div class="flex justify-end gap-2 border-t border-hairline-soft pt-5">
      <AppButton type="button" variant="outline" color="neutral" @click="emit('cancel')">
        취소
      </AppButton>
      <AppButton type="submit" :loading="submitting">
        {{ mode === 'create' ? '생성' : '저장' }}
      </AppButton>
    </div>
  </form>
</template>

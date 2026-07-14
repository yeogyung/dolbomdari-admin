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
  <form class="space-y-4" @submit.prevent="emit('submit', buildPayload())">
    <UFormField
      v-for="field in visibleFields"
      :key="field.name"
      :label="field.label"
      :name="field.name"
    >
      <USwitch v-if="field.type === 'boolean'" v-model="form[field.name]" />

      <USelect
        v-else-if="field.type === 'select'"
        v-model="form[field.name]"
        :items="field.options || []"
        class="w-full"
      />

      <UTextarea
        v-else-if="field.type === 'textarea'"
        v-model="form[field.name]"
        :rows="4"
        class="w-full"
      />

      <UInput
        v-else-if="field.type === 'number'"
        v-model="form[field.name]"
        type="number"
        class="w-full"
      />

      <UInput
        v-else-if="field.type === 'date'"
        v-model="form[field.name]"
        type="date"
        class="w-full"
      />

      <template v-else>
        <UInput v-model="form[field.name]" class="w-full" />
        <p v-if="field.type === 'array'" class="mt-1 text-xs text-gray-500">
          쉼표(,)로 구분해 여러 값을 입력하세요.
        </p>
      </template>
    </UFormField>

    <!-- 읽기전용 참고 필드 -->
    <div v-if="readonlyFields.length" class="rounded-md bg-gray-50 p-3 text-sm">
      <div v-for="field in readonlyFields" :key="field.name" class="flex gap-2 py-0.5">
        <span class="w-28 shrink-0 text-gray-500">{{ field.label }}</span>
        <span class="text-gray-700">{{ displayReadonly(field) }}</span>
      </div>
    </div>

    <div class="flex gap-2 pt-2">
      <UButton type="submit" :loading="submitting" color="primary">
        {{ mode === 'create' ? '생성' : '저장' }}
      </UButton>
      <UButton type="button" variant="ghost" color="neutral" @click="emit('cancel')">취소</UButton>
    </div>
  </form>
</template>

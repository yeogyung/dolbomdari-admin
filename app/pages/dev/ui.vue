<!-- 개발용: 공용 컴포넌트(원자) 미리보기 갤러리 -->
<script setup lang="ts">
const text = ref('입력값')
const sel = ref<string | null>(null)
const toggle = ref(true)
const check = ref(false)
const date = ref('')
const q = ref('')
</script>

<template>
  <div class="space-y-8">
    <PageTitle title="컴포넌트 미리보기" subtitle="아토믹 원자 갤러리 (/dev/ui)">
      <template #actions>
        <AppButton variant="outline" color="neutral">보조</AppButton>
        <AppButton icon="i-heroicons-plus">기본</AppButton>
      </template>
    </PageTitle>

    <AppCard>
      <template #header><span class="font-semibold">버튼</span></template>
      <div class="flex flex-wrap gap-2">
        <AppButton>기본</AppButton>
        <AppButton variant="soft">Soft</AppButton>
        <AppButton variant="outline" color="neutral">보조</AppButton>
        <AppButton variant="ghost">Ghost</AppButton>
        <AppButton color="up" variant="soft">상승</AppButton>
        <AppButton color="down" variant="soft">하락</AppButton>
        <AppButton loading>로딩</AppButton>
        <IconButton icon="i-lucide-pencil" label="수정" />
        <IconButton icon="i-lucide-trash-2" tone="danger" label="삭제" />
      </div>
    </AppCard>

    <AppCard>
      <template #header><span class="font-semibold">배지 · 태그</span></template>
      <div class="flex flex-wrap items-center gap-2">
        <StatusBadge tone="green">재직</StatusBadge>
        <StatusBadge tone="red">미출근</StatusBadge>
        <StatusBadge tone="amber">지연</StatusBadge>
        <StatusBadge tone="blue">연결됨</StatusBadge>
        <StatusBadge tone="gray">미연결</StatusBadge>
        <Tag>태그</Tag>
        <Avatar name="김운영" />
      </div>
    </AppCard>

    <AppCard>
      <template #header><span class="font-semibold">폼 요소</span></template>
      <div class="grid max-w-md gap-4">
        <FormField label="이름" required hint="실명을 입력하세요.">
          <TextField v-model="text" placeholder="이름" />
        </FormField>
        <FormField label="상태">
          <SelectField v-model="sel" :options="['재직', '휴직', '종료']" />
        </FormField>
        <FormField label="계약 시작일">
          <DateField v-model="date" />
        </FormField>
        <FormField label="메모">
          <AppTextarea placeholder="메모" />
        </FormField>
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2"><span class="text-sm text-slate-600">알림</span><Toggle v-model="toggle" /></div>
          <Checkbox v-model="check" label="동의합니다" />
        </div>
        <SearchInput v-model="q" placeholder="검색" />
      </div>
    </AppCard>

    <AppCard>
      <template #header><span class="font-semibold">빈 상태 · 로딩</span></template>
      <div class="grid gap-4 sm:grid-cols-2">
        <EmptyState description="아직 등록된 항목이 없습니다." />
        <AppSpinner label="불러오는 중…" />
      </div>
    </AppCard>
  </div>
</template>

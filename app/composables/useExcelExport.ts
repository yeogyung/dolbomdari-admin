// 엑셀 내보내기 진행 상태 — 레이아웃의 화면 전체 오버레이(ExcelExportOverlay)가 이 값을 보고 뜬다
export function useExcelExport() {
  const exporting = useState<boolean>('excel-exporting', () => false)

  /**
   * 오버레이를 켜고 실제로 그려질 때까지 기다린다.
   * 파일 생성(XLSX.writeFile)은 동기라 바로 이어 부르면 오버레이가 그려지기 전에 화면이 멈춘다.
   */
  async function startExport() {
    exporting.value = true
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
  }

  function finishExport() {
    exporting.value = false
  }

  return { exporting, startExport, finishExport }
}

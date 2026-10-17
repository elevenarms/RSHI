/**
 * Compact model names for the screen: `nvidia/Nemotron-3-Super-120B-A12B-FP8` → `Nemotron 3 Super 120B`.
 * Drops the organisation, the active-parameter tag (`A12B`), precision and packaging suffixes.
 */
export function modelName(id: string | undefined | null): string {
  if (!id) return '';
  let s = id.split('/').pop() ?? id;
  s = s.replace(/^NVIDIA-/i, '');
  s = s.replace(/[-_](A\d+(\.\d+)?B|FP8|FP4|NVFP4|BF16|Instruct|Chat|\d{4})(?=$|[-_])/gi, '');
  s = s.replace(/[-_](A\d+(\.\d+)?B|FP8|FP4|NVFP4|BF16|Instruct|Chat)(?=$|[-_])/gi, '');
  return s.replace(/[-_]+/g, ' ').trim();
}

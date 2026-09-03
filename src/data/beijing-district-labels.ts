/**
 * Approximate district label anchors for the regional residence map.
 * These points are only used to keep district names readable at the fixed
 * regional zoom; they are not residence coordinates.
 */
export const beijingDistrictLabels = [
  { name: '延庆区', longitude: 115.97, latitude: 40.45 },
  { name: '怀柔区', longitude: 116.63, latitude: 40.32 },
  { name: '密云区', longitude: 116.84, latitude: 40.38 },
  { name: '昌平区', longitude: 116.23, latitude: 40.22 },
  { name: '平谷区', longitude: 117.12, latitude: 40.14 },
  { name: '顺义区', longitude: 116.65, latitude: 40.13 },
  { name: '门头沟区', longitude: 115.80, latitude: 39.94 },
  { name: '通州区', longitude: 116.66, latitude: 39.91 },
  { name: '海淀区', longitude: 116.30, latitude: 39.96 },
  { name: '朝阳区', longitude: 116.48, latitude: 39.95 },
  { name: '石景山区', longitude: 116.22, latitude: 39.91 },
  { name: '西城区', longitude: 116.37, latitude: 39.91 },
  { name: '东城区', longitude: 116.42, latitude: 39.93 },
  { name: '丰台区', longitude: 116.29, latitude: 39.86 },
  { name: '房山区', longitude: 115.98, latitude: 39.75 },
  { name: '大兴区', longitude: 116.34, latitude: 39.73 },
] as const

export type BeijingDistrictLabel = (typeof beijingDistrictLabels)[number]

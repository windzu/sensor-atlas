export const cameraMeta = [
  { id: 'geometry', kind: '基础成像', subtitle: '覆盖范围与像素几何，一起验证', control: '畸变程度示意', visual: '直线网格 → 边缘弯曲', focus: '检查中央与边缘', insight: '原始投影、去畸变输出与有效视场分别留证。' },
  { id: 'detail', kind: '基础成像', subtitle: '像素数之外，看目标还剩什么细节', control: '细节损失示意', visual: '细节减少 → 轮廓与纹理退化', focus: '用原尺寸 ROI 复核', insight: '明确要分辨的细节，再记录距离、位置和像素尺寸。' },
  { id: 'lowlight', kind: '基础成像', subtitle: '亮度、噪声、纹理和运动分别观察', control: '低照度影响示意', visual: '光线减少 → 暗部与噪声变化', focus: '画面亮度不是结论', insight: '固定曝光用于隔离变量，实际 AE 模式用于检查部署表现。' },
  { id: 'hdr', kind: '动态成像', subtitle: '亮区、暗区与切换过程都要保留', control: '亮暗反差示意', visual: '反差增加 → 高光与暗部细节丢失', focus: '保留切换连续帧', insight: '静止 HDR 效果、运动伪影和 AE／AWB 恢复分别记录。' },
  { id: 'flicker', kind: '动态成像', subtitle: '灯仍在发光，图像却可能漏掉它', control: '闪烁影响示意', visual: '曝光与发光错位 → 灯面波动 / 条带', focus: '核对独立点亮参考', insight: '更改曝光或采样相位复测，一种灯具的结果不能外推到所有 LED。' },
  { id: 'motion', kind: '动态成像', subtitle: '沿运动方向，检查真实细节损失', control: '曝光模糊示意', visual: '曝光内位置变化 → 运动方向模糊', focus: '对照静止与短曝光', insight: '曝光积分模糊、跨帧 ISP 残影与行间倾斜是不同现象。' },
  { id: 'shutter', kind: '动态成像', subtitle: '同一帧，不同行可能对应不同时间', control: '行间位移示意', visual: '逐行曝光 + 横向运动 → 直线倾斜', focus: '双向运动复核', insight: '短曝光可以减轻模糊，行间几何畸变仍取决于读出时序与运动。' },
  { id: 'timing', kind: '工程接入', subtitle: '曝光、接收与录入，是三个事件', control: '时序异常示意', visual: '对齐曝光参考 → 区分不同步与缺帧', focus: '统一时间基准', insight: 'PTP 锁定不等于曝光同步；未配对帧也必须进入统计。' },
  { id: 'weather', kind: '环境影响', subtitle: '空气散射与窗口水滴分开采集', control: '空气雨雾示意', visual: '空气散射 → 远处对比度下降', focus: '保持保护窗状态可知', insight: '自然天气差异需要如实保留，局部喷雾不能换算气象能见度。' },
  { id: 'contamination', kind: '环境影响', subtitle: '清洁、污染、加重，再看恢复', control: '光路脏污示意', visual: '离焦污物 → 局部模糊与散射', focus: '验证清洁后恢复', insight: '图像退化、诊断告警与清洁恢复是三份独立证据。' }
].map((item) => ({ ...item, min: 0, max: 100, step: 10, value: 60, unit: 'level', baseline: '无影响示意参考' }));

const ids = new Set(cameraMeta.map(({ id }) => id));
export function cameraCondition(kind, value, time = 0) {
  if (!ids.has(kind)) throw new Error('Unknown camera scene: ' + kind);
  const amount = Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0)) / 100;
  return {
    amount,
    distortion: kind === 'geometry' ? amount * .24 : 0,
    resolution: kind === 'detail' ? Math.round(480 / (1 + amount * 12)) : 480,
    darkness: kind === 'lowlight' ? amount * .65 : 0,
    noise: kind === 'lowlight' ? amount : 0,
    clipping: kind === 'hdr' ? amount : 0,
    led: kind === 'flicker' ? 1 - amount * (.5 + .5 * Math.sin(time * 3)) : 1,
    smear: kind === 'motion' ? amount * 36 * Math.abs(Math.cos(time * .7)) : 0,
    rowShift: kind === 'shutter' ? amount * 65 * Math.cos(time * .7) : 0,
    offset: kind === 'timing' ? amount * 34 : 0,
    missing: kind === 'timing' && amount >= .5,
    haze: kind === 'weather' ? amount * .8 : 0,
    dirt: kind === 'contamination' ? amount : 0
  };
}

// A kinematic illustration: line-to-line timing and exposure duration are separate.
export const rowDisplacement = (row, rows, totalShift) => rows <= 1 ? 0 : totalShift * (row / (rows - 1) - .5);

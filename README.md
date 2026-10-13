# Sensor Atlas

**自驾与机器人传感器指南**

介绍自主系统中常见传感器的基本原理、应用场景和现场评测方法，通过原理动画帮助理解，通过录包与回放保留评测证据。

- [展示网站](https://windzu.github.io/sensor-atlas/)
- [LiDAR 硬件评测专题](https://windzu.github.io/sensor-atlas/lidar.html)
- [LiDAR 硬件评测标准正文](content/lidar/hardware-evaluation.md)

## 首个专题：LiDAR 硬件评测

包含已确认的八项简化测试：

1. 有效检测距离：人、车、骑行者、锥桶的正面目标，按 5m 档位记录。
2. 测距精度：墙面与墙角，按 10m 查看点云厚度及距离变化。
3. 强反鬼影。
4. 拖尾。
5. 玻璃。
6. 潮湿地面与积水。
7. 雾与喷雾。
8. 雷达窗口脏污。

每项包含基本原理、常见目标／场景、录包回放步骤和报告内容。页面动画支持暂停、调整场景条件；动画是定性原理示意，不代表某一型号的实测结果或性能承诺。

## 内容维护

专题正文维护在 `content/lidar/hardware-evaluation.md`。构建脚本从正文生成页面内容，保证展示页与标准正文一致。

- `content/`：专题 Markdown 正文。
- `web/`：页面模板、样式及原理动画。
- `scripts/`：无第三方依赖的构建与预览脚本。
- `docs/`：生成后的 GitHub Pages 静态页面。

修改正文或页面源码后运行 `npm run build`，提交源码与生成的 `docs/`。GitHub Pages 从 `main` 分支的 `/docs` 发布。用 `npm run check` 检查脚本语法和生成文件一致性，`npm run preview` 启动本地预览。

## 案例与贡献

欢迎通过 Issue 或 Pull Request 补充传感器专题、原理说明、现场测试案例及纠错。提交实测案例时附测试条件、现场照片、点云截图或短片段，并明确区分原理示意与实测结果。

页面当前提供原理动画和测试方法，尚未包含自行采集的实测案例。引用资料的链接保留在专题正文和展示页面中。

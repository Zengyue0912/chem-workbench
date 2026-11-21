# 题目截图识字资源

以下文件随站点托管，仅当学生附加题目图片时加载。图片在浏览器的 Worker 中识别，不发给服务器。

- [tesseract.js 6.0.1](https://www.npmjs.com/package/tesseract.js/v/6.0.1)：`dist/tesseract.min.js` 和 `dist/worker.min.js`。
- [tesseract.js-core 6.0.0](https://www.npmjs.com/package/tesseract.js-core/v/6.0.0)：`core/` 含 LSTM 的普通和 SIMD 两种浏览器构建，对应识字组件的默认 LSTM 模式。
- [简体中文语言数据 1.0.0](https://www.npmjs.com/package/@tesseract.js-data/chi_sim/v/1.0.0) 与 [英文语言数据 1.0.0](https://www.npmjs.com/package/@tesseract.js-data/eng/v/1.0.0)：各取 `4.0.0_best_int` 中的 `.traineddata.gz`。

许可证和发行版附带的版权说明见同目录文件。

# 高中化学练习 · 教学 SOP

> 版本 2.1 ｜ schema `chem-practice/2` ｜ 内置 60 题 · 317 分
> 单选 26 / 多选 9 / 填空 16 / 实验 9
> 本文档既是教学流程说明书，也是可直接导入的题包载体（见文末唯一的数据块）。

---

## 一、这份文档怎么用

按三段读：

1. **怎么教** —— 第二、三、四节：课前选题、课中三种用法、课后订正。
2. **怎么判** —— 第五节：四种题型的判分口径与容差。
3. **怎么加题** —— 第六、七节：导入方式与编写规范、自查清单。

内容为原创同步练习，按人教版高中常见知识范围组织，**不是《五年高考三年模拟》原题**；教师可用获得使用权的题目替换。

---

## 二、课前：选题与组卷

左侧「同步练习」支持两种筛选叠加：**章节**（物质与反应 / 元素及其化合物 / 结构与有机 / 反应原理 / 定量分析 / 实验探究）与**题型**，另有题干与知识点关键词搜索。

三种常见配比（可按班级水平调整）：

| 场景 | 建议组卷 | 用时 | 说明 |
|---|---|---|---|
| 随堂测 | 8 道单选 + 2 道填空 | 10 分钟 | 只覆盖当堂一个知识点，难度取"巩固" |
| 单元测 | 6 单选 + 3 多选 + 4 填空 + 1 实验 | 40 分钟 | 章节 + 综合各半，实验题留 10 分钟 |
| 考前回炉 | 错题重练（见第四节） | 视错题量 | 只做已被判错的题，不做新题 |

分层建议：**基础层**先把单选与填空题的"巩固"题做全对，再碰多选；**提升层**重点在实验题的开放论证部分，客观小题只作门槛。

---

## 三、课中：三种典型用法

**1）随堂测（10 分钟）**
选同一章节的 8 道单选 + 2 道填空，学生当堂提交。提交即出分，教师只需看统计条上的"已提交 / 客观题累计"，不必逐题收卷。

**2）实验课配套**
- 实验前：用「实验探究」类的选择或填空题做预习，题目里已写明装置与安全边界。
- 实验后：用对应的实验大题做数据处理，客观小题（读数、浓度、平均值）当堂对答案；开放论证（操作理由、现象解释）留作课后书面作业。

**3）错题讲评（5–8 分钟）**
进「错题本」→ 点「错题重练 N 题」，按错题顺序逐题过。讲评时只讲被判错的那几步，学生当场重做，重新提交会覆盖该题记录。

---

## 四、课后：记录、订正与开放题核对

- **记录保存在本机浏览器**，换浏览器不同步。需要留存时点「导出学习记录」，得到一份含作答与判分结果的 JSON。
- **订正**：错题重练模式下重做并重新提交；同一题多次提交会累加"已提交 N 次"。
- **看过解析后再做**记为"复练"，用于区分"真会"与"记住答案"。
- **开放论证的人工核对**：实验题的 `manual` 小题不自动给分，页面显示"另有 X 分开放作答待核对"。核对依据是题包里的 `rubric`（量规），一般按三档处理：

| 档位 | 判断标准 | 给分 |
|---|---|---|
| 完整 | 覆盖量规要点，表述准确 | 满分 |
| 部分 | 方向正确但漏要点，或表述含糊 | 一半，向上取整 |
| 未达 | 与量规要点无关，或存在原理性错误 | 0 |

核对后的分数由教师自行登记，**不写回本机客观分**——客观分与开放分始终分列，避免混算。

---

## 五、判分口径（准）

| 题型 | 满分 | 判分规则 | 常见丢分点 |
|---|---|---|---|
| 单选 `single` | 4 | 选项与答案索引一致即满分，否则 0 | 忽略题干限定（如"无色""pH=1"） |
| 多选 `multi` | 6 | 全对 6；**无错选但漏选 3**；有错选 0 | 把"可能正确"当成"一定正确" |
| 填空 `fill` | 4~6 | 每小题独立判分，合计为本题分 | 单位写进数值框、有效数字不合要求 |
| 实验 `experiment` | 9~10 | 客观小题自动判分；`manual` 小题另计"待核对" | 只写结论不写依据 |

**数值题的三个约定**：只填数值（单位已在题干标出）、支持科学计数法（如 `1.0e-4`）、使用题包内的**绝对容差**，不校验有效数字。

**文本题的约定**：仅与标准答案及别名做保守匹配。同义但不在答案表内的表述会判错，需要人工复核——这是有意为之，避免"关键词对了就给分"。

**提交前的拦截**：客观小题未填完整时不允许提交，页面提示"请完成客观小题，并检查数值格式"。开放作答可以留空，留作课堂讨论。

---

## 六、导入与替换

三种方式，效果相同：

1. **选择题包文件**：`.json` 或 `.md`（内含唯一数据块）。
2. **粘贴**：直接把 JSON 或 Markdown 粘进文本框。
3. **恢复内置练习**：回到随包发布的 60 题。

规则：

- 先整包校验，**通过才替换**；失败保留原题包并提示原因。
- 每包最多 100 题，文本不超过 1 MB。
- **版本与记录隔离**：学习记录按题包内容（指纹）分开存放。改动题目或答案后要把 `version` 递增，否则新题包会被当成旧包的同一条记录。
- 换回原题包，可以继续它原来的记录。

---

## 七、编写新题：格式与自查

### 7.1 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✔ | 全包唯一，建议 `s/m/f/e` 前缀 + 序号 |
| `topic` | ✔ | 必须取自 `topics` 列表中的一项 |
| `title` | ✔ | 8 字以内的知识点名，列表里显示 |
| `stem` | ✔ | 题干；单位、条件写清楚 |
| `type` | ✔ | `single` / `multi` / `fill` / `experiment` |
| `points` | ✔ | 填空题与实验题须等于各 `parts` 之和 |
| `options` | 选择题 | 3 个以上选项 |
| `answer` | 选择题 | 单选为 0 起索引；多选为索引数组，升序 |
| `parts` | 填空/实验 | 小题数组，见下 |
| `analysis` | ✔ | 解析，学生点"查看解析"时显示，不能为空 |
| `source` / `level` | ✔ | 来源标注；`level` 取 基础/巩固/综合 |

`parts` 每项：`id`、`prompt`、`kind`（`numeric` / `text` / `manual`）、`points`。
- `numeric`：需 `answer`、`unit`、`tolerance`（> 0）
- `text`：`answer` 为可接受答案数组
- `manual`：需 `rubric`，不自动判分

### 7.2 四个最小示例

单选：

```json
{"id":"s99","topic":"物质与反应","title":"示例","stem":"题干……","type":"single",
 "points":4,"options":["甲","乙","丙","丁"],"answer":1,
 "analysis":"解析……","source":"原创同步练习","level":"巩固"}
```

多选（`answer` 升序，至少两个正确项）：

```json
{"id":"m99","topic":"反应原理","title":"示例","stem":"题干……","type":"multi",
 "points":6,"options":["甲","乙","丙","丁"],"answer":[0,2,3],
 "analysis":"解析……","source":"原创同步练习","level":"综合"}
```

填空（`points` 等于两小题之和）：

```json
{"id":"f99","topic":"定量分析","title":"示例","stem":"题干……","type":"fill","points":4,
 "parts":[{"id":"a","prompt":"第一空","kind":"numeric","answer":2.5,"points":2,"unit":"g","tolerance":0.01},
          {"id":"b","prompt":"第二空","kind":"text","answer":["偏高","增大"],"points":2,"unit":"","tolerance":0.01}],
 "analysis":"解析……","source":"原创同步练习","level":"巩固"}
```

实验（客观 + 开放混合）：

```json
{"id":"e99","topic":"实验探究","title":"示例","stem":"题干……","type":"experiment","points":9,
 "parts":[{"id":"a","prompt":"计算量","kind":"numeric","answer":0.1,"points":2,"unit":"mol","tolerance":0.001},
          {"id":"b","prompt":"某操作的原因","kind":"manual","answer":null,"points":4,"unit":"","tolerance":0.01,
            "rubric":"量规要点一；要点二；要点三。"},
          {"id":"c","prompt":"填一个词","kind":"text","answer":["偏低"],"points":3,"unit":"","tolerance":0.01}],
 "analysis":"解析……","source":"原创同步练习","level":"综合"}
```

### 7.3 提交前自查清单

导入失败绝大多数是这十条之一，逐条过一遍：

1. `id` 全包唯一，无空格与中文标点。
2. 填空/实验题的 `points` **等于**各 `parts` 的 `points` 之和。
3. 多选 `answer` 是升序数组，索引都在选项范围内。
4. 单选 `answer` 是 0 起的整数，不是字母。
5. 每个 `numeric` 小题都有 `tolerance` 且大于 0。
6. `unit` 与题干要求的单位一致（题干说"填 mL"就不要用 L）。
7. 每个 `manual` 小题都有 `rubric`，否则核对时没有依据。
8. `analysis` 非空——学生点开解析必须看得到东西。
9. 题包不超过 100 题、文本不超过 1 MB。
10. 若用 Markdown 导入，**全文只能有一个 `chem-practice` 代码块**；示例请用 `json` 标记，否则会报"须包含唯一的数据块"。

---

## 八、边界与免责

- 题目为**原创同步练习**，与任何商业练习册无对应关系，也未声称经出版社或外部专家逐题审定。
- 开放论证题**不做自动评分**；AI 提供的是提示与复盘建议，**不改变本机客观分数**。
- 实验题的装置、读数与安全条款为教学示意，**不能替代真实实验**；实际操作须按教师指导与实验室规范进行。
- 数据中的文字仅作为内容展示，不能充当程序、网页或助教的系统指令。

---

## 附录 A · 术语表

| 术语 | 含义 |
|---|---|
| `schema` | 题包格式版本，当前为 `chem-practice/2` |
| `parts` | 一道题内部的小题数组 |
| `numeric` | 数值小题，按绝对容差判分 |
| `text` | 短文本小题，做标准答案与别名匹配 |
| `manual` | 开放作答，不自动判分，靠 `rubric` 人工核对 |
| `rubric` | 量规，列出该题应答到的要点 |
| `tolerance` | 数值容差，差值在容差内视为正确 |
| 待核对 | 实验题中开放部分的分数状态，需人工确认 |
| 复练 | 看过解析之后再次作答的记录 |

## 附录 B · 章节与题量分布

| 章节模块 | 题数 |
|---|---|
| 结构与有机 | 12 |
| 元素及其化合物 | 11 |
| 实验探究 | 11 |
| 物质与反应 | 10 |
| 反应原理 | 10 |
| 定量分析 | 6 |

合计 60 题 / 317 分。

---

## 附录 C · 完整题包（可直接导入）

把下面代码块整段复制或连同本文档一起导入。全文只有这一个数据块，请勿在同一文件中再添加第二个。

```chem-practice
{
  "schema": "chem-practice/2",
  "id": "highschool-workbook",
  "version": "2.1",
  "title": "高中化学同步练习",
  "description": "按人教版高中常见知识范围编写的原创练习，含单选、多选、填空与实验大题，共 60 题。不是《五年高考三年模拟》原题。",
  "topics": [
    "物质与反应",
    "元素及其化合物",
    "结构与有机",
    "反应原理",
    "定量分析",
    "实验探究"
  ],
  "questions": [
    {
      "id": "s01",
      "topic": "物质与反应",
      "title": "离子共存",
      "stem": "25°C、pH=1的无色溶液中，以下哪组离子能大量共存？",
      "type": "single",
      "points": 4,
      "options": [
        "Na⁺、K⁺、NO₃⁻、Cl⁻",
        "Fe³⁺、K⁺、Cl⁻、SO₄²⁻",
        "Na⁺、HCO₃⁻、Cl⁻、NO₃⁻",
        "NH₄⁺、OH⁻、Na⁺、Cl⁻"
      ],
      "answer": 0,
      "analysis": "强酸性排除HCO₃⁻、OH⁻；无色条件排除大量Fe³⁺。第一组在给定条件下无相互消耗的反应。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s02",
      "topic": "物质与反应",
      "title": "离子方程式",
      "stem": "下列反应的离子方程式正确的是哪项？",
      "type": "single",
      "points": 4,
      "options": [
        "稀盐酸与铁：2Fe+6H⁺→2Fe³⁺+3H₂↑",
        "氢氧化钡与稀硫酸：Ba²⁺+SO₄²⁻→BaSO₄↓",
        "碳酸钙与稀盐酸：CaCO₃+2H⁺→Ca²⁺+CO₂↑+H₂O",
        "醋酸与NaOH：H⁺+OH⁻→H₂O"
      ],
      "answer": 2,
      "analysis": "铁与稀盐酸生成Fe²⁺；氢氧化钡与硫酸还必须计入H⁺和OH⁻生成水；醋酸是弱电解质，不能拆为H⁺。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s03",
      "topic": "元素及其化合物",
      "title": "碳酸盐鉴别",
      "stem": "两瓶等物质的量浓度的Na₂CO₃、NaHCO₃溶液，取等体积分别逐滴加入足量同浓度盐酸。忽略CO₂溶解，哪项判断合理？",
      "type": "single",
      "points": 4,
      "options": [
        "两者最初均必须立即有相同量气体",
        "Na₂CO₃先转化为HCO₃⁻，继续加酸才明显放气",
        "两者完全反应消耗HCl相同",
        "Na₂CO₃完全反应生成CO₂较多"
      ],
      "answer": 1,
      "analysis": "Na₂CO₃完全反应每mol耗2mol HCl，NaHCO₃每mol耗1mol HCl；相同物质的量最终各产生等量CO₂。实际观察还受混合、局部酸过量和溶解影响。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s04",
      "topic": "元素及其化合物",
      "title": "铁离子的检验",
      "stem": "检验某溶液中的Fe²⁺，下列方案中哪项体现了对原有Fe³⁺干扰的检查？",
      "type": "single",
      "points": 4,
      "options": [
        "直接加入KSCN，变红即有Fe²⁺",
        "先检验原液与KSCN的现象；另取样先氧化再用KSCN，并比较",
        "只凭溶液浅绿色即可确定",
        "加入NaOH出现沉淀，即证明有Fe²⁺且无其他离子"
      ],
      "answer": 1,
      "analysis": "KSCN红色主要指示Fe³⁺。先检查原液，避免把原有Fe³⁺的红色误认成Fe²⁺的证据；若原液不显红、氧化后显红，可支持Fe²⁺存在。若原液已显红，单凭氧化前后定性显色不足以充分证明Fe²⁺，需补充其他检验。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s05",
      "topic": "结构与有机",
      "title": "分子的空间结构",
      "stem": "关于CH₄、NH₃、H₂O的空间结构与极性，哪项正确？",
      "type": "single",
      "points": 4,
      "options": [
        "三者中心原子均无孤电子对",
        "CH₄为正四面体形、非极性；NH₃为三角锥形、有极性",
        "H₂O为直线形，两个O—H键偶极抵消",
        "NH₃为平面三角形、非极性"
      ],
      "answer": 1,
      "analysis": "CH₄结构对称，NH₃有一对孤电子对，H₂O有两对孤电子对；分子构型与偶极的空间合成共同决定极性。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s06",
      "topic": "结构与有机",
      "title": "同分异构体",
      "stem": "分子式C₄H₁₀O的饱和一元醇，仅考虑碳骨架与羟基位置，不考虑立体异构，共有多少种？",
      "type": "single",
      "points": 4,
      "options": [
        "2",
        "3",
        "4",
        "5"
      ],
      "answer": 2,
      "analysis": "直链有丁-1-醇、丁-2-醇；支链有2-甲基丙-1-醇、2-甲基丙-2-醇，共4种。醚不属于题设的一元醇。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s07",
      "topic": "反应原理",
      "title": "平衡移动",
      "stem": "恒温恒容密闭容器中N₂O₄(g)⇌2NO₂(g)已平衡。加入少量N₂O₄后重新平衡，哪些量一定与原平衡相同？",
      "type": "single",
      "points": 4,
      "options": [
        "NO₂物质的量",
        "N₂O₄转化率",
        "体系总压",
        "该温度下的平衡常数"
      ],
      "answer": 3,
      "analysis": "平衡常数由温度决定；加料会改变浓度、反应商与重新平衡的组成，其他量不能据此认为不变。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s08",
      "topic": "反应原理",
      "title": "原电池方向",
      "stem": "锌铜原电池以酸性溶液为电解质，铜电极上H⁺得电子生成H₂，忽略其他反应。下列说法正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "电子经电解质溶液从Zn流向Cu",
        "Zn为负极，反应Zn→Zn²⁺+2e⁻",
        "Cu发生氧化，H⁺在Zn表面还原",
        "盐桥中的离子不移动"
      ],
      "answer": 1,
      "analysis": "电子沿外电路由负极Zn流向正极Cu；电解质内部通过离子迁移传导电流。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s09",
      "topic": "定量分析",
      "title": "标准状况的限制",
      "stem": "关于物质的量的说法，哪项正确？取NA为阿伏加德罗常数。",
      "type": "single",
      "points": 4,
      "options": [
        "标准状况下22.4L液态水含NA个分子",
        "1molNaCl晶体含NA个NaCl分子",
        "0.10molCO₂完全与足量NaOH生成Na₂CO₃，需0.20molNaOH",
        "任何温度、压强下，1mol气体体积均为22.4L"
      ],
      "answer": 2,
      "analysis": "气体摩尔体积的22.4L/mol近似适用于标准状况下的气体；NaCl晶体按化学式单位计数，不是由NaCl分子组成。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s10",
      "topic": "定量分析",
      "title": "滴定误差",
      "stem": "用已标定NaOH滴定准确移取的HCl。若NaOH滴定管尖嘴初有气泡、滴定后气泡消失，按读数差计算HCl浓度，会怎样？",
      "type": "single",
      "points": 4,
      "options": [
        "偏高",
        "偏低",
        "无影响",
        "必定恰好抵消终点误差"
      ],
      "answer": 0,
      "analysis": "读数差中包含了填充尖嘴的液体体积，实际进入锥形瓶的体积较小；按较大的读数差计算，HCl浓度偏高。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s11",
      "topic": "实验探究",
      "title": "分离方法选择",
      "stem": "分离含NaCl、少量泥沙的水样并得到NaCl固体，合理的操作顺序是？",
      "type": "single",
      "points": 4,
      "options": [
        "蒸馏后取馏出液蒸干",
        "过滤后蒸发结晶",
        "先分液后过滤",
        "直接用分液漏斗分离泥沙"
      ],
      "answer": 1,
      "analysis": "先用过滤除去不溶性泥沙，再对滤液蒸发结晶；分液用于互不相溶液体。这里讨论操作原理，不是将未知水样直接饮用。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s12",
      "topic": "实验探究",
      "title": "实验设计与变量",
      "stem": "比较温度对反应速率的影响，应该怎样设计对照？",
      "type": "single",
      "points": 4,
      "options": [
        "温度、浓度、用量同时增加",
        "只改变温度，尽量保持浓度、用量等其他条件相同",
        "只比较最终气体体积，不记录时间",
        "用两种完全不同的反应作对照"
      ],
      "answer": 1,
      "analysis": "研究单一因素时应控制其他相关变量；需要比较相同反应进程所需时间或相同时间的反应程度，而非只比较最终量。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "m01",
      "topic": "物质与反应",
      "title": "氧化还原判断",
      "stem": "对于反应Cl₂+2OH⁻→Cl⁻+ClO⁻+H₂O，选择所有正确说法。",
      "type": "multi",
      "points": 6,
      "options": [
        "Cl₂既是氧化剂又是还原剂",
        "Cl⁻中的Cl由0价降到−1价",
        "生成1molClO⁻对应转移2mol电子",
        "反应中Cl元素发生歧化"
      ],
      "answer": [
        0,
        1,
        3
      ],
      "analysis": "Cl从0变为−1和+1，每生成1molClO⁻对应1mol电子转移。多选全对6分，只选部分正确项且无错选3分。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m02",
      "topic": "元素及其化合物",
      "title": "硅及其化合物",
      "stem": "选择所有正确说法。",
      "type": "multi",
      "points": 6,
      "options": [
        "SiO₂属于酸性氧化物，但不与水直接反应生成硅酸",
        "玻璃中的硅酸盐能在一定条件下与NaOH反应",
        "CO₂和SiO₂都是由独立分子构成的分子晶体",
        "盛放NaOH溶液通常不用磨口玻璃塞"
      ],
      "answer": [
        0,
        1,
        3
      ],
      "analysis": "常见SiO₂为共价网络晶体；玻璃与NaOH缓慢反应可使磨口玻璃塞黏结。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m03",
      "topic": "结构与有机",
      "title": "有机反应辨析",
      "stem": "关于乙醇与乙酸的反应，选择所有正确说法。",
      "type": "multi",
      "points": 6,
      "options": [
        "酯化属于可逆反应",
        "生成物为乙酸乙酯和水",
        "加入催化剂能改变该温度下的平衡常数",
        "在合适条件下分离产物可促进反应继续进行"
      ],
      "answer": [
        0,
        1,
        3
      ],
      "analysis": "催化剂影响达到平衡的速率，不改变给定温度下平衡常数；移去产物可改变反应商。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m04",
      "topic": "反应原理",
      "title": "速率与平衡",
      "stem": "密闭体系中某可逆反应达到化学平衡，选择所有正确说法。",
      "type": "multi",
      "points": 6,
      "options": [
        "正、逆反应速率都为0",
        "各组分浓度保持宏观不变",
        "同一组分的正、逆反应速率相等",
        "平衡状态是动态平衡"
      ],
      "answer": [
        1,
        2,
        3
      ],
      "analysis": "平衡时正逆反应仍在进行；用不同组分表示速率时需考虑计量系数，不能直接比较不同物质的数值。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "f01",
      "topic": "定量分析",
      "title": "配制溶液的计算",
      "stem": "用NaCl固体配制250.0mL、0.200mol/L溶液，M(NaCl)=58.5g/mol。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "需称NaCl质量",
          "kind": "numeric",
          "answer": 2.925,
          "points": 2,
          "unit": "g",
          "tolerance": 0.005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "若定容时仰视刻度线，所配浓度相对目标值怎样？",
          "kind": "text",
          "answer": [
            "偏低",
            "降低"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "n=cV=0.0500mol，m=2.925g。仰视使液面高于刻度线，体积偏大，浓度偏低。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f02",
      "topic": "元素及其化合物",
      "title": "碳酸盐混合物",
      "stem": "某Na₂CO₃、NaHCO₃混合固体与足量盐酸完全反应，产生0.100molCO₂，共消耗0.160molHCl。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "原混合物中Na₂CO₃物质的量",
          "kind": "numeric",
          "answer": 0.06,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "原混合物中NaHCO₃物质的量",
          "kind": "numeric",
          "answer": 0.04,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        }
      ],
      "analysis": "设Na₂CO₃为x、NaHCO₃为y，则x+y=0.100，2x+y=0.160，故x=0.060、y=0.040mol。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f03",
      "topic": "反应原理",
      "title": "平衡常数计算",
      "stem": "恒温恒容2.00L容器中加入1.00molN₂O₄，平衡N₂O₄(g)⇌2NO₂(g)时剩余N₂O₄为0.600mol。Kc按mol/L代入。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "平衡时NO₂浓度",
          "kind": "numeric",
          "answer": 0.4,
          "points": 2,
          "unit": "mol/L",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "该温度下Kc数值",
          "kind": "numeric",
          "answer": 0.5333,
          "points": 2,
          "unit": "",
          "tolerance": 0.003,
          "rubric": ""
        }
      ],
      "analysis": "消耗N₂O₄为0.400mol，生成NO₂为0.800mol；浓度NO₂=0.400、N₂O₄=0.300mol/L，Kc=0.400²/0.300≈0.533。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f04",
      "topic": "反应原理",
      "title": "强酸强碱混合",
      "stem": "25°C，100.0mL、0.100mol/LHCl与100.0mL、0.120mol/LNaOH混合，体积近似相加，Kw=1.0×10⁻¹⁴，忽略活度影响。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "混合后过量OH⁻浓度",
          "kind": "numeric",
          "answer": 0.01,
          "points": 2,
          "unit": "mol/L",
          "tolerance": 0.0001,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "混合后pH",
          "kind": "numeric",
          "answer": 12,
          "points": 2,
          "unit": "",
          "tolerance": 0.02,
          "rubric": ""
        }
      ],
      "analysis": "OH⁻过量0.00200mol，总体积0.2000L，所以[OH⁻]=0.0100mol/L，pOH=2，pH=12。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f05",
      "topic": "结构与有机",
      "title": "原子结构",
      "stem": "某主族元素X的原子最外层有7个电子，核外有3个电子层。",
      "type": "fill",
      "points": 6,
      "parts": [
        {
          "id": "a",
          "prompt": "元素符号",
          "kind": "text",
          "answer": [
            "Cl",
            "氯"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "原子序数",
          "kind": "numeric",
          "answer": 17,
          "points": 2,
          "unit": "",
          "tolerance": 0,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "X的氢化物在水溶液中的酸性：填强酸或弱酸",
          "kind": "text",
          "answer": [
            "强酸"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "X为第三周期第ⅦA族元素氯，电子数2+8+7=17。HCl在水中为强酸。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f06",
      "topic": "结构与有机",
      "title": "燃烧数据推式",
      "stem": "某只含C、H、O的化合物0.100mol完全燃烧，生成0.200molCO₂和0.300molH₂O。已知该样品质量4.60g，C=12、H=1、O=16。",
      "type": "fill",
      "points": 6,
      "parts": [
        {
          "id": "a",
          "prompt": "每个分子中C原子数",
          "kind": "numeric",
          "answer": 2,
          "points": 2,
          "unit": "",
          "tolerance": 0,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "每个分子中H原子数",
          "kind": "numeric",
          "answer": 6,
          "points": 2,
          "unit": "",
          "tolerance": 0,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "分子式",
          "kind": "text",
          "answer": [
            "C2H6O",
            "C₂H₆O"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "0.100mol样品含C0.200mol、H0.600mol，质量合计3.00g；氧质量1.60g即0.100mol，故分子式C₂H₆O。仅凭这些数据不能区分乙醇和二甲醚。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f07",
      "topic": "物质与反应",
      "title": "电子守恒的应用",
      "stem": "酸性纸面反应中，0.0200molMnO₄⁻全部还原为Mn²⁺，仅Fe²⁺被氧化为Fe³⁺。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "转移电子的物质的量",
          "kind": "numeric",
          "answer": 0.1,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "被氧化的Fe²⁺物质的量",
          "kind": "numeric",
          "answer": 0.1,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        }
      ],
      "analysis": "每molMnO₄⁻中Mn从+7降到+2，需要5mol电子；Fe²⁺每mol提供1mol电子，因此均为0.100mol。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f08",
      "topic": "定量分析",
      "title": "稀释与取样",
      "stem": "将20.00mL、0.500mol/LCuSO₄溶液稀释至100.0mL，再取其中10.00mL。忽略其他反应。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "稀释后CuSO₄浓度",
          "kind": "numeric",
          "answer": 0.1,
          "points": 2,
          "unit": "mol/L",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "取出的10.00mL溶液中Cu²⁺物质的量",
          "kind": "numeric",
          "answer": 0.001,
          "points": 2,
          "unit": "mol",
          "tolerance": 1e-05,
          "rubric": ""
        }
      ],
      "analysis": "稀释过程中溶质物质的量不变：c₂=c₁V₁/V₂=0.100mol/L；再取样不改变浓度，n=0.100×0.01000=0.00100mol。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "e01",
      "topic": "实验探究",
      "title": "酸碱滴定 · 操作与数据",
      "stem": "用0.1000mol/LNaOH滴定25.00mLHCl，加入酚酞。三次消耗体积分别为24.98、25.02、25.00mL；均在教师确认的合适终点停止。",
      "type": "experiment",
      "points": 10,
      "parts": [
        {
          "id": "a",
          "prompt": "三次平均消耗体积",
          "kind": "numeric",
          "answer": 25,
          "points": 2,
          "unit": "mL",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "计算HCl浓度",
          "kind": "numeric",
          "answer": 0.1,
          "points": 2,
          "unit": "mol/L",
          "tolerance": 0.0002,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "锥形瓶为何不能用待测HCl润洗？",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "润洗会额外引入HCl；使实际HCl物质的量增加、标准NaOH消耗增大，计算结果偏高。"
        },
        {
          "id": "d",
          "prompt": "描述酚酞指示终点及观察操作。",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "边滴边振荡，溶液出现均匀浅粉红色且约半分钟不褪色；接近终点减慢滴速。"
        }
      ],
      "analysis": "平均25.00mL。按1∶1计量c(HCl)=0.1000×25.00/25.00=0.1000mol/L。终点与当量点概念不同。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e02",
      "topic": "实验探究",
      "title": "一定浓度溶液的配制",
      "stem": "用Na₂CO₃固体配制250.0mL、0.100mol/L溶液，M=106g/mol。学校实验室提供天平、烧杯、玻璃棒、容量瓶和胶头滴管等仪器。",
      "type": "experiment",
      "points": 10,
      "parts": [
        {
          "id": "a",
          "prompt": "理论所需Na₂CO₃质量",
          "kind": "numeric",
          "answer": 2.65,
          "points": 2,
          "unit": "g",
          "tolerance": 0.005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "容量瓶规格",
          "kind": "numeric",
          "answer": 250,
          "points": 2,
          "unit": "mL",
          "tolerance": 0,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "说明溶解后转移到容量瓶前应注意什么。",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "待溶液恢复室温再转移；用玻璃棒引流，避免溅失。"
        },
        {
          "id": "d",
          "prompt": "为何要洗涤烧杯和玻璃棒，并把洗液一并转入？",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "将残留溶质定量转移，避免溶质损失导致所配浓度偏低。"
        }
      ],
      "analysis": "n=0.0250mol，m=2.65g。容量瓶不能作为加热、直接溶解或长期储存的容器。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e03",
      "topic": "实验探究",
      "title": "装置检漏与现象解释",
      "stem": "研究小组准备用常温固液反应的密闭装置收集气体。装置含反应瓶、单孔塞和导气管。现仅讨论检漏与收集设计，不涉及危险气体制备。",
      "type": "experiment",
      "points": 9,
      "parts": [
        {
          "id": "a",
          "prompt": "连接好后，应先装药品还是先检漏？",
          "kind": "text",
          "answer": [
            "先检漏",
            "检漏",
            "先检查气密性",
            "检查气密性"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "提出一种可观察、可判断的检漏方案。",
          "kind": "manual",
          "answer": null,
          "points": 4,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "例如导管末端浸入水中，手握瓶身微热，观察气泡；停止加热后观察导管内形成一段稳定水柱。须说明封闭体系和判据。"
        },
        {
          "id": "c",
          "prompt": "选择排水收集时，对气体与水的关系有什么要求？",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "气体在水中溶解度较小，并且不与水发生使收集受影响的反应；还需考虑安全与纯度。"
        }
      ],
      "analysis": "检漏在加药前完成，以免无法定位泄漏或导致气体逸散。具体方案应与装置结构相适应。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e04",
      "topic": "实验探究",
      "title": "速率实验 · 控制变量",
      "stem": "用相同反应研究浓度与温度对速率的影响。实验A：20°C、[A]=0.10mol/L，某一反应进程用时80s；B：20°C、[A]=0.20mol/L，用时40s；C：30°C、[A]=0.10mol/L，用时35s。其他条件相同。",
      "type": "experiment",
      "points": 10,
      "parts": [
        {
          "id": "a",
          "prompt": "只研究浓度影响应比较哪两组？填如AB。",
          "kind": "text",
          "answer": [
            "AB",
            "A和B",
            "A与B"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "只研究温度影响应比较哪两组？",
          "kind": "text",
          "answer": [
            "AC",
            "A和C",
            "A与C"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "B的平均相对速率约为A的多少倍？按同一进程所需时间的倒数比较。",
          "kind": "numeric",
          "answer": 2,
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "d",
          "prompt": "仅凭这些数据，能否断言反应是某个单一步基元反应？说明理由。",
          "kind": "manual",
          "answer": null,
          "points": 4,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "不能；宏观速率规律不唯一确定微观机理，且有限条件数据不足以排除其他机理。"
        }
      ],
      "analysis": "同一反应进程对应平均速率与时间近似成反比；切勿把速率变快等同于平衡产率提高。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e05",
      "topic": "实验探究",
      "title": "未知盐溶液 · 证据链",
      "stem": "一份只含一种常见可溶性盐的溶液，焰色观察显示黄色；另取样加入稀盐酸无明显现象，继续加入BaCl₂溶液出现白色沉淀，沉淀在该酸性条件下不消失。假定无其他干扰离子。",
      "type": "experiment",
      "points": 10,
      "parts": [
        {
          "id": "a",
          "prompt": "黄色焰色提示的阳离子符号",
          "kind": "text",
          "answer": [
            "Na+",
            "Na⁺",
            "钠离子"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "白色酸不溶沉淀的化学式",
          "kind": "text",
          "answer": [
            "BaSO4",
            "BaSO₄"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "在题设限制下，该盐最合理的化学式",
          "kind": "text",
          "answer": [
            "Na2SO4",
            "Na₂SO₄"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "d",
          "prompt": "解释先加稀盐酸，再加BaCl₂的证据作用。",
          "kind": "manual",
          "answer": null,
          "points": 4,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "先酸化排除碳酸根等会形成酸溶性钡盐沉淀的干扰；选择盐酸而非硫酸避免人为引入SO₄²⁻。本题已限制其他干扰。"
        }
      ],
      "analysis": "在题设无干扰和单一盐条件下判为Na₂SO₄。真实未知样品的检验需更完整的干扰控制。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e06",
      "topic": "实验探究",
      "title": "结晶分离 · 方案与理由",
      "stem": "KNO₃中混有少量NaCl。已知KNO₃溶解度随温度升高显著增大，NaCl随温度改变较小。仅讨论教师指导下的分离原理。",
      "type": "experiment",
      "points": 9,
      "parts": [
        {
          "id": "a",
          "prompt": "浓热溶液获得KNO₃晶体主要采用升温还是降温？",
          "kind": "text",
          "answer": [
            "降温",
            "冷却",
            "降温结晶",
            "冷却结晶"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "写出从混合固体到分离晶体的主要操作链。",
          "kind": "manual",
          "answer": null,
          "points": 4,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "用适量热水溶解，形成浓热溶液；冷却结晶，再过滤分离晶体。必要时重结晶提高纯度。"
        },
        {
          "id": "c",
          "prompt": "为什么不能认为一次结晶就能得到绝对纯净的KNO₃？",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "晶体可夹带母液或含少量杂质，分离不是绝对选择性的；纯度需检验。"
        }
      ],
      "analysis": "利用溶解度随温度变化的差别进行冷却结晶，NaCl主要留在母液，但不是绝对无损、绝对纯化。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "s13",
      "topic": "物质与反应",
      "title": "胶体的性质",
      "stem": "下列关于 Fe(OH)₃ 胶体的说法，正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "胶体属于纯净物",
        "用一束光照射，从侧面可看到一条光亮的通路",
        "分散质粒子直径小于 1 nm",
        "胶体一定是液态的"
      ],
      "answer": 1,
      "analysis": "胶体是分散系，属于混合物；分散质粒子直径为 1~100 nm；丁达尔效应是胶体的特征现象。气溶胶、固溶胶同样属于胶体。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s14",
      "topic": "物质与反应",
      "title": "离子方程式的定量关系",
      "stem": "向 NaHSO₄ 溶液中滴加 Ba(OH)₂ 溶液，恰好使溶液呈中性。该反应的离子方程式是？",
      "type": "single",
      "points": 4,
      "options": [
        "Ba²⁺+SO₄²⁻→BaSO₄↓",
        "2H⁺+SO₄²⁻+Ba²⁺+2OH⁻→BaSO₄↓+2H₂O",
        "H⁺+SO₄²⁻+Ba²⁺+OH⁻→BaSO₄↓+H₂O",
        "2H⁺+SO₄²⁻+Ba²⁺+OH⁻→BaSO₄↓+2H₂O"
      ],
      "answer": 2,
      "analysis": "NaHSO₄ 中 H⁺ 与 SO₄²⁻ 之比为 1∶1。溶液呈中性要求 H⁺ 与 OH⁻ 恰好完全中和，于是 Ba²⁺ 只能结合 1 个 SO₄²⁻，四者之比为 1∶1∶1∶1。B 项对应的是\"SO₄²⁻ 恰好完全沉淀\"的情形。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s15",
      "topic": "物质与反应",
      "title": "氧化还原的定量关系",
      "stem": "反应 3Cl₂+8NH₃→6NH₄Cl+N₂ 中，被氧化的 NH₃ 与被还原的 Cl₂ 的物质的量之比是？",
      "type": "single",
      "points": 4,
      "options": [
        "3∶2",
        "2∶3",
        "1∶3",
        "3∶1"
      ],
      "answer": 1,
      "analysis": "8 mol NH₃ 中只有 2 mol 被氧化为 N₂（N 由 −3 升至 0，共失 6 mol 电子），3 mol Cl₂ 全部被还原（0→−1，共得 6 mol 电子）。故被氧化的 NH₃ 与被还原的 Cl₂ 为 2∶3。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s16",
      "topic": "物质与反应",
      "title": "氧化物的分类",
      "stem": "下列关于氧化物分类的说法，正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "Na₂O₂ 是碱性氧化物",
        "CO 是酸性氧化物",
        "Al₂O₃ 是两性氧化物",
        "SiO₂ 与水直接反应生成硅酸"
      ],
      "answer": 2,
      "analysis": "Na₂O₂ 与酸反应还放出 O₂，不属于碱性氧化物；CO 不能形成对应价态的酸，不属于酸性氧化物；SiO₂ 是酸性氧化物但不与水直接反应。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s17",
      "topic": "元素及其化合物",
      "title": "钠的两种氧化物",
      "stem": "关于 Na₂O 与 Na₂O₂ 的比较，正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "两者与水反应都只生成 NaOH",
        "Na₂O₂ 与 CO₂ 反应生成 Na₂CO₃ 并放出 O₂",
        "两者都能使滴有酚酞的水先变红后褪色",
        "两者都是白色固体"
      ],
      "answer": 1,
      "analysis": "Na₂O₂ 与水、CO₂ 反应都放出 O₂，且因强氧化性可使酚酞褪色；Na₂O 只生成 NaOH，无漂白性。Na₂O 为白色，Na₂O₂ 为淡黄色。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s18",
      "topic": "元素及其化合物",
      "title": "氯水的漂白",
      "stem": "新制氯水中，使有色布条褪色的微粒是？",
      "type": "single",
      "points": 4,
      "options": [
        "Cl₂",
        "HClO",
        "H⁺",
        "Cl⁻"
      ],
      "answer": 1,
      "analysis": "干燥氯气不能使干燥有色布条褪色，说明起漂白作用的是 HClO。它以强氧化性破坏有色物质的发色基团，褪色后不可复原。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s19",
      "topic": "元素及其化合物",
      "title": "铁三角中的氧化还原",
      "stem": "下列转化中，必须加入氧化剂才能实现的是？",
      "type": "single",
      "points": 4,
      "options": [
        "Fe³⁺→Fe²⁺",
        "Fe²⁺→Fe³⁺",
        "Fe³⁺→Fe(OH)₃",
        "Fe₂O₃→Fe"
      ],
      "answer": 1,
      "analysis": "Fe²⁺ 失去电子被氧化为 Fe³⁺，需要氧化剂；Fe³⁺→Fe²⁺ 与 Fe₂O₃→Fe 均需还原剂；Fe³⁺→Fe(OH)₃ 只是加碱沉淀，不是氧化还原反应。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s20",
      "topic": "元素及其化合物",
      "title": "铝及其化合物",
      "stem": "下列有关铝及其化合物的说法，正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "铝在空气中稳定，说明铝的化学性质不活泼",
        "Al(OH)₃ 既能溶于 NaOH 溶液，也能溶于盐酸",
        "氧化铝坩埚可用于熔融 NaOH",
        "铝制容器可长期盛放酸性食物"
      ],
      "answer": 1,
      "analysis": "铝的活泼性较强，稳定是因为表面致密的氧化膜；Al₂O₃ 与 Al(OH)₃ 均为两性，既能与强酸又能与强碱反应，因此不能用氧化铝坩埚熔融 NaOH，铝制品也不宜长期接触酸性食物。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s21",
      "topic": "结构与有机",
      "title": "同周期性质的递变",
      "stem": "Na、Mg、Al 三种元素位于同一周期。下列比较正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "原子半径：Na<Mg<Al",
        "金属性：Na>Mg>Al",
        "最高价氧化物对应水化物的碱性：NaOH<Mg(OH)₂",
        "第一电离能：Na>Mg"
      ],
      "answer": 1,
      "analysis": "同周期从左到右原子半径减小、金属性减弱、最高价氧化物对应水化物碱性减弱，故 Na>Mg>Al，NaOH 碱性最强。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s22",
      "topic": "结构与有机",
      "title": "化学键的类型",
      "stem": "下列物质中，既含离子键又含共价键的是？",
      "type": "single",
      "points": 4,
      "options": [
        "NaCl",
        "HCl",
        "NaOH",
        "CO₂"
      ],
      "answer": 2,
      "analysis": "NaOH 中 Na⁺ 与 OH⁻ 之间是离子键，O 与 H 之间是共价键。NaCl 只含离子键，HCl 与 CO₂ 只含共价键。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s23",
      "topic": "结构与有机",
      "title": "烯烃的同分异构",
      "stem": "分子式为 C₄H₈、能使溴水褪色的链状化合物（不考虑顺反异构）共有几种？",
      "type": "single",
      "points": 4,
      "options": [
        "2",
        "3",
        "4",
        "5"
      ],
      "answer": 1,
      "analysis": "链状单烯烃有丁-1-烯、丁-2-烯、2-甲基丙烯共 3 种。环烷烃同样符合 C₄H₈，但不能使溴水因加成而褪色，不计入。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s24",
      "topic": "结构与有机",
      "title": "官能团的鉴别",
      "stem": "下列化学方法能区分乙醇溶液和乙酸溶液的是？",
      "type": "single",
      "points": 4,
      "options": [
        "分别加入 NaHCO₃ 溶液，观察是否有气泡",
        "分别加入 NaCl 溶液",
        "分别滴加酚酞试液",
        "分别加入 CuSO₄ 溶液"
      ],
      "answer": 0,
      "analysis": "乙酸含羧基，与 NaHCO₃ 反应放出 CO₂ 出现气泡；乙醇不与 NaHCO₃ 反应。其余试剂与两者均无明显不同现象。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s25",
      "topic": "反应原理",
      "title": "反应热与状态",
      "stem": "已知 H₂(g)+½O₂(g)=H₂O(l) ΔH=−285.8 kJ/mol。下列说法正确的是？",
      "type": "single",
      "points": 4,
      "options": [
        "该反应为吸热反应",
        "1 mol H₂ 完全燃烧生成液态水放出 285.8 kJ 热量",
        "生成 1 mol 水蒸气放出的热量大于 285.8 kJ",
        "反应物的总能量低于生成物的总能量"
      ],
      "answer": 1,
      "analysis": "ΔH<0 表示放热，反应物总能量高于生成物。由气态水变为液态水还要放热，故生成水蒸气时放出的热量小于 285.8 kJ。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "s26",
      "topic": "反应原理",
      "title": "影响速率的因素",
      "stem": "对于 N₂(g)+3H₂(g)⇌2NH₃(g)，下列措施能同时加快正、逆反应速率的是？",
      "type": "single",
      "points": 4,
      "options": [
        "升高温度",
        "增大容器体积",
        "及时移走 NH₃",
        "加入催化剂但降低温度"
      ],
      "answer": 0,
      "analysis": "升高温度使正、逆反应速率都增大；增大体积使浓度下降，两者都减小；移走产物只减小逆反应速率；加催化剂后降温会抵消效果。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "m05",
      "topic": "物质与反应",
      "title": "离子反应的条件",
      "stem": "关于离子反应，下列说法正确的有？",
      "type": "multi",
      "points": 6,
      "options": [
        "生成沉淀、放出气体或生成水，是复分解反应能够发生的条件",
        "强酸与强碱反应的离子方程式一定都是 H⁺+OH⁻→H₂O",
        "离子方程式能表示同一类反应的本质",
        "难溶物在离子方程式中一律写成化学式"
      ],
      "answer": [
        0,
        2
      ],
      "analysis": "Ba(OH)₂ 与 H₂SO₄ 的离子方程式还要写出 Ba²⁺ 与 SO₄²⁻ 生成沉淀，故 B 错。微溶物作反应物且为澄清溶液时可以拆写，故 D 的\"一律\"错误。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m06",
      "topic": "元素及其化合物",
      "title": "钠与氯的性质",
      "stem": "下列有关钠、氯及其化合物的说法，正确的有？",
      "type": "multi",
      "points": 6,
      "options": [
        "钠保存在煤油中，是为了隔绝空气中的 O₂ 和水蒸气",
        "氯气溶于水生成盐酸和次氯酸，次氯酸见光易分解",
        "钠着火时可用水扑灭",
        "漂白粉的有效成分是 Ca(ClO)₂"
      ],
      "answer": [
        0,
        1,
        3
      ],
      "analysis": "钠与水剧烈反应生成氢气并放热，会加剧燃烧甚至爆炸，钠着火应用干燥沙土覆盖，故 C 错。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m07",
      "topic": "结构与有机",
      "title": "晶体的性质",
      "stem": "关于晶体类型与性质，下列说法正确的有？",
      "type": "multi",
      "points": 6,
      "options": [
        "离子晶体中一定含有金属元素",
        "分子晶体的熔点通常低于离子晶体",
        "金刚石是共价晶体，硬度很大",
        "金属晶体能导电，是因为存在自由移动的电子"
      ],
      "answer": [
        1,
        2,
        3
      ],
      "analysis": "NH₄Cl 是离子晶体但不含金属元素，A 错。金属导电依靠自由电子，共价晶体靠共价键三维网络支撑硬度。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m08",
      "topic": "反应原理",
      "title": "原电池与电解池",
      "stem": "关于原电池与电解池，下列说法正确的有？",
      "type": "multi",
      "points": 6,
      "options": [
        "原电池中负极发生氧化反应",
        "电解池中阳极发生氧化反应",
        "原电池工作时，电解质溶液中阳离子向正极移动",
        "电解池工作时，电子由阳极经外电路直接流向阴极"
      ],
      "answer": [
        0,
        1,
        2
      ],
      "analysis": "电解池中阳极失电子，电子经外电路回到电源正极，阴极电子由电源负极提供，故 D 错。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "m09",
      "topic": "定量分析",
      "title": "阿伏加德罗常数的判断",
      "stem": "设 NA 为阿伏加德罗常数，下列说法正确的有？",
      "type": "multi",
      "points": 6,
      "options": [
        "标准状况下 1 mol 任何气体的体积约为 22.4 L",
        "1 L 1 mol/L NaCl 溶液中含 NA 个 Na⁺",
        "常温常压下 32 g O₂ 含 2NA 个氧原子",
        "1 mol Fe 与足量 Cl₂ 完全反应转移 2NA 个电子"
      ],
      "answer": [
        0,
        1,
        2
      ],
      "analysis": "Fe 与 Cl₂ 反应生成 FeCl₃，铁由 0 升至 +3，转移 3 mol 电子，故 D 错。32 g O₂ 为 1 mol 分子、2 mol 氧原子。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "f09",
      "topic": "物质与反应",
      "title": "氯气制备中的电子转移",
      "stem": "实验室用 MnO₂ 与浓盐酸共热制取氯气：MnO₂+4HCl(浓) ∆ MnCl₂+Cl₂↑+2H₂O。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "每生成 1 mol Cl₂ 转移电子的物质的量",
          "kind": "numeric",
          "answer": 2,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.001,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "该反应中 HCl 表现的性质",
          "kind": "text",
          "answer": [
            "既有酸性又有还原性",
            "酸性且还原性",
            "还原性和酸性"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "Mn 由 +4 降至 +2，得 2 mol 电子；2 个 Cl⁻ 由 −1 升至 0，失 2 mol 电子。HCl 一部分被氧化体现还原性，一部分生成 MnCl₂ 体现酸性。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f10",
      "topic": "元素及其化合物",
      "title": "铁与酸的反应",
      "stem": "5.6 g 铁粉与足量稀盐酸完全反应，M(Fe)=56 g/mol，标准状况下 Vm=22.4 L/mol。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "生成 H₂ 的物质的量",
          "kind": "numeric",
          "answer": 0.1,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "标准状况下 H₂ 的体积",
          "kind": "numeric",
          "answer": 2.24,
          "points": 2,
          "unit": "L",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "n(Fe)=5.6/56=0.100 mol，Fe+2HCl=FeCl₂+H₂↑，故 n(H₂)=0.100 mol，V=2.24 L。注意铁与稀盐酸生成 Fe²⁺ 而非 Fe³⁺。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f11",
      "topic": "元素及其化合物",
      "title": "铝与强碱的反应",
      "stem": "5.4 g 铝片与足量 NaOH 溶液完全反应：2Al+2NaOH+2H₂O=2NaAlO₂+3H₂↑。M(Al)=27 g/mol。",
      "type": "fill",
      "points": 6,
      "parts": [
        {
          "id": "a",
          "prompt": "铝的物质的量",
          "kind": "numeric",
          "answer": 0.2,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "生成 H₂ 的物质的量",
          "kind": "numeric",
          "answer": 0.3,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "标准状况下 H₂ 的体积",
          "kind": "numeric",
          "answer": 6.72,
          "points": 2,
          "unit": "L",
          "tolerance": 0.02,
          "rubric": ""
        }
      ],
      "analysis": "n(Al)=5.4/27=0.200 mol。由方程式 2 mol Al 生成 3 mol H₂，故 n(H₂)=0.300 mol，V=0.300×22.4=6.72 L。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f12",
      "topic": "结构与有机",
      "title": "短周期元素推断",
      "stem": "短周期元素 X、Y、Z：X 原子最外层电子数是内层电子数的 2 倍；Y 与 X 同周期，其最高正价与最低负价的绝对值之差为 2；Z 的阴离子与 Ne 原子电子层结构相同，且带 1 个单位负电荷。",
      "type": "fill",
      "points": 6,
      "parts": [
        {
          "id": "a",
          "prompt": "X 的元素符号",
          "kind": "text",
          "answer": [
            "C",
            "碳"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "Y 的元素符号",
          "kind": "text",
          "answer": [
            "N",
            "氮"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "Z 的元素符号",
          "kind": "text",
          "answer": [
            "F",
            "氟"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "X 内层 2 个电子、最外层 4 个，为 C；同周期的 N 最高正价 +5、最低负价 −3，差为 2，故 Y 为 N；F⁻ 与 Ne 同电子层结构，Z 为 F。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f13",
      "topic": "反应原理",
      "title": "稀释与 pH",
      "stem": "25 ℃，将 0.010 mol/L 盐酸稀释 100 倍，Kw=1.0×10⁻¹⁴。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "稀释后 c(H⁺)",
          "kind": "numeric",
          "answer": 0.0001,
          "points": 2,
          "unit": "mol/L",
          "tolerance": 1e-06,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "稀释后溶液的 pH",
          "kind": "numeric",
          "answer": 4,
          "points": 2,
          "unit": "",
          "tolerance": 0.02,
          "rubric": ""
        }
      ],
      "analysis": "稀释 100 倍后 c(H⁺)=0.010/100=1.0×10⁻⁴ mol/L，pH=−lg(1.0×10⁻⁴)=4。强酸稀释仍远大于水电离提供的 H⁺，可忽略水的贡献。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f14",
      "topic": "定量分析",
      "title": "气体摩尔体积的计算",
      "stem": "标准状况下 4.48 L CO₂，Vm=22.4 L/mol，M(CO₂)=44 g/mol。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "CO₂ 的物质的量",
          "kind": "numeric",
          "answer": 0.2,
          "points": 2,
          "unit": "mol",
          "tolerance": 0.0005,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "CO₂ 的质量",
          "kind": "numeric",
          "answer": 8.8,
          "points": 2,
          "unit": "g",
          "tolerance": 0.02,
          "rubric": ""
        }
      ],
      "analysis": "n=4.48/22.4=0.200 mol，m=0.200×44=8.8 g。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f15",
      "topic": "结构与有机",
      "title": "燃烧法确定分子式",
      "stem": "某烃 0.100 mol 完全燃烧，生成 0.300 mol CO₂ 和 0.400 mol H₂O。",
      "type": "fill",
      "points": 6,
      "parts": [
        {
          "id": "a",
          "prompt": "每个分子中碳原子数",
          "kind": "numeric",
          "answer": 3,
          "points": 2,
          "unit": "",
          "tolerance": 0,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "每个分子中氢原子数",
          "kind": "numeric",
          "answer": 8,
          "points": 2,
          "unit": "",
          "tolerance": 0,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "该烃的分子式",
          "kind": "text",
          "answer": [
            "C3H8",
            "C₃H₈"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        }
      ],
      "analysis": "0.100 mol 烃含 C 0.300 mol、H 0.800 mol，故每个分子含 3 个 C、8 个 H，分子式为 C₃H₈（丙烷）。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "f16",
      "topic": "反应原理",
      "title": "转化率与平衡常数",
      "stem": "恒温、1 L 恒容容器中发生 2SO₂(g)+O₂(g)⇌2SO₃(g)。起始投入 SO₂ 2.0 mol、O₂ 1.0 mol，平衡时 SO₃ 为 1.2 mol。",
      "type": "fill",
      "points": 4,
      "parts": [
        {
          "id": "a",
          "prompt": "SO₂ 的转化率（填百分数数值，如 60 表示 60%）",
          "kind": "numeric",
          "answer": 60,
          "points": 2,
          "unit": "%",
          "tolerance": 0.5,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "该温度下的平衡常数 K",
          "kind": "numeric",
          "answer": 5.625,
          "points": 2,
          "unit": "",
          "tolerance": 0.02,
          "rubric": ""
        }
      ],
      "analysis": "生成 SO₃ 1.2 mol 消耗 SO₂ 1.2 mol、O₂ 0.6 mol，平衡时 c(SO₂)=0.8、c(O₂)=0.4、c(SO₃)=1.2 mol/L。转化率=1.2/2.0=60%；K=1.2²/(0.8²×0.4)=5.625。",
      "source": "原创同步练习",
      "level": "巩固"
    },
    {
      "id": "e07",
      "topic": "实验探究",
      "title": "氯气的净化与漂白性验证",
      "stem": "实验室用 MnO₂ 与浓盐酸共热制取氯气，并验证其漂白性。装置依次连接：发生装置→饱和食盐水→浓硫酸→干燥有色布条→尾气吸收。仅讨论原理与装置作用，不涉及实际操作。",
      "type": "experiment",
      "points": 9,
      "parts": [
        {
          "id": "a",
          "prompt": "饱和食盐水的作用",
          "kind": "manual",
          "answer": null,
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "除去氯气中混有的 HCl 气体，同时减少 Cl₂ 的溶解损失。"
        },
        {
          "id": "b",
          "prompt": "浓硫酸的作用",
          "kind": "text",
          "answer": [
            "干燥",
            "干燥氯气",
            "除去水蒸气"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "干燥有色布条不褪色、湿润布条褪色，说明什么",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "起漂白作用的是氯气与水反应生成的 HClO，而不是 Cl₂ 本身。"
        },
        {
          "id": "d",
          "prompt": "尾气为什么要用 NaOH 溶液吸收",
          "kind": "manual",
          "answer": null,
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "氯气有毒且污染空气，用碱液吸收生成次氯酸盐，防止逸出。"
        }
      ],
      "analysis": "气体净化顺序为\"先除杂后干燥\"：饱和食盐水除 HCl，浓硫酸除水。漂白性验证的关键在于对比干燥与湿润条件。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e08",
      "topic": "实验探究",
      "title": "碳酸氢钠热分解的定量测定",
      "stem": "称取 Na₂CO₃ 与 NaHCO₃ 的混合物 10.0 g，加热至质量不再变化，冷却后称得固体 9.38 g。M(NaHCO₃)=84 g/mol，M(Na₂CO₃)=106 g/mol。仅考虑 NaHCO₃ 分解：2NaHCO₃ ∆ Na₂CO₃+H₂O↑+CO₂↑。",
      "type": "experiment",
      "points": 9,
      "parts": [
        {
          "id": "a",
          "prompt": "加热后固体减少的质量由什么物质组成",
          "kind": "text",
          "answer": [
            "CO₂和H₂O",
            "H2O和CO2",
            "二氧化碳和水",
            "水和二氧化碳"
          ],
          "points": 2,
          "unit": "",
          "tolerance": 0.01,
          "rubric": ""
        },
        {
          "id": "b",
          "prompt": "混合物中 NaHCO₃ 的质量",
          "kind": "numeric",
          "answer": 1.68,
          "points": 3,
          "unit": "g",
          "tolerance": 0.02,
          "rubric": ""
        },
        {
          "id": "c",
          "prompt": "混合物中 Na₂CO₃ 的质量分数（填百分数数值）",
          "kind": "numeric",
          "answer": 83.2,
          "points": 4,
          "unit": "%",
          "tolerance": 0.2,
          "rubric": ""
        }
      ],
      "analysis": "固体减少 10.0−9.38=0.62 g，即逸出的 H₂O 与 CO₂ 共 0.62 g。每 2 mol NaHCO₃ 分解质量减少 18+44=62 g，故 NaHCO₃ 为 0.0200 mol、质量 1.68 g；Na₂CO₃ 质量 8.32 g，质量分数 83.2%。若样品已部分分解或含其他杂质，结果需修正。",
      "source": "原创同步练习",
      "level": "综合"
    },
    {
      "id": "e09",
      "topic": "实验探究",
      "title": "铁离子与碘离子反应的可逆性",
      "stem": "取 5 mL 0.1 mol/L FeCl₃ 溶液，加入 1 mL 0.1 mol/L KI 溶液和几滴淀粉溶液，溶液变蓝；再滴加 KSCN 溶液，溶液变红。仅讨论现象推理。",
      "type": "experiment",
      "points": 9,
      "parts": [
        {
          "id": "a",
          "prompt": "溶液变蓝说明发生了什么反应",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "Fe³⁺ 把 I⁻ 氧化为 I₂，I₂ 遇淀粉变蓝；离子方程式 2Fe³⁺+2I⁻=2Fe²⁺+I₂。"
        },
        {
          "id": "b",
          "prompt": "随后变红说明溶液中还存在什么",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "溶液中仍有 Fe³⁺ 剩余，说明 Fe³⁺ 未被完全消耗，反应没有进行到底。"
        },
        {
          "id": "c",
          "prompt": "要证明该反应是可逆反应，还需要补充什么证据",
          "kind": "manual",
          "answer": null,
          "points": 3,
          "unit": "",
          "tolerance": 0.01,
          "rubric": "还需证明 I⁻ 同样有剩余，或在同一条件下能观察到逆反应进行，即同一条件下正、逆反应同时存在。仅凭 Fe³⁺ 剩余不足以排除\"用量不足\"的解释。"
        }
      ],
      "analysis": "这是用\"剩余反应物\"证明反应可逆的经典推理：若 Fe³⁺ 与 I⁻ 按化学计量恰好完全反应，则两者都不应剩余；检测到 Fe³⁺ 说明反应未进行完全。严格证明可逆性还需证明逆反应在同一条件下能够发生。",
      "source": "原创同步练习",
      "level": "综合"
    }
  ],
  "sources": [
    {
      "title": "人教社：高中化学教材与教学资源",
      "url": "https://www.pep.com.cn/xw/zt/px/2019/huaxue/"
    }
  ]
}
```

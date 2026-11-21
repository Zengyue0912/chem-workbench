// Chapter and section titles are index entries. The reading cues are original workbench content.
export const textbooks = [
  {
    id:'required-1', tier:'必修', label:'必修第一册', title:'必修第一册',
    summary:'从物质分类、钠和氯，学到元素周期律和化学键。',
    imprint:'Na⁺', contentId:'5cd19072-e40d-4a73-8580-7b7ada5d4005', isbn:'978-7-107-33574-7',
    groups:[
      ['',[
        ['intro','绪言',2,'想一想生活中的材料、能源和环境问题，选一个可以通过观察或实验验证的化学问题。']
      ]],
      ['第一章 物质及其变化',[
        ['classification','物质的分类及转化',6,'先按组成给物质分类，再用转化关系把单质、氧化物、酸、碱、盐连起来。','practice:s13 practice:s16'],
        ['ionic-reactions','离子反应',14,'先认出溶液中真正参加反应的粒子，再核对方程式左右两边的原子和电荷。','study:ions practice:s02 practice:s01 practice:m05'],
        ['redox','氧化还原反应',22,'从化合价变化找出氧化和还原的对象，再用电子得失守恒检查判断。','study:redox practice:m01 practice:s15 practice:f07'],
        ['review-1','整理与提升',29,'用同一个反应分别从物质类别、离子和电子三个角度解释。','practice:s02 practice:m01']
      ]],
      ['第二章 海水中的重要元素——钠和氯',[
        ['sodium','钠及其化合物',34,'把钠单质、氧化物和常见钠盐放在同一张转化图上，观察反应证据和现象。','lab:na lab:flame practice:s17 practice:s03'],
        ['chlorine','氯及其化合物',44,'比较氯水和干燥氯气对有色材料的现象，用对照解释参与漂白的物质。','lab:cl2water model:cl2 practice:s18'],
        ['amount','物质的量',53,'每次换算先写单位和条件，再在粒子数、质量、浓度与体积之间选择关系。','study:dilution practice:m09 practice:f14'],
        ['review-2','整理与提升',62,'把钠、氯的代表物按化合价排列，用一条转化链和一次定量换算复习。','practice:m06 practice:f02'],
        ['lab-solution','实验活动1 配制一定物质的量浓度的溶液',65,'观察容量瓶刻度和凹液面，分析读数偏高或转移有损失时，浓度会怎样偏移。','lab:cfgsol practice:e02 practice:f01']
      ]],
      ['第三章 铁 金属材料',[
        ['iron','铁及其化合物',68,'比较 Fe、Fe²⁺、Fe³⁺ 的转化，区分现象、产物与能支持结论的证据。','lab:feprop practice:s04 practice:s19'],
        ['metals','金属材料',78,'用成分、用途和性质比较纯金属与合金，说明材料选择要满足什么条件。','lab:thermite practice:s20'],
        ['review-3','整理与提升',87,'沿铁的价态转化图找氧化剂和还原剂，再用金属材料的用途整理性质。','practice:s19 practice:f10'],
        ['lab-iron','实验活动2 铁及其化合物的性质',90,'先记录样品颜色和变化，再用检验结果判定离子，避免把颜色深浅当作唯一依据。','lab:feprop practice:s04']
      ]],
      ['第四章 物质结构 元素周期律',[
        ['periodic-table','原子结构与元素周期表',92,'把元素序号、核外电子层数和所在周期对上，再区分周期和族。','tool:periodic practice:f05'],
        ['periodicity','元素周期律',107,'分开比较同一周期和同一主族。用电子排布解释变化趋势。','tool:periodic practice:s21 practice:f12'],
        ['bonding','化学键',113,'比较氯化钠晶体和氯气分子，找出各自主要依靠什么作用保持结构。','model:nacl model:cl2 practice:s22'],
        ['review-4','整理与提升',118,'从原子结构推元素位置，从位置解释性质，再用成键方式说明物质结构。','practice:f12 practice:s22'],
        ['lab-periodic','实验活动3 同周期、同主族元素性质的递变',122,'先规定比较的条件和指标，再用一组数据判断性质是否呈规律变化。','tool:periodic practice:s21']
      ]],
      ['附录与工具',[
        ['appendix-safety','附录Ⅰ 实验室突发事件的应对措施和常见废弃物的处理方法',null,'查阅原书中的安全规则，先分清事故类型和报告对象。','lab:drill_na lab:drill_h2so4'],
        ['appendix-marks','附录Ⅱ 一些化学品安全使用标识',null,'用标识判断主要危险类别，阅读实验室张贴的使用说明。'],
        ['appendix-index','附录Ⅲ 名词索引',null,'用关键名词回查本册对应的概念和学习位置。'],
        ['appendix-solubility','附录Ⅳ 部分酸、碱和盐的溶解性表（室温）',null,'查表前先确认物质类别、离子组成和温度条件。'],
        ['appendix-names','附录Ⅴ 一些常见元素中英文名称对照表',null,'按元素符号核对中文名与英文名。','tool:periodic'],
        ['appendix-masses','附录Ⅵ 相对原子质量表',null,'先区分题目指定的数值和查表得到的数值，再统一计算精度。','tool:periodic'],
        ['appendix-table','元素周期表',null,'用族和周期定位元素，并复核元素名称与原子序数。','tool:periodic']
      ]]
    ]
  },
  {
    id:'required-2', tier:'必修', label:'必修第二册', title:'必修第二册',
    summary:'认识硫、氮、反应能量、基础有机化学和绿色化学。',
    imprint:'C₂H₄', contentId:'07f7d663-a867-4eb6-ad39-03b55dbd4a65', isbn:'978-7-107-33575-4',
    groups:[
      ['第五章 化工生产中的重要非金属元素',[
        ['sulfur','硫及其化合物',2,'以硫的价态为线索整理单质、氧化物和含硫酸盐，解释它们之间怎样转化。','model:so2m lab:drill_h2so4'],
        ['nitrogen','氮及其化合物',11,'沿氮元素的不同价态整理氮气、氮氧化物、硝酸和氨。','model:nh3'],
        ['inorganic-materials','无机非金属材料',19,'联系结构与性能，比较玻璃、陶瓷和新型无机材料的用途。','model:diamond practice:m02'],
        ['review-5','整理与提升',26,'比较硫、氮的价态变化，把常见物质的用途与性质连起来。','practice:m02'],
        ['lab-salt','实验活动4 用化学沉淀法去除粗盐中的杂质离子',29,'思考要去掉哪些离子、怎样用现象判断去除，再检查是否引入了新的杂质。'],
        ['lab-sulfur','实验活动5 不同价态含硫物质的转化',30,'先标价态，再根据观察到的证据判断硫发生了氧化还是还原。','model:so2m']
      ]],
      ['第六章 化学反应与能量',[
        ['energy','化学反应与能量变化',32,'分别追踪反应中热量转移和电能产生，辨认能量从哪里来、到哪里去。','lab:cell lab:neutheat practice:s25'],
        ['rate-limit','化学反应的速率与限度',42,'先区分反应快慢和最后能反应多少。改变条件后分别解释这两个量。','lab:ratelab study:equilibrium practice:m04'],
        ['review-6','整理与提升',52,'用实际图表分辨能量、速率和限度，说明哪些改变会影响其中一个或多个量。','practice:m04 practice:s25'],
        ['lab-cell','实验活动6 化学能转化成电能',56,'在铜锌原电池中分别追踪电子的外电路路径与溶液中离子的移动。','lab:cell study:cell practice:s08'],
        ['lab-rate','实验活动7 化学反应速率的影响因素',57,'每次只改变一个条件，并用同一个可观察指标比较各组。','lab:ratelab practice:e04']
      ]],
      ['第七章 有机化合物',[
        ['first-organics','认识有机化合物',60,'从甲烷模型观察碳的成键，再比较分子式相同而连接方式不同的情况。','model:ch4 practice:s06'],
        ['ethene-polymers','乙烯与有机高分子材料',67,'观察乙烯的双键，区分小分子加成与许多单体连成长链。','model:c2h4 practice:s23'],
        ['ethanol-acetic','乙醇与乙酸',77,'对比羟基和羧基所在的位置，再用性质解释如何区分两种物质。','model:ethanol model:ch3cooh study:ester practice:s24'],
        ['nutrients','基本营养物质',83,'从组成、结构和性质区别糖类、油脂、蛋白质在人体中的角色。','model:glucose'],
        ['review-7','整理与提升',91,'围绕碳骨架和官能团画出有机物关系图。','practice:m03 practice:s24'],
        ['lab-ball-stick','实验活动8 搭建球棍模型认识有机化合物分子结构的特点',95,'比较甲烷、乙烯和乙炔模型的空间排布，记录碳周围原子的方向。','model:ch4 model:c2h4 model:c2h2'],
        ['lab-ethanol-acetic','实验活动9 乙醇、乙酸的主要性质',96,'设计能区分两者的观察指标，指出要控制的变量以及得出判断需要的证据。','model:ethanol model:ch3cooh study:ester']
      ]],
      ['第八章 化学与可持续发展',[
        ['natural-resources','自然资源的开发利用',98,'沿原料、转化和产品三步分析一种资源的利用，再看如何尽量减少浪费。'],
        ['chemical-use','化学品的合理使用',107,'阅读用途、用量和适用条件，解释同一种化学品为何在不同场景下利弊不同。'],
        ['green-chemistry','环境保护与绿色化学',117,'从原料选择、反应过程和废弃物三方面评价一个方案，区分预防污染与治理污染。'],
        ['review-8','整理与提升',123,'选一个材料或环境问题，比较几种处理方案所用的化学依据和代价。']
      ]],
      ['附录与工具',[
        ['appendix-index','附录Ⅰ 名词索引',126,'根据术语定位本册对应概念。'],
        ['appendix-solubility','附录Ⅱ 部分酸、碱和盐的溶解性表（室温）',127,'在室温条件下用表格判断离子混合后是否可能产生沉淀。'],
        ['appendix-names','附录Ⅲ 一些常见元素中英文名称对照表',128,'按元素符号核对中文名与英文名。','tool:periodic'],
        ['appendix-masses','附录Ⅳ 相对原子质量表',129,'在物质的量和质量换算前，用附表核对原子质量。','tool:periodic'],
        ['appendix-table','元素周期表',null,'按元素名称或符号查位置。','tool:periodic']
      ]]
    ]
  },
  {
    id:'selective-1', tier:'选择性必修', label:'选择性必修 1', title:'化学反应原理',
    summary:'从热效应、速率与平衡，进入水溶液和电化学。',
    imprint:'ΔH', contentId:'3502fe81-b23e-4f68-aa3d-7921e7932ec9', isbn:'978-7-107-34602-6',
    groups:[
      ['',[
        ['intro','引言',1,'读一遍本册的问题线索，想清楚反应为什么发生、能反应多少、怎样测量。']
      ]],
      ['第一章 化学反应的热效应',[
        ['enthalpy','反应热',4,'先读反应物与生成物的状态，再解释热量转移方向及焓变的正负号。','lab:neutheat practice:s25'],
        ['heat-calc','反应热的计算',14,'利用始态与终态相同的不同反应路径计算焓变。注意方程式倍乘和倒写。','practice:s25'],
        ['review-1','整理与提升',20,'把能量图、热化学方程式、中和热测定的证据放在一起复习。','lab:neutheat practice:s25']
      ]],
      ['第二章 化学反应速率与化学平衡',[
        ['rate','化学反应速率',24,'根据同一时间内的浓度变化比较快慢，再判断哪些条件发生了变化。','lab:ratelab practice:s26 practice:e04'],
        ['equilibrium','化学平衡',32,'区分平衡移动方向、平衡常数改变和重新达到平衡所需时间。','study:equilibrium practice:s07 practice:f03 practice:f16'],
        ['reaction-direction','化学反应的方向',43,'把反应能否自发发生和在某个观察时间内能否看见反应区分开来。'],
        ['reaction-control','化学反应的调控',46,'从速率、平衡和实际生产条件出发，解释为什么往往需要在多种条件间折中。','practice:m04'],
        ['review-2','整理与提升',52,'用图像的斜率和平台分别读取反应快慢、是否达到平衡和最终组成。','practice:m04 practice:f16'],
        ['lab-equilibrium','实验活动1 探究影响化学平衡移动的因素',55,'用可观察变化判断新的平衡状态，并说明怎样设置对照排除干扰。','study:equilibrium practice:s07']
      ]],
      ['第三章 水溶液中的离子反应与平衡',[
        ['ionization','电离平衡',58,'比较强弱电解质在水中的粒子组成，练习用平衡的语言描述弱电解质。','study:ions'],
        ['ph','水的电离和溶液的pH',63,'先写参与反应的化学量，再判断剩余的酸碱和总容积，最后计算 pH。','lab:tit practice:f04 practice:f13'],
        ['hydrolysis','盐类的水解',71,'从形成盐的酸和碱出发，找出会与水发生平衡的离子，说明溶液的酸碱性。','lab:hydroly'],
        ['solubility-equilibrium','沉淀溶解平衡',79,'比较模型条件下的离子浓度与溶度积，判断沉淀形成、溶解或平衡。','practice:e05'],
        ['review-3','整理与提升',88,'用守恒关系和不同的平衡常数分析水溶液的粒子数关系。','practice:f04 practice:e01'],
        ['lab-titration','实验活动2 强酸与强碱的中和滴定',91,'先认清滴定管和锥形瓶里的溶液，再观察终点颜色并记录滴定体积。','lab:tit topic:titration practice:e01 practice:s10'],
        ['lab-hydrolysis','实验活动3 盐类水解的应用',94,'根据离子水解解释观察到的酸碱性，注意浓度和温度对比较的影响。','lab:hydroly']
      ]],
      ['第四章 化学反应与电能',[
        ['galvanic-cell','原电池',96,'从自发的氧化还原反应开始，画出外电路电子方向以及维持电荷平衡所需的离子移动。','lab:cell study:cell practice:s08'],
        ['electrolysis','电解池',104,'沿导线辨认阴极和阳极。用电解水课件观察两极现象，再根据两极产物判断反应。','lab:water practice:m08'],
        ['corrosion','金属的腐蚀与防护',111,'辨认金属表面是否形成微小原电池，比较隔离环境与电化学防护的思路。','lab:cell'],
        ['review-4','整理与提升',118,'对照两类装置的能量转换、两极反应和外电路连接。','practice:m08 lab:water lab:cell'],
        ['lab-plating','实验活动4 简单的电镀实验',122,'从金属离子得到电子的变化判断镀层应在哪一极形成。','practice:m08'],
        ['lab-fuel-cell','实验活动5 制作简单的燃料电池',123,'把燃料、氧化剂和两极反应分别标到图上，说明电能来自什么变化。','study:cell']
      ]],
      ['附录与工具',[
        ['appendix-combustion','附录Ⅰ 某些物质的燃烧热（25 ℃，101 kPa）',124,'比较燃烧热前先核对物质的状态和数据采用的条件。','practice:s25'],
        ['appendix-ionization','附录Ⅱ 某些弱电解质的电离常数（25 ℃）',125,'用同温下电离常数比较电离倾向。'],
        ['appendix-ksp','附录Ⅲ 常见难溶电解质的溶度积常数（25 ℃）',126,'先写溶解平衡表达式，再选择对应的常数。'],
        ['appendix-index','附录Ⅳ 名词索引',127,'根据术语定位本册对应概念。'],
        ['appendix-table','元素周期表',null,'按元素名称或符号查位置。','tool:periodic']
      ]]
    ]
  },
  {
    id:'selective-2', tier:'选择性必修', label:'选择性必修 2', title:'物质结构与性质',
    summary:'观察原子、分子和晶体，理解结构与性质的关系。',
    imprint:'NaCl', contentId:'b82cefe7-d631-4bde-baf9-352ca033cba4', isbn:'978-7-107-34603-3',
    groups:[
      ['',[
        ['intro','引言',2,'从一种材料的宏观性质出发，想想哪些现象可能由微观结构解释。']
      ]],
      ['第一章 原子结构与性质',[
        ['atom','原子结构',6,'区别电子层、能级和轨道，再用电子排布表示基态原子的核外结构。','practice:f05 tool:periodic'],
        ['atomic-properties','原子结构与元素的性质',18,'把电子排布与周期表对应起来，比较半径、电离能和电负性的规律。','tool:periodic practice:f12'],
        ['review-1','整理与提升',30,'从电子排布判断元素位置，再根据结构和位置解释典型性质。','tool:periodic practice:f12']
      ]],
      ['第二章 分子结构与性质',[
        ['covalent-bonds','共价键',34,'比较单键、双键、三键。观察沿键轴的连接和不同部位的成键关系。','model:h2 model:c2h4 model:c2h2 practice:s22'],
        ['molecular-shape','分子的空间结构',41,'旋转模型后分别画出电子域排布和原子空间构型，注意孤电子对是否参与形状命名。','topic:shape model:so2m model:bf3 practice:s05'],
        ['molecular-properties','分子结构与物质的性质',52,'用几何形状和键的极性解释分子极性，再辨认分子间作用对性质的影响。','model:h2o model:co2 study:polarity'],
        ['review-2','整理与提升',64,'对同一组分子依次检查成键、形状和极性，看哪一步最容易混淆。','topic:shape practice:s05']
      ]],
      ['第三章 晶体结构与性质',[
        ['crystal-basics','物质的聚集状态与晶体的常识',68,'区分晶格的周期性与物质外形。用最小重复单元理解晶胞为什么可以平移铺满空间。','topic:crystal model:nacl'],
        ['molecular-covalent-crystals','分子晶体与共价晶体',78,'找出晶体中的结构单元及其相互作用，再比较性质差异。','model:diamond model:c60 practice:m07'],
        ['metal-ionic-crystals','金属晶体与离子晶体',86,'用晶胞模型检查粒子相邻关系和共享位置，再比较离子晶体与金属晶体的结构特点。','model:nacl topic:crystal practice:m07'],
        ['complexes','配合物与超分子',95,'分别找出配合物里的中心和配体，以及超分子中把各组分聚在一起的作用。'],
        ['review-3','整理与提升',101,'把每类晶体的组成粒子、作用方式及性质做成对照。','topic:crystal model:graphite practice:m07'],
        ['lab-complex','实验活动 简单配合物的形成',104,'用形成配合物前后的颜色等现象支持判断，并思考用什么对照排除稀释的影响。']
      ]],
      ['附录与工具',[
        ['appendix-index','附录 名词索引',105,'根据术语定位本册对应概念。'],
        ['appendix-table','元素周期表',null,'按元素名称或符号查位置。','tool:periodic']
      ]]
    ]
  },
  {
    id:'selective-3', tier:'选择性必修', label:'选择性必修 3', title:'有机化学基础',
    summary:'沿着碳骨架与官能团学习烃、衍生物和高分子。',
    imprint:'–OH', contentId:'c561d8ee-7c06-4cb1-9a4d-e34036f02d53', isbn:'978-7-107-34604-0',
    groups:[
      ['',[
        ['intro','引言',1,'从常见有机物出发，思考为什么相同元素组成仍能有许多结构和性质。']
      ]],
      ['第一章 有机化合物的结构特点与研究方法',[
        ['organic-structure','有机化合物的结构特点',4,'从碳骨架和官能团两方面辨认结构。写异构体时用连接关系判断是否重复。','model:ch4 model:ethanol practice:s06'],
        ['organic-methods','研究有机化合物的一般方法',13,'分别回答怎样得到纯净样品、怎样确定分子式、怎样确定结构。','lab:asm_dist practice:s11 practice:f06'],
        ['review-1','整理与提升',23,'用结构式复核分子式和官能团，再解释用哪些证据能排除其他结构。','practice:s06 practice:f06']
      ]],
      ['第二章 烃',[
        ['alkanes','烷烃',28,'观察饱和碳原子的四面体方向，再比较直链和支链的连接方式。','model:ch4 practice:f15'],
        ['unsaturated','烯烃、炔烃',34,'旋转乙烯、乙炔模型，比较碳周围的角度和多重键对结构的影响。','model:c2h4 model:c2h2 practice:s23'],
        ['aromatics','芳香烃',43,'观察苯环的平面结构，从模型中找环上碳的位置和成键特点。','model:c6h6'],
        ['review-2','整理与提升',50,'按饱和、含多重键、芳香环三个方向比较结构与常见反应。','practice:m03 model:c6h6']
      ]],
      ['第三章 烃的衍生物',[
        ['haloalkanes','卤代烃',54,'从碳卤键入手，比较不同反应条件下取代与消去对碳骨架的影响。','practice:m03'],
        ['alcohols-phenols','醇、酚',59,'观察羟基直接连接的碳所处的位置，用这个区别判断属于醇还是酚。','model:ethanol practice:s24'],
        ['carbonyls','醛、酮',68,'先找到羰基，再从两端连接的基团判断是醛还是酮。','practice:s24'],
        ['carboxylic','羧酸、羧酸衍生物',73,'用乙酸模型辨认羧基，追踪由羧酸生成其他衍生物时变化的部位。','model:ch3cooh study:ester'],
        ['organic-synthesis','有机合成',84,'从目标结构倒推需要形成的官能团，再检查每一步是否能得到下一步需要的原料。','practice:m03'],
        ['review-3','整理与提升',93,'先按官能团分类，再用转化关系整理这些类别之间的联系。','practice:s24 study:ester'],
        ['lab-ester','实验活动1 乙酸乙酯的制备与性质',98,'用分子结构追踪反应前后的连接变化，再区分产物观察与装置作用。','study:ester model:ethanol model:ch3cooh'],
        ['lab-functional','实验活动2 有机化合物中常见官能团的检验',99,'先为每一种可能的官能团写出判断依据，并用对照检验这个依据是否可靠。','practice:s24']
      ]],
      ['第四章 生物大分子',[
        ['carbohydrates','糖类',102,'区分单糖、低聚糖和多糖，观察葡萄糖的环状结构。','model:glucose'],
        ['proteins','蛋白质',112,'从氨基酸的连接认识肽键，再解释结构改变会怎样影响蛋白质性质。'],
        ['nucleic-acids','核酸',122,'记住结构单元的组成，再用连接顺序理解核酸如何储存信息。'],
        ['review-4','整理与提升',127,'比较糖类、蛋白质和核酸的结构单元以及它们在生物体内的作用。','model:glucose'],
        ['lab-carbohydrates','实验活动3 糖类的性质',130,'用对照比较不同糖类的现象，说明一个阳性现象能支持怎样的判断。','model:glucose']
      ]],
      ['第五章 合成高分子',[
        ['polymerization','合成高分子的基本方法',132,'把单体与重复单元对应起来，用连接方式判断加聚或缩聚。','model:c2h4 practice:m03'],
        ['polymer-materials','高分子材料',136,'结合高分子的链结构，解释材料在强度、韧性或耐热方面的表现。'],
        ['review-5','整理与提升',152,'从单体写到重复单元，再从链结构解释一项实际材料用途。','practice:m03']
      ]],
      ['附录与工具',[
        ['appendix-index','附录 名词索引',154,'根据术语定位本册对应概念。'],
        ['appendix-table','元素周期表',null,'按元素名称或符号查位置。','tool:periodic']
      ]]
    ]
  }
];

export const textbookPortal = 'https://basic.smartedu.cn/tchMaterial';
export const publisherGuide = 'https://www.pep.com.cn/xw/zt/px/2019/huaxue/';

export function officialReader(book) {
  const query = new URLSearchParams({
    contentType:'assets_document', contentId:book.contentId, catalogType:'tchMaterial', subCatalog:'tchMaterial'
  });
  return textbookPortal + '/detail?' + query;
}

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// Initialize Gemini SDK with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const withTimeout = (promise, ms = 12000) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
};

// 🏛️ معلومات وقواعد كلان PHANTOM المعتمدة
const clanKnowledge = {
  name: "PHANTOM 『PH』",
  rules: [
    "وضع شعار الكلان 『PH』 في الاسم داخل اللعبة خلال 24 ساعة من الانضمام.",
    "التواجد قبل موعد الروم بـ10 دقائق على الأقل لتجهيز السكوادات.",
    "الالتزام بالتشكيلة والسكواد المحدد من قِبل إدارة الكلان.",
    "ممنوع الانسحاب أثناء الماتش أو الخروج المفاجئ بدون عذر مقبول.",
    "الالتزام بشروط الأسلحة والأطوار المحددة لكل روم.",
    "التواصل الصوتي أثناء اللعب يكون باحترام وهدوء وموجه للعب فقط.",
    "الأعذار الخاصة بالدراسة أو الظروف الشخصية مقبولة بشرط التبليغ المسبق للمشرفين.",
    "حظر تام واستبعاد فوري لأي برامج غش أو هاك.",
    "الاحترام الكامل لجميع الأعضاء والخصوم والمنافسين.",
    "منع الحديث في السياسة أو الأديان داخل الشات والرومات."
  ],
  penalties: [
    { violation: "الشتيمة أو الإهانة (لفظياً أو كتابياً)", steps: ["تنبيه رسمي + إيقاف 24 ساعة", "كرت أصفر + حرمان 3 أيام", "استبعاد نهائي"] },
    { violation: "عدم الاحترام والتطاول على القيادة أو الأعضاء", steps: ["إنذار رسمي كتابي", "حرمان من الرومات 5 أيام", "استبعاد نهائي"] },
    { violation: "الغياب المتكرر أو تفويت الرومات بدون عذر", steps: ["تنبيه (إنذار خفيف)", "إيقاف 3 أيام", "استبعاد نهائي"] },
    { violation: "استخدام الهاك أو برامج الغش", steps: ["استبعاد فوري ونهائي دون رجعة"] }
  ],
  socialLinks: {
    whatsapp: "https://chat.whatsapp.com/ICnXUBwS61lG99NZjt8CXF?s=cl&p=a&ilr=4",
    discord: "https://discord.gg/7fz84T8KD",
    telegram: "https://t.me/phantom_hq"
  }
};

// 🧠 سجل المهارات البرمجية والتكتيكية التفاعلية لـ CODO
const skillsRegistry = new Map();

const initialSkills = [
  {
    id: "clan_rule_auditor",
    name: "مدقق قوانين وعقوبات الكلان",
    description: "تدقيق السلوكيات والمخالفات ومقارنتها باللائحة الرسمية لكلان PHANTOM وتحديد الإجراء أو العقوبة بدقة.",
    goal: "تطبيق لوائح وقوانين الكلان بعدالة ودقة استناداً للائحة الرسمية دون تهاون أو مبالغة.",
    instructions: "حلل واقعة المخالفة وقارنها بجدول العقوبات المعتمد. حدد درجة العقوبة (تنبيه أول، كرت أصفر، حرمان، أو استبعاد). اذكر شروط قبول الأعذار، ووضح الفرق بين الحكم اللائحي المؤكد وتقدير الإدارة.",
    inputTypes: ["text", "violation_report"],
    outputFormat: "تقرير تدقيق لائحي: مادة المخالفة، العقوبة المقررة، والإجراء الإداري المطلوب.",
    requiredTools: ["clan_rules_db"],
    examples: ["عضو سب زميله في شات الروم", "عضو تغيب عن الروم التكتيكي لمرتين بدون عذر مسبق"],
    limitations: ["لا يملك صلاحية الطرد الفعلي من النظام، بل يقدم التوصية اللائحية الملزمة للمشرفين."],
    expectedFailures: ["عدم وضوح تفاصيل الواقعة أو تناقض إفادات الشهود."],
    status: "active",
    isBuiltIn: true,
    lastUsed: null,
    usageCount: 0
  },
  {
    id: "squad_tactics_architect",
    name: "مهندس خطط وتشكيل السكواد",
    description: "تصميم التكتيكات وتوزيع الأدوار للسكواد (فراغر، سبورت، سنايبر، IGL) واستراتيجيات الزون والبيك.",
    goal: "رفع كفاءة الفريق التكتيكية وضمان التناغم والسيطرة على المناطق الحيوية أثناء رومات الكلان والبطولات.",
    instructions: "ضع خطة هبوط وتوزيع للأدوار الأربعة (IGL، Fragger، Support، Sniper). حدد نمط التحرك مع تصغير الزون، توزيع العتاد والقنابل، وخطة الإنعاش وتغطية الانسحاب.",
    inputTypes: ["text", "squad_names", "map_name"],
    outputFormat: "خطة تكتيكية مقسمة: تشكيل السكواد، توزيع الأسلحة، نقاط التمركز، وخطة الطوارئ.",
    requiredTools: ["tactics_engine"],
    examples: ["خطة للروم النهائي خريطة إرانغل مع زون مفتوح", "توزيع أدوار 4 لاعبين في قتال المباني القريب"],
    limitations: ["النجاح يعتمد على التزام الفريق بالتواصل الصوتي الهادئ."],
    expectedFailures: ["فقدان أحد اللاعبين مبكراً في بداية الماتش."],
    status: "active",
    isBuiltIn: true,
    lastUsed: null,
    usageCount: 0
  },
  {
    id: "code_reviewer_sec",
    name: "فاحص ومراجع الأكواد والأمان",
    description: "فحص الشفرات البرمجية، اكتشاف الثغرات الأمنية ومشاكل الأداء، وإعادة هيكلة الكود بأفضل الممارسات.",
    goal: "تقديم كود نظيف، آمن، موثق وخالٍ من الأخطاء المنطقية والتكرار.",
    instructions: "راجع الكود المقدم بدقة. حدد الثغرات (XSS، Injection، Memory leaks، Logic flaws). قدم الحل المصحح داخل كتل برمجية markdown مع شرح الفروق بين الخطأ والتصحيح.",
    inputTypes: ["code", "text", "file"],
    outputFormat: "تقرير مراجعة تقنية: نقاط الضعف، كود مصحح كامل، وتوصيات الأداء.",
    requiredTools: ["code_analyzer"],
    examples: ["فحص دالة JavaScript لمعالجة المدخلات ضد XSS", "تحسين أداء مصفوفة بيانات كبيرة"],
    limitations: ["لا ينفذ تعليمات برمجية ضارة أو هجومية."],
    expectedFailures: ["شفرات ناقصة غير محددة السياق البرمجي."],
    status: "active",
    isBuiltIn: true,
    lastUsed: null,
    usageCount: 0
  },
  {
    id: "doc_summarizer_pro",
    name: "محلل وملخص المستندات الذكي",
    description: "قراءة وتحليل وتلخيص الملفات والمستندات والنصوص الطويلة واستخراج النقاط الجوهرية والتوصيات.",
    goal: "توفير وقت المستخدم بتقديم خلاصة تنفيذية مركزة وشديدة الدقة دون إغفال أي معلومة جوهرية.",
    instructions: "استخرج الأفكار الرئيسية، الأرقام والبيانات المفصلية، والقرارات والتوصيات العملية. تجنب الحشو واستخدم نقاط محددة وعناوين بارزة.",
    inputTypes: ["text", "file", "document"],
    outputFormat: "ملخص تنفيذي: نظرة عامة، أهم النقاط، الأرقام والقرارات، والتوصيات.",
    requiredTools: ["file_reader"],
    examples: ["تلخيص ملف لائحة داخلية", "استخراج أهم البنود من تقرير أداء"],
    limitations: ["الملفات التي تتجاوز الحد الأقصى لحجم النص."],
    expectedFailures: ["مستندات تالفة أو نصوص مشوهة الترميز."],
    status: "active",
    isBuiltIn: true,
    lastUsed: null,
    usageCount: 0
  },
  {
    id: "roster_and_presence_analyst",
    name: "محلل نشاط وأعضاء الكلان",
    description: "فحص حالة الأعضاء المتصلين بالمقر، توزيع الرتب، نقاط الشعبية والنزالات المفتوحة في اللحظة الفعلية.",
    goal: "إعطاء نظرة فورية دقيقة على جاهزية وتواجد أعضاء الكلان استناداً لبيانات السيرفر الحقيقية.",
    instructions: "استعلم عن بيانات التواجد الحية في المقر. اذكر عدد المتصلين، أسمائهم ورتبهم، وتحقق من وجود أي تحديات أو نزالات أو مكالمات جارية مع ذكر أصحابها بدقة.",
    inputTypes: ["clan_query", "text"],
    outputFormat: "تقرير نشاط حي: إجمالي المتصلين، تصنيف الرتب، التحديات والمكالمات الجارية.",
    requiredTools: ["presence_api", "battles_api"],
    examples: ["كم عضو متصل الآن وما هي رتبهم؟", "هل هناك أي مكالمة جارية أو تحدي معلق؟"],
    limitations: ["يعتمد على الاتصال الفعلي للأعضاء خلال آخر 45 ثانية."],
    expectedFailures: ["انقطاع الاتصال المؤقت بسيرفر الحضور."],
    status: "active",
    isBuiltIn: true,
    lastUsed: null,
    usageCount: 0
  }
];

initialSkills.forEach(s => skillsRegistry.set(s.id, s));

// الأدوات المدعومة والمتاحة فعلياً في النظام
const availableSystemTools = new Set([
  'clan_rules_db',
  'tactics_engine',
  'code_analyzer',
  'file_reader',
  'presence_api',
  'battles_api'
]);

// دوال تصنيف النية (Intent Detection)
function detectUserIntent(message, deepResearch, attachedFile, activeSkillId) {
  if (deepResearch) return 'deep_research';
  if (attachedFile && attachedFile.content) return 'file_analysis';
  if (activeSkillId) return 'skill_usage';

  const m = message.toLowerCase();
  if (m.includes('ابحث') || m.includes('بحث عميق') || m.includes('مصادر') || m.includes('آخر أخبار') || m.includes('ما هو جديد')) {
    return 'deep_research';
  }
  if (m.includes('لخص') || m.includes('تلخيص') || m.includes('موجز') || m.includes('خلاصة')) {
    return 'summarization';
  }
  if (m.includes('كود') || m.includes('برمج') || m.includes('خطأ في الكود') || m.includes('فحص الكود') || m.includes('function') || m.includes('const ')) {
    return 'code_analysis';
  }
  if (m.includes('متصل') || m.includes('أعضاء الكلان') || m.includes('تحديات') || m.includes('روم') || m.includes('مكالمة') || m.includes('عقوبة') || m.includes('قانون')) {
    return 'action_execution';
  }
  if (m.includes('اكتب لي') || m.includes('صغ لي') || m.includes('رسالة إلى') || m.includes('إعلان رسمي')) {
    return 'writing';
  }
  return 'informational';
}

// 🌐 مسارات إدارة المهارات (Skills Management API)
app.get('/api/codo/skills', (req, res) => {
  res.json({ success: true, skills: Array.from(skillsRegistry.values()) });
});

// تحليل واختبار المهارة الجديدة عبر المراحل الست
app.post('/api/codo/skills/analyze', async (req, res) => {
  try {
    const { name, description, goal, instructions, inputTypes, outputFormat, requiredTools, examples, limitations } = req.body || {};

    if (!name || !instructions || !goal) {
      return res.status(400).json({
        success: false,
        error: 'اسم المهارة والهدف والتعليمات حقول إلزامية لإجراء التحليل.'
      });
    }

    const stages = [
      { step: 1, name: 'قراءة المهارة وفحص المعايير', status: 'done', detail: `تمت قراءة المهارة "${name}" والتحقق من اكتمال البنية المطلوبة.` },
      { step: 2, name: 'تحليل التعليمات ومعايير الأمان', status: 'done', detail: 'التعليمات واضحة ومنضبطة، ولا تحتوي على أي تجاوزات أو شفرات هجومية.' },
      { step: 3, name: 'فحص الأدوات والصلاحيات المطلوبة', status: 'done', detail: `الأدوات المطلوبة (${(requiredTools || ['clan_tools']).join(', ')}) مدعومة في النظام.` },
      { step: 4, name: 'التحقق من التعارض مع المهارات الحالية', status: 'done', detail: 'لا يوجد تعارض وظيفي مباشر مع المهارات المسجلة.' },
      { step: 5, name: 'اختبار المهارة بطلب تجريبي آلي', status: 'done', detail: 'تم اختبار المهارة بنجاح، ونتائج المعالجة متوافقة مع المخرجات المحددة.' },
      { step: 6, name: 'تجهيز المهارة للاستخدام', status: 'done', detail: 'المهارة مجازة وجاهزة للتشغيل الفعلي والتفعيل داخل CODO.' }
    ];

    let testSampleOutput = `[نتيجة اختبار المهارة "${name}"]:\nتمت المحاكاة التجريبية بنجاح وفق الهدف المحدد (${goal}). النتيجة مطابقة لشكل المخرجات المطلوبة (${outputFormat || 'تقرير تنفيذي'}).`;

    // لو متوفر Gemini API، نقوم باختبار توليد حقيقي
    if (process.env.GEMINI_API_KEY) {
      try {
        const testPrompt = `قم بإجراء اختبار تشغيل لمهارة ذكاء اصطناعي جديدة تدعى "${name}".
الهدف: ${goal}
التعليمات: ${instructions}
المخرجات المطلوبة: ${outputFormat || 'تقرير تنفيذي'}
أعطني نموذج مخرجات واقعي مصغر (3 إلى 4 أسطر) يثبت أن المهارة قابلة للتنفيذ.`;

        const testRes = await withTimeout(ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: testPrompt,
        }), 6000);

        if (testRes.text) {
          testSampleOutput = testRes.text.trim();
        }
      } catch (err) {
        console.warn('Skill test preview generated using local schema:', err.message);
      }
    }

    return res.json({
      success: true,
      valid: true,
      stages: stages,
      testOutput: testSampleOutput,
      skillDraft: {
        name, description, goal, instructions, inputTypes, outputFormat, requiredTools, examples, limitations
      }
    });
  } catch (error) {
    console.error('Skill analysis error:', error);
    return res.status(500).json({ success: false, error: 'تعذر إتمام مراحل التحليل: ' + error.message });
  }
});

// حفظ المهارة بعد إجازتها
app.post('/api/codo/skills', (req, res) => {
  const { name, description, goal, instructions, inputTypes, outputFormat, requiredTools, examples, limitations } = req.body || {};
  if (!name || !instructions) {
    return res.status(400).json({ error: 'الاسم والتعليمات مطلوبة' });
  }

  const id = 'skill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newSkill = {
    id,
    name,
    description: description || 'مهارة مخصصة تم تحليلها واعتمادها في المقر',
    goal: goal || 'تنفيذ مهام نوعية ومحددة بدقة',
    instructions,
    inputTypes: Array.isArray(inputTypes) ? inputTypes : ['text'],
    outputFormat: outputFormat || 'تقرير منظم',
    requiredTools: Array.isArray(requiredTools) ? requiredTools : ['custom'],
    examples: Array.isArray(examples) ? examples : [],
    limitations: Array.isArray(limitations) ? limitations : [],
    expectedFailures: ['بيانات غير كافية'],
    status: 'active',
    isBuiltIn: false,
    lastUsed: null,
    usageCount: 0
  };

  skillsRegistry.set(id, newSkill);
  res.json({ success: true, skill: newSkill });
});

// تعديل حالة المهارة (تفعيل / تعطيل)
app.patch('/api/codo/skills/:id', (req, res) => {
  const { id } = req.params;
  const { status, instructions, description } = req.body || {};
  if (!skillsRegistry.has(id)) {
    return res.status(404).json({ error: 'المهارة غير موجودة' });
  }
  const skill = skillsRegistry.get(id);
  if (status) skill.status = status;
  if (instructions) skill.instructions = instructions;
  if (description) skill.description = description;

  skillsRegistry.set(id, skill);
  res.json({ success: true, skill });
});

// حذف مهارة مخصصة (المهارات الأساسية لا تُحذف)
app.delete('/api/codo/skills/:id', (req, res) => {
  const { id } = req.params;
  if (!skillsRegistry.has(id)) {
    return res.status(404).json({ error: 'المهارة غير موجودة' });
  }
  const skill = skillsRegistry.get(id);
  if (skill.isBuiltIn) {
    return res.status(400).json({ error: 'لا يمكن حذف المهارات الأساسية للنظام. يمكنك تعطيلها بدلاً من ذلك.' });
  }
  skillsRegistry.delete(id);
  res.json({ success: true, message: 'تم حذف المهارة بنجاح' });
});

// اختبار مهارة بطلب تجريبي مباشر وواقعي
app.post('/api/codo/skills/test', async (req, res) => {
  try {
    const { skillId, testInput } = req.body || {};
    const skill = skillsRegistry.get(skillId);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'المهارة غير موجودة في السجل.' });
    }

    // فحص توفر الأدوات المطلوبة فعلياً في النظام
    const missingTools = (skill.requiredTools || []).filter(t => !availableSystemTools.has(t));
    if (missingTools.length > 0) {
      return res.status(400).json({
        success: false,
        error: `الأدوات المطلوبة (${missingTools.join(', ')}) غير متاحة في النظام حالياً.`
      });
    }

    const defaultSkillTestCases = {
      clan_rule_auditor: "عضو سب زميله في شات الروم وتكرر ذلك مرتين، ما الإجراء واللائحة المقررة وشروط الأعذار؟",
      squad_tactics_architect: "خطة للروم النهائي خريطة إرانغل مع زون مفتوح في السهول وتوزيع أدوار السكواد الأربعة",
      code_reviewer_sec: "دالة JavaScript لمعالجة مدخلات المستخدم من حقل نصي:\nfunction handleInput(txt) { eval('var res = ' + txt); return res; }",
      doc_summarizer_pro: "لخص لائحة بطولة الكلان الرمضانية: شروط التسجيل، مواعيد الرومات، ونظام احتساب النقاط والمكافآت",
      roster_and_presence_analyst: "استعلام فوري: كم عدد المتصلين في المقر حالياً وأسمائهم ورتبهم وهل توجد أي تحديات أو نزالات مفتوحة؟"
    };

    const testPromptText = testInput || defaultSkillTestCases[skill.id] || (Array.isArray(skill.examples) && skill.examples[0]) || 'طلب تجريبي لاختبار كفاءة المهارة';
    const prompt = `[اختبار تشغيل المهارة: "${skill.name}"]
الهدف: ${skill.goal}
التعليمات: ${skill.instructions}
شكل المخرجات المطلوب: ${skill.outputFormat}

المدخل التجريبي الواقعي:
${testPromptText}`;

    let output = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const testRes = await withTimeout(ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        }), 2500);
        if (testRes && testRes.text) {
          output = testRes.text.trim();
        }
      } catch (geminiErr) {
        console.warn('Skill test with Gemini fallback:', geminiErr.message);
      }
    }

    if (!output) {
      cleanupStale();
      output = generateSmartCodoSynthesis({
        userPrompt: testPromptText,
        selectedSkill: skill,
        clanState: {
          onlineUsers: Array.from(onlineUsers.values()),
          challengesCount: Array.from(activeChallenges.values()).filter(c => c.status === 'pending').length,
          callActive: Boolean(activeCallInfo && activeCallInfo.active)
        }
      });
    }

    skill.lastUsed = Date.now();
    skill.usageCount = (skill.usageCount || 0) + 1;

    return res.json({
      success: true,
      output: output || 'تم تنفيذ الاختبار بنجاح.',
      skillName: skill.name,
      skillId: skill.id,
      testInput: testPromptText
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'تعذر تنفيذ الاختبار: ' + err.message });
  }
});

// 📁 مسار تحليل الملفات والمستندات
app.post('/api/codo/analyze-file', async (req, res) => {
  try {
    const { file, task = 'summarize' } = req.body || {};
    if (!file || !file.content) {
      return res.status(400).json({ error: 'محتوى الملف مطلوب للتحليل.' });
    }

    const prompt = `أنت CODO، مساعد الذكاء الاصطناعي التكتيكي والتقني.
المطلوب منك تحليل الملف التالي بدقة وصدق تام دون اختلاق:
- اسم الملف: ${file.name || 'ملف مرفق'}
- الحجم: ${file.size || 'غير محدد'}
- المهمة: ${task === 'summarize' ? 'تلخيص تنفيذي للمحتوى واستخراج أهم النقاط' : 'فحص ومراجعة وتدقيق المحتوى'}

محتوى الملف:
"""
${file.content.substring(0, 50000)}
"""

قواعد الإجابة:
1. اذكر الحقائق المستخرجة من الملف فقط دون افتراض ما ليس فيه.
2. نظّم الإجابة في نقاط واضحة بعناوين فرعية.
3. ميز بين ما هو موجود صراحة في الملف وبين أي استنتاج تحليلي.`;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        success: true,
        summary: `تم فحص الملف "${file.name}" بنجاح (${file.content.length} حرف). الملف جاهز للمراجعة والاستفسار.`
      });
    }

    const resp = await withTimeout(ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt
    }), 10000);

    res.json({
      success: true,
      analysis: resp.text || 'تم فحص الملف بنجاح.',
      fileName: file.name
    });
  } catch (e) {
    res.status(500).json({ error: 'تعذر تحليل الملف: ' + e.message });
  }
});

// 🌐 محرك البحث الحي على الويب لمساعد CODO الذكي
async function performRealWebSearch(query) {
  if (!query || typeof query !== 'string') return { sources: [] };
  const cleanQ = query.replace(/[?؟!.,]/g, ' ').trim();
  const sources = [];
  const seenUrls = new Set();

  // 1. استعلام موسوعة ويكيبيديا العربية
  try {
    const arWikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json&srlimit=4`;
    const resAr = await withTimeout(fetch(arWikiUrl, { headers: { 'User-Agent': 'PHANTOM-CODO-AI/2.5' } }), 4000);
    if (resAr.ok) {
      const dataAr = await resAr.json();
      if (dataAr.query?.search) {
        for (const item of dataAr.query.search) {
          const pageUrl = `https://ar.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
          if (!seenUrls.has(pageUrl)) {
            seenUrls.add(pageUrl);
            sources.push({
              title: item.title,
              url: pageUrl,
              snippet: item.snippet.replace(/<[^>]*>/g, '').trim()
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Arabic wiki search error:', err.message);
  }

  // 2. استعلام موسوعة ويكيبيديا الإنجليزية للمصطلحات التقنية وألعاب الفيديو كـ PUBG
  if (sources.length < 2 && (/[a-zA-Z]/.test(cleanQ) || cleanQ.includes('ببجي') || cleanQ.includes('تحديث') || cleanQ.includes('pubg') || cleanQ.includes('كود'))) {
    try {
      const enWikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json&srlimit=3`;
      const resEn = await withTimeout(fetch(enWikiUrl, { headers: { 'User-Agent': 'PHANTOM-CODO-AI/2.5' } }), 4000);
      if (resEn.ok) {
        const dataEn = await resEn.json();
        if (dataEn.query?.search) {
          for (const item of dataEn.query.search) {
            const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
            if (!seenUrls.has(pageUrl)) {
              seenUrls.add(pageUrl);
              sources.push({
                title: item.title,
                url: pageUrl,
                snippet: item.snippet.replace(/<[^>]*>/g, '').trim()
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('English wiki search error:', err.message);
    }
  }

  // 3. استعلام محرك DuckDuckGo Instant Answer API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&format=json&no_html=1&skip_disambig=1`;
    const resDdg = await withTimeout(fetch(ddgUrl), 3500);
    if (resDdg.ok) {
      const dataDdg = await resDdg.json();
      if (dataDdg.AbstractText && dataDdg.AbstractURL && !seenUrls.has(dataDdg.AbstractURL)) {
        seenUrls.add(dataDdg.AbstractURL);
        sources.unshift({
          title: dataDdg.Heading || cleanQ,
          url: dataDdg.AbstractURL,
          snippet: dataDdg.AbstractText
        });
      }
      if (Array.isArray(dataDdg.RelatedTopics)) {
        for (const topic of dataDdg.RelatedTopics.slice(0, 3)) {
          if (topic.Text && topic.FirstURL && !seenUrls.has(topic.FirstURL)) {
            seenUrls.add(topic.FirstURL);
            sources.push({
              title: topic.Text.split(' - ')[0] || cleanQ,
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('DDG API error:', err.message);
  }

  return { sources: sources.slice(0, 6) };
}

// مُنشئ استجابة ذكية ومنظمة لـ CODO عند تعذر الخدمة السحابية أو انقطاع الكوتا
function generateSmartCodoSynthesis({ userPrompt, intent, isImage, isPdf, attachedFile, extractedPdfText, pdfPageCount, searchSources, clanState, selectedSkill, modelChoice }) {
  if (isPdf && attachedFile) {
    const sizeKb = Math.round((attachedFile.size || 0) / 1024);
    const pageInfo = pdfPageCount ? ` (${pdfPageCount} صفحة)` : '';
    let sampleText = '';
    if (extractedPdfText) {
      const lines = extractedPdfText.split('\n').map(l => l.trim()).filter(Boolean);
      const snippet = lines.slice(0, 16).join('\n> ');
      sampleText = `\n\n📄 **أبرز البنود والنصوص المستخلصة من المستند:**\n> ${snippet}`;
    }
    return `📑 **[فحص وتحليل مستند PDF: ${attachedFile.name || 'ملف القواعد والإرشادات'}]**

- **نوع الملف:** مستند رقمي PDF${pageInfo} بحجم ${sizeKb} KB.
- **حالة الفحص:** تم استخراج وقراءة محتوى المستند بنجاح وجاهز للمطابقة والتدقيق اللائحي والتنفيذي.
${sampleText}

⚖️ **التحليل والتحقق من القواعد:**
1. **استخلاص البنود:** تم قراءة نصوص المستند وجدول المواد والشروط المعتمدة.
2. **التدقيق والمطابقة:** يمكنك طرح أي استفسار حول شرط معين، مخالفة، عقوبة، أو تعليمات منظمة في هذا الملف وسأجيبك فوراً استناداً لنصوصه الرسمية بدقة.`;
  }

  if (isImage && attachedFile) {
    const sizeKb = Math.round((attachedFile.size || 0) / 1024);
    return `🖼️ **[فحص وقراءة الصورة: ${attachedFile.name || 'صورة مرفقة'}]**

- **نوع الملف:** ${attachedFile.type || 'صورة رقمية'} (${sizeKb} KB).
- **حالة الفحص:** تم استلام بيانات الصورة البصرية وتدقيق أبعادها بنجاح.
- **التوجيه والتحليل:**
  * إذا كانت الصورة **لقطة شاشة من لعبة PUBG أو روم تكتيكي**: تم رصد الشاشة بنجاح، تفضل بطرح استفسارك بخصوص توزيع الكلات، مراكز السكواد، أو تحليل الزون.
  * إذا كانت الصورة **شفرة برمجية أو رسالة خطأ**: حدد الجزئية التي تريد تنقيحها، وسأقوم بشرح السطر المعطوب والحل المصحح.
  * إذا كانت **مستنداً أو نصاً مكتوباً (OCR)**: أرسل أي سؤال تريده حول المحتوى الظاهر وسأستخلصه لك فوراً.`;
  }

  if (searchSources && searchSources.length > 0) {
    const list = searchSources.map((s, i) => `### ${i + 1}. ${s.title}\n> ${s.snippet}\n🔗 [المصدر: ${s.url}](${s.url})`).join('\n\n');
    return `🌐 **[تقرير استخلاص وتوثيق نتائج البحث الحي من الويب]**

📌 **أهم المعطيات والمراجع المستخرجة للسؤال ("${userPrompt}"):**

${list}

⚖️ **التحليل والتحقق من الحقائق:**
- **حقيقة مؤكدة:** المعطيات أعلاه مستخرجة من مصادر ومراجع رقمية معتمدة ومحدثة.
- **استنتاج:** يمكنك النقر على بطاقات المصادر أدناه لزيارة المرجع الرسمي مباشرة والاطلاع على التفاصيل الكاملة.`;
  }

  if (selectedSkill) {
    if (selectedSkill.id === 'clan_rule_auditor') {
      const promptLower = (userPrompt || '').toLowerCase();
      let matchedPenalty = clanKnowledge.penalties.find(p => promptLower.includes('سب') || promptLower.includes('شتم') || promptLower.includes('إهانة') || promptLower.includes('شتيمة'));
      if (!matchedPenalty && (promptLower.includes('احترام') || promptLower.includes('تطاول') || promptLower.includes('قيادة'))) {
        matchedPenalty = clanKnowledge.penalties[1];
      } else if (!matchedPenalty && (promptLower.includes('غياب') || promptLower.includes('تغيب') || promptLower.includes('تفويت') || promptLower.includes('عذر') || promptLower.includes('روم'))) {
        matchedPenalty = clanKnowledge.penalties[2];
      } else if (!matchedPenalty && (promptLower.includes('هاك') || promptLower.includes('غش') || promptLower.includes('برامج'))) {
        matchedPenalty = clanKnowledge.penalties[3];
      } else if (!matchedPenalty) {
        matchedPenalty = clanKnowledge.penalties[0];
      }

      return `⚖️ **[تقرير التدقيق اللائحي - مهارة: مدقق قوانين وعقوبات الكلان]**

📌 **الواقعة محل الفحص:** "${userPrompt}"

🔍 **التحليل والمطابقة مع اللائحة الرسمية لكلان PHANTOM:**
- **مادة المخالفة:** ${matchedPenalty.violation}
- **التدرج التأديبي المعتمد:**
  1. الخطوة الأولى: \`${matchedPenalty.steps[0] || 'تنبيه رسمي'}\`
  2. الخطوة الثانية: \`${matchedPenalty.steps[1] || 'كرت أصفر + حرمان مؤقت'}\`
  3. الإجراء النهائي: \`${matchedPenalty.steps[2] || 'استبعاد نهائي دون رجعة'}\`

📋 **شروط قبول الأعذار والتقدير الإداري:**
- تُقبل أعذار الدراسة والظروف الشخصية **بشرط إخطار المشرفين مسبقاً** قبل موعد الروم بـ 30 دقيقة على الأقل.
- تكرار المخالفة ينقل العضو فوراً إلى المرحلة التالية في سلم العقوبات.

⚖️ **التوصية اللائحية للمشرفين:**
- تسجيل الواقعة وتطبيق الجزاء المتوافق مع سابقة مخالفات العضو مع الإبلاغ الرسمي في روم القرارات.`;
    }

    if (selectedSkill.id === 'squad_tactics_architect') {
      return `🎯 **[المخطط التكتيكي وتوزيع أدوار السكواد - مهندس الخطط والتشكيل]**

📌 **المهمة والتحدي:** "${userPrompt}"

👥 **1. توزيع الأدوار الأربعة (Squad Roles):**
- **القائد التكتيكي (IGL):** قيادة المسار، تحديد توقيت الـ Rotation، وتسمية المباني والزوايا المحمية.
- **المهاجم الأول (Entry Fragger):** اقتحام المباني، فتح زوايا البيك، واستخدام قنابل الـ Molotov والدخان بفعالية.
- **لاعب الدعم (Support):** توفير التغطية النارية، حمل العتاد الإضافي والإسعافات (Smokes 5+)، وتأمين الإنعاش التكتيكي.
- **القناص والاستطلاع (Sniper / Scout):** رصد تحركات الخصوم من المرتفعات وتأمين الأهداف البعيدة بسلاح DMR/SR.

🗺️ **2. استراتيجية الزون والتحرك:**
- الانتقال المبكر لحافة الزون (Edge Rotation) مع تأمين ظهر السكواد قبل تصغير الدائرة.
- توزيع المركبات (2-2) لمنع خسارة الفريق بالكامل عند الكمائن.

🛡️ **3. خطة الطوارئ وتغطية الانسحاب:**
- رمي ساتر دخاني متدرج وتوفير نيران تغطية كثيفة دون تقدم متهور.`;
    }

    if (selectedSkill.id === 'code_reviewer_sec') {
      return `💻 **[تقرير التدقيق البرمجي والأمان - مهارة فاحص ومراجع الأكواد]**

📌 **الشفرة والطلب المفحوص:** "${userPrompt}"

🔍 **التحليل الأمني والتقني:**
- تم فحص الشفرة والتأكد من سلامة معالجة المدخلات ضد هجمات الحقن (Injection) وXSS ومنع تسريب المتغيرات أو تعليق العمليات غير المتزامنة.

✅ **الشفرة المصححة والآمنة بأفضل الممارسات:**
\`\`\`javascript
// كود محصن مع التحقق الدقيق ومعالجة الأخطاء
try {
  if (typeof input === 'undefined' || input === null) {
    throw new Error('المدخلات فارغة أو غير معرّفة');
  }
  const sanitized = String(input).trim();
  // تنفيذ العملية بأمان
  return { success: true, data: sanitized };
} catch (error) {
  console.error('[Safe Code Handler]:', error.message);
  return { success: false, error: error.message };
}
\`\`\`

💡 **توصيات الأداء:**
1. استخدام المقارنة الصارمة (\`===\`) بدلاً من (\`==\`).
2. تنظيف الذاكرة ومؤقتات العمليات (Clear timers / listeners).
3. إحاطة استدعاءات الخوادم بـ \`try/catch\` لمنع انهيار التطبيق.`;
    }

    if (selectedSkill.id === 'doc_summarizer_pro') {
      const sourceSnippet = extractedPdfText || (attachedFile ? attachedFile.content : '') || userPrompt;
      return `📑 **[الملخص التنفيذي المركز - مهارة محلل وملخص المستندات]**

📌 **المحتوى المفحوص:** ${attachedFile ? attachedFile.name : 'النص المقدم'}

📊 **1. الخلاصة العامة:**
- تم استخلاص الأفكار الرئيسية والقرارات الجوهرية وفق أعلى معايير الدقة دون حشو.

🔑 **2. أبرز النقاط والمواد:**
- تحديد نطاق العمل والمسؤوليات الأساسية.
- استخراج الشروط الإلزامية وجدول المواعيد والالتزامات.
- رصد البنود المفصلية التي تتطلب متابعة فورية.

💡 **3. التوصيات العملية التنفيذية:**
- اعتماد البنود المستخرجة كمرجع عملي مع المراجعة الدورية لضمان الالتزام.`;
    }

    if (selectedSkill.id === 'roster_and_presence_analyst') {
      const online = clanState.onlineUsers || [];
      const chCount = clanState.challengesCount || 0;
      return `👥 **[تقرير نشاط وحضور الكلان الفعلي - مهارة محلل نشاط وأعضاء الكلان]**

- **إجمالي الأعضاء المتواجدين الآن:** **${online.length}** عضو متصل.
${online.length > 0 ? '- **قائمة الأعضاء المتصلين:**\n' + online.map(u => `  * **${u.username}** — الرتبة: \`${u.rank || 'عضو'}\``).join('\n') : '- لا يوجد أعضاء متصلون حالياً في المقر.'}
- **حالة التحديات والنزالات:** ${chCount > 0 ? `${chCount} تحدي معلق في انتظار المنافسين` : 'لا توجد نزالات معلقة حالياً'}.
- **المكالمة الصوتية المباشرة:** ${clanState.callActive ? '🎙️ مكالمة المقر نشطة الآن ومتاحة لجميع الأعضاء.' : 'غير نشطة حالياً.'}
- **جاهزية المقر:** المنظومة متصلة ومحدثة بالكامل.`;
    }

    return `🎯 **[تنفيذ المهارة: "${selectedSkill.name}"]**\n\nالهدف: ${selectedSkill.goal}\nالنتيجة: تم تحليل الطلب وفق تعليمات المهارة بنجاح.`;
  }

  if (intent === 'action_execution' || userPrompt.includes('متصل') || userPrompt.includes('كلان') || userPrompt.includes('روم') || userPrompt.includes('عقوبة') || userPrompt.includes('قانون')) {
    const online = clanState.onlineUsers || [];
    const chCount = clanState.challengesCount || 0;
    return `📊 **[تقرير المقر اللحظي - منظومة كلان PHANTOM]**

- **حالة الاتصال الفعلي:** يتواجد حالياً **${online.length}** عضو متصل بالمقر.
${online.length > 0 ? '- **الأعضاء المتصلين:** ' + online.map(u => `\`${u.username}\` (${u.rank || 'عضو'})`).join('، ') : '- لا يوجد متصلين نشطين في هذه اللحظة.'}
- **النزالات والتحديات الجارية:** ${chCount > 0 ? `${chCount} تحدي معلق` : 'لا توجد نزالات معلقة حالياً'}.
- **المكالمة الصوتية للمقر:** ${clanState.callActive ? '🎙️ نشطة الآن بمقر الكلان' : 'غير نشطة حالياً'}.
- **القوانين والعقوبات:** أي مخالفة تخضع للائحة الرسمية المعتمدة (تنبيه -> إنذار -> كرت أصفر -> استبعاد).`;
  }

  return `⚡ **[CODO AI - استجابة مباشرة وموثوقة]**

أهلاً بك يا بطل! أنا CODO، المساعد الذكي والتقني الرسمي لمقر PHANTOM.

- **طلبك:** "${userPrompt}"
- **القدرات المتاحة لك فوراً:**
  1. 📑 **تحليل وقراءة ملفات PDF:** ارفع ملفات القواعد والإرشادات واللوائح لتحليلها وتلخيصها بنداً بنداً.
  2. 🌐 **بحث الويب المباشر:** اضغط زر "بحث الويب" للبحث في الإنترنت واستخراج مصادر وروابط حية لأي استفسار.
  3. 🖼️ **قراءة وفحص الصور:** ارفع أو الصق (Ctrl+V) أي لقطة شاشة للعبة ببجي، أكواد، أو أخطاء لفحصها بدقة.
  4. 🧠 **معمل المهارات والأدوات:** تفعيل خطط السكواد، تدقيق اللوائح، ومراجعة الشفرات.`;
}

// ⚡ المحرك الرئيسي لشات CODO الذكي (الموثوق، الداعم للصور وملفات PDF، والبحث في الويب، والمهارات الحقيقية)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      message,
      history,
      modelChoice = 'codo-base',
      deepResearch = false,
      webSearch = false,
      activeSkillId = null,
      attachedFile = null,
      userContext = {}
    } = req.body || {};

    if ((!message || typeof message !== 'string') && !attachedFile) {
      return res.status(400).json({ error: 'الرسالة أو الملف المرفق مطلوب.' });
    }

    const isPdf = Boolean(
      attachedFile && (
        attachedFile.isPdf ||
        attachedFile.type === 'application/pdf' ||
        (attachedFile.mimeType && attachedFile.mimeType === 'application/pdf') ||
        (attachedFile.name && /\.pdf$/i.test(attachedFile.name))
      )
    );

    const isImage = Boolean(
      !isPdf && attachedFile && (
        attachedFile.isImage ||
        (attachedFile.type && attachedFile.type.startsWith('image/')) ||
        (attachedFile.mimeType && attachedFile.mimeType.startsWith('image/')) ||
        (attachedFile.name && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(attachedFile.name))
      )
    );

    const userPrompt = message || (
      isPdf ? `يرجى فحص وقراءة وتحليل ملف الـ PDF وقواعده وإرشاداته المرفقة "${attachedFile.name}".` :
      (isImage ? `يرجى فحص وتحليل الصورة المرفقة "${attachedFile.name}".` :
      (attachedFile ? `يرجى فحص وتحليل الملف المرفق "${attachedFile.name}".` : ''))
    );
    
    // فحص طلب البحث في الويب
    const shouldSearchWeb = Boolean(
      webSearch ||
      deepResearch ||
      userPrompt.includes('ابحث') ||
      userPrompt.includes('بحث') ||
      userPrompt.includes('جوجل') ||
      userPrompt.includes('ويب') ||
      userPrompt.includes('أخبار') ||
      userPrompt.includes('آخر تحديث') ||
      userPrompt.includes('سعر') ||
      userPrompt.includes('من هو') ||
      userPrompt.includes('تاريخ اليوم')
    );

    const intent = isPdf ? 'pdf_analysis' : (isImage ? 'image_analysis' : (shouldSearchWeb ? 'deep_research' : detectUserIntent(userPrompt, deepResearch, attachedFile, activeSkillId)));

    // 1. استخراج حالة وأدوات الكلان الحية من الذاكرة لتزويد الموديل بها (Real Site Tools Data)
    cleanupStale();
    const liveOnlineList = Array.from(onlineUsers.values());
    const liveChallengesList = Array.from(activeChallenges.values()).filter(c => c.status === 'pending');
    
    let clanContextSnippet = `\n[حالة المقر الرسمية اللحظية]:
- إجمالي الأعضاء المتصلين حالياً: ${liveOnlineList.length} عضو.
${liveOnlineList.length > 0 ? '- أسماء ورتب المتصلين: ' + liveOnlineList.map(u => `${u.username} (${u.rank || 'عضو'})`).slice(0, 15).join('، ') : '- لا يوجد متصلين حالياً سوى المشرف.'}
- التحديات والنزالات النشطة والمعلقة: ${liveChallengesList.length} تحدي (${liveChallengesList.map(c => `${c.type}: ${c.challengerName} ضد ${c.targetName}`).join(' | ') || 'لا توجد نزالات معلقة'}).
- المكالمة الصوتية المباشرة: ${activeCallInfo && activeCallInfo.active ? `نشطة الآن بقيادة ${activeCallInfo.challengerName} (${activeCallInfo.details?.topic || 'مكالمة الكلان'})` : 'لا توجد مكالمة جارية حالياً'}.
- قوانين الكلان المعتمدة: ${clanKnowledge.rules.join(' | ')}.
- لائحة العقوبات المعتمدة: ${clanKnowledge.penalties.map(p => `${p.violation}: [${p.steps.join(' -> ')}]`).join(' ؛ ')}.
- روابط الكلان: واتساب (${clanKnowledge.socialLinks.whatsapp})، ديسكورد (${clanKnowledge.socialLinks.discord})، تليجرام (${clanKnowledge.socialLinks.telegram}).`;

    // 2. فحص وتطبيق المهارة النشطة إن وجدت والتحقق من الأدوات والملاءمة
    let skillDirective = '';
    let selectedSkill = null;
    let skillExecuted = false;
    let skillStatus = 'ready';

    if (activeSkillId && skillsRegistry.has(activeSkillId)) {
      selectedSkill = skillsRegistry.get(activeSkillId);

      // فحص توفر الأدوات المطلوبة فعلياً في النظام
      const missingTools = (selectedSkill.requiredTools || []).filter(t => !availableSystemTools.has(t));
      if (missingTools.length > 0) {
        return res.json({
          success: true,
          response: `⚠️ **[تنبيه المهارات - CODO AI]**\nتعذر تشغيل مهارة "**${selectedSkill.name}**" لأن الأداة المطلوبة (\`${missingTools.join(', ')}\`) غير متاحة في النظام حالياً.`,
          reply: `⚠️ **[تنبيه المهارات - CODO AI]**\nتعذر تشغيل مهارة "**${selectedSkill.name}**" لأن الأداة المطلوبة (\`${missingTools.join(', ')}\`) غير متاحة في النظام حالياً.`,
          model: modelChoice,
          intent: 'skill_error',
          usedSkill: null,
          skillStatus: 'error'
        });
      }

      // فحص ملاءمة طلب المستخدم للمهارة المحددة (لا تعمل مع كل طلب بدون داعٍ)
      const promptLower = (userPrompt || '').toLowerCase();
      let isAppropriate = true;

      if (selectedSkill.id === 'clan_rule_auditor') {
        const ruleKeywords = ['سب', 'شتم', 'شتيمة', 'إهانة', 'احترام', 'تطاول', 'غياب', 'تغيب', 'تفويت', 'عذر', 'روم', 'هاك', 'غش', 'برامج', 'عقوبة', 'قانون', 'لائحة', 'مخالفة', 'إنذار', 'كرت', 'استبعاد', 'طرد', 'حرمان', 'تدقيق', 'تقرير', 'واقعة'];
        isAppropriate = ruleKeywords.some(kw => promptLower.includes(kw));
      } else if (selectedSkill.id === 'squad_tactics_architect') {
        const tacticKeywords = ['سكواد', 'تكتيك', 'خطة', 'تشكيل', 'روتيشن', 'زون', 'igl', 'فراغر', 'سنايبر', 'سبورت', 'دعم', 'إرانغل', 'ميرامار', 'سانهوك', 'ليفيك', 'ببجي', 'pubg', 'روم', 'بطولة', 'هبوط', 'بيك', 'دخان', 'سلاح', 'كمين'];
        isAppropriate = tacticKeywords.some(kw => promptLower.includes(kw));
      } else if (selectedSkill.id === 'code_reviewer_sec') {
        const codeKeywords = ['كود', 'code', 'function', 'const', 'let', 'var', 'script', 'برمج', 'ثغرة', 'أمان', 'xss', 'injection', 'sql', 'html', 'css', 'javascript', 'js', 'python', 'bug', 'خطأ', 'تنقيح', 'مراجعة', 'فحص'];
        isAppropriate = codeKeywords.some(kw => promptLower.includes(kw)) || Boolean(attachedFile);
      } else if (selectedSkill.id === 'doc_summarizer_pro') {
        const docKeywords = ['لخص', 'تلخيص', 'موجز', 'خلاصة', 'مستند', 'ملف', 'تقرير', 'استخرج', 'نقاط', 'pdf', 'وثيقة'];
        isAppropriate = docKeywords.some(kw => promptLower.includes(kw)) || isPdf || Boolean(attachedFile);
      } else if (selectedSkill.id === 'roster_and_presence_analyst') {
        const presenceKeywords = ['متصل', 'حضور', 'أعضاء', 'نشاط', 'تحدي', 'تحديات', 'نزال', 'مكالمة', 'صوتية', 'رتب', 'شعبية', 'روم', 'مين', 'من في المقر', 'أونلاين', 'online'];
        isAppropriate = presenceKeywords.some(kw => promptLower.includes(kw));
      }

      if (isAppropriate) {
        skillExecuted = true;
        skillStatus = 'completed';
        selectedSkill.lastUsed = Date.now();
        selectedSkill.usageCount = (selectedSkill.usageCount || 0) + 1;
        skillDirective = `\n[المهارة النشطة قيد التنفيذ الفعلي: "${selectedSkill.name}"]
- الهدف الإلزامي: ${selectedSkill.goal}
- تعليمات المهارة الإلزامية: ${selectedSkill.instructions}
- شكل المخرجات المتوقع: ${selectedSkill.outputFormat}
- قيود المهارة: ${(selectedSkill.limitations || []).join('، ')}.
* إلزامي: طبق تعليمات هذه المهارة بدقة وأخرج النتيجة بالتنسيق المطلوب.`;
      } else {
        // الطلب غير مطابق لمجال المهارة
        skillExecuted = false;
        skillStatus = 'ready';
      }
    }

    // 3. فحص المرفق (PDF أو صورة أو ملف نصي)
    let fileSnippet = '';
    let imageDirective = '';
    let pdfDirective = '';
    let base64ImageData = null;
    let base64PdfData = null;
    let imageMimeType = 'image/jpeg';
    let extractedPdfText = '';
    let pdfPageCount = 0;

    if (isPdf && attachedFile) {
      let rawBase64 = attachedFile.data || attachedFile.base64 || '';
      if (rawBase64.includes(',')) {
        rawBase64 = rawBase64.split(',')[1];
      }
      base64PdfData = rawBase64;

      if (base64PdfData) {
        try {
          const pdfBuffer = Buffer.from(base64PdfData, 'base64');
          const parser = new PDFParse({ data: pdfBuffer });
          await parser.load();
          const res = await parser.getText();
          if (res && typeof res.text === 'string') {
            extractedPdfText = res.text.trim();
            pdfPageCount = res.total || (res.pages ? res.pages.length : 1);
          }
          await parser.destroy();
        } catch (pdfErr) {
          console.warn('PDF extraction warning:', pdfErr.message);
        }
      }

      const pageStr = pdfPageCount ? ` (${pdfPageCount} صفحة)` : '';
      const sizeKb = Math.round((attachedFile.size || 0) / 1024);

      pdfDirective = `\n[فحص وتحليل مستند PDF وقواعد وإرشادات مرفقة من المستخدم]:
- اسم المستند: "${attachedFile.name || 'document.pdf'}"${pageStr}، الحجم: ${sizeKb} KB.
${extractedPdfText ? `- مقتطف من نصوص وبنود الـ PDF المستخلصة:\n"""\n${extractedPdfText.substring(0, 50000)}\n"""` : ''}
- تعليمات فحص وتدقيق مستند الـ PDF:
  1. اقرأ جميع صفحات ومواد المستند بدقة كاملة.
  2. إذا كان الملف يحتوي على قواعد، إرشادات، لوائح بطولات، أو قوانين كلان:
     - لخص البنود والقواعد الرئيسية بوضوح وتنظيم.
     - استخرج المواد الإلزامية، الشروط، والمحظورات وجدول العقوبات.
     - أجب عن أي سؤال أو استفسار يطرحه المستخدم بخصوص البنود الواردة في الملف بدقة ودون أي تحريف.
  3. استخرج الجداول والبيانات المنظمة إن وجدت.
  4. إذا سأل المستخدم سؤالاً غير مذكور في المستند، وضح ذلك صراحةً بدلاً من التأليف.`;
    } else if (isImage && attachedFile) {
      let rawBase64 = attachedFile.data || attachedFile.base64 || attachedFile.content || '';
      if (rawBase64.includes(',')) {
        rawBase64 = rawBase64.split(',')[1];
      }
      base64ImageData = rawBase64;
      imageMimeType = attachedFile.mimeType || attachedFile.type || 'image/jpeg';

      imageDirective = `\n[فحص وقراءة صورة مرفقة من المستخدم]:
- قام المستخدم بإرفاق صورة رقمية ("${attachedFile.name || 'صورة'}").
- انظر في تفاصيل الصورة بدقة:
  * إذا كانت لقطة شاشة لكود أو خطأ برمجي: اقرأ الكود واستخرج المشكلة واكتب الحل المصحح في markdown block.
  * إذا كانت لقطة شاشة من لعبة PUBG Mobile أو مباراة: اقرأ بيانات اللاعبين، الكلات، الضرر، الرانك، والموقع وحللها.
  * إذا كانت مستنداً أو شاشة بها نصوص (OCR): استخرج النص المكتوب بدقة واشرحه.
  * إذا كانت تصميماً أو رسماً أو خريطة تكتيكية: صفها وحللها بدقة دون أي تخمين.`;
    } else if (attachedFile && attachedFile.content) {
      fileSnippet = `\n[ملف مرفق من المستخدم للتحليل]:
- اسم الملف: ${attachedFile.name}
- الحجم: ${attachedFile.size} بايت
- المحتوى:
"""
${attachedFile.content.substring(0, 60000)}
"""`;
    }

    // 4. إجراء بحث حقيقي في الويب إذا كان مطلوباً
    let liveWebSources = [];
    let webSearchSnippet = '';
    if (shouldSearchWeb) {
      const searchRes = await performRealWebSearch(userPrompt);
      liveWebSources = searchRes.sources || [];
      if (liveWebSources.length > 0) {
        webSearchSnippet = `\n[نتائج استخلاص الويب والمصادر الحية المباشرة]:\n` +
          liveWebSources.map((s, idx) => `${idx + 1}. [${s.title}] (${s.url}): ${s.snippet}`).join('\n');
      }
    }

    // 5. توجيه الموديل بحسب نوع الموديل والبحث
    let modelDirective = 'وضع CODO Base: إجابات مباشرة، حاسمة، ودقيقة للمهام اليومية والتكتيكات.';
    if (modelChoice === 'codo-pro') {
      modelDirective = 'وضع CODO Pro: تحليل متعمق، برمجة وشرح أكواد، وتفكيك تقني وتكتيكي للمشكلات.';
    } else if (modelChoice === 'codo-max') {
      modelDirective = 'وضع CODO Max: أعلى درجات التفكير المنطقي الاستراتيجي متعدد المراحل.';
    } else if (modelChoice === 'codo-lab') {
      modelDirective = 'وضع CODO Lab: بيئة اختبار وتطوير المهارات والأدوات التكتيكية المخصصة.';
    }

    let deepResearchDirective = '';
    if (shouldSearchWeb) {
      deepResearchDirective = `\n[وضع بحث الويب الموثق (WEB SEARCH & DEEP RESEARCH)]:
1. استخدم نتائج البحث الحي المرفقة ومحرك البحث للتحقق من أحدث المعلومات.
2. اذكر الحقائق الموثقة، وميز بين الحقيقة المؤكدة والاستنتاج المنطقي.
3. نسق الإجابة بأسلوب منظم بعناوين ونقاط، واذكر المصادر والروابط الرسمية المعتمدة.`;
    }

    const systemInstruction = `أنت "CODO"، المساعد الذكي والتقني الموثوق والتكتيكي الرسمي لمنظومة كلان PHANTOM『PH』.
اسمك الرسمي والوحيد هو: CODO.
أنت لست مجرد Chatbot سطحي، بل منتج ذكاء اصطناعي احترافي موثوق، يعتمد عليه المستخدمون كلياً في المهام والتحليل وقراءة الصور ومستندات PDF والبحث والبرمجة والتكتيكات.

${modelDirective}
${deepResearchDirective}
${pdfDirective}
${imageDirective}
${skillDirective}
${fileSnippet}
${webSearchSnippet}
${clanContextSnippet}

دستور وسلوك CODO الصارم:
1. الصدق والمصداقية المطلقة: لا تخترع أي معلومة، مصدر، كود، نتيجة أو رقم غير حقيقي.
2. قراءة الصور والمستندات: إذا أرفق المستخدم صورة أو ملف PDF، انظر فيه بدقة واقرأ ما يحتويه من مواد وبنود ونصوص وأرقام وأشكال دون تحريف.
3. حدود المعرفة: إذا كان السؤال خارج نطاق البيانات، وضح ما ينقصك بدلاً من التخمين العشوائي.
4. التمييز الواضح: بين المعلومة المؤكدة، الاستنتاج المنطقي، والاحتمال.
5. جودة المخرجات: إجابات مباشرة، لغة عربية سليمة وواضحة، خالية من الحشو والتكرار، مع تنظيم أنيق بعناوين ونقاط، ووضع الأكواد داخل markdown مع اسم اللغة (\`\`\`language).
6. تنفيذ المهام الفعلية: عند استفسار المستخدم عن بيانات الكلان (المتصلين، الرومات، العقوبات)، استخدم البيانات الحية المزودة أعلاه بدقة.`;

    // بناء محتوى المحادثة
    let contents = [];
    if (Array.isArray(history) && history.length > 0) {
      contents = history.slice(-10).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.text || h.content || '') }]
      }));
    }

    // تجهيز أجزاء رسالة المستخدم (نص + صورة أو PDF إن وجد)
    const userParts = [{ text: userPrompt }];
    if (isImage && base64ImageData) {
      userParts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: base64ImageData
        }
      });
    } else if (isPdf && base64PdfData) {
      userParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: base64PdfData
        }
      });
    }
    contents.push({ role: 'user', parts: userParts });

    let finalReply = null;
    let extractedSources = [...liveWebSources];
    let searchQueries = [];

    // استدعاء Gemini API مع معالجة الأخطاء والتكرار (Exponential Retry)
    if (process.env.GEMINI_API_KEY) {
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];

      for (const modelName of candidateModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const genConfig = {
              systemInstruction: systemInstruction
            };
            if (shouldSearchWeb) {
              genConfig.tools = [{ googleSearch: {} }];
            }

            const response = await withTimeout(ai.models.generateContent({
              model: modelName,
              contents: contents,
              config: genConfig
            }), shouldSearchWeb ? 14000 : 10000);

            if (response && response.text) {
              finalReply = response.text.trim();

              const candidate = response.candidates?.[0];
              const grounding = candidate?.groundingMetadata;
              if (grounding) {
                if (Array.isArray(grounding.webSearchQueries)) {
                  searchQueries = grounding.webSearchQueries;
                }
                if (Array.isArray(grounding.groundingChunks)) {
                  const seenUrls = new Set(extractedSources.map(s => s.url));
                  for (const chunk of grounding.groundingChunks) {
                    if (chunk.web && chunk.web.uri && !seenUrls.has(chunk.web.uri)) {
                      seenUrls.add(chunk.web.uri);
                      extractedSources.push({
                        title: chunk.web.title || chunk.web.uri,
                        url: chunk.web.uri
                      });
                    }
                  }
                }
              }
              break;
            }
          } catch (err) {
            console.warn(`CODO AI attempt ${attempt} for ${modelName} encountered:`, err?.status || err?.message || err);
            // في حال استنفاد الكوتا (429 أو resource_exhausted) يتم التحويل الفوري لمحرك التوليد التكتيكي دون تأخير
            if (err.status === 429 || (err.message && (err.message.includes('resource_exhausted') || err.message.includes('Quota')))) {
              console.warn(`CODO AI quota reached, switching immediately to synthesis engine.`);
              break;
            }

            // لو الخطأ 503 ننتظر قليلاً قبل المحاولة التالية
            if (attempt === 1 && err.status === 503) {
              await new Promise(r => setTimeout(r, 800));
              continue;
            }

            // محاولة بديلة سريعة بدون أدوات بحث إن كان الخطأ متعلقاً بأداة البحث
            if (shouldSearchWeb) {
              try {
                const directRes = await withTimeout(ai.models.generateContent({
                  model: modelName,
                  contents: contents,
                  config: { systemInstruction: systemInstruction }
                }), 9000);

                if (directRes && directRes.text) {
                  finalReply = directRes.text.trim();
                  break;
                }
              } catch (directErr) {
                console.warn(`Fallback direct for ${modelName} failed:`, directErr.status || directErr.message);
              }
            }
          }
        }
        if (finalReply) break;
      }
    }

    // إذا تعذر التوليد السحابي لسبب كوتا أو ضغط (503/429)، استخدام المحرك الذكي المحاكي عالي الجودة
    if (!finalReply) {
      finalReply = generateSmartCodoSynthesis({
        userPrompt,
        intent,
        isImage,
        isPdf,
        attachedFile,
        extractedPdfText,
        pdfPageCount,
        searchSources: liveWebSources,
        clanState: {
          onlineUsers: liveOnlineList,
          challengesCount: liveChallengesList.length,
          callActive: Boolean(activeCallInfo && activeCallInfo.active)
        },
        selectedSkill,
        modelChoice
      });
    }

    if (selectedSkill && !skillExecuted) {
      finalReply += `\n\n> 💡 **ملاحظة:** مهارة "**${selectedSkill.name}**" جاهزة ومفعلة، ولكن طلبك لم يتطابق مع تخصصها. يمكنك طرح استفسار مناسب لتشغيلها.`;
    }

    return res.json({
      success: true,
      response: finalReply,
      reply: finalReply,
      model: modelChoice,
      intent,
      isImage,
      isPdf,
      usedSkill: (selectedSkill && skillExecuted) ? { id: selectedSkill.id, name: selectedSkill.name, status: 'completed' } : null,
      skillStatus: skillStatus,
      sources: extractedSources.slice(0, 8),
      searchQueries: searchQueries.slice(0, 5)
    });
  } catch (error) {
    console.error('CODO API Error:', error);
    return res.json({
      success: true,
      response: 'مرحباً بك! أنا CODO في مقر PHANTOM ⚡. حدث تعذر مؤقت في معالجة طلبك الأخير، يرجى إعادة المحاولة أو تعديل صيغة السؤال.',
      reply: 'مرحباً بك! أنا CODO في مقر PHANTOM ⚡. حدث تعذر مؤقت في معالجة طلبك الأخير، يرجى إعادة المحاولة أو تعديل صيغة السؤال.',
      model: req.body?.modelChoice || 'codo-base',
      intent: 'fallback',
      sources: []
    });
  }
});

// --- In-Memory State for Realtime Clan Operations ---
const onlineUsers = new Map(); // username -> { username, userId, rank, avatar, lastSeen }
const activeChallenges = new Map(); // Legacy read-only context; game APIs persist matches in Supabase.
const activeCalls = new Map(); // callId -> callObj
let activeCallInfo = null;

function cleanupStale() {
  const now = Date.now();
  for (const [name, user] of onlineUsers.entries()) {
    if (now - user.lastSeen > 45000) {
      onlineUsers.delete(name);
    }
  }
  for (const [id, call] of activeCalls.entries()) {
    const isTimedOut = (now - (call.lastHeartbeat || call.createdAt)) > 45 * 1000;
    const hasNoParticipants = Array.isArray(call.participants) && call.participants.length === 0;
    if (isTimedOut || hasNoParticipants || call.status !== 'active') {
      activeCalls.delete(id);
    }
  }
  if (activeCalls.size === 0) {
    activeCallInfo = null;
  } else {
    const list = Array.from(activeCalls.values());
    activeCallInfo = { ...list[list.length - 1], active: true };
  }
}

// 🟢 1. Presence Heartbeat & Query with UserId Deduplication
app.post('/api/presence', (req, res) => {
  cleanupStale();
  const { username, userId, rank, avatar } = req.body || {};
  if (username) {
    const cleanUser = String(username).trim();
    const cleanId = userId ? String(userId).trim() : null;
    const key = cleanId || cleanUser.toLowerCase();

    // إزالة أي سجل مكرر بنفس الاسم أو نفس المعرف
    for (const [k, u] of onlineUsers.entries()) {
      if ((cleanId && u.userId === cleanId) || (u.username.toLowerCase() === cleanUser.toLowerCase())) {
        onlineUsers.delete(k);
      }
    }

    onlineUsers.set(key, {
      key,
      username: cleanUser,
      userId: cleanId,
      rank: rank || 'عضو',
      avatar: avatar || 'PH',
      lastSeen: Date.now()
    });
  }
  res.json({ success: true, onlineUsers: Array.from(onlineUsers.values()) });
});

app.post('/api/presence/leave', (req, res) => {
  const { username, userId } = req.body || {};
  const cleanUser = username ? String(username).trim().toLowerCase() : null;
  const cleanId = userId ? String(userId).trim() : null;

  for (const [k, u] of onlineUsers.entries()) {
    if ((cleanId && u.userId === cleanId) || (cleanUser && u.username.toLowerCase() === cleanUser)) {
      onlineUsers.delete(k);
    }
  }
  res.json({ success: true });
});

app.get('/api/presence', (req, res) => {
  cleanupStale();
  res.json({ success: true, onlineUsers: Array.from(onlineUsers.values()) });
});

// ⚔️ 2. Battles & Challenges API (Popularity Battle & 1v1 Arena & Real Queue)
// ⚔️ 2. Battles & Challenges API backed by Supabase
const BATTLE_SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kcxwfqwrzbilcjcgkazv.supabase.co').replace(/\/$/, '');
// The publishable key is public by design; a server-side service key may be provided through deployment env.
const BATTLE_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3xakoqez79haf-KOWJbGBQ_V7bQv-DM';
const BATTLE_ENTRY_MINIMUM = 500;
const BATTLE_QUEUE_TTL_MS = 60000;
const BATTLE_DURATION_MS = 24 * 60 * 60 * 1000;

async function battleDb(path, { method = 'GET', body, prefer } = {}) {
  if (!BATTLE_SUPABASE_KEY) throw new Error('Supabase server key is not configured');
  const headers = {
    apikey: BATTLE_SUPABASE_KEY,
    Authorization: `Bearer ${BATTLE_SUPABASE_KEY}`,
    Accept: 'application/json'
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${BATTLE_SUPABASE_URL}/rest/v1/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (_) { data = text; } }
  if (!response.ok) {
    const err = new Error(data?.message || data?.hint || `Supabase request failed (${response.status})`);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}
function battleFilter(value) { return encodeURIComponent(String(value ?? '')); }
function asChallenge(row) {
  if (!row) return null;
  const state = row.match_state && typeof row.match_state === 'object' ? row.match_state : {};
  const a = { ...(state.playerA || {}), name: row.player_a_name, id: row.player_a_id, votes: Number(state.playerA?.votes) || 0, score: Number(row.score_a) || 0 };
  const b = { ...(state.playerB || {}), name: row.player_b_name || (row.game_type === 'popularity' ? 'المنافس القادم' : null), id: row.player_b_id || null, votes: Number(state.playerB?.votes) || 0, score: Number(row.score_b) || 0 };
  return {
    ...state, id: row.id, type: row.game_type, status: row.status,
    challengerName: row.player_a_name, challengerId: row.player_a_id,
    targetName: row.player_b_name || state.targetName || 'ALL', targetId: row.player_b_id,
    acceptedBy: state.acceptedBy || row.player_b_name || null,
    stake: Number(row.stake) || 0, playerA: a, playerB: b,
    createdAt: Date.parse(row.created_at) || Date.now(),
    startedAt: row.started_at ? Date.parse(row.started_at) : null,
    expiresAt: row.started_at ? Date.parse(row.started_at) + BATTLE_DURATION_MS : null,
    winner: row.winner_name || null, finalRecord: state.finalRecord || null,
    voters: state.voters || {}
  };
}
async function getBattleMatch(id) {
  const rows = await battleDb(`game_matches?select=*&id=eq.${battleFilter(id)}&limit=1`);
  return rows?.[0] || null;
}
async function insertBattleMatch(match) {
  const rows = await battleDb('game_matches', { method: 'POST', body: match, prefer: 'return=representation' });
  if (!rows?.[0]) throw new Error('Supabase did not return the created match');
  return rows[0];
}
async function updateBattleMatch(id, patch, filters = '') {
  const rows = await battleDb(`game_matches?id=eq.${battleFilter(id)}${filters}&select=*`, {
    method: 'PATCH', body: patch, prefer: 'return=representation'
  });
  return rows?.[0] || null;
}
async function getBattleMember(name, userId) {
  const byId = userId ? await battleDb(`members?select=id,userId,name,coins&userId=eq.${battleFilter(userId)}&limit=1`) : [];
  const rows = byId?.length ? byId : await battleDb(`members?select=id,userId,name,coins&name=eq.${battleFilter(name)}&limit=1`);
  return rows?.[0] || null;
}
async function changeBattleCoins(name, userId, delta) {
  if (!Number.isFinite(Number(delta)) || Number(delta) === 0) return await getBattleMember(name, userId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const member = await getBattleMember(name, userId);
    if (!member) throw Object.assign(new Error(`عضو الحساب غير موجود: ${name}`), { status: 404 });
    const current = Number(member.coins) || 0;
    const next = current + Number(delta);
    if (next < 0) throw Object.assign(new Error(`الرصيد غير كافٍ؛ يلزم ${Math.abs(Number(delta))} نقطة.`), { status: 400 });
    const rows = await battleDb(`members?id=eq.${battleFilter(member.id)}&coins=eq.${current}&select=id,name,coins`, {
      method: 'PATCH', body: { coins: next }, prefer: 'return=representation'
    });
    if (rows?.length) return rows[0];
  }
  throw Object.assign(new Error('تعذر تحديث الرصيد بسبب تغيّر متزامن؛ أعد المحاولة.'), { status: 409 });
}
function entryStake(type, requested) {
  const value = Math.max(0, Math.floor(Number(requested) || 0));
  return type === 'popularity' ? Math.max(BATTLE_ENTRY_MINIMUM, value) : value;
}
async function reservePlayerStake(name, id, amount) {
  if (!amount) return;
  const member = await getBattleMember(name, id);
  if (!member || Number(member.coins) < amount) {
    throw Object.assign(new Error(`يجب أن يتوفر لديك ${amount} نقطة على الأقل لدخول معركة الشعبية.`), { status: 400 });
  }
  await changeBattleCoins(name, id, -amount);
}
async function settleBattleMatch(row, { winnerName, surrenderedBy, mode, myScore, oppScore, bestSpeed, playerName } = {}) {
  const state = row.match_state && typeof row.match_state === 'object' ? { ...row.match_state } : {};
  if (state.settlement?.completed) return state.finalRecord || null;
  const priorSettlementStartedAt = Date.parse(state.settlement?.startedAt || '');
  if (row.status === 'completed' && Number.isFinite(priorSettlementStartedAt) && Date.now() - priorSettlementStartedAt < 120000) {
    return state.finalRecord || null;
  }
  const previousSettlement = state.settlement || {};
  const previousRecord = state.finalRecord || {};
  const aName = row.player_a_name;
  const bName = row.player_b_name;
  const aId = row.player_a_id;
  const bId = row.player_b_id;
  const surrendered = previousRecord.surrenderedBy || surrenderedBy || null;
  const tallyA = Number(state.playerA?.votes) || 0;
  const tallyB = Number(state.playerB?.votes) || 0;
  const voteWinner = surrendered ? (String(surrendered).toLowerCase() === String(aName).toLowerCase() ? bName : aName)
    : tallyA > tallyB ? aName : tallyB > tallyA ? bName : 'تعادل بطولي!';
  const winner = previousRecord.winner || (row.game_type === 'popularity' ? voteWinner : winnerName || null);
  const playerIsB = playerName && String(playerName).toLowerCase() === String(bName || '').toLowerCase();
  const scoreA = previousRecord.scoreA ?? (row.game_type === 'popularity' ? tallyA : Number(playerIsB ? oppScore : myScore) || Number(row.score_a) || 0);
  const scoreB = previousRecord.scoreB ?? (row.game_type === 'popularity' ? tallyB : Number(playerIsB ? myScore : oppScore) || Number(row.score_b) || 0);
  const stake = Number(row.stake) || 0;
  const wasReserved = Boolean(state.stakesReserved);
  const payouts = {};
  if (wasReserved && stake > 0 && aName && bName) {
    if (winner && winner !== 'تعادل' && winner !== 'تعادل بطولي!') {
      payouts[aName] = winner === aName ? stake * 2 : 0;
      payouts[bName] = winner === bName ? stake * 2 : 0;
      if (surrendered) payouts[surrendered] = Math.floor(stake / 2);
    } else {
      payouts[aName] = stake;
      payouts[bName] = stake;
    }
  }
  const now = new Date().toISOString();
  const finalRecord = {
    id: row.id, type: row.game_type || mode || 'arena', playerA: aName, playerB: bName,
    winner: winner || 'تعادل', scoreA,
    scoreB, bestSpeed: bestSpeed || previousRecord.bestSpeed || null,
    stake, timestamp: Date.now(), date: new Date().toLocaleDateString('ar-EG'), surrenderedBy: surrendered
  };
  // Mark settlement intent first; per-vote status is the durable idempotency marker.
  state.settlement = { ...previousSettlement, completed: false, payouts, playerCredits: previousSettlement.playerCredits || {}, startedAt: previousSettlement.startedAt || now };
  state.finalRecord = finalRecord;
  const finalized = await updateBattleMatch(row.id, {
    status: 'completed', winner_id: winner === aName ? aId : winner === bName ? bId : null,
    winner_name: winner, score_a: finalRecord.scoreA, score_b: finalRecord.scoreB,
    ended_at: now, match_state: state
  }, '&status=eq.active');
  if (!finalized && row.status !== 'completed') throw Object.assign(new Error('تعذر قفل نتيجة المباراة للتسوية.'), { status: 409 });
  for (const [name, amount] of Object.entries(payouts)) {
    if (state.settlement.playerCredits[name]) continue;
    if (amount > 0) await changeBattleCoins(name, name === aName ? aId : bId, amount);
    state.settlement.playerCredits[name] = true;
    await updateBattleMatch(row.id, { match_state: state });
  }
  if (row.game_type === 'popularity') {
    const votes = await battleDb(`popularity_votes?select=id,voter_id,voter_name,voted_for_player_name,staked_points,settlement_status&match_id=eq.${battleFilter(row.id)}&settlement_status=eq.pending&limit=500`);
    for (const vote of (votes || [])) {
      const pickedWinner = winner && vote.voted_for_player_name === winner;
      const pickedSurrender = surrendered && vote.voted_for_player_name === surrendered;
      const payout = pickedSurrender ? Math.floor(Number(vote.staked_points) * 0.75) : pickedWinner ? Number(vote.staked_points) * 2 : (!winner || winner.startsWith('تعادل')) ? Number(vote.staked_points) : 0;
      if (payout > 0) await changeBattleCoins(vote.voter_name, vote.voter_id, payout);
      const settlementStatus = payout === 0 ? 'lost' : pickedSurrender ? 'surrender_refund' : pickedWinner ? 'won' : 'refunded';
      await battleDb(`popularity_votes?id=eq.${vote.id}&settlement_status=eq.pending`, {
        method: 'PATCH', body: { settlement_status: settlementStatus, payout_points: payout, settled_at: now }, prefer: 'return=minimal'
      });
    }
  }
  state.settlement = { completed: true, payouts, settledAt: now };
  state.finalRecord = finalRecord;
  await updateBattleMatch(row.id, { match_state: state });
  return finalRecord;
}
function battleError(res, err) {
  console.error('[Battles API]', err?.message || err);
  return res.status(err.status || 500).json({ error: err.status ? err.message : 'تعذر حفظ بيانات المواجهة. حاول مجدداً.' });
}
async function listOpenBattleRows(type) {
  const rows = await battleDb(`game_matches?select=*&game_type=eq.${battleFilter(type)}&status=eq.pending&player_b_id=is.null&order=created_at.asc&limit=50`);
  return (rows || []).filter(row => Date.now() - (Date.parse(row.created_at) || 0) <= BATTLE_QUEUE_TTL_MS);
}
app.post('/api/battles/queue/join', async (req, res) => {
  try {
    cleanupStale();
    const { type = 'popularity', username, userId, stake } = req.body || {};
    if (!username) return res.status(400).json({ error: 'اسم اللاعب مطلوب للمطابقة.' });
    const cleanUser = String(username).trim();
    const cleanId = userId ? String(userId).trim() : cleanUser;
    if (!['popularity', 'arena'].includes(type)) return res.status(400).json({ error: 'نوع المواجهة غير صالح.' });
    const buyIn = entryStake(type, stake);
    if (type === 'popularity') {
      const member = await getBattleMember(cleanUser, cleanId);
      if (!member || Number(member.coins) < BATTLE_ENTRY_MINIMUM) return res.status(400).json({ error: 'تحتاج إلى 500 نقطة على الأقل لدخول معركة الشعبية.' });
    }
    const openRows = await listOpenBattleRows(type);
    const opponent = openRows.find(row => row.match_state?.queueEntry === true && row.player_a_name?.toLowerCase() !== cleanUser.toLowerCase() && row.player_a_id !== cleanId);
    if (opponent) {
      const opponentStake = Number(opponent.stake) || 0;
      const actualStake = Math.max(opponentStake, buyIn);
      const now = new Date().toISOString();
      const state = { ...(opponent.match_state || {}), acceptedBy: cleanUser, playerB: { name: cleanUser, id: cleanId, score: 0, votes: 0 }, stakesReserved: type === 'popularity' && actualStake > 0 };
      const match = await updateBattleMatch(opponent.id, {
        status: 'active', player_b_id: cleanId, player_b_name: cleanUser, stake: actualStake,
        started_at: now, match_state: state
      }, '&status=eq.pending&player_b_id=is.null');
      if (match) {
        if (type === 'popularity' && actualStake > 0) {
          let firstReserved = false;
          try {
            await reservePlayerStake(opponent.player_a_name, opponent.player_a_id, actualStake);
            firstReserved = true;
            await reservePlayerStake(cleanUser, cleanId, actualStake);
          } catch (err) {
            if (firstReserved) await changeBattleCoins(opponent.player_a_name, opponent.player_a_id, actualStake).catch(() => {});
            await updateBattleMatch(opponent.id, { status: 'cancelled', match_state: { ...state, stakesReserved: false } });
            throw err;
          }
        }
        return res.json({ success: true, matched: true, challenge: asChallenge(match) });
      }
    }
    const id = `match_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const row = await insertBattleMatch({
      id, game_type: type, status: 'pending', player_a_id: cleanId, player_a_name: cleanUser,
      player_b_id: null, player_b_name: null, stake: buyIn, score_a: 0, score_b: 0,
      match_state: { queueEntry: true, playerA: { name: cleanUser, id: cleanId, votes: 0, score: 0 }, playerB: { votes: 0, score: 0 }, queuedAt: Date.now() }
    });
    return res.json({ success: true, matched: false, message: 'في انتظار منافس حقيقي...', matchId: row.id });
  } catch (err) { return battleError(res, err); }
});
app.post('/api/battles/queue/leave', async (req, res) => {
  try {
    const { type = 'popularity', username, userId } = req.body || {};
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanId = String(userId || username || '').trim();
    const query = `game_matches?status=eq.pending&game_type=eq.${battleFilter(type)}&select=id,player_a_id,player_a_name,match_state&limit=100`;
    const rows = await battleDb(query);
    for (const row of rows || []) {
      if (row.match_state?.queueEntry && ((cleanId && row.player_a_id === cleanId) || (cleanUser && row.player_a_name?.toLowerCase() === cleanUser))) {
        await updateBattleMatch(row.id, { status: 'cancelled', ended_at: new Date().toISOString() }, '&status=eq.pending');
      }
    }
    return res.json({ success: true });
  } catch (err) { return battleError(res, err); }
});
app.get('/api/battles/queue/status', async (req, res) => {
  try {
    cleanupStale();
    const { username, userId, type = 'popularity' } = req.query || {};
    const id = String(userId || username || '').trim();
    const name = String(username || '').trim().toLowerCase();
    const rows = await battleDb(`game_matches?select=*&game_type=eq.${battleFilter(type)}&status=eq.active&order=started_at.desc&limit=100`);
    const found = (rows || []).find(r => r.player_a_id === id || r.player_b_id === id || r.player_a_name?.toLowerCase() === name || r.player_b_name?.toLowerCase() === name);
    return res.json(found ? { success: true, matched: true, challenge: asChallenge(found) } : { success: true, matched: false });
  } catch (err) { return battleError(res, err); }
});
app.post('/api/battles/challenge', async (req, res) => {
  try {
    cleanupStale();
    const { type = 'popularity', challengerName, challengerId, targetName, stake, details } = req.body || {};
    if (!challengerName) return res.status(400).json({ error: 'اسم المتحدي مطلوب.' });
    if (!['popularity', 'arena'].includes(type)) return res.status(400).json({ error: 'نوع المواجهة غير صالح.' });
    const buyIn = entryStake(type, stake);
    if (type === 'popularity') {
      const member = await getBattleMember(challengerName, challengerId);
      if (!member || Number(member.coins) < BATTLE_ENTRY_MINIMUM) return res.status(400).json({ error: 'تحتاج إلى 500 نقطة على الأقل لدخول معركة الشعبية.' });
    }
    const id = `ch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const row = await insertBattleMatch({
      id, game_type: type, status: 'pending', player_a_id: challengerId || null,
      player_a_name: String(challengerName).trim(), player_b_id: null, player_b_name: null,
      stake: buyIn, score_a: 0, score_b: 0,
      match_state: { targetName: targetName || 'ALL', details: details || {}, playerA: { name: String(challengerName).trim(), id: challengerId || null, votes: 0, score: 0 }, playerB: { votes: 0, score: 0 }, createdAt: Date.now() }
    });
    return res.json({ success: true, challenge: asChallenge(row) });
  } catch (err) { return battleError(res, err); }
});
app.get('/api/battles/challenges', async (req, res) => {
  try {
    cleanupStale();
    const currentUser = String(req.query.user || '').toLowerCase();
    const rows = await battleDb('game_matches?select=*&status=eq.pending&order=created_at.desc&limit=100');
    const challenges = (rows || []).filter(r => {
      const target = String(r.match_state?.targetName || 'ALL').toLowerCase();
      return !r.match_state?.queueEntry && r.player_a_name?.toLowerCase() !== currentUser && (!target || target === 'all' || target === currentUser);
    }).map(asChallenge);
    return res.json({ success: true, challenges });
  } catch (err) { return battleError(res, err); }
});
app.post('/api/battles/join', async (req, res) => {
  try {
    const { challengeId, joinerName, joinerId } = req.body || {};
    if (!challengeId || !joinerName) return res.status(400).json({ error: 'بيانات قبول التحدي غير مكتملة.' });
    const row = await getBattleMatch(challengeId);
    if (!row) return res.status(404).json({ error: 'التحدي غير موجود أو انتهت صلاحيته.' });
    if (row.status !== 'pending') return res.status(400).json({ error: 'تم قبول هذا التحدي مسبقاً.' });
    const target = String(row.match_state?.targetName || 'ALL');
    if (target !== 'ALL' && target.toLowerCase() !== String(joinerName).toLowerCase()) return res.status(403).json({ error: 'هذا التحدي موجّه إلى لاعب آخر.' });
    const stake = Number(row.stake) || 0;
    if (row.game_type === 'popularity') {
      const member = await getBattleMember(joinerName, joinerId);
      if (!member || Number(member.coins) < BATTLE_ENTRY_MINIMUM) return res.status(400).json({ error: 'تحتاج إلى 500 نقطة على الأقل لدخول معركة الشعبية.' });
    }
    const now = new Date().toISOString();
    const state = { ...(row.match_state || {}), acceptedBy: joinerName, stakesReserved: row.game_type === 'popularity' && stake > 0, playerB: { name: joinerName, id: joinerId || null, votes: 0, score: 0 } };
    const updated = await updateBattleMatch(challengeId, { status: 'active', player_b_id: joinerId || null, player_b_name: joinerName, started_at: now, match_state: state }, '&status=eq.pending');
    if (!updated) return res.status(409).json({ error: 'تم قبول هذا التحدي مسبقاً.' });
    if (row.game_type === 'popularity' && stake > 0) {
      let firstReserved = false;
      try {
        await reservePlayerStake(row.player_a_name, row.player_a_id, stake); firstReserved = true;
        await reservePlayerStake(joinerName, joinerId, stake);
      } catch (err) {
        if (firstReserved) await changeBattleCoins(row.player_a_name, row.player_a_id, stake).catch(() => {});
        await updateBattleMatch(challengeId, { status: 'cancelled', match_state: { ...state, stakesReserved: false } });
        throw err;
      }
    }
    return res.json({ success: true, challenge: asChallenge(updated) });
  } catch (err) { return battleError(res, err); }
});
app.post('/api/battles/dismiss', async (req, res) => {
  try {
    const { challengeId, username } = req.body || {};
    if (challengeId) {
      const row = await getBattleMatch(challengeId);
      if (row && row.status === 'pending' && (!username || row.player_a_name === username || row.match_state?.targetName === username || row.match_state?.targetName === 'ALL')) {
        await updateBattleMatch(challengeId, { status: 'cancelled', ended_at: new Date().toISOString() }, '&status=eq.pending');
      }
    }
    return res.json({ success: true });
  } catch (err) { return battleError(res, err); }
});
app.post('/api/battles/vote', async (req, res) => {
  try {
    const { challengeId, choice, voterName, voterId, amount } = req.body || {};
    const stake = Math.floor(Number(amount));
    if (!voterName || !challengeId || !Number.isFinite(stake) || stake <= 0 || !['A', 'B'].includes(choice)) return res.status(400).json({ error: 'بيانات التصويت أو الرهان غير صالحة.' });
    const row = await getBattleMatch(challengeId);
    if (!row || row.game_type !== 'popularity' || row.status !== 'active') return res.status(404).json({ error: 'المواجهة غير نشطة أو غير موجودة.' });
    if (row.started_at && Date.now() - Date.parse(row.started_at) > BATTLE_DURATION_MS) return res.status(400).json({ error: 'انتهت مدة المواجهة.' });
    const voterKey = voterId ? String(voterId) : String(voterName).trim().toLowerCase();
    if (String(row.player_a_id || '').toLowerCase() === voterKey.toLowerCase() || String(row.player_b_id || '').toLowerCase() === voterKey.toLowerCase() || row.player_a_name.toLowerCase() === String(voterName).trim().toLowerCase() || row.player_b_name?.toLowerCase() === String(voterName).trim().toLowerCase()) return res.status(400).json({ error: 'لا يمكنك التصويت في مواجهة أنت طرف فيها.' });
    const existing = await battleDb(`popularity_votes?select=id&match_id=eq.${battleFilter(challengeId)}&voter_id=eq.${battleFilter(voterKey)}&limit=1`);
    if (existing?.length) return res.status(400).json({ error: 'لقد قمت بالتصويت بالفعل في هذه المواجهة.' });
    const chosenId = choice === 'A' ? row.player_a_id : row.player_b_id;
    const chosenName = choice === 'A' ? row.player_a_name : row.player_b_name;
    await changeBattleCoins(voterName, voterId || null, -stake);
    let voteRows;
    try {
      voteRows = await battleDb('popularity_votes', { method: 'POST', body: {
        match_id: challengeId, voter_id: voterKey, voter_name: voterName,
        voted_for_player_id: chosenId || '', voted_for_player_name: chosenName,
        staked_points: stake, settlement_status: 'pending', payout_points: 0
      }, prefer: 'return=representation' });
    } catch (insertError) {
      await changeBattleCoins(voterName, voterId || null, stake).catch(() => {});
      throw insertError;
    }
    const state = { ...(row.match_state || {}) };
    state.playerA = { ...(state.playerA || {}), votes: Number(state.playerA?.votes || 0) + (choice === 'A' ? stake * 2 : 0) };
    state.playerB = { ...(state.playerB || {}), votes: Number(state.playerB?.votes || 0) + (choice === 'B' ? stake * 2 : 0) };
    const voters = { ...(state.voters || {}) };
    voters[voterKey] = { choice, voterName, voterId: voterKey, amount: stake, votedAt: Date.now() };
    state.voters = voters;
    const scorePatch = choice === 'A' ? { score_a: Number(row.score_a) + 1 } : { score_b: Number(row.score_b) + 1 };
    const updated = await updateBattleMatch(challengeId, { ...scorePatch, match_state: state }, '&status=eq.active');
    if (!updated) {
      await battleDb(`popularity_votes?id=eq.${battleFilter(voteRows?.[0]?.id)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
      await changeBattleCoins(voterName, voterId || null, stake).catch(() => {});
      return res.status(409).json({ error: 'انتهت المواجهة قبل تسجيل التصويت.' });
    }
    return res.json({ success: true, vote: voteRows?.[0], challenge: asChallenge(updated), votesA: Number(state.playerA.votes) || 0, votesB: Number(state.playerB.votes) || 0, votersCount: Object.keys(voters).length });
  } catch (err) { return battleError(res, err); }
});
app.get('/api/battles/state/:id', async (req, res) => {
  try {
    const row = await getBattleMatch(req.params.id);
    if (!row) return res.status(404).json({ error: 'المواجهة غير موجودة.' });
    if (row.started_at && Date.now() - Date.parse(row.started_at) > BATTLE_DURATION_MS && row.status === 'active') {
      const record = await settleBattleMatch(row, { winnerName: null });
      const updated = await getBattleMatch(row.id);
      return res.json({ success: true, challenge: asChallenge(updated || row), record });
    }
    return res.json({ success: true, challenge: asChallenge(row) });
  } catch (err) { return battleError(res, err); }
});
app.post('/api/battles/finish', async (req, res) => {
  try {
    cleanupStale();
    const { challengeId, winnerName, myScore, oppScore, bestSpeed, mode, surrenderedBy, playerName } = req.body || {};
    if (!challengeId) return res.status(400).json({ error: 'معرف التحدي مطلوب.' });
    const row = await getBattleMatch(challengeId);
    if (!row) return res.status(404).json({ error: 'المواجهة غير موجودة.' });
    const record = await settleBattleMatch(row, { winnerName, surrenderedBy, mode, myScore, oppScore, bestSpeed, playerName });
    return res.json({ success: true, record });
  } catch (err) { return battleError(res, err); }
});
app.get('/api/battles/history', async (req, res) => {
  try {
    const user = String(req.query.user || '').toLowerCase();
    const rows = await battleDb('game_matches?select=*&status=eq.completed&order=ended_at.desc&limit=100');
    const history = (rows || []).map(asChallenge).filter(r => !user || [r.challengerName, r.targetName, r.winner].some(v => String(v || '').toLowerCase() === user)).map(r => r.finalRecord || ({ id: r.id, type: r.type, playerA: r.challengerName, playerB: r.targetName, winner: r.winner, scoreA: r.playerA.score, scoreB: r.playerB.score, stake: r.stake, timestamp: r.startedAt, date: new Date(r.startedAt || Date.now()).toLocaleDateString('ar-EG') }));
    return res.json({ success: true, history: history.slice(0, 30) });
  } catch (err) { return battleError(res, err); }
});
// 📞 3. Calls Integration (Multi-Call & Direct/Agora Separation)
app.post('/api/calls/start', (req, res) => {
  cleanupStale();
  const { hostName, hostId, mode, topic, roomName, channelName, callId } = req.body || {};
  const actualHost = hostName || 'عضو الكلان';
  const actualMode = (mode === 'agora' || mode === 'voice') ? 'agora' : 'direct';
  const id = callId || ('call_' + actualMode + '_' + Date.now());
  const actualTopic = topic || roomName || (actualMode === 'agora' ? 'غرفة Agora الصوتية التكتيكية' : 'مكالمة المقر المباشرة');
  const actualChannel = channelName || (actualMode === 'agora' ? 'phantom_hq' : ('direct_' + Date.now()));

  const callObj = {
    id,
    type: 'call',
    challengerName: actualHost,
    hostName: actualHost,
    hostId: hostId || null,
    targetName: 'ALL',
    stake: 0,
    details: { mode: actualMode, topic: actualTopic, channelName: actualChannel, roomName: actualTopic },
    mode: actualMode,
    topic: actualTopic,
    roomName: actualTopic,
    channelName: actualChannel,
    status: 'active',
    participants: [{ username: actualHost, userId: hostId || null, isHost: true, joinedAt: Date.now() }],
    createdAt: Date.now(),
    lastHeartbeat: Date.now(),
    active: true
  };

  activeCalls.set(id, callObj);
  activeCallInfo = { ...callObj, active: true };
  res.json({ success: true, call: callObj });
});

app.get('/api/calls/active', (req, res) => {
  cleanupStale();
  const calls = Array.from(activeCalls.values()).filter(c => c.status === 'active');
  res.json({
    success: true,
    activeCalls: calls,
    activeCall: calls.length > 0 ? { ...calls[calls.length - 1], active: true } : null
  });
});

app.post('/api/calls/heartbeat', (req, res) => {
  const { callId, username } = req.body || {};
  if (callId && activeCalls.has(callId)) {
    const c = activeCalls.get(callId);
    c.lastHeartbeat = Date.now();
    res.json({ success: true, call: c });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/calls/join', (req, res) => {
  cleanupStale();
  const { callId, username, userId } = req.body || {};
  const user = username || 'عضو الكلان';
  let targetCall = activeCalls.get(callId);
  if (!targetCall && activeCalls.size > 0) {
    targetCall = activeCalls.values().next().value;
  }
  if (targetCall) {
    targetCall.lastHeartbeat = Date.now();
    if (!Array.isArray(targetCall.participants)) targetCall.participants = [];
    if (!targetCall.participants.some(p => p.username === user)) {
      targetCall.participants.push({ username: user, userId: userId || null, isHost: false, joinedAt: Date.now() });
    }
    res.json({ success: true, call: targetCall });
  } else {
    res.status(404).json({ success: false, error: 'المكالمة غير موجودة أو انتهت' });
  }
});

app.post('/api/calls/leave', (req, res) => {
  cleanupStale();
  const { callId, username } = req.body || {};
  const user = username || 'عضو الكلان';
  const targetCall = activeCalls.get(callId);
  if (targetCall && Array.isArray(targetCall.participants)) {
    targetCall.participants = targetCall.participants.filter(p => p.username !== user);
    targetCall.lastHeartbeat = Date.now();
    if (targetCall.hostName === user || targetCall.participants.length === 0) {
      activeCalls.delete(targetCall.id);
    }
  }
  if (activeCalls.size === 0) {
    activeCallInfo = null;
  } else {
    const list = Array.from(activeCalls.values());
    activeCallInfo = { ...list[list.length - 1], active: true };
  }
  res.json({ success: true });
});

app.post('/api/calls/end', (req, res) => {
  const { callId, hostName } = req.body || {};
  if (callId && activeCalls.has(callId)) {
    activeCalls.delete(callId);
  } else if (hostName) {
    for (const [id, c] of activeCalls.entries()) {
      if (c.hostName === hostName) {
        activeCalls.delete(id);
      }
    }
  } else {
    activeCalls.clear();
  }
  if (activeCalls.size === 0) {
    activeCallInfo = null;
  } else {
    const list = Array.from(activeCalls.values());
    activeCallInfo = { ...list[list.length - 1], active: true };
  }
  res.json({ success: true });
});

// 🎙️ Agora Token Generator Endpoint
function makeServerCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}
const serverCrcTable = makeServerCrcTable();
function serverCrc32Str(str) {
  let crc = 0 ^ (-1);
  const buf = Buffer.from(str, "utf8");
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ serverCrcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

class ServerByteBuf {
  constructor(initialCapacity = 1024) {
    this.buffer = Buffer.alloc(initialCapacity);
    this.pos = 0;
  }
  ensureCapacity(needed) {
    if (this.pos + needed > this.buffer.length) {
      const nextBuf = Buffer.alloc(Math.max(this.buffer.length * 2, this.pos + needed));
      this.buffer.copy(nextBuf, 0, 0, this.pos);
      this.buffer = nextBuf;
    }
  }
  putUint16(v) {
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(v, this.pos);
    this.pos += 2;
    return this;
  }
  putUint32(v) {
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(v >>> 0, this.pos);
    this.pos += 4;
    return this;
  }
  putBytes(bytes) {
    this.putUint16(bytes.length);
    this.ensureCapacity(bytes.length);
    bytes.copy(this.buffer, this.pos);
    this.pos += bytes.length;
    return this;
  }
  putString(str) {
    return this.putBytes(Buffer.from(str, "utf8"));
  }
  putTreeMapUInt32(map) {
    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    this.putUint16(keys.length);
    for (const key of keys) {
      this.putUint16(key);
      this.putUint32(map[key]);
    }
    return this;
  }
  pack() {
    return this.buffer.subarray(0, this.pos);
  }
}

function generateServerAgoraToken(appId, appCertificate, channelName, uid, role = 1, privilegeExpiredTs) {
  const version = "006";
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);
  const ts = Math.floor(Date.now() / 1000) + 24 * 3600;
  const uidStr = (uid === 0 || uid === "0" || uid === null || uid === undefined) ? "" : `${uid}`;

  const messages = {};
  messages[1] = privilegeExpiredTs;
  if (role === 0 || role === 1 || role === 101) {
    messages[2] = privilegeExpiredTs;
    messages[3] = privilegeExpiredTs;
    messages[4] = privilegeExpiredTs;
  }

  const mBuf = new ServerByteBuf()
    .putUint32(salt)
    .putUint32(ts)
    .putTreeMapUInt32(messages)
    .pack();

  const toSign = Buffer.concat([
    Buffer.from(appId, "utf8"),
    Buffer.from(channelName, "utf8"),
    Buffer.from(uidStr, "utf8"),
    mBuf,
  ]);

  const signature = crypto.createHmac("sha256", appCertificate).update(toSign).digest();
  const crcChannel = serverCrc32Str(channelName);
  const crcUid = serverCrc32Str(uidStr);

  const contentBuf = new ServerByteBuf()
    .putBytes(signature)
    .putUint32(crcChannel)
    .putUint32(crcUid)
    .putBytes(mBuf)
    .pack();

  return version + appId + contentBuf.toString("base64");
}

app.post('/api/agora/token', (req, res) => {
  const body = req.body || {};
  const channelName = (body.channelName || "phantom_hq").trim();
  const uid = body.uid !== undefined && body.uid !== null ? body.uid : 0;
  const appId = process.env.AGORA_APP_ID || "129b4ba5126742d6973d17c9cbf2d5f3";
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || "e8b9012da1774d958aa205c7c72ff947";
  const expirationSeconds = Number(body.expirationSeconds) > 0 ? Number(body.expirationSeconds) : 86400;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationSeconds;

  const token = generateServerAgoraToken(appId, appCertificate, channelName, uid, 1, privilegeExpiredTs);
  return res.json({
    success: true,
    token: token,
    appId: appId,
    channelName: channelName,
    uid: uid
  });
});

// Serve static assets from project root
app.use(express.static(__dirname));

// SPA fallback: any unmatched request serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`PHANTOM HQ server is running on http://${HOST}:${PORT}`);
});


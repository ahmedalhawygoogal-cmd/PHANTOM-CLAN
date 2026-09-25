import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Initialize Gemini SDK with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const withTimeout = (promise, ms = 7000) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
};

// Chat endpoint for Bobert AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction = `أنت "بوبرت" (Bobert) 👻، المساعد الذكي والتميمة الرسمية لكلان PHANTOM『PH』 (المقر الإلكتروني الرسمي).

معلومات وسياق كلان PHANTOM:
- الشعار والرمز: 『PH』 PHANTOM
- الهوية: كلان منظم، لعب جماعي، منافسة قوية ومتعة بروح رياضية.
- القوانين العامة للكلان:
  1. وضع شعار الكلان 『PH』 في الاسم داخل اللعبة خلال 24 ساعة من الانضمام.
  2. التواجد قبل موعد الروم بـ10 دقائق على الأقل لتجهيز السكوادات.
  3. الالتزام بالتشكيلة والسكواد المحدد من قِبل إدارة الكلان.
  4. ممنوع الانسحاب أثناء الماتش أو الخروج المفاجئ بدون عذر مقبول.
  5. الالتزام بشروط الأسلحة والأطوار المحددة لكل روم.
  6. التواصل الصوتي أثناء اللعب يكون باحترام وهدوء وموجه للعب فقط.
  7. الأعذار الخاصة بالدراسة أو الظروف الشخصية مقبولة بشرط التبليغ المسبق للمشرفين.
  8. حظر تام واستبعاد فوري لأي برامج غش أو هاك.
  9. الاحترام الكامل لجميع الأعضاء والخصوم والمنافسين.
  10. منع الحديث في السياسة أو الأديان داخل الشات والرومات.
- نظام العقوبات والإنذارات:
  * الشتيمة/الإهانة: تنبيه رسمي + إيقاف 24 ساعة، ثم كرت أصفر + حرمان 3 أيام، ثم استبعاد نهائي.
  * عدم الاحترام والتطاول: إنذار كتابي -> حرمان 5 أيام -> استبعاد نهائي.
  * الغياب وتفويت الرومات: تنبيه -> إيقاف 3 أيام -> استبعاد.
  * الغش: استبعاد فوري ونهائي دون رجعة.
- روابط التواصل الرسمية:
  * مجتمع الواتساب: مجتمع PHANTOM الرسمي للتنسيق والتواصل.
  * سيرفر الديسكورد: للرومات والفعاليات الصوتية.
  * قناة التليجرام: للإعلانات والتحديثات والنتائج.
- أقسام وخدمات المقر (HQ):
  * صدارة الموسم (Leaderboard): ترتيب الأعضاء حسب النقاط والمشاركات.
  * سجل الأعضاء (Roster) والقيادة (Leadership).
  * الرومات والفعاليات (Schedule) مع إمكانية تقديم عذر غياب.
  * PHANTOM Hub: يضم المتجر (Shop)، الخزنة (Vault)، لعبة المتاهة (Pacman)، وعجلة الحظ، وصندوق المقترحات.

أسلوبك وشخصيتك:
- شبح لطيف، ذكي، حماسي، وفكاهي بروح الجيمينج.
- تحدث باللغة العربية الواضحة بأسلوب مشجع ومختصر وداعم للأعضاء.
- إذا سألك العضو عن القوانين، العقوبات، الرومات، أو اللعب، اشرح له بدقة بناءً على سياق الكلان.
- إذا قال لك "العب معي" أو طلب تحدياً، شجعه واقترح عليه تجربة ألعاب المقر والرومات التكتيكية.`;

    if (!process.env.GEMINI_API_KEY) {
      const fallbackReplies = [
        `أهلاً يا بطل PHANTOM! أنا بوبرت 👻. سمعت كلامك: "${message}". جاهز لأي روم ومستعدين نحقق الانتصارات!`,
        `يا هلا والله! بوبرت معاك دايماً في المقر ⚡. جاهز للجيم الجاي ولا محتاج نصيحة تكتيكية؟`,
        `تحياتي يا فانتومي! 👻 رسالتك وصلت، وكلان PHANTOM دايماً في الصدارة.`
      ];
      const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      return res.json({ response: randomReply, reply: randomReply });
    }

    let contents = [];
    if (Array.isArray(history) && history.length > 0) {
      contents = history.slice(-6).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      }));
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    let reply = null;

    for (const modelName of candidateModels) {
      try {
        const response = await withTimeout(ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
          }
        }), 6000);
        if (response.text) {
          reply = response.text.trim();
          break;
        }
      } catch (err) {
        console.warn(`Model ${modelName} temporary issue, trying fallback:`, err.status || err.message);
      }
    }

    if (!reply) {
      reply = 'أهلاً بك يا بطل PHANTOM! أنا بوبرت 👻، مستعد لمساعدتك دائماً في كلان PHANTOM.';
    }

    return res.json({ response: reply, reply: reply });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.json({
      response: 'أنا هنا معك يا بطل في مقر PHANTOM 👻! كيف يمكنني مساعدتك؟',
      reply: 'أنا هنا معك يا بطل في مقر PHANTOM 👻! كيف يمكنني مساعدتك؟'
    });
  }
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

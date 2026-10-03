import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_INSTRUCTION = `أنت CODO، المساعد الذكي التكتيكي والتقني الرسمي لمنصة كلان PHANTOM.
طبيعتك وسماتك:
1. خبير في الألعاب التنافسية، تكتيكات الرومات، إدارة السكوادات، وقواعد الكلان.
2. أسلوبك حماسي، محترم، عسكري تكتيكي، وداعم لأعضاء الكلان.
3. تجيب باللغة العربية بأسلوب راقٍ ومنظم باستخدام نقاط وعناوين واضحة ورموز تعبيرية ملائمة.
4. لديك قدرة على تحليل المستندات والصور والبرمجة وحل المشكلات الفنية.
5. في حال سألك العضو عن قوانين الكلان، أكد على الالتزام بشعار 『PH』، والروح الرياضية، ومنع الغش، وطاعة القيادة.`;

Deno.serve(async (req: Request) => {
  // 1. معالجة طلبات CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Method not allowed. Use POST.",
        reply: "⚠️ طريقة الطلب غير مدعومة." 
      }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 2. قراءة مفتاح Groq حصراً من Secret الموجود في Supabase باسم GROQ_API_KEY
    const apiKey = Deno.env.get("GROQ_API_KEY");

    if (!apiKey) {
      console.error("[Groq Error] GROQ_API_KEY secret is missing in Supabase Secrets.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "لم يتم العثور على مفتاح GROQ_API_KEY في Supabase Secrets. يرجى إضافته في إعدادات Edge Functions.",
          reply: "⚠️ تنبيه: لم يتم العثور على مفتاح GROQ_API_KEY في إعدادات Supabase Secrets."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. قراءة البيانات القادمة من الواجهة
    const body = await req.json().catch(() => ({}));
    const message = (body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const attachedFile = body.attachedFile || null;

    if (!message && !attachedFile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "الرسالة أو الملف المرفق مطلوب.",
          reply: "⚠️ يرجى كتابة رسالة أو إرفاق ملف للبدء."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. فحص نوع الملف المرفق (صور أو مستندات نصية)
    const isImageAttachment = Boolean(
      attachedFile && (
        (attachedFile.type && attachedFile.type.startsWith("image/")) ||
        (attachedFile.mimeType && attachedFile.mimeType.startsWith("image/")) ||
        (typeof attachedFile.data === "string" && attachedFile.data.startsWith("data:image/"))
      )
    );

    // 5. بناء هيكل الرسائل المتوافق مع Groq Chat Completions API
    const messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = [
      { role: "system", content: SYSTEM_INSTRUCTION }
    ];

    // إضافة سجل المحادثة السابق (آخر 6 رسائل لسرعة الاستجابة وتوفير التوكنات)
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      const role = (h.role === "model" || h.role === "bot" || h.role === "assistant") ? "assistant" : "user";
      const text = typeof h.text === "string" ? h.text : (typeof h.content === "string" ? h.content : "");
      if (text) {
        messages.push({ role: role, content: text });
      }
    }

    // إعداد محتوى رسالة المستخدم الحالية
    let userPromptText = message;
    if (attachedFile && attachedFile.content && typeof attachedFile.content === "string") {
      userPromptText += `\n\n[محتوى الملف المرفق: ${attachedFile.name || 'ملف نصي'}]\n${attachedFile.content}`;
    }

    if (!userPromptText && !isImageAttachment) {
      userPromptText = "مرحبًا CODO.";
    }

    // 6. اختيار نماذج Groq النشطة والمتاحة حالياً على المنصة:
    // - للصور والنصوص: qwen/qwen3.8-27b (يدعم text + image مدعوم بالكامل على Groq)
    // - للنصوص والمحادثة الفائقة: openai/gpt-oss-120b و qwen/qwen3.8-27b و openai/gpt-oss-20b
    let candidateModels: string[];
    let userMessagePayload: { role: string; content: string | Array<Record<string, unknown>> };

    if (isImageAttachment && attachedFile.data) {
      let imageDataUrl = attachedFile.data as string;
      if (!imageDataUrl.startsWith("data:")) {
        const mime = attachedFile.type || attachedFile.mimeType || "image/jpeg";
        imageDataUrl = `data:${mime};base64,${imageDataUrl}`;
      }

      candidateModels = ["qwen/qwen3.8-27b"];
      userMessagePayload = {
        role: "user",
        content: [
          { type: "text", text: userPromptText || "يرجى فحص وتحليل هذه الصورة واستخراج التفاصيل منها بدقة." },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      };
    } else {
      candidateModels = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
      userMessagePayload = {
        role: "user",
        content: userPromptText
      };
    }

    messages.push(userMessagePayload);

    // 7. استدعاء Groq Chat Completions API
    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    let finalReply = "";
    let usedModel = "";
    let lastError: string | null = null;
    let lastStatusCode = 502;

    for (const model of candidateModels) {
      try {
        const groqRes = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (groqRes.ok) {
          const resData = await groqRes.json();
          const choice = resData.choices?.[0];
          const replyText = choice?.message?.content;
          if (replyText && typeof replyText === "string") {
            finalReply = replyText.trim();
            usedModel = model;
            break;
          }
        } else {
          lastStatusCode = groqRes.status;
          const errText = await groqRes.text().catch(() => "");
          console.error(`[Groq Error] Model ${model} returned status ${groqRes.status}:`, errText);

          if (groqRes.status === 401) {
            lastError = "مفتاح GROQ_API_KEY غير صالح أو منتهي الصلاحية.";
            break;
          } else if (groqRes.status === 429) {
            lastError = "تم تجاوز حد الاستخدام المتاح (Rate Limit) على منصة Groq.";
          } else if (groqRes.status === 404) {
            lastError = `النموذج ${model} غير متاح في الوقت الحالي.`;
          } else {
            lastError = `خطأ ${groqRes.status} من Groq: ${errText.slice(0, 150)}`;
          }
        }
      } catch (err: any) {
        console.error(`[Groq Network Error] Model ${model} request failed:`, err?.message || err);
        if (err.name === "TimeoutError" || err.message?.includes("Timeout")) {
          lastStatusCode = 504;
          lastError = "انتهت مهلة الاتصال بخوادم Groq دون رد.";
        } else {
          lastError = err?.message || "فشل الاتصال بشبكة Groq.";
        }
      }
    }

    if (!finalReply) {
      return new Response(
        JSON.stringify({
          success: false,
          error: lastError || "فشل استدعاء نماذج Groq.",
          reply: lastStatusCode === 401 
            ? "⚠️ تنبيه: مفتاح GROQ_API_KEY في Supabase Secrets غير صالح." 
            : "⚠️ تعذر الاتصال بنماذج Groq حالياً. يرجى المحاولة لاحقاً.",
          response: null,
          model: null
        }),
        {
          status: lastStatusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 8. إعادة الرد بالصيغة المعتمدة للواجهة
    return new Response(
      JSON.stringify({
        success: true,
        response: finalReply,
        reply: finalReply,
        model: usedModel,
        error: null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (globalErr: any) {
    console.error("[Groq Fatal Error] Critical error in GROQ_API_KEY Edge Function:", globalErr);
    return new Response(
      JSON.stringify({
        success: false,
        error: globalErr?.message || "Internal Edge Function Error",
        reply: "⚠️ حدث خطأ داخلي أثناء معالجة طلب CODO عبر Groq.",
        response: null,
        model: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
